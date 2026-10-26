/* Оновлювач пакета гри.
   Не залежить від Electron, тому його можна перевіряти звичайним Node.

   Як це працює:
   1. Читаємо маніфест (updates/game.json у репозиторії): {version, file, sha256, size, minShell}.
   2. Якщо версія новіша за ту, що вже є (завантажена раніше або вбудована в інсталятор),
      качаємо zip, звіряємо розмір і sha256, розпаковуємо в <dataDir>/game/<версія>.
   3. Якщо мережі немає або щось пішло не так — запускаємо найновішу з наявних версій.
*/
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const SEMVER = /^\d+\.\d+\.\d+$/;

function cmpVer(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function readVersionFile(dir) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(dir, 'version.json'), 'utf8')).version;
    return SEMVER.test(v) ? v : null;
  } catch {
    return null;
  }
}

function validateManifest(m) {
  if (!m || typeof m !== 'object') throw new Error('маніфест порожній');
  if (!SEMVER.test(m.version || '')) throw new Error('у маніфесті неправильна версія');
  if (!/^[\w.-]+\.zip$/.test(m.file || '')) throw new Error('у маніфесті неправильне ім’я файлу');
  if (!/^[0-9a-f]{64}$/.test(m.sha256 || '')) throw new Error('у маніфесті немає контрольної суми');
  if (!(Number.isInteger(m.size) && m.size > 0 && m.size < 2e9)) throw new Error('у маніфесті неправильний розмір');
  if (m.minShell != null && !SEMVER.test(m.minShell)) throw new Error('у маніфесті неправильна minShell');
  return m;
}

class GameUpdater {
  /**
   * @param {object} o
   * @param {string} o.dataDir      — коренева папка даних (%APPDATA%\HoduHeroyamNema)
   * @param {string} o.bundledDir   — гра, вбудована в інсталятор (resources/game)
   * @param {string} o.manifestUrl
   * @param {string} o.shellVersion — версія оболонки (.exe)
   * @param {Function} o.fetch      — fetch (у Electron — net.fetch)
   * @param {number} [o.timeoutMs]
   * @param {number} [o.keep]
   * @param {Function} [o.log]
   */
  constructor(o) {
    this.o = { timeoutMs: 8000, keep: 2, log: () => {}, ...o };
    this.gameRoot = path.join(o.dataDir, 'game');
  }

  /** Версії, які вже лежать на диску і пройшли перевірку. */
  installed() {
    let names = [];
    try {
      names = fs.readdirSync(this.gameRoot);
    } catch {
      return [];
    }
    return names
      .filter(n => SEMVER.test(n))
      .map(n => ({ version: n, dir: path.join(this.gameRoot, n), source: 'downloaded' }))
      .filter(e => fs.existsSync(path.join(e.dir, '.ok')) && fs.existsSync(path.join(e.dir, 'index.html')))
      .sort((a, b) => cmpVer(b.version, a.version));
  }

  bundled() {
    const dir = this.o.bundledDir;
    if (!dir || !fs.existsSync(path.join(dir, 'index.html'))) return null;
    return { version: readVersionFile(dir) || '0.0.0', dir, source: 'bundled' };
  }

  /** Найновіша доступна версія без мережі. */
  best() {
    const all = this.installed();
    const b = this.bundled();
    if (b) all.push(b);
    all.sort((x, y) => cmpVer(y.version, x.version));
    return all[0] || null;
  }

  async fetchManifest() {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.o.timeoutMs);
    try {
      const url = this.o.manifestUrl + (this.o.manifestUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
      const res = await this.o.fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('GitHub відповів ' + res.status);
      return validateManifest(await res.json());
    } finally {
      clearTimeout(t);
    }
  }

  async download(m, onProgress) {
    const url = new URL(m.file, this.o.manifestUrl).toString();
    await fsp.mkdir(this.gameRoot, { recursive: true });
    const tmp = path.join(this.gameRoot, `.download-${m.version}.zip`);
    const res = await this.o.fetch(url, { cache: 'no-store' });
    if (!res.ok || !res.body) throw new Error('не вдалося завантажити пакет: ' + res.status);
    const hash = crypto.createHash('sha256');
    const out = fs.createWriteStream(tmp);
    let got = 0;
    try {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        got += value.length;
        if (got > m.size) throw new Error('пакет більший, ніж заявлено');
        hash.update(value);
        if (!out.write(value)) await new Promise(r => out.once('drain', r));
        onProgress && onProgress(got / m.size);
      }
    } finally {
      await new Promise(r => out.end(r));
    }
    if (got !== m.size) throw new Error(`пакет пошкоджений (розмір ${got} замість ${m.size})`);
    if (hash.digest('hex') !== m.sha256) throw new Error('пакет пошкоджений (контрольна сума не збігається)');
    return tmp;
  }

  async extract(zipPath, version) {
    const target = path.join(this.gameRoot, version);
    const stage = path.join(this.gameRoot, `.stage-${version}`);
    await fsp.rm(stage, { recursive: true, force: true });
    await fsp.mkdir(stage, { recursive: true });
    const zip = new AdmZip(zipPath);
    for (const e of zip.getEntries()) {
      const name = e.entryName.replace(/\\/g, '/');
      const dest = path.resolve(stage, name);
      if (!dest.startsWith(stage + path.sep)) throw new Error('у пакеті небезпечний шлях: ' + name);
      if (e.isDirectory) {
        await fsp.mkdir(dest, { recursive: true });
      } else {
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        await fsp.writeFile(dest, e.getData());
      }
    }
    if (!fs.existsSync(path.join(stage, 'index.html'))) throw new Error('у пакеті немає index.html');
    await fsp.rm(target, { recursive: true, force: true });
    await fsp.rename(stage, target);
    await fsp.writeFile(path.join(target, '.ok'), new Date().toISOString());
    await fsp.rm(zipPath, { force: true });
  }

  async prune(keepVersion) {
    const list = this.installed();
    const keep = new Set([keepVersion, ...list.slice(0, this.o.keep).map(e => e.version)]);
    for (const e of list) if (!keep.has(e.version)) await fsp.rm(e.dir, { recursive: true, force: true });
    // прибрати недокачані/недорозпаковані залишки
    try {
      for (const n of await fsp.readdir(this.gameRoot))
        if (n.startsWith('.download-') || n.startsWith('.stage-'))
          await fsp.rm(path.join(this.gameRoot, n), { recursive: true, force: true });
    } catch {}
  }

  /**
   * Перевірити оновлення і повернути, що запускати.
   * @param {(s:{stage:string, progress?:number, version?:string})=>void} onStatus
   * @returns {Promise<{game: {version,dir,source}|null, result: string, manifest?: object, error?: string}>}
   */
  async run(onStatus = () => {}) {
    const log = this.o.log;
    let current = this.best();
    onStatus({ stage: 'checking', version: current && current.version });
    let m;
    try {
      m = await this.fetchManifest();
    } catch (e) {
      log('маніфест недоступний:', e.message);
      return { game: current, result: 'offline', error: e.message };
    }
    if (m.minShell && cmpVer(this.o.shellVersion, m.minShell) < 0) {
      log(`нова гра ${m.version} потребує оболонки ${m.minShell}, а в нас ${this.o.shellVersion}`);
      return { game: current, result: 'shell-too-old', manifest: m };
    }
    if (current && cmpVer(m.version, current.version) <= 0) {
      return { game: current, result: 'up-to-date', manifest: m };
    }
    try {
      onStatus({ stage: 'downloading', progress: 0, version: m.version });
      const zip = await this.download(m, p => onStatus({ stage: 'downloading', progress: p, version: m.version }));
      onStatus({ stage: 'installing', version: m.version });
      await this.extract(zip, m.version);
      await this.prune(m.version);
      current = this.best();
      return { game: current, result: 'updated', manifest: m };
    } catch (e) {
      log('оновлення не вдалося:', e.message);
      await this.prune(current && current.version).catch(() => {});
      return { game: this.best(), result: 'failed', manifest: m, error: e.message };
    }
  }
}

module.exports = { GameUpdater, cmpVer, validateManifest };

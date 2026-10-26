#!/usr/bin/env node
/* Випуск нової версії гри для лаунчера (без перезбирання .exe).
   Використання (з папки desktop):
     npm run game:release -- 1.0.1
     npm run game:release -- 1.0.1 --min-shell 0.2.0
   Що робить:
     1) записує версію в game/VERSION і збирає game/dist;
     2) пакує game/dist у updates/game-<версія>.zip;
     3) оновлює updates/game.json (версія, розмір, sha256);
     4) прибирає старі zip, лишаючи 3 останні.
   Після цього треба закомітити й запушити зміни — лаунчери друзів підхоплять їх при наступному запуску. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const AdmZip = require('adm-zip');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'game');
const DIST = path.join(GAME, 'dist');
const UPD = path.join(ROOT, 'updates');
const SEMVER = /^\d+\.\d+\.\d+$/;
const cmp = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

const args = process.argv.slice(2);
const version = args.find(a => SEMVER.test(a));
const msIdx = args.indexOf('--min-shell');
if (!version) {
  console.error('Вкажіть версію гри, наприклад: npm run game:release -- 1.0.1');
  process.exit(1);
}
let prev = null;
try { prev = JSON.parse(fs.readFileSync(path.join(UPD, 'game.json'), 'utf8')); } catch {}
if (prev && cmp(version, prev.version) <= 0) {
  console.error(`Версія ${version} не новіша за опубліковану ${prev.version}.`);
  process.exit(1);
}
const minShell = msIdx >= 0 ? args[msIdx + 1] : (prev && prev.minShell) || '0.1.0';
if (!SEMVER.test(minShell)) { console.error('Неправильна --min-shell'); process.exit(1); }

fs.writeFileSync(path.join(GAME, 'VERSION'), version + '\n');
execFileSync(process.execPath, [path.join(GAME, 'build.js')], { stdio: 'inherit' });

fs.mkdirSync(UPD, { recursive: true });
const zipName = `game-${version}.zip`;
const zip = new AdmZip();
const addDir = (dir, rel = '') => {
  for (const n of fs.readdirSync(dir)) {
    if (n === 'web.html') continue; // веб-збірка лаунчеру не потрібна
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) addDir(p, rel + n + '/');
    else zip.addFile(rel + n, fs.readFileSync(p));
  }
};
addDir(DIST);
const buf = zip.toBuffer();
fs.writeFileSync(path.join(UPD, zipName), buf);

const manifest = {
  version,
  file: zipName,
  size: buf.length,
  sha256: crypto.createHash('sha256').update(buf).digest('hex'),
  minShell,
  date: new Date().toISOString(),
};
fs.writeFileSync(path.join(UPD, 'game.json'), JSON.stringify(manifest, null, 2) + '\n');

const zips = fs.readdirSync(UPD).filter(n => /^game-\d+\.\d+\.\d+\.zip$/.test(n))
  .sort((a, b) => cmp(b.slice(5, -4), a.slice(5, -4)));
for (const old of zips.slice(3)) fs.rmSync(path.join(UPD, old));

console.log(`Готово: updates/${zipName} (${(buf.length / 1024).toFixed(0)} КБ), мінімальна версія програми ${minShell}.`);
console.log('Тепер закомітьте й запуште зміни (git add game updates && git commit && git push).');

// Тести оновлювача гри: локальний HTTP-сервер замість GitHub.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { GameUpdater, cmpVer } = require('../src/game-updater');

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hhn-'));
}
function makeBundled(version) {
  const d = tmpdir();
  fs.writeFileSync(path.join(d, 'index.html'), `<p>bundled ${version}</p>`);
  fs.writeFileSync(path.join(d, 'version.json'), JSON.stringify({ version }));
  return d;
}
function makeZip(version, extra = {}) {
  const z = new AdmZip();
  z.addFile('index.html', Buffer.from(`<p>game ${version}</p>`));
  z.addFile('version.json', Buffer.from(JSON.stringify({ version })));
  for (const [n, c] of Object.entries(extra)) z.addFile(n, Buffer.from(c));
  return z.toBuffer();
}
async function server(files) {
  const s = http.createServer((req, res) => {
    const name = req.url.split('?')[0].slice(1);
    if (!(name in files)) { res.statusCode = 404; return res.end(); }
    const body = typeof files[name] === 'string' ? Buffer.from(files[name]) : files[name];
    res.setHeader('content-length', body.length);
    res.end(body);
  });
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${s.address().port}/`, close: () => s.close() };
}
function manifestFor(version, buf, more = {}) {
  return JSON.stringify({
    version, file: `game-${version}.zip`, size: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'), minShell: '0.1.0', ...more,
  });
}
const mk = (o) => new GameUpdater({ shellVersion: '0.1.0', fetch, timeoutMs: 2000, ...o });

test('порівняння версій', () => {
  assert.equal(cmpVer('1.0.10', '1.0.9'), 1);
  assert.equal(cmpVer('1.0.0', '1.0.0'), 0);
  assert.equal(cmpVer('0.9.9', '1.0.0'), -1);
});

test('без інтернету запускається вбудована версія', async () => {
  const u = mk({ dataDir: tmpdir(), bundledDir: makeBundled('1.0.0'), manifestUrl: 'http://127.0.0.1:1/game.json' });
  const r = await u.run();
  assert.equal(r.result, 'offline');
  assert.equal(r.game.version, '1.0.0');
  assert.equal(r.game.source, 'bundled');
});

test('завантажує й розпаковує нову версію, а потім уже не качає вдруге', async () => {
  const buf = makeZip('1.0.1', { 'assets/cards/a.txt': 'card' });
  const s = await server({ 'game.json': manifestFor('1.0.1', buf), 'game-1.0.1.zip': buf });
  const dataDir = tmpdir();
  try {
    const stages = [];
    const u = mk({ dataDir, bundledDir: makeBundled('1.0.0'), manifestUrl: s.url + 'game.json' });
    const r = await u.run(st => stages.push(st.stage));
    assert.equal(r.result, 'updated');
    assert.equal(r.game.version, '1.0.1');
    assert.equal(r.game.source, 'downloaded');
    assert.ok(stages.includes('downloading') && stages.includes('installing'));
    assert.equal(fs.readFileSync(path.join(r.game.dir, 'assets/cards/a.txt'), 'utf8'), 'card');
    const r2 = await u.run();
    assert.equal(r2.result, 'up-to-date');
    assert.equal(r2.game.version, '1.0.1');
  } finally { s.close(); }
});

test('пошкоджений пакет відкидається, гра запускається з попередньої версії', async () => {
  const buf = makeZip('1.0.2');
  const bad = Buffer.from(buf); bad[bad.length - 5] ^= 0xff;
  const s = await server({ 'game.json': manifestFor('1.0.2', buf), 'game-1.0.2.zip': bad });
  try {
    const dataDir = tmpdir();
    const u = mk({ dataDir, bundledDir: makeBundled('1.0.0'), manifestUrl: s.url + 'game.json' });
    const r = await u.run();
    assert.equal(r.result, 'failed');
    assert.match(r.error, /контрольна сума/);
    assert.equal(r.game.version, '1.0.0');
    assert.deepEqual(fs.readdirSync(path.join(dataDir, 'game')), []); // жодних залишків
  } finally { s.close(); }
});

test('якщо гра потребує новішої програми — лишається поточна версія', async () => {
  const buf = makeZip('2.0.0');
  const s = await server({ 'game.json': manifestFor('2.0.0', buf, { minShell: '0.5.0' }), 'game-2.0.0.zip': buf });
  try {
    const u = mk({ dataDir: tmpdir(), bundledDir: makeBundled('1.0.0'), manifestUrl: s.url + 'game.json' });
    const r = await u.run();
    assert.equal(r.result, 'shell-too-old');
    assert.equal(r.game.version, '1.0.0');
  } finally { s.close(); }
});

test('пакет зі шкідливим шляхом (../) не розпаковується', async () => {
  const z = new AdmZip();
  z.addFile('index.html', Buffer.from('x'));
  z.addFile('evil.txt', Buffer.from('x'));
  z.getEntries()[1].entryName = '../../evil.txt';
  const buf = z.toBuffer();
  const s = await server({ 'game.json': manifestFor('1.1.0', buf), 'game-1.1.0.zip': buf });
  try {
    const dataDir = tmpdir();
    const u = mk({ dataDir, bundledDir: makeBundled('1.0.0'), manifestUrl: s.url + 'game.json' });
    const r = await u.run();
    assert.equal(r.result, 'failed');
    assert.equal(r.game.version, '1.0.0');
    assert.ok(!fs.existsSync(path.join(dataDir, 'evil.txt')));
  } finally { s.close(); }
});

test('зберігаються лише дві останні версії', async () => {
  const dataDir = tmpdir();
  for (const v of ['1.0.1', '1.0.2', '1.0.3']) {
    const buf = makeZip(v);
    const s = await server({ 'game.json': manifestFor(v, buf), [`game-${v}.zip`]: buf });
    try {
      const r = await mk({ dataDir, bundledDir: makeBundled('1.0.0'), manifestUrl: s.url + 'game.json' }).run();
      assert.equal(r.game.version, v);
    } finally { s.close(); }
  }
  assert.deepEqual(fs.readdirSync(path.join(dataDir, 'game')).sort(), ['1.0.2', '1.0.3']);
});

test('без мережі й без вбудованої гри — помилка, а не порожнє вікно', async () => {
  const r = await mk({ dataDir: tmpdir(), bundledDir: null, manifestUrl: 'http://127.0.0.1:1/game.json' }).run();
  assert.equal(r.game, null);
});

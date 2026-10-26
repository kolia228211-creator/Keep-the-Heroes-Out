// Наскрізний тест гри по мережі: два вікна гри (jsdom) + справжній мережевий модуль.
// Хост відкриває гру, друг підключається, обидва роблять хід — стан доходить в обидва боки.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { JSDOM, VirtualConsole } = require('jsdom');
const { Lan } = require('../src/lan');

const GAME = path.join(__dirname, '..', '..', 'game');
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, what, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (fn()) return; } catch {} await tick(); }
  throw new Error('не дочекалися: ' + what);
}

// Те саме, що робить preload + main.js, тільки без Electron (дані копіюються, як через IPC)
function bridge() {
  const listeners = new Set();
  const copy = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const lan = new Lan({ emit: ev => setTimeout(() => listeners.forEach(f => f(copy(ev))), 0) });
  const wrap = fn => async a => { try { return copy({ ok: true, ...(await fn(copy(a) || {})) }); } catch (e) { return { ok: false, error: e.message }; } };
  return {
    lan,
    net: {
      host: wrap(o => lan.host(o)),
      join: wrap(o => lan.join(o)),
      leave: wrap(async () => { await lan.leave(); return {}; }),
      set: data => wrap(d => ({ sent: lan.set(d) }))(data),
      seat: seat => wrap(() => { lan.seat(seat); return {}; })(),
      status: wrap(() => lan.status()),
      on: cb => { listeners.add(cb); return () => listeners.delete(cb); },
    },
  };
}

function openGame(html, name, extraLs = {}) {
  const b = bridge();
  const errors = [];
  const vc = new VirtualConsole().on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://game.local/' + name, virtualConsole: vc,
    beforeParse(w) {
      w.hhn = { platform: 'desktop', net: b.net };
      w.localStorage.setItem('hhn-name', name);
      w.localStorage.setItem('hhn2', JSON.stringify({ spd: 'i', tilt: false }));
      for (const [k, v] of Object.entries(extraLs)) w.localStorage.setItem(k, v);
    },
  });
  const w = dom.window;
  const g = { w, b, errors, ev: s => w.eval(s), doc: w.document };
  g.toasts = [];
  // відповідати на запитання гри автоматично, поки йде хід
  g.stop = (() => {
    const iv = setInterval(() => {
      try {
        const ui = w.eval('ui');
        if (ui.pick) {
          if (ui.pick.rooms && ui.pick.rooms.length) w.roomClick(ui.pick.rooms[0]);
          else if (ui.pick.cells) w.cellClick(ui.pick.cells[0].x, ui.pick.cells[0].y);
          return;
        }
        const t = w.document.querySelector('#toast');
        if (t && !t.hidden && g.toasts[g.toasts.length - 1] !== t.textContent) g.toasts.push(t.textContent);
        if (!ui.busy) return;
        const m = w.document.querySelector('#modal:not([hidden]) button.opt:not([disabled]), #modal:not([hidden]) button.optc:not([disabled]), #modal:not([hidden]) #okc');
        if (m) m.click();
      } catch {}
    }, 5);
    return () => clearInterval(iv);
  })();
  return g;
}

test('двоє гравців грають по мережі', async () => {
  execFileSync(process.execPath, [path.join(GAME, 'build.js')]);
  const html = fs.readFileSync(path.join(GAME, 'dist', 'index.html'), 'utf8');
  const port = 40000 + Math.floor(Math.random() * 20000);
  const H = openGame(html, 'Коля', { 'hhn-port': String(port) });
  const C = openGame(html, 'Аня', { 'hhn-last-host': '127.0.0.1:' + port });
  try {
    await tick(150);
    assert.match(H.doc.querySelector('.mbtns').textContent, /Гра по мережі/);

    // --- хост відкриває гру: сценарій 1, Щурник (гравець 1) і Дракон (гравець 2)
    H.ev("ui.cfg.sc=1;ui.cfg.np=2;ui.cfg.clans=['rat','dragon','imp','witch'];ui.cfg.mode='online';ui.scr='setup';render()");
    assert.ok(H.doc.querySelector('#lanname'), 'на екрані налаштувань є поле імені для мережі');
    H.ev('lanHost()');
    await waitFor(() => H.ev('lan.on') && H.doc.querySelector('#modal:not([hidden]) .lanbox'), 'вікно з адресою для друзів');
    assert.match(H.doc.querySelector('#modal').textContent, new RegExp(':' + port));
    H.doc.querySelectorAll('#modal button.opt')[0].click(); // хост грає за Щурника → стартове розміщення
    await waitFor(() => H.ev('S.ph') === 1 && !H.ev('ui.busy'), 'хост розставив стартових монстрів');

    // --- друг підключається
    C.ev('lanJoinModal()');
    assert.equal(C.doc.querySelector('#lanaddr').value, '127.0.0.1:' + port);
    C.ev('lanJoin()');
    await waitFor(() => C.ev('S') && C.doc.querySelector('#modal:not([hidden]) button.opt'), 'друг отримав гру і вибирає клан');
    assert.match(C.doc.querySelector('#modal h3').textContent, new RegExp('Ви підключилися до гри \\(127\\.0\\.0\\.1:' + port));
    C.doc.querySelectorAll('#modal button.opt')[1].click(); // Дракон
    assert.equal(C.ev('ui.seat'), 1);
    await waitFor(() => H.ev('lan.peers').length === 2 && H.ev('lan.peers').some(p => p.name === 'Аня' && p.seat === 1), 'хост бачить Аню за Драконом');
    assert.match(H.doc.querySelector('.lanbadge').textContent, /2/);
    H.ev('lanInfo()');
    assert.match(H.doc.querySelector('#lanpeers').textContent, /Аня.*Дракон/s);
    assert.match(H.doc.querySelector('#modal').textContent, /Коля.*хост/s);
    H.ev('closeModal()');
    assert.ok(H.toasts.some(t => /Аня/.test(t)), 'хост отримав сповіщення про підключення');

    // --- першим ходить Дракон (найменший клан) — тобто Аня
    assert.equal(C.ev('S.cur'), 1);
    assert.ok(!H.ev('canAct()'), 'хост не може ходити за Аню');
    const v0 = H.ev('S.v');
    C.ev('run(()=>endTurn())');
    await waitFor(() => !C.ev('ui.busy') && C.ev('S.cur') === 0, 'Аня завершила хід');
    await waitFor(() => H.ev('S.v') > v0 && H.ev('S.cur') === 0, 'хід Ані дійшов до хоста');
    assert.equal(H.ev('S.log.length'), C.ev('S.log.length'));
    assert.equal(H.ev('JSON.stringify(S.rm)'), C.ev('JSON.stringify(S.rm)'));

    // --- хід хоста доходить до Ані
    H.ev('run(()=>endTurn())');
    await waitFor(() => !H.ev('ui.busy') && H.ev('S.cur') === 1, 'хост завершив хід');
    await waitFor(() => C.ev('S.cur') === 1 && C.ev('S.v') === H.ev('S.v'), 'хід хоста дійшов до Ані');
    assert.equal(C.ev('JSON.stringify(S.g)'), H.ev('JSON.stringify(S.g)'));

    // --- хост може зберегти мережеву партію
    assert.ok(!H.doc.querySelector('#top button[title="Зберегти гру"]').disabled);
    assert.ok(C.doc.querySelector('#top button[title="Зберегти гру"]').disabled);

    // --- хост закриває гру для мережі — Аня бачить пояснення й може грати далі сама
    H.ev('lanLeave()'); H.ev('lanLeave()');
    await waitFor(() => /Гру по мережі завершено/.test(C.doc.querySelector('#modal').textContent), 'Аня отримала повідомлення');
    assert.equal(C.ev('DOC'), null);
    assert.ok(H.ev('S') && !H.ev('lan.on'), 'партія лишилась у хоста');

    assert.deepEqual([...H.errors, ...C.errors], []);
  } finally {
    H.stop(); C.stop();
    await H.b.lan.leave(); await C.b.lan.leave();
    H.w.close(); C.w.close();
  }
});

test('на сайті (без програми) мережевого меню немає, онлайн-кімнати як раніше', async () => {
  execFileSync(process.execPath, [path.join(GAME, 'build.js'), '--web']);
  const html = fs.readFileSync(path.join(GAME, 'dist', 'web.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://web.local/' });
  await tick(100);
  const w = dom.window;
  assert.match(w.document.querySelector('.mbtns').textContent, /Грати онлайн з друзями/);
  w.eval("ui.cfg.mode='online';ui.scr='setup';render()");
  assert.ok(w.document.querySelector('#code'), 'на сайті — поле коду кімнати');
  assert.ok(!w.document.querySelector('#lanname'));
  w.close();
});

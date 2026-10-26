// Тести мережевого модуля: справжній сервер і клієнти на 127.0.0.1.
const test = require('node:test');
const assert = require('node:assert');
const { Lan, parseAddr, addresses } = require('../src/lan');

const tick = (ms = 60) => new Promise(r => setTimeout(r, ms));
function node(name) {
  const events = [];
  const lan = new Lan({ emit: e => events.push(e) });
  lan.events = events;
  lan.last = t => [...events].reverse().find(e => e.t === t);
  lan.nm = name;
  return lan;
}
async function waitFor(fn, ms = 2000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return; await tick(20); }
  throw new Error('не дочекалися');
}

test('розбір адреси', () => {
  assert.deepEqual(parseAddr('26.1.2.3:5000'), { host: '26.1.2.3', port: 5000 });
  assert.deepEqual(parseAddr(' 26.1.2.3 '), { host: '26.1.2.3', port: 47777 });
  assert.throws(() => parseAddr('26.1.2.3:99999'));
  assert.throws(() => parseAddr('бла бла'));
  assert.ok(Array.isArray(addresses()));
});

test('хост і два гравці: стан гри розходиться всім, крім автора', async () => {
  const h = node('Хост'), a = node('Аня'), b = node('Богдан');
  try {
    const st = await h.host({ port: 0, name: 'Хост', gv: '1.1.0' });
    const addr = '127.0.0.1:' + st.port;
    h.set({ s: 'S1', v: 1, by: 'h' });
    await a.join({ addr, name: 'Аня', gv: '1.1.0' });
    assert.equal(a.last('doc').data.s, 'S1'); // новий гравець одразу отримує поточну гру
    await b.join({ addr, name: 'Богдан', gv: '1.1.0' });
    await waitFor(() => h.status().peers.length === 3);

    a.set({ s: 'S2', v: 2, by: 'a' });
    await waitFor(() => h.last('doc') && h.last('doc').data.s === 'S2' && b.last('doc').data.s === 'S2');
    assert.equal(a.events.filter(e => e.t === 'doc').length, 1); // автор не отримує свій хід назад

    b.seat(1);
    await waitFor(() => h.status().peers.some(p => p.name === 'Богдан' && p.seat === 1));
    const aPeers = a.last('peers').list;
    assert.ok(aPeers.find(p => p.me && p.name === 'Аня'));
    assert.ok(aPeers.find(p => p.host && p.name === 'Хост'));
  } finally {
    await a.leave(); await b.leave(); await h.leave();
  }
});

test('різні версії гри — зрозуміла відмова', async () => {
  const h = node(), a = node();
  try {
    const st = await h.host({ port: 0, name: 'Х', gv: '1.1.0' });
    await assert.rejects(a.join({ addr: '127.0.0.1:' + st.port, name: 'А', gv: '1.0.0' }), /Різні версії гри/);
    assert.equal(a.mode, null);
  } finally { await a.leave(); await h.leave(); }
});

test('ніхто не відкрив гру — зрозуміла помилка', async () => {
  const a = node();
  await assert.rejects(a.join({ addr: '127.0.0.1:1', name: 'А', gv: '1.1.0' }), /ніхто не відкрив гру/);
  assert.equal(a.mode, null);
});

test('зайнятий порт — зрозуміла помилка', async () => {
  const h1 = node(), h2 = node();
  try {
    const st = await h1.host({ port: 0, name: 'Х', gv: '1' });
    await assert.rejects(h2.host({ port: st.port, name: 'Х2', gv: '1' }), /уже зайнятий/);
  } finally { await h1.leave(); await h2.leave(); }
});

test('хост закрив гру — гравці отримують повідомлення', async () => {
  const h = node(), a = node();
  const st = await h.host({ port: 0, name: 'Х', gv: '1' });
  await a.join({ addr: '127.0.0.1:' + st.port, name: 'А', gv: '1' });
  await h.leave();
  await waitFor(() => a.last('closed'));
  assert.match(a.last('closed').reason, /Хост завершив/);
  await waitFor(() => a.mode === null);
});

test('обрив зв’язку — гравець сам перепідключається й отримує свіжу гру', async () => {
  const h = node(), a = node();
  try {
    const st = await h.host({ port: 0, name: 'Х', gv: '1' });
    await a.join({ addr: '127.0.0.1:' + st.port, name: 'А', gv: '1' });
    a.seat(2);
    for (const c of h.wss.clients) c.terminate(); // імітуємо обрив
    await waitFor(() => a.last('lost'));
    h.set({ s: 'після обриву', v: 9, by: 'h' });
    await waitFor(() => a.last('restored'), 5000);
    assert.equal(a.last('doc').data.s, 'після обриву');
    await waitFor(() => h.status().peers.some(p => p.name === 'А' && p.seat === 2)); // місце збереглось
  } finally { await a.leave(); await h.leave(); }
});

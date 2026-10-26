// Димовий тест гри: збирає game/dist/index.html, відкриває в jsdom
// і грає кожен сценарій випадковими ходами. Ловить помилки JS після правок у game/src.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const GAME = path.join(__dirname, '..', '..', 'game');

test('гра збирається, відмальовується і доходить до кінця в усіх сценаріях', async () => {
  execFileSync(process.execPath, [path.join(GAME, 'build.js')]);
  const html = fs.readFileSync(path.join(GAME, 'dist', 'index.html'), 'utf8');
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://game.local/',
    virtualConsole: new (require('jsdom').VirtualConsole)().on('jsdomError', e => errors.push(e.message)),
  });
  const w = dom.window;
  const ev = s => w.eval(s);
  await new Promise(r => setTimeout(r, 200));
  assert.ok(w.document.querySelector('.menu h1'), 'головне меню не відмалювалось');

  const pickOne = a => a[Math.floor(Math.random() * a.length)];
  const drive = gen => {
    let x, steps = 0;
    for (;;) {
      const { value: q, done } = gen.next(x);
      if (done) return q;
      if (++steps > 20000) throw new Error('забагато кроків');
      x = undefined;
      if (q.t === 'ask') { const ok = q.opts.filter(o => !o.d); x = ok.length ? pickOne(ok).v : (q.cancel ? null : q.opts[0].v); }
      else if (q.t === 'room') x = pickOne(q.rooms);
      else if (q.t === 'cell') x = pickOne(q.cells);
    }
  };

  const SCEN = ev('SCEN'), CLANS = ev('CLANS');
  for (const sc of SCEN) {
    try {
      const free = Object.keys(CLANS).filter(c => !(sc.ban || []).includes(c)).sort(() => Math.random() - 0.5);
      ev('newGame')({ sc: sc.id, df: pickOne(['e', 'n', 'h']), clans: free.slice(0, 1 + Math.floor(Math.random() * 4)) });
      drive(ev('setupPlace')());
      for (let turn = 0; !ev('S').over && turn < 80; turn++) {
        const S = ev('S');
        for (let g = 0; S.pl[S.cur].hand.length && Math.random() < 0.85 && g < 8; g++) {
          if (drive(ev('playCard')(Math.floor(Math.random() * S.pl[S.cur].hand.length))) === false) break;
          for (let k = 0; ev('S').pend.length && k < 30; k++) drive(ev('usePend')(0)) || ev('S').pend.shift();
        }
        if (Math.random() < 0.3) drive(ev('dungeonRisk')());
        drive(ev('endTurn')());
        if (turn === 1) {
          ev("ui.scr='game'");
          ev('render()');
          assert.ok(w.document.querySelector('#board .room'), `поле не відмалювалось у сценарії ${sc.id}`);
        }
      }
      assert.ok(ev('S').over, `сценарій ${sc.id} не завершився`);
    } catch (e) {
      errors.push(`сценарій ${sc.id}: ${e.message}`);
    }
  }
  ev('startTutorial()');
  ev('rulesModal()');
  assert.ok(w.document.querySelector('.rules'), 'вікно правил не відкрилось');
  assert.deepEqual(errors, []);
  w.close();
});

#!/usr/bin/env node
/* Збирає гру з game/src в один HTML-файл.
   node game/build.js            → game/dist/index.html (для десктопу, повний документ)
   node game/build.js --web      → game/dist/web.html   (для веб-артефакту claude.ai, як раніше build.py)
*/
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const JS_ORDER = ['data.js', 'scen.js', 'engine.js', 'art.js', 'ui.js', 'tut.js'];

const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');
const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();

const css = read('style.css');
const js = JS_ORDER.map(read).join('\n');
const boot = `
document.body.insertAdjacentHTML('afterbegin',ICONS);
addEventListener('scroll',()=>{if(scrollY||scrollX)scrollTo(0,0)});document.addEventListener('scroll',e=>{const t=e.target;if(t===document||t===document.documentElement||t===document.body||t.id==='app'||t.id==='game'){if(t.scrollTop)t.scrollTop=0}},true);
addEventListener('resize',()=>{if(ui.scr==='game'&&S)render()});
render();saveInit();
`;
const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Russo+One&family=Alegreya+Sans:wght@400;500;700;800&family=PT+Mono&display=swap">`;
const body = `<div id="app"></div>
<div id="fx"></div>
<div id="modal" hidden></div>
<div id="toast" hidden></div>
<script>
const GAME_VERSION=${JSON.stringify(version)};
${js}
${boot}
</script>`;

function web() {
  return `<title>Ходу героям нема!</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fonts}
<style>
${css}
</style>
${body}
`;
}

function desktop() {
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ходу героям нема!</title>
${fonts}
<style>
${css}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

fs.mkdirSync(DIST, { recursive: true });
const isWeb = process.argv.includes('--web');
const out = path.join(DIST, isWeb ? 'web.html' : 'index.html');
const html = isWeb ? web() : desktop();
fs.writeFileSync(out, html, 'utf8');
if (!isWeb) fs.writeFileSync(path.join(DIST, 'version.json'), JSON.stringify({ version }) + '\n');
console.log(`${path.relative(process.cwd(), out)} — ${html.length} символів, версія гри ${version}`);

/* ===================== ЩО НОВОГО =====================
 Нова версія гри зверху. При випуску (npm run game:release) додавайте сюди запис із тим самим номером.
 Після оновлення гра один раз показує вікно «Що нового»; також його можна відкрити з меню. */
const CHANGES=[
{v:'1.2.1',d:'27.10.2026',items:['Після оновлення гра показує це вікно, а в меню видно номер версії.']},
{v:'1.2.0',d:'27.10.2026',items:['Справжні карти з оригінальної гри: колоди всіх 9 кланів, герої Гільдії, предмети ринку (тепер по 8 кожного типу).','Клани стартують у кімнатах і з кількістю монстрів, як на їхніх картах (наприклад, 4 Щурники в кімнатах із капелюхом).','Герої Гільдії з’являються лише в кімнатах із мечами, капелюхом, оком або кістками.','Сценарій 2: у колоді 4 карти Ката.']},
{v:'1.1.0',d:'26.10.2026',items:['Гра по мережі з друзями: «Відкрити гру для мережі» і «Підключитися до гри друга» (через Radmin VPN).']},
{v:'1.0.0',d:'26.10.2026',items:['Перша версія гри в програмі для Windows.']}
];
const cmpV=(a,b)=>{const x=String(a).split('.').map(Number),y=String(b).split('.').map(Number);for(let i=0;i<3;i++){const d=(x[i]||0)-(y[i]||0);if(d)return d}return 0};
const VER={shell:null};
window.whatsNew=since=>{const list=CHANGES.filter(c=>since?cmpV(c.v,since)>0&&cmpV(c.v,GAME_VERSION)<=0:true).slice(0,since?99:4);if(!list.length)return;
 modal(`<h3>${since?`Гру оновлено до версії ${esc(GAME_VERSION)}`:'Що нового'}</h3><div class="news">${list.map(c=>`<div class="newsv"><b>Версія ${esc(c.v)}</b> <small class="mu">${esc(c.d)}</small><ul>${c.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div><div class="row end"><button class="primary" onclick="closeModal()">Добре</button></div>`,'wide')};
function verLine(){return `<p class="fine ver">Гра ${esc(GAME_VERSION)}${VER.shell?` · програма ${esc(VER.shell)}`:''} · <button class="linkbtn" onclick="whatsNew()">що нового</button></p>`}
async function whatsNewInit(){let seen='';try{seen=localStorage.getItem('hhn-seen-ver')||''}catch(e){}
 let updated=false;
 if(window.hhn&&window.hhn.info){try{const i=await window.hhn.info();VER.shell=i.shellVersion||null;updated=!!(i.game&&i.game.result==='updated')}catch(e){}}
 try{localStorage.setItem('hhn-seen-ver',GAME_VERSION)}catch(e){}
 if(ui.scr==='menu')render();
 // перше оновлення після появи цього вікна: показуємо й попередню версію, бо про неї теж ще не розповідали
 const prev=seen||(updated?(CHANGES[2]&&CHANGES[2].v)||'0.0.0':'');
 if(prev&&cmpV(GAME_VERSION,prev)>0&&ui.scr==='menu'&&$('#modal').hidden)whatsNew(prev)}

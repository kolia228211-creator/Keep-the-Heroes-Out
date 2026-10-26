/* ===================== ІНТЕРФЕЙС ===================== */
const $=s=>document.querySelector(s);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const TAB=Math.random().toString(36).slice(2,10);
const ui={scr:'menu',busy:false,pick:null,skip:false,tab:null,tilt:true,spd:'n',seat:null,sel:[],cfg:{sc:1,df:'e',np:2,clans:['rat','dragon','imp','witch'],mode:'local',code:''},evR:null,modalRes:null,tutStep:0};
const SPD={s:1100,n:650,f:280,i:0};
try{const p=JSON.parse(localStorage.getItem('hhn2')||'{}');if(p.spd)ui.spd=p.spd;if(p.tilt!=null)ui.tilt=p.tilt}catch(e){}
const saveUi=()=>{try{localStorage.setItem('hhn2',JSON.stringify({spd:ui.spd,tilt:ui.tilt}))}catch(e){}};
let REC=null,DOC=null,UNSUB=null,WQ=Promise.resolve();

/* ---------- драйвер генераторів ---------- */
async function run(genFn){if(ui.busy)return;ui.busy=true;REC=[];render();let v;
 try{const g=genFn();let x;for(;;){const {value,done}=g.next(x);if(done){v=value;break}x=await handle(value)}}
 catch(e){console.error(e);toast('Помилка гри: '+e.message)}
 finally{ui.busy=false;ui.skip=false;ui.pick=null;ui.evR=null;closeModal();const fr=REC;REC=null;commit(fr);render();tutAfter()}
 return v}
async function handle(q){
 if(q.t==='frame'){ui.evR=q.r;if(REC)REC.push({rm:clone(S.rm),n:S.log.length,r:q.r,lg:S.lastG});render();await tutPause();const d=ui.skip?0:SPD[ui.spd];if(d)await sleep(d);return}
 if(q.t==='ask')return await askModal(q);
 if(q.t==='room')return await pickRoom(q);
 if(q.t==='cell')return await pickCell(q);
 if(q.t==='show')return await showCards(q);}
function pickRoom(q){return new Promise(res=>{ui.pick={rooms:q.rooms,msg:q.msg,cancel:q.cancel,res};if(innerWidth<900)ui.tab=null;render()})}
function pickCell(q){return new Promise(res=>{ui.pick={cells:q.cells,msg:q.msg,cancel:true,res,rooms:[]};render()})}
function resolvePick(v){if(!ui.pick)return;const r=ui.pick.res;ui.pick=null;render();r(v)}
window.roomClick=i=>{if(ui.pick){if(ui.pick.rooms.includes(i)){if(!tutAllow('room',S.rm[i].k))return;resolvePick(i)}return}if(!ui.busy)roomInfo(i)};
window.cellClick=(x,y)=>{if(ui.pick&&ui.pick.cells)resolvePick({x,y})};

/* ---------- модальні вікна ---------- */
function modal(html,cls=''){const m=$('#modal');m.innerHTML=`<div class="dlg ${cls}" role="dialog">${html}</div>`;m.hidden=false;return m}
function closeModal(){const m=$('#modal');if(m){m.hidden=true;m.innerHTML=''}}
window.closeModal=closeModal;
function askModal(q){return new Promise(res=>{ui.modalRes=v=>{ui.modalRes=null;closeModal();res(v)};
 const hasCards=q.opts.some(o=>o.card);
 const body=q.opts.map((o,i)=>{const dis=o.d?'disabled':'';const tutHi=tutMark('opt',o.v)?'tut-hi':'';
  if(o.card&&o.l&&o.l.o)return `<button class="optc ${tutHi}" ${dis} data-i="${i}">${cardHTML(o.l)}</button>`;
  if(o.card&&Array.isArray(o.l))return `<button class="opt optrow ${tutHi}" ${dis} data-i="${i}">${optHTML(o.l)}<small>${esc(o.l.map(tokText).join(' + '))}</small></button>`;
  return `<button class="opt ${tutHi}" ${dis} data-i="${i}">${o.ic?ic(o.ic):''}<span>${esc(o.l)}</span></button>`}).join('');
 modal(`<h3>${esc(q.msg)}</h3><div class="opts ${hasCards?'cards':''}">${body}</div>${q.cancel?'<div class="row end"><button class="ghost" data-c="1">Скасувати</button></div>':''}`);
 $('#modal').onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.c){if(!tutAllow('cancel'))return;ui.modalRes&&ui.modalRes(null);return}if(b.dataset.i!=null){const o=q.opts[+b.dataset.i];if(!tutAllow('opt',o.v))return;ui.modalRes&&ui.modalRes(o.v)}}})}
function showCards(q){return new Promise(res=>{modal(`<h3>${esc(q.title)}</h3><div class="opts cards">${q.cards.map(c=>`<div class="optc ${q.take.includes(c.n)?'take':'drop'}">${cardHTML(c)}<small>${q.take.includes(c.n)?'у руку':'у скид'}</small></div>`).join('')}</div><div class="row end"><button class="primary" id="okc">Добре</button></div>`);$('#okc').onclick=()=>{closeModal();res()}})}
let TT;function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(TT);TT=setTimeout(()=>e.hidden=true,3800)}

/* ---------- карти ---------- */
function tokHTML(t){
 if(typeof t==='string'){if(t[0]==='-')return `<span class="tk neg" title="Скинути ${RESN[t.slice(1)]}">−${ic(t.slice(1))}</span>`;if(t==='sum1')return `<span class="tk" title="Виклик монстра в ту саму кімнату">${ic('sum1')}</span>`;return `<span class="tk" title="${ACTN[t]||t}">${ic(t)}</span>`}
 if(t.sw)return `<span class="tk sw" title="Зграя: усі ваші монстри в одній кімнаті — ${ACTN[t.sw]}">${ic('sw')}${ic(t.sw)}</span>`;
 if(t.amb)return `<span class="tk amb" title="Засідка: до ${t.amb[0]} монстрів у кімнати «${TYPES[t.amb[1]]}»">${ic('amb')}<b>${t.amb[0]}</b>${ti(t.amb[1])}</span>`;
 if(t.nv)return `<span class="tk nv" title="Навала: якщо вдалося ліве, праве безкоштовно">${tokHTML(t.nv[0])}${ic('nv')}${typeof t.nv[1]==='object'?`<span class="tk">${ic('sum1')}<b>${t.nv[1].sum}</b></span>`:tokHTML(t.nv[1])}</span>`;
 if(t.rf)return `<span class="tk rf" title="Зміцнення: перегляньте 3 карти, візьміть ті, що мають ${ACTN[t.rf]}">${ic('rf')}${ic(t.rf)}</span>`;
 if(t.sum)return `<span class="tk">${ic('sum1')}<b>${t.sum}</b></span>`;return ''}
function tokText(t){if(typeof t==='string'){if(t[0]==='-')return 'скинути '+RESA[t.slice(1)];return ACTN[t]||t}if(t.sw)return 'Зграя ('+ACTN[t.sw].toLowerCase()+')';if(t.amb)return 'Засідка: до '+t.amb[0]+' у «'+TYPES[t.amb[1]]+'»';if(t.nv)return 'Навала: '+tokText(t.nv[0]).toLowerCase()+' ⇒ '+(typeof t.nv[1]==='object'?'виклик '+t.nv[1].sum:tokText(t.nv[1]).toLowerCase());if(t.rf)return 'Зміцнення ('+ACTN[t.rf].toLowerCase()+')';if(t.sum)return 'виклик '+t.sum;return ''}
const optHTML=o=>`<span class="optacts">${o.map(tokHTML).join('')}</span>`;
function cardHTML(c,extra=''){const it=c.it&&c.it!=='tac';const cl=c.cl?CLANS[c.cl]:null;
 const col=it?{gear:'#b8402f',mon:'#d08a1a',pot:'#3c9a4a',scroll:'#5a4fb8'}[c.it]:cl?cl.col:'#777';
 const art=it?`<svg class="cart" viewBox="0 0 24 24"><use href="#i-${{gear:'mel',mon:'amb',pot:'card',scroll:'rf'}[c.it]}"/></svg>`:cl?figSVG(CLANFIG[c.cl],'#0006'):'';
 return `<div class="card ${it?'item':'tac'} ${extra}" style="--cc:${col}"><div class="cn">${esc(c.n)}</div><div class="cbody">${art}<span class="ctype">${it?ITYPE[c.it]:(c.it==='tac'?'Лабораторія · ':'')+(cl?cl.n:'')}</span></div><div class="cacts">${c.o.map(optHTML).join('<i class="slash">/</i>')}</div></div>`}
function gCardHTML(c,small){if(!c)return `<div class="gcard back ${small?'sm':''}"><span>Гільдія</span></div>`;
 if(c.k==='h'){const h={c:c.c,a:1,hp:1,ep:c.ep};return `<div class="gcard hero ${small?'sm':''}" style="--cc:${HRING[c.c]}"><div class="gtop">${c.ep?'Епічн. ':''}${HEROES[c.c].n}</div>${heroSVG(h)}<div class="gtype">${ti(c.t)}${c.t==='gem'?'':ti(c.t)}</div><small>${TYPES[c.t]}</small></div>`}
 return `<div class="gcard scen ${small?'sm':''}"><div class="gtop">${esc(c.n)}</div><div class="gnum">${c.sc}</div>${c.t?`<div class="gtype">${c.t.map(ti).join('')}</div>`:''}<small>Карта сценарію</small></div>`}

/* ---------- кімнати ---------- */
function bannerHTML(i){const o=S.rm[i],a=ROOMS[o.k].act||{};let h='';
 if(a.put)h=ic('act')+ic(a.put);else if(a.buy)h=ic('act')+ic(a.buy[0])+'<i class="arr">›</i>'+`<span class="ityp it-${a.buy[1]}">${ITYPE[a.buy[1]][0]}</span>`;else if(a.lab)h=ic('act')+ic('ev')+'<i class="arr">›</i>'+ic('card');else if(a.build)h=ic('act')+ic('coin')+'<i class="arr">›</i>'+ic('chest');else if(a.dun)h=ti('spec')+ic('ev')+'<i class="arr">›</i>'+ic('card')+'×3';
 return `<div class="banner ${o.xb?'blocked':''}" title="${roomActText(i)}">${h}${o.xb?`<span class="xb">${ic('x')}</span>`:''}</div>`}
function roomActText(i){const o=S.rm[i],a=ROOMS[o.k].act||{};if(a.put)return `Активація: покладіть ${RESA[a.put]} в цю кімнату`;if(a.buy)return `Активація: скиньте ${RESA[a.buy[0]]} з цієї кімнати й візьміть карту «${ITYPE[a.buy[1]]}» з ринку`;if(a.lab)return 'Активація: витягніть карту Гільдії (героя — до темниці) й візьміть карту тактики з ринку';if(a.build)return 'Активація: скиньте 1–3 монети й збудуйте нову кімнату';if(a.dun)return 'Раз за хід без монстра: витягніть карту Гільдії. Героя — до темниці, ви берете 3 карти';return ''}
function boardHTML(){const box0=$('#boardwrap');const flipXY=box0&&(()=>{const xs=S.rm.map(r=>r.x),ys=S.rm.map(r=>r.y);const c=Math.max(...xs)-Math.min(...xs)+1,r=Math.max(...ys)-Math.min(...ys)+1;const cs0=getComputedStyle(box0);const W=box0.clientWidth-parseFloat(cs0.paddingLeft)-parseFloat(cs0.paddingRight)-16,H=box0.clientHeight-parseFloat(cs0.paddingTop)-parseFloat(cs0.paddingBottom)-26;const t=(cc,rr)=>Math.min(W/(cc*1.1),H/(rr*1.1));return t(r,c)>t(c,r)*1.12})();ui.flipXY=flipXY;const X=o=>flipXY?o.y:o.x,Y=o=>flipXY?o.x:o.y;const xs=S.rm.map(X),ys=S.rm.map(Y);let minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys);
 if(ui.pick&&ui.pick.cells){ui.pick.cells.forEach(c=>{minX=Math.min(minX,X(c));minY=Math.min(minY,Y(c));maxX=Math.max(maxX,X(c));maxY=Math.max(maxY,Y(c))})}
 const cols=maxX-minX+1,rows=maxY-minY+1;const box=$('#boardwrap');const cs=getComputedStyle(box);const W=box.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-16,H=box.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)-16;
 const g=0.1,T=Math.max(40,Math.min(W/(cols+(cols-1)*g),(H-10)/(rows+(rows-1)*g),230));const G=T*g;
 const pos=(x,y)=>({l:(x-minX)*(T+G),t:(y-minY)*(T+G)});const P2=o=>pos(X(o),Y(o));
 const RM=ui.view?ui.view.rm:S.rm;const d=distFrom(heroGoals());
 let h='';
 // проходи
 S.ln.forEach(([a,b])=>{const A=S.rm[a],B=S.rm[b];if(!A||!B)return;const pa=P2(A),pb=P2(B);const hor=Y(A)===Y(B);
  const cx=(pa.l+pb.l)/2+T/2,cy=(pa.t+pb.t)/2+T/2;let arrow='';if(d[a]!=null&&d[b]!=null&&d[a]!==d[b]){const from=d[a]>d[b]?A:B,to=d[a]>d[b]?B:A;arrow=X(to)>X(from)?'▶':X(to)<X(from)?'◀':Y(to)>Y(from)?'▼':'▲'}
  const w=hor?G+T*.12:T*.24,hh=hor?T*.24:G+T*.12;h+=`<div class="door ${hor?'h':'v'}" style="left:${cx-w/2}px;top:${cy-hh/2}px;width:${w}px;height:${hh}px"><span>${arrow}</span></div>`});
 RM.forEach((o,i)=>{const p=P2(o),k=o.k;const cls=['room','rt-'+ROOMS[k].t];
  if(ui.pick&&ui.pick.rooms){if(ui.pick.rooms.includes(i))cls.push('ok');else cls.push('dim')}
  if(ui.evR===i)cls.push('ev');if(tutMark('room',k))cls.push('tut-hi');
  const res=RES.map(r=>o.res[r]?tokenHTML(r,o.res[r]):'').join('')+(o.trap?tokenHTML('trap',o.trap):'');
  const evs=o.ev.map(e=>e.k==='dragonev'?ic('ev','ic evt'):e.up?(e.k==='x'?ic('x','ic evt'):e.k==='wolf'?'<span class="evt big">🐺</span>':e.k==='ticket'?'<span class="evt big">🎫</span>':ic('ev','ic evt')):`<span class="evt face" title="Жетон долілиць">?</span>`).join('');
  const mons=o.m.map(u=>{const kind=u.p>=0?CLANFIG[S.pl[u.p].c]:u.k;const base=u.p>=0?PCOL[u.p]:'#2b2b2b';const mx=u.p>=0?CLANS[S.pl[u.p].c].hp:(u.mx||1);
   return `<span class="pc" data-id="m${u.id}" title="${esc(unitName(u))}${mx>1?' · '+u.hp+'/'+mx+'♥':''}">${figSVG(kind,base)}${mx>1?`<i class="hp">${u.hp}</i>`:''}</span>`}).join('');
  const hs=o.h.map(x=>`<span class="pc hp-${x.c}" data-id="h${x.id}" title="${esc(hName(x))}${x.a?'':' (виснажений)'}">${heroSVG(x)}</span>`).join('');
  h+=`<div class="${cls.join(' ')}" style="left:${p.l}px;top:${p.t}px;width:${T}px;height:${T}px;--T:${T}px" onclick="roomClick(${i})" data-r="${i}">${roomSVG(k)}
   <div class="rtype" title="${TYPES[ROOMS[k].t]}">${ti(ROOMS[k].t)}</div>${bannerHTML(i)}
   <div class="evs">${evs}</div><div class="units">${mons}${hs}</div><div class="toks">${res}</div>
   ${o.tr?chestSVG(o.tr.v,k==='VAU'):''}${o.port?`<span class="portal ${o.port===2?'done':''}" title="${o.port===2?'Завершений портал':'Незавершений портал'}">${ic('port')}</span>`:''}
   <div class="rname">${ROOMS[k].n}</div></div>`});
 if(ui.pick&&ui.pick.cells)ui.pick.cells.forEach(c=>{const p=P2(c);h+=`<div class="cell" style="left:${p.l}px;top:${p.t}px;width:${T}px;height:${T}px" onclick="cellClick(${c.x},${c.y})">Будувати тут</div>`});
 const bw=cols*T+(cols-1)*G,bh=rows*T+(rows-1)*G;
 return `<div id="board" class="${ui.tilt?'tilt':''}" style="width:${bw}px;height:${bh}px;--T:${T}px">${h}</div>`}
function roomInfo(i){const o=S.rm[i],k=o.k,d=ROOMS[k];
 modal(`<div class="rinfo"><div class="rbig">${roomSVG(k)}</div><div><h3>${ti(d.t)} ${d.n}</h3><p class="mu">Тип: ${TYPES[d.t]}. Герої з’являються тут з карт Гільдії з цим символом.</p>
 <p><b>${d.act&&d.act.dun?'Особлива дія':'Активація'}:</b> ${roomActText(i)||'немає особливої дії'}.${o.xb?' <b>Зараз закрито жетоном «Х».</b>':''}</p>
 ${o.tr?`<p>Скарб вартістю <b>${o.tr.v}</b>${o.tr.v===4?' — якщо його загарбають, ви програли':''}. Ефект прихований до грабунку.</p>`:'<p class="mu">Скарбу немає.</p>'}
 ${o.port?`<p>${o.port===2?'Завершений портал: монстри переходять між завершеними порталами за один рух.':'Незавершений портал: завершіть його активацією.'}</p>`:''}
 ${o.m.length?`<p><b>Монстри:</b> ${o.m.map(u=>esc(unitName(u))+(u.hp>1||(u.mx||0)>1?` (${u.hp}♥)`:'')).join(', ')}</p>`:''}
 ${o.h.length?`<p><b>Герої:</b> ${o.h.map(x=>esc(hName(x))+(x.a?'':' (виснажений)')).join(', ')}</p>`:''}
 ${RES.some(r=>o.res[r])||o.trap?`<p><b>Жетони:</b> ${RES.filter(r=>o.res[r]).map(r=>RESN[r]+' ×'+o.res[r]).concat(o.trap?['пастка ×'+o.trap]:[]).join(', ')}</p>`:''}
 </div></div><div class="row end"><button class="primary" onclick="closeModal()">Закрити</button></div>`,'wide')}

/* ---------- екран гри ---------- */
const canAct=()=>S&&!ui.busy&&!S.over&&S.ph>=1&&S.ph<=2&&(ui.seat==null||ui.seat===S.cur);
function render(){
 if(ui.scr==='menu'){$('#app').innerHTML=menuHTML();return}
 if(ui.scr==='pick'){$('#app').innerHTML=pickHTML();return}
 if(ui.scr==='setup'){$('#app').innerHTML=setupHTML();return}
 if(!S)return;
 const old=rects();
 if(!$('#game'))$('#app').innerHTML=gameShell();$('#game').classList.toggle('tutmode',!!tutOn());
 $('#top').innerHTML=topHTML();$('#prompt').innerHTML=ui.pick?pickBar():'';$('#boardwrap').innerHTML=boardHTML()+(S.over&&!ui.pick?overHTML():'');$('#side').innerHTML=sideHTML();$('#hand').innerHTML=handHTML();$('#tabs').innerHTML=tabsHTML();$('#drawer').innerHTML=drawerHTML();$('#drawer').hidden=!ui.tab;
 const lg=document.querySelectorAll('.log');lg.forEach(l=>l.scrollTop=l.scrollHeight);
 fly(old);tutRender()}
function gameShell(){return `<div id="game"><header id="top"></header><main id="boardwrap"></main><div id="prompt"></div><aside id="side"></aside><section id="hand"></section><nav id="tabs"></nav><div id="drawer" hidden></div><div id="tut" hidden></div></div>`}
function pickBar(){if(!ui.pick)return '';return `<div class="pickbar"><span>${esc(ui.pick.msg)}</span>${ui.pick.cancel?`<button onclick="${tutMark('cancel')?'':''}if(tutAllow('cancel'))resolvePick(null)">${ui.pick.msg.includes('Готово')?'Готово':'Скасувати'}</button>`:''}</div>`}
function overHTML(){return `<div class="over ${S.over}"><h2>${S.over==='win'?'Перемога!':'Поразка'}</h2><p>${esc(S.overWhy||'')}</p><div class="row"><button class="primary" onclick="ui.scr='pick';S=null;render()">Інший сценарій</button><button onclick="restart()">Зіграти ще раз</button></div></div>`}
function topHTML(){const sc=SC(),p=P();const ph=['Розміщення','Гра карт','Оновлення','Очищення','Вторгнення'];
 return `<button class="ghost logo" onclick="toMenu()" title="Меню">${figSVG('dragon','#0000')}</button>
 <div class="scn"><b>${sc.id}. ${esc(sc.n)}</b><span class="mu">${DIFN[S.df]} · хвиля ${S.wave}/2</span></div>
 <div class="who" style="--pc:${PCOL[S.cur]}">${figSVG(CLANFIG[p.c],PCOL[S.cur])}<span>${S.ph===0?'Підготовка':'Хід'}: <b>${CLANS[p.c].n}</b>${S.pl.length>1?` <small>гравець ${S.cur+1}</small>`:''}</span></div>
 <ol class="phases">${[1,2,3,4].map(i=>`<li class="${S.ph===i?'on':S.ph>i?'done':''}">${i}. ${ph[i]}</li>`).join('')}</ol>
 <div class="tools"><button class="ghost" onclick="saveModal()" title="Зберегти гру" ${S.tut||DOC?'disabled':''}>💾<span> Зберегти</span></button><button class="ghost" onclick="rulesModal()" title="Правила">📖<span> Правила</span></button><button class="ghost" onclick="scenModal()" title="Правила сценарію">📜<span> Сценарій</span></button><button class="ghost" onclick="ui.tilt=!ui.tilt;saveUi();render()" title="Вигляд поля">${ui.tilt?'3D':'2D'}</button>
 <select aria-label="Швидкість героїв" onchange="ui.spd=this.value;saveUi()">${[['s','Повільно'],['n','Нормально'],['f','Швидко'],['i','Миттєво']].map(([v,l])=>`<option value="${v}" ${ui.spd===v?'selected':''}>${l}</option>`).join('')}</select>
 ${ui.busy&&S.ph===4?'<button onclick="ui.skip=true">Пропустити ⏭</button>':''}</div>`}
function sideHTML(){return `<div class="sect guild">${guildHTML()}</div><div class="sect mk"><h4>Ринок предметів ${S.ph===2&&canAct()?'<small class="mkhint">оберіть предмети, потім карту з руки</small>':'<small class="mkhint">ціна — ресурс і кімната</small>'}</h4>${marketHTML()}</div><div class="sect lg"><h4>Журнал</h4>${logHTML()}</div>`}
function guildHTML(){const tile=DIF[S.df];return `<h4>Гільдія</h4><div class="grow"><div class="dtile"><div class="dtl">${DIFN[S.df]}</div><div class="${S.wave===1?'on':''}">Хвиля 1: ${tile[0]}</div><div class="${S.wave===2?'on':''}">Хвиля 2: ${tile[1]}</div><div class="gdeck" title="Карт у колоді: ${S.g.length}">${gCardHTML(null,1)}<b>${S.g.length}</b></div></div>
 <div class="glast ${ui.evR===null&&false?'':''}">${S.lastG?gCardHTML(S.lastG):'<div class="gcard empty">Ще не відкрито</div>'}</div></div>
 <button class="ghost w" onclick="discardModal()">Скид Гільдії (${S.gd.length}) — переглянути</button>`}
const ITCOST={gear:['coin','FOR'],mon:['bone','CAG'],pot:['frog','APO'],scroll:['book','AUD'],tac:[null,'LAB']};
const ITCOL={gear:'#b8402f',mon:'#d08a1a',pot:'#3c9a4a',scroll:'#5a4fb8',tac:'#556'};
function marketHTML(){const sel=S.ph===2&&canAct();return `<div class="mklist">${S.mk.map((c,i)=>{const [res,room]=ITCOST[c.it]||[null,'LAB'];const has=S.rm.some(r=>r.k===room);
 return `<button class="mkr ${ui.sel.includes(i)?'sel':''} ${sel?'can':''}" onclick="mkClick(${i})" title="${esc(c.n)} — ${ITYPE[c.it]}"><span class="mkart" style="--ic:${ITCOL[c.it]}">${c.it==='tac'&&c.cl?figSVG(CLANFIG[c.cl],'#0000'):ic({gear:'mel',mon:'amb',pot:'card',scroll:'rf',tac:'card'}[c.it])}</span>
 <span class="mkname"><b>${esc(c.n)}</b><small>${ITYPE[c.it]}${c.cl?' · '+CLANS[c.cl].n:''}</small></span>
 <span class="mkacts">${c.o.map(optHTML).join('<i class="slash">/</i>')}</span>
 <span class="mkcost ${has?'':'no'}" title="${has?'Отримати: активуйте «'+ROOMS[room].n+'»'+(res?' і скиньте '+RESA[res]:''):'У цьому сценарії немає кімнати «'+ROOMS[room].n+'»'}">${res?ic(res):ic('ev')}<small>${ROOMS[room].n}</small></span></button>`}).join('')}</div>`}
function logHTML(){return `<div class="log">${S.log.slice(-160).map(l=>`<div class="${l.k}">${esc(l.t)}</div>`).join('')}</div>`}
function handHTML(){const p=P(),cl=CLANS[p.c],me=canAct();const show=ui.seat==null||ui.seat===S.cur;
 const chips=S.pend.map((pe,i)=>`<button class="chip ${tutMark('chip',tokLabel(pe.tk))?'tut-hi':''}" ${me?'':'disabled'} onclick="chipClick(${i})" title="${esc(ACTN[tokLabel(pe.tk)]||'')} · з карти «${esc(pe.src)}»">${tokHTML(pe.tk)}</button>`).join('');
 const cards=show?p.hand.map((c,i)=>`<button class="hc ${tutMark('card',c.n)?'tut-hi':''}" ${me?'':'aria-disabled="true"'} onclick="handClick(${i})">${cardHTML(c)}</button>`).join(''):'<p class="mu">Рука прихована — зараз хід іншого гравця.</p>';
 return `<div class="clan" style="--cc:${cl.col}"><div class="cfig">${figSVG(CLANFIG[p.c],PCOL[S.cur])}</div><div><b>${cl.n}</b> <small class="role">${ROLEN[cl.role]}</small><div class="attrs"><span title="Монстрів у лігві">${ic('lair')} ${p.lair}/${cl.size}</span><span title="Здоров’я монстра">♥ ${cl.hp}</span><span title="Колода тактики">${ic('deck')} ${p.deck.length}</span><span title="Скид">⤓ ${p.disc.length}</span></div><p class="ab">${ic('act')} ${esc(cl.ab)}</p></div></div>
 <div class="handmain"><div class="pend">${p.play.length?`<span class="played"><span class="mu">Зіграно:</span>${p.play.map(c=>`<span class="pchip" title="${esc(c.n)}">${esc(c.n)}</span>`).join('')}</span>`:''}${S.pend.length?`<span class="mu">Дії:</span>${chips}`:`<span class="mu hintx">${me?(S.ph===1?'Зіграйте карту з руки — її дії з’являться тут.':'Фаза 2: оновіть предмети або завершіть хід.'):(S.over?'':ui.busy?'Зачекайте…':'Хід іншого гравця.')}</span>`}</div>
 <div class="cards">${cards||'<p class="mu">Рука порожня</p>'}</div></div>
 <div class="acts">${S.ph===1?`<button class="${tutMark('dungeon')?'tut-hi':''}" ${me&&!S.dunUsed?'':'disabled'} onclick="dungeonClick()" title="Раз за хід: витягніть карту Гільдії">${ti('spec')} Темниця</button><button ${me?'':'disabled'} onclick="toPhase2()" title="Фаза 2: оновлення предметів">Фаза 2</button>`:''}<button class="primary ${tutMark('end')?'tut-hi':''}" ${me?'':'disabled'} onclick="endClick()">Завершити хід</button></div>`}
function tabsHTML(){const t=[['hand','Рука',P().hand.length],['mk','Ринок',''],['guild','Гільдія',S.g.length],['log','Журнал','']];return t.map(([k,l,n])=>`<button class="${ui.tab===k?'on':''}" onclick="ui.tab=ui.tab==='${k}'?null:'${k}';render()">${l}${n!==''?` <small>${n}</small>`:''}</button>`).join('')}
function drawerHTML(){if(!ui.tab)return '';if(ui.tab==='hand')return `<div class="dhand">${handHTML()}</div>`;if(ui.tab==='mk')return `<h4>Ринок предметів</h4>${marketHTML()}`;if(ui.tab==='guild')return guildHTML();return `<h4>Журнал</h4>${logHTML()}`}

/* ---------- дії гравця ---------- */
window.handClick=i=>{if(!canAct())return;const c=P().hand[i];
 if(S.ph===2){if(!ui.sel.length)return toast('Спершу позначте на ринку предмети, які хочете замінити.');refreshItems(i,ui.sel.slice());ui.sel=[];commit();render();return}
 if(!tutAllow('card',c.n))return;run(()=>playCard(i))};
window.chipClick=i=>{if(!canAct())return;if(!tutAllow('chip',tokLabel(S.pend[i].tk)))return;run(()=>usePend(i))};
window.dungeonClick=()=>{if(!canAct()||S.dunUsed)return;if(!tutAllow('dungeon'))return;run(()=>dungeonRisk())};
window.toPhase2=()=>{if(!canAct())return;if(!tutAllow('phase2'))return;S.ph=2;S.pend=[];L(`${pName(S.cur)}: фаза 2 — оновлення предметів`);commit();render()};
window.endClick=()=>{if(!canAct())return;if(!tutAllow('end'))return;if(S.pend.length&&!confirmInline())return;ui.sel=[];run(()=>endTurn())};
function confirmInline(){if(ui.confirmEnd){ui.confirmEnd=0;return true}ui.confirmEnd=1;toast('Ще лишились невикористані дії. Натисніть «Завершити хід» ще раз, щоб їх пропустити.');setTimeout(()=>ui.confirmEnd=0,4000);return false}
window.mkClick=i=>{if(!(S.ph===2&&canAct())){const c=S.mk[i];modal(`<div class="opts cards"><div class="optc">${cardHTML(c)}</div></div><p class="mu">${ITYPE[c.it]}. Отримати можна активацією кімнати: ${c.it==='gear'?'Кузня (монета)':c.it==='mon'?'Клітка (кістка)':c.it==='pot'?'Аптека (жаба)':c.it==='scroll'?'Аудиторія (книга)':'Лабораторія'}.</p><div class="row end"><button class="primary" onclick="closeModal()">Закрити</button></div>`);return}
 const k=ui.sel.indexOf(i);if(k>=0)ui.sel.splice(k,1);else ui.sel.push(i);render()};
window.toMenu=()=>{if(S&&!S.over&&!confirmLeave())return;ui.scr='menu';if(UNSUB){UNSUB();UNSUB=null}DOC=null;render()};
function confirmLeave(){if(ui.leave){ui.leave=0;return true}ui.leave=1;toast('Натисніть ще раз, щоб вийти в меню (гра на цьому пристрої буде втрачена).');setTimeout(()=>ui.leave=0,4000);return false}
window.restart=()=>{startGame(ui.cfg)};

/* ---------- анімація переміщень ---------- */
function rects(){const m={};document.querySelectorAll('#board [data-id]').forEach(e=>{m[e.dataset.id]={r:e.getBoundingClientRect(),h:e.outerHTML}});return m}
function fly(old){const fx=$('#fx'),seen={};
 document.querySelectorAll('#board [data-id]').forEach(e=>{const id=e.dataset.id;seen[id]=1;const o=old[id],n=e.getBoundingClientRect();
  if(!o){e.classList.add('pop');return}if(Math.abs(o.r.left-n.left)+Math.abs(o.r.top-n.top)<5)return;
  const c=document.createElement('div');c.className='fly';c.innerHTML=o.h;c.style.cssText=`left:${o.r.left}px;top:${o.r.top}px;width:${o.r.width}px;height:${o.r.height}px`;fx.appendChild(c);e.style.visibility='hidden';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{c.style.left=n.left+'px';c.style.top=n.top+'px'}));setTimeout(()=>{c.remove();e.style.visibility=''},480)});
 for(const id in old)if(!seen[id]){const p=document.createElement('div');p.className='poof';p.style.cssText=`left:${old[id].r.left}px;top:${old[id].r.top}px`;p.innerHTML='<span>💥</span>';fx.appendChild(p);setTimeout(()=>p.remove(),650)}}

/* ---------- довідкові вікна ---------- */
window.discardModal=()=>{const by={};S.gd.forEach(c=>{const k=c.k==='h'?HEROES[c.c].n:c.n;(by[k]=by[k]||[]).push(c)});
 const all={};S.g.concat(S.gd).forEach(c=>{const k=c.k==='h'?HEROES[c.c].n:c.n;all[k]=(all[k]||0)+1});
 modal(`<h3>Скид Гільдії</h3><p class="mu">Скинуті карти загальнодоступні — аналізуйте, хто ще може прийти. У колоді лишилось ${S.g.length} карт.</p>
 <div class="gdisc">${S.gd.length?S.gd.slice().reverse().map(c=>gCardHTML(c,1)).join(''):'<p class="mu">Скид порожній.</p>'}</div>
 <h4>Ще в колоді (за типом)</h4><div class="tbl">${Object.keys(all).map(k=>`<div><span>${esc(k)}</span><b>${all[k]-(by[k]||[]).length}</b></div>`).join('')}</div>
 <div class="row end"><button class="primary" onclick="closeModal()">Закрити</button></div>`,'wide')};
window.scenModal=()=>{const sc=SC();modal(`<h3>Сценарій ${sc.id}. ${esc(sc.n)}</h3>${sc.rules.map(r=>`<div class="rule"><b>${esc(r[0])}</b> <small>(${esc(r[1])})</small><p>${esc(r[2])}</p></div>`).join('')}${sc.ban?`<p class="mu">У цьому сценарії не можна грати за: ${sc.ban.map(c=>CLANS[c].n).join(', ')}.</p>`:''}${S&&S.labClan?`<p class="mu">Лабораторія: карти клану «${CLANS[S.labClan].n}» замішано в колоду предметів.</p>`:''}<div class="row end"><button class="primary" onclick="closeModal()">Закрити</button></div>`,'wide')};
window.rulesModal=()=>{modal(RULES_HTML,'wide rules')};
const RULES_HTML=`<h3>Коротко про правила</h3>
<div class="rcols"><div><h4>Хід гравця</h4><ol><li><b>Гра карт із руки.</b> Грайте карти по одній і виконуйте їхні дії будь-якими своїми монстрами в будь-якому порядку. Не обов’язково виконувати все.</li><li><b>Оновлення предметів.</b> Скиньте карту з руки, щоб замінити 1–5 предметів на ринку.</li><li><b>Очищення.</b> Зіграні карти йдуть у скид, доберіть руку до 5.</li><li><b>Вторгнення героїв.</b> Розіграйте 1–3 карти Гільдії (залежно від складності й хвилі).</li><li><b>Завершення ходу.</b> Хід переходить до сусіда ліворуч.</li></ol>
<h4>Перемога і поразка</h4><p>Пережили другу хвилю колоди Гільдії — перемога. Герої загарбали скарб 4 у сховищі — поразка.</p>
<h4>Темниця</h4><p>Раз за хід, без монстра: витягніть карту Гільдії. Героя — до темниці (виснаженим), ви берете 3 карти. Маг у темниці звільняє всіх!</p></div>
<div><h4>Дії</h4><dl class="acts">
<dt>${ic('card')} Отримання карти</dt><dd>Візьміть карту тактики, її можна зіграти цього ж ходу.</dd>
<dt>${ic('act')} Активація</dt><dd>Дія кімнати з вашим монстром, здібність клану або завершення порталу.</dd>
<dt>${ic('mv')} Переміщення</dt><dd>Монстр іде в сусідню кімнату через прохід або портал і може нести 1 ресурс чи пастку.</dd>
<dt>${ic('mel')} Ближня атака</dt><dd>1 ушкодження герою в кімнаті з вашим монстром.</dd>
<dt>${ic('rng')} Дистанційна атака</dt><dd>1 ушкодження герою в кімнаті, з’єднаній проходом з кімнатою вашого монстра.</dd>
<dt>${ic('coin')}${ic('bone')}${ic('frog')}${ic('book')} Ресурс</dt><dd>Покладіть жетон у кімнату з вашим монстром.</dd>
<dt>${ic('def')} Захист</dt><dd>Реакція: коли герой атакує кімнату з вашим монстром, скиньте карту із Захистом — ушкодження −1.</dd>
<dt>${ic('trap')} Пастка</dt><dd>Покладіть пастку. Герой, що входить, отримує 1 ушкодження.</dd>
<dt>${ic('port')} Портал</dt><dd>Покладіть завершений портал у кімнату з вашим монстром.</dd>
<dt>${ic('amb')} Засідка</dt><dd>Викличте до N монстрів із лігва в кімнати зображеного типу.</dd>
<dt>${ic('nv')} Навала</dt><dd>Якщо вдалася ліва дія, права — безкоштовно.</dd>
<dt>${ic('sw')} Зграя</dt><dd>Усі ваші монстри в одній кімнаті виконують дію.</dd>
<dt>${ic('rf')} Зміцнення</dt><dd>Перегляньте 3 карти колоди, візьміть ті, що мають дію, решту скиньте.</dd>
<dt><i class="slash">/</i> Вибір</dt><dd>Оберіть ліву або праву групу дій.</dd></dl></div>
<div><h4>Вторгнення: як діє герой</h4><ol><li><b>Виклик</b> у кожну кімнату типу з карти.</li><li><b>Хизування:</b> ${ic('rng')} лучниця стріляє в сусідню кімнату, найближчу до сховища; воїн скидає до 2 ресурсів; пройдисвітка скидає пастку; маг у темниці звільняє в’язнів.</li><li><b>Перевірка кімнати:</b> пастки б’ють героя. У темниці герої виснажуються.</li><li><b>Натхнення:</b> активний герой надихає виснажених у кімнаті.</li><li><b>Атака:</b> якщо є монстр, герой виснажується й завдає 1 ушкодження.</li><li><b>Грабунок:</b> якщо активних героїв ≥ вартості скарбу, вони виснажуються й забирають його.</li><li><b>Очікування:</b> героїв замало — усі в кімнаті виснажуються.</li><li><b>Просування:</b> інакше активні герої йдуть у сусідню кімнату ближче до сховища (стрілки на дверях).</li></ol>
<h4>Скарби</h4><p>${Object.values(TEFF).map(t=>`<b>${t[0]}:</b> ${t[1]}.`).join(' ')}</p></div></div>
<div class="row end"><button class="primary" onclick="closeModal()">Закрити</button></div>`;

/* ---------- меню, вибір сценарію, налаштування ---------- */
function menuHTML(){return `<div class="menu"><div class="hero-art">${['ghost','witch','dragon','rat','slime'].map((k,i)=>figSVG(k,PCOL[i%4])).join('')}</div>
 <h1>Ходу героям нема!</h1><p class="tag">Кооперативна оборона підземелля для 1–4 гравців. Ви — монстри. Вони — «герої».</p>
 <div class="mbtns">${contBtn()}<button class="${ui.saves&&ui.saves.find(s=>s.id==='save-auto')?'':'primary'} big" onclick="ui.scr='pick';render()">Нова гра</button><button class="big" onclick="startTutorial()">Навчальна партія</button><button class="big" onclick="ui.cfg.mode='online';ui.scr='pick';render()">Грати онлайн з друзями</button><button class="ghost" onclick="savesScreen()">Збереження${ui.saves&&ui.saves.length?' ('+ui.saves.length+')':''}</button><button class="ghost" onclick="rulesModal()">Правила</button>${S&&!S.over&&!S.tut?'<button class="ghost" onclick="ui.scr=\'game\';render()">Повернутися до гри</button>':''}</div>
 <p class="fine">Неофіційна фанатська версія для особистої гри. Оригінальна гра — Льюїс Брюе, українське видання — «Ігромаг». Графіка намальована окремо. Склад карт тактики, предметів і героїв Гільдії поки наближений.</p></div>`}
function pickHTML(){return `<div class="pickscr"><div class="row sb"><h2>Оберіть сценарій</h2><button class="ghost" onclick="ui.scr='menu';render()">← Меню</button></div>
 <div class="scgrid">${SCEN.map(s=>`<button class="scard ${ui.cfg.sc===s.id?'sel':''}" onclick="ui.cfg.sc=${s.id};ui.scr='setup';render()"><span class="num">${s.id}</span><b>${esc(s.n)}</b><small>${s.rules.map(r=>esc(r[0])).join(' · ')}</small>${s.ban?`<em>Без: ${s.ban.map(c=>CLANS[c].n).join(', ')}</em>`:''}${miniMap(s)}</button>`).join('')}</div></div>`}
function miniMap(s){const cells=[];s.map.forEach((row,y)=>row.split(' ').forEach((c,x)=>{if(c!=='....')cells.push({x,y,k:c.slice(0,3),v:c.slice(3)})}));const W=Math.max(...cells.map(c=>c.x))+1,H=Math.max(...cells.map(c=>c.y))+1;
 return `<svg class="mini" viewBox="0 0 ${W*10} ${H*10}">${cells.map(c=>`<rect x="${c.x*10+.5}" y="${c.y*10+.5}" width="9" height="9" rx="1.5" fill="${{gem:'#e0b030',sword:'#b8402f',hat:'#5a49a6',eye:'#24857f',bones:'#3f7c38',spec:'#555'}[ROOMS[c.k].t]}"/>${c.v==='4'?`<circle cx="${c.x*10+5}" cy="${c.y*10+5}" r="2" fill="#fff"/>`:''}`).join('')}</svg>`}
function setupHTML(){const s=SCEN[ui.cfg.sc-1],c=ui.cfg;const ban=s.ban||[];c.clans=c.clans.map(k=>ban.includes(k)?Object.keys(CLANS).find(x=>!ban.includes(x)&&!c.clans.includes(x))||k:k);
 return `<div class="setup"><div class="row sb"><h2>${s.id}. ${esc(s.n)}</h2><button class="ghost" onclick="ui.scr='pick';render()">← Сценарії</button></div>
 <div class="sgrid"><div class="sbox"><h4>Особливі правила</h4>${s.rules.map(r=>`<div class="rule"><b>${esc(r[0])}</b> <small>(${esc(r[1])})</small><p>${esc(r[2])}</p></div>`).join('')}</div>
 <div class="sbox"><h4>Гравці й складність</h4><div class="row"><label for="np">Гравців</label><select id="np" onchange="ui.cfg.np=+this.value;render()">${[1,2,3,4].map(n=>`<option ${n===c.np?'selected':''}>${n}</option>`).join('')}</select>
 <label for="df">Складність</label><select id="df" onchange="ui.cfg.df=this.value">${Object.keys(DIFN).map(k=>`<option value="${k}" ${c.df===k?'selected':''}>${DIFN[k]} (${DIF[k][0]}/${DIF[k][1]})</option>`).join('')}</select></div>
 <div class="clans">${[...Array(c.np)].map((_,i)=>`<div class="pclan"><span class="dot" style="background:${PCOL[i]}"></span><span>Гравець ${i+1}</span><div class="cpick">${Object.keys(CLANS).map(k=>{const dis=ban.includes(k)||(c.clans.indexOf(k)>-1&&c.clans.indexOf(k)<c.np&&c.clans.indexOf(k)!==i);return `<button class="cl ${c.clans[i]===k?'sel':''}" ${dis?'disabled':''} title="${CLANS[k].n}: ${ROLEN[CLANS[k].role]}, ${CLANS[k].size} монстр., ${CLANS[k].hp}♥" onclick="ui.cfg.clans[${i}]='${k}';render()">${figSVG(CLANFIG[k],PCOL[i])}<small>${CLANS[k].n}</small></button>`}).join('')}</div><p class="mu">${esc(CLANS[c.clans[i]].motto)} ${esc(CLANS[c.clans[i]].ab)}</p></div>`).join('')}</div>
 <div class="row"><label for="mode">Режим</label><select id="mode" onchange="ui.cfg.mode=this.value;render()"><option value="local" ${c.mode==='local'?'selected':''}>Один екран (по черзі)</option><option value="online" ${c.mode==='online'?'selected':''}>Онлайн-кімната</option></select></div>
 ${c.mode==='online'?`<div class="row"><label for="code">Код кімнати</label><input id="code" value="${esc(c.code)}" placeholder="zhaba7" autocomplete="off"></div><p class="mu">Створює той, хто налаштовує гру. Друзі натискають «Приєднатися» з тим самим кодом — їм потрібен доступ до цієї сторінки з правом редагування (Contributor або вище). Під час чужого ходу рішення, як-от «Захист», приймає активний гравець — домовляйтесь голосом.</p><div class="row"><button class="primary big" onclick="online(true)">Створити кімнату</button><button class="big" onclick="online(false)">Приєднатися</button></div>`:`<div class="row"><button class="primary big" onclick="startGame(ui.cfg)">Почати гру</button></div>`}
 </div></div></div>`}
window.startGame=cfg=>{newGame({sc:cfg.sc,df:cfg.df,clans:cfg.clans.slice(0,cfg.np)});ui.scr='game';ui.seat=null;ui.sel=[];ui.tab=null;$('#app').innerHTML='';render();run(()=>setupPlace())};

/* ---------- онлайн ---------- */
function commit(fr){if(!S)return;S.v=(S.v||0)+1;autoSave();if(!DOC)return;const data={s:JSON.stringify(S),fr:JSON.stringify(fr||[]),v:S.v,by:TAB};WQ=WQ.then(()=>DOC.set(data)).catch(e=>toast('Хід не зберігся в кімнаті: '+(e&&(e.code||e.message)||'помилка')))}
async function online(create){const code=(($('#code')||{}).value||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20);if(!code)return toast('Введіть код кімнати латиницею або цифрами, наприклад zhaba7');ui.cfg.code=code;
 let db=null;try{db=await claude.use('db')}catch(e){}if(!db)return modal('<h3>Онлайн тут недоступний</h3><p>Кімнати працюють лише на опублікованій сторінці гри для користувачів, що увійшли в акаунт. Грайте в режимі «Один екран».</p><div class="row end"><button class="primary" onclick="closeModal()">Добре</button></div>');
 if(UNSUB)UNSUB();DOC=db.doc('games/'+code);
 if(create){newGame({sc:ui.cfg.sc,df:ui.cfg.df,clans:ui.cfg.clans.slice(0,ui.cfg.np)});ui.scr='game';$('#app').innerHTML='';ui.seat=null;commit();seatPick(true)}else{ui.joining=1;toast('Підключаюсь до кімнати '+code+'…')}
 UNSUB=DOC.onSnapshot(snap=>{if(!snap.exists){if(ui.joining){ui.joining=0;toast('Кімнату «'+code+'» не знайдено. Перевірте код.')}return}
  const d=snap.data();if(!d||typeof d.s!=='string')return;if(S&&!ui.joining&&(d.by===TAB||d.v<=S.v))return;
  let ns,fr;try{ns=JSON.parse(d.s);fr=JSON.parse(d.fr||'[]')}catch(e){return}const first=ui.joining||ui.scr!=='game';ui.joining=0;S=ns;ui.scr='game';
  if(first){$('#app').innerHTML='';render();if(ui.seat==null)seatPick()}else replay(fr)},e=>toast('Зв’язок з кімнатою втрачено. Оновіть сторінку.'))}
async function replay(fr){if(!fr||fr.length<2){render();return}const fin=clone(S.rm),lg=S.log.length;for(const f of fr){ui.view=f;ui.evR=f.r;render();await sleep(SPD[ui.spd]||0)}ui.view=null;ui.evR=null;render()}
function seatPick(host){modal(`<h3>${host?`Кімнату «${esc(ui.cfg.code)}» створено`:`Ви в кімнаті «${esc(ui.cfg.code)}»`}</h3><p>Ким ви граєте?</p><div class="opts">${S.pl.map((p,i)=>`<button class="opt" onclick="ui.seat=${i};closeModal();render();if(${host?1:0}&&S.ph===0)run(()=>setupPlace())">${figSVG(CLANFIG[p.c],PCOL[i])}<span>${CLANS[p.c].n} (гравець ${i+1})</span></button>`).join('')}<button class="opt" onclick="ui.seat=-1;closeModal();render()"><span>👁 Лише дивитися</span></button></div>`)}

/* ---------- збереження ---------- */
const SAVE={col:null,ready:false,q:{}};
async function saveInit(){try{const db=await claude.use('db');const user=await claude.use('user');const id=user&&await user.id();if(db&&id)SAVE.col=db.collection('data/users/'+id)}catch(e){}SAVE.ready=true;await refreshSaves();if(ui.scr==='menu')render()}
function lsSaves(){try{return JSON.parse(localStorage.getItem('hhn-saves')||'{}')}catch(e){return {}}}
function lsPut(o){try{localStorage.setItem('hhn-saves',JSON.stringify(o));return true}catch(e){return false}}
async function refreshSaves(){let list=[];try{if(SAVE.col){const q=await SAVE.col.get();list=q.docs.filter(d=>d.id.startsWith('save-')).map(d=>Object.assign({id:d.id},d.data()))}else{const o=lsSaves();list=Object.keys(o).map(k=>Object.assign({id:k},o[k]))}}catch(e){}
 list.sort((a,b)=>(b.at||0)-(a.at||0));ui.saves=list;return list}
function saveRec(name){const st=clone(S);st.log=st.log.slice(-250);const sc=SCEN[S.sc-1];return {name,sc:S.sc,scn:sc.n,df:S.df,wave:S.wave,clans:S.pl.map(p=>p.c),cur:S.cur,at:Date.now(),deck:S.g.length,s:JSON.stringify(st)}}
async function saveWrite(id,name){const rec=saveRec(name);
 const job=(SAVE.q[id]||Promise.resolve()).then(async()=>{if(SAVE.col)await SAVE.col.doc(id).set(rec);else{const o=lsSaves();o[id]=rec;if(!lsPut(o))throw new Error('сховище браузера недоступне')}});
 SAVE.q[id]=job.catch(()=>{});await job;const i=(ui.saves||[]).findIndex(s=>s.id===id);const meta=Object.assign({id},rec);if(i>=0)ui.saves[i]=meta;else(ui.saves=ui.saves||[]).unshift(meta);return true}
async function saveDelete(id){try{if(SAVE.col)await SAVE.col.doc(id).delete();else{const o=lsSaves();delete o[id];lsPut(o)}}catch(e){}ui.saves=(ui.saves||[]).filter(s=>s.id!==id)}
let AST=null;
function autoSave(){if(!S||S.tut||DOC||ui.scr!=='game'||S.ph===0)return;clearTimeout(AST);
 if(S.over){AST=setTimeout(()=>saveDelete('save-auto'),300);return}
 AST=setTimeout(()=>saveWrite('save-auto','Автозбереження').catch(e=>toast('Автозбереження не вдалося: '+(e.code||e.message))),700)}
function saveDesc(s){const d=new Date(s.at||0);const dt=d.toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
 return `<b>${s.sc}. ${esc(s.scn||'')}</b><small>${DIFN[s.df]||''} · хвиля ${s.wave}/2 · у колоді Гільдії ${s.deck??'?'} · ${(s.clans||[]).map(c=>CLANS[c]?CLANS[c].n:c).join(', ')}</small><small class="mu">${esc(s.name||'')} · ${dt}</small>`}
function contBtn(){const a=(ui.saves||[]).find(s=>s.id==='save-auto');if(!a)return '';return `<button class="primary big cont" onclick="loadSave('save-auto')"><span>Продовжити гру</span><small>${a.sc}. ${esc(a.scn||'')} · хвиля ${a.wave}/2</small></button>`}
window.loadSave=async id=>{let rec=(ui.saves||[]).find(s=>s.id===id);try{if(SAVE.col){const d=await SAVE.col.doc(id).get();if(d.exists)rec=Object.assign({id},d.data())}}catch(e){}
 if(!rec||!rec.s)return toast('Не вдалося прочитати збереження.');let st;try{st=JSON.parse(rec.s)}catch(e){return toast('Збереження пошкоджене.')}
 S=st;S.tut=null;DOC=null;if(UNSUB){UNSUB();UNSUB=null}ui.scr='game';ui.seat=null;ui.sel=[];ui.tab=null;ui.pick=null;ui.busy=false;ui.cfg.sc=S.sc;ui.cfg.df=S.df;ui.cfg.np=S.pl.length;ui.cfg.clans=S.pl.map(p=>p.c).concat(ui.cfg.clans).filter((c,i,a)=>a.indexOf(c)===i);
 closeModal();$('#app').innerHTML='';L('💾 Гру завантажено',null,'h');render();if(S.ph===0)run(()=>setupPlace())};
window.saveModal=()=>{if(!S||S.tut||DOC)return;const man=(ui.saves||[]).filter(s=>s.id!=='save-auto');
 modal(`<h3>Зберегти гру</h3><p class="mu">Гра також зберігається автоматично після кожної дії — її можна продовжити з головного меню.${SAVE.col?'':' Збереження лежать у цьому браузері.'}</p>
 <div class="row"><input id="svname" placeholder="Назва збереження" value="${esc(SCEN[S.sc-1].n)} — хвиля ${S.wave}" style="flex:1;min-width:0"><button class="primary" onclick="doSave()">Зберегти</button></div>
 ${man.length?`<h4 style="margin-top:12px">Перезаписати</h4><div class="slist">${man.map(s=>`<div class="sitem"><div class="sdesc">${saveDesc(s)}</div><button onclick="doSave('${s.id}')">Перезаписати</button></div>`).join('')}</div>`:''}
 <div class="row end"><button class="ghost" onclick="closeModal()">Закрити</button></div>`)};
window.doSave=async id=>{const nm=(($('#svname')||{}).value||'Збереження').slice(0,60);const man=(ui.saves||[]).filter(s=>s.id!=='save-auto');if(!id&&man.length>=8)return toast('Уже 8 збережень. Перезапишіть одне з них або видаліть у меню «Збереження».');
 try{await saveWrite(id||('save-'+Date.now().toString(36)),nm);closeModal();toast('Гру збережено')}catch(e){toast('Не вдалося зберегти: '+(e.code||e.message))}};
window.savesScreen=async()=>{await refreshSaves();const l=ui.saves||[];
 modal(`<h3>Збереження</h3>${l.length?`<div class="slist">${l.map(s=>`<div class="sitem"><div class="sdesc">${s.id==='save-auto'?'<em>Автозбереження</em>':''}${saveDesc(s)}</div><div class="row"><button class="primary" onclick="loadSave('${s.id}')">Завантажити</button><button class="ghost" onclick="delSave('${s.id}')" title="Видалити">🗑</button></div></div>`).join('')}</div>`:'<p class="mu">Збережень поки немає. Почніть гру — вона збережеться автоматично.</p>'}
 <div class="row end"><button class="ghost" onclick="closeModal()">Закрити</button></div>`,'wide')};
window.delSave=async id=>{if(ui.delArm!==id){ui.delArm=id;toast('Натисніть 🗑 ще раз, щоб видалити це збереження.');setTimeout(()=>{if(ui.delArm===id)ui.delArm=null},4000);return}ui.delArm=null;await saveDelete(id);savesScreen();if(ui.scr==='menu')render()};

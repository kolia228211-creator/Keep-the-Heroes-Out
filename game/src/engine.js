/* ===================== РУШІЙ =====================
 Увесь хід гри — генератори. Вони віддають запити до інтерфейсу:
 {t:'frame',r}  — показати кадр (анімація кроку)
 {t:'ask',msg,opts:[{l,v,d}],cancel} — вибір
 {t:'room',rooms,msg,cancel} — клацнути кімнату
 {t:'show',title,cards} — показати карти
*/
let S=null;
const rnd=n=>Math.floor(Math.random()*n);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const clone=o=>JSON.parse(JSON.stringify(o));
const SC=()=>SCEN[S.sc-1];

/* ---------- геометрія ---------- */
const R=i=>S.rm[i];
const rIdx=k=>S.rm.findIndex(r=>r.k===k);
const rType=i=>ROOMS[S.rm[i].k].t;
const rName=i=>ROOMS[S.rm[i].k].n;
function nbP(i){const o=[];for(const [a,b] of S.ln){if(a===i)o.push(b);else if(b===i)o.push(a)}return o}
function nbM(i){const o=nbP(i);if(S.rm[i].port===2)S.rm.forEach((r,j)=>{if(j!==i&&r.port===2&&!o.includes(j))o.push(j)});return o}
function nbGrid(i){const a=S.rm[i];return S.rm.map((r,j)=>j).filter(j=>{const b=S.rm[j];return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1})}
const vault=()=>rIdx('VAU');
function heroGoals(){if(S.sc===13){const g=S.rm.map((r,i)=>i).filter(i=>S.rm[i].m.some(u=>u.k==='liz'));if(g.length)return g}return [vault()]}
function distFrom(goals){const d={},q=[...goals];goals.forEach(g=>d[g]=0);while(q.length){const x=q.shift();for(const y of nbP(x))if(d[y]==null){d[y]=d[x]+1;q.push(y)}}return d}
function nextRooms(i,goals){const d=distFrom(goals||heroGoals());if(d[i]==null||d[i]===0)return [];const n=nbP(i).filter(j=>d[j]!=null&&d[j]<d[i]);const m=Math.min(...n.map(j=>d[j]));return n.filter(j=>d[j]===m)}
const jailRoom=()=>{let i=rIdx('DUN');if(i<0)i=S.rm.findIndex(r=>ROOMS[r.k].t==='spec');return i};
const roomsOfType=t=>S.rm.map((r,i)=>i).filter(i=>rType(i)===t);

/* ---------- журнал і кадри ---------- */
function L(t,r,k){S.log.push({t,r:r==null?null:r,k:k||''})}
function* F(t,r,k){L(t,r,k);yield {t:'frame',r:r==null?null:r}}
function* ask(msg,opts,cancel){return yield {t:'ask',msg,opts,cancel:!!cancel}}
function* pick(rooms,msg,cancel=true){if(!rooms.length)return null;return yield {t:'room',rooms,msg,cancel}}

/* ---------- юніти ---------- */
const P=()=>S.pl[S.cur];
const pName=i=>CLANS[S.pl[i].c].n;
function unitName(u){if(u.p>=0)return CLANS[S.pl[u.p].c].n;return u.nm||MONN[u.k]}
const mine=u=>u.p===S.cur||(u.k==='imp'&&S.sc===9);
const own=r=>S.rm[r].m.some(mine);
const ownRooms=()=>S.rm.map((r,i)=>i).filter(own);
const hName=h=>(h.ep?'епічний ':'')+HEROES[h.c].n;
function heroHP(c){if(c==='w'&&(S.sc===12||S.sc===17||S.epic))return 2;return 1}
function frogsEnemy(){return S.sc===4}
function frogsAlly(){return S.sc===17}
// цілі для атаки монстрів гравця в кімнаті
function monTargets(r){const o=R(r),t=o.h.map(h=>({k:'h',h}));if(frogsEnemy()&&o.res.frog>0)t.push({k:'frog'});o.m.forEach(u=>{if(u.k==='dragon'&&S.flags.rage)t.push({k:'u',u})});return t}
// цілі для атаки героїв у кімнаті
function heroTargets(r){const o=R(r),t=[];o.m.forEach(u=>{if(u.k==='dragon'&&!S.flags.rage)return;t.push({k:'u',u})});if(frogsAlly()&&o.res.frog>0)t.push({k:'frog'});return t}
const canAttackH=h=>!['rat','slime'].includes(h.c);
const canLootH=h=>!['ghost','slime'].includes(h.c);

/* ---------- підготовка ---------- */
function newGame(cfg){
 const sc=SCEN[cfg.sc-1];
 S={v:0,sc:cfg.sc,df:cfg.df,wave:1,cur:0,ph:0,rm:[],ln:[],pl:[],pend:[],log:[],g:[],gd:[],it:[],mk:[],tr:[],sup:{coin:5,bone:5,frog:sc.frogs?99:5,book:5,trap:5,port:10,ev:5},
  pool:{r:5,w:5,a:5,m:5,rat:9,ghost:3,skel:6,slime:8,imp:3,liz:0,witch:0},dunUsed:0,over:null,nid:0,flags:{},epic:!!sc.epic,lastG:null,setupQ:[],built:[],bp:[],labClan:null,tut:cfg.tut||null};
 sc.map.forEach((row,y)=>row.split(' ').forEach((c,x)=>{if(c==='....')return;const k=c.slice(0,3),v=+c.slice(3)||0;S.rm.push({k,x,y,tr:null,tv:v,res:{coin:0,bone:0,frog:0,book:0},trap:0,port:0,ev:[],xb:0,m:[],h:[]})}));
 sc.links.split(' ').forEach(p=>{const [a,b]=p.split('-');S.ln.push([rIdx(a),rIdx(b)])});
 // скарби: перемішані жетони відповідної вартості
 const pool=shuffle(TREASURES.map(t=>({v:t[0],e:t[1]})));
 S.rm.forEach(r=>{if(r.tv){const i=pool.findIndex(t=>t.v===r.tv);if(i>=0)r.tr=pool.splice(i,1)[0];else r.tr={v:r.tv,e:r.tv===4?'def':'mar'}}});
 S.tr=pool;
 (sc.portals||'').split(' ').filter(Boolean).forEach(k=>{R(rIdx(k)).port=1;S.sup.port--});
 (sc.ports2||'').split(' ').filter(Boolean).forEach(k=>{R(rIdx(k)).port=2;S.sup.port--});
 for(const k in (sc.ev||{}))sc.ev[k].forEach(e=>R(rIdx(k)).ev.push({k:e,up:1}));
 for(const k in (sc.frogs||{}))R(rIdx(k)).res.frog+=sc.frogs[k];
 for(const k in (sc.books||{})){R(rIdx(k)).res.book+=sc.books[k];S.sup.book=Math.max(0,S.sup.book-sc.books[k])}
 (sc.xblock||'').split(' ').filter(Boolean).forEach(k=>R(rIdx(k)).xb=1);
 (sc.imps||'').split(' ').filter(Boolean).forEach(k=>R(rIdx(k)).m.push({id:++S.nid,p:-2,k:'imp',hp:1}));
 for(const k in (sc.lizAt||{}))for(let i=0;i<sc.lizAt[k];i++)R(rIdx(k)).m.push({id:++S.nid,p:-3,k:'liz',hp:1});
 for(const k in (sc.witches||{}))R(rIdx(k)).m.push({id:++S.nid,p:-4,k:'witch',hp:2,mx:2,nm:sc.witches[k]});
 for(const k in (sc.pupsAt||{}))for(let i=0;i<sc.pupsAt[k];i++)R(rIdx(k)).m.push({id:++S.nid,p:-5,k:'pup',hp:1});
 if(sc.dragonAt)R(rIdx(sc.dragonAt)).m.push({id:++S.nid,p:-6,k:'dragon',hp:9,mx:9});
 for(const k in (sc.ratsAt||{}))for(let i=0;i<sc.ratsAt[k];i++){R(rIdx(k)).h.push({id:++S.nid,c:'rat',a:1,hp:1});S.pool.rat--}
 if(sc.wolfSpots)placeTokens(sc.wolfSpots.split(' ').map(rIdx),'wolf');
 // гравці
 S.pl=cfg.clans.map(c=>({c,deck:shuffle(DECKS[c].map(([n,o])=>({n,o,cl:c}))),hand:[],disc:[],play:[],lair:CLANS[c].size}));
 if(cfg.tut&&cfg.tut.deck)S.pl[0].deck=cfg.tut.deck.map(i=>{const [n,o]=DECKS.rat[i];return {n,o,cl:'rat'}});
 S.pl.forEach(p=>draw(p,5,true));
 // предмети (+ лабораторія)
 for(const t in ITEMS)ITEMS[t].forEach(([n,o])=>S.it.push({n,o,it:t}));
 if(S.rm.some(r=>r.k==='LAB')){const free=Object.keys(CLANS).filter(c=>!cfg.clans.includes(c));S.labClan=free[rnd(free.length)];DECKS[S.labClan].forEach(([n,o])=>S.it.push({n,o,it:'tac',cl:S.labClan}))}
 shuffle(S.it);S.mk=S.it.splice(0,5);
 // креслення (сц. 20)
 if(sc.build){S.bp=shuffle(Object.keys(ROOMS).filter(k=>!S.rm.some(r=>r.k===k)));S.blueprints=S.bp.splice(0,3)}
 // колода Гільдії
 if(sc.epic){for(const c in HCARDS)HCARDS[c].forEach(t=>S.g.push({k:'h',c,t,ep:1}))}
 else{for(const c in HCARDS)HCARDS[c].forEach(t=>S.g.push({k:'h',c,t}));sc.cards.forEach(([n,cnt,ts],ci)=>{for(let i=0;i<cnt;i++)S.g.push({k:'s',n,sc:sc.id,t:ts||null,ci})})}
 shuffle(S.g);
 if(cfg.tut&&cfg.tut.guild)S.g=cfg.tut.guild.concat(S.g.filter(c=>c.k==='s'));
 // хто ходить першим: найменший клан
 let best=0;S.pl.forEach((p,i)=>{if(CLANS[p.c].size<CLANS[S.pl[best].c].size)best=i});S.cur=best;
 S.flags.mermaid=S.sc===8||S.sc===16?1:0;
 if(S.sc===9)checkSewer();
 L(`Сценарій ${sc.id} «${sc.n}», складність: ${DIFN[S.df].toLowerCase()}.`,null,'h');
 // черга стартового розміщення
 S.pl.forEach((p,i)=>{const [n,t]=CLANS[p.c].start;S.setupQ.push({p:i,n,t})});
 return S;
}
function placeTokens(rooms,kind){S.rm.forEach(r=>r.ev=r.ev.filter(e=>e.k!=='x'&&e.k!=='wolf'&&e.k!=='ticket'));const toks=shuffle(['x','x','x',kind]);shuffle(rooms.slice()).slice(0,4).forEach((ri,i)=>R(ri).ev.push({k:toks[i],up:0}))}
function draw(p,n,quiet){let got=0;for(let i=0;i<n;i++){if(!p.deck.length){if(!p.disc.length)break;p.deck=shuffle(p.disc.splice(0))}p.hand.push(p.deck.shift());got++}return got}

/* ---------- стартове розміщення ---------- */
function* setupPlace(){
 while(S.setupQ.length){const q=S.setupQ[0],p=S.pl[q.p];S.cur=q.p;
  let rooms=roomsOfType(q.t);if(!rooms.length)rooms=[vault()];
  for(let i=0;i<q.n&&p.lair>0;i++){
   const r=(S.tut&&S.tut.start)?rIdx(S.tut.start[i]):yield* pick(rooms,`${pName(q.p)}: розмістіть стартового монстра (${i+1}/${q.n}) у кімнату типу «${TYPES[q.t]}»`,false);
   R(r).m.push({id:++S.nid,p:q.p,hp:CLANS[p.c].hp});p.lair--;yield* F(`${pName(q.p)} займає «${rName(r)}»`,r)}
  S.setupQ.shift()}
 let best=0;S.pl.forEach((p,i)=>{if(CLANS[p.c].size<CLANS[S.pl[best].c].size)best=i});S.cur=best;S.ph=1;
 if(S.tut&&S.tut.prep)S.tut.prep();
 L(`Хід: ${pName(S.cur)}`,null,'turn');yield* startTurn();
}
function* startTurn(){S.ph=1;S.dunUsed=0;S.pend=[];
 if(S.sc===8&&S.flags.mermaid){S.pl.forEach(()=>{});const g=draw(P(),2);if(g)yield* F(`🎤 Русалка співає: ${pName(S.cur)} бере ${g} додаткові карти`)}}

/* ---------- гра карт ---------- */
function* playCard(i){const p=P(),c=p.hand[i];let opt=0;
 if(c.o.length>1){opt=yield* ask(`«${c.n}»: оберіть варіант`,c.o.map((o,k)=>({l:o,v:k,card:1})),true);if(opt==null)return false}
 p.hand.splice(i,1);p.play.push(c);
 c.o[opt].forEach(tk=>{if(tk!=='def')S.pend.push({tk,src:c.n})});
 L(`${pName(S.cur)} грає «${c.n}»`);return true}
function* usePend(i){const pe=S.pend[i];const res=yield* doTok(pe.tk);if(res){const j=S.pend.indexOf(pe);if(j>=0)S.pend.splice(j,1)}return res}
function tokLabel(tk){if(typeof tk==='string')return tk;if(tk.sw)return 'sw';if(tk.amb)return 'amb';if(tk.nv)return 'nv';if(tk.rf)return 'rf';return '?'}

function* doTok(tk,fix){
 if(typeof tk==='string'){
  if(tk==='mv')return yield* aMove(fix&&fix.room,fix&&fix.unit);
  if(tk==='mel')return yield* aMelee(fix&&fix.room);
  if(tk==='rng')return yield* aRanged(fix&&fix.room);
  if(tk==='act')return yield* aAct(fix&&fix.room);
  if(tk==='card'){const g=draw(P(),1);if(!g){yield* F('У колоді та скиді не лишилось карт');return true}yield* F(`${pName(S.cur)} бере карту тактики`);return true}
  if(RES.includes(tk)||tk==='trap'||tk==='port')return yield* aPlace(tk,fix&&fix.room);
  if(tk[0]==='-')return yield* aDiscardRes(tk.slice(1));
  if(tk==='sum1')return yield* aSummonInto(fix&&fix.room,1);
 }
 if(tk.sw)return yield* aSwarm(tk.sw);
 if(tk.amb)return yield* aAmbush(tk.amb[0],tk.amb[1]);
 if(tk.nv)return yield* aSurge(tk.nv[0],tk.nv[1]);
 if(tk.rf)return yield* aReinforce(tk.rf);
 if(tk.sum)return yield* aSummonInto(fix&&fix.room,tk.sum);
 return false}

function* chooseUnit(r,filter,msg){const us=R(r).m.filter(filter);if(us.length<=1)return us[0]||null;
 const kinds=[];us.forEach(u=>{const key=(u.p>=0?'p'+u.p:u.k)+':'+u.hp;if(!kinds.find(k=>k.key===key))kinds.push({key,u})});
 if(kinds.length===1)return us[0];
 return yield* ask(msg,kinds.map(k=>({l:`${unitName(k.u)}${k.u.hp>1||(k.u.mx||0)>1?' ('+k.u.hp+' ♥)':''}`,v:k.u})),true)}

function* aMove(fromFix,unitFix,ghostWalls){
 const from=fromFix!=null?fromFix:yield* pick(ownRooms(),'🥾 Рух: оберіть кімнату з вашим монстром');if(from==null)return null;
 const u=unitFix||(yield* chooseUnit(from,mine,'Кого переміщуєте?'));if(!u)return null;
 let dests=nbM(from);if(ghostWalls)dests=[...new Set(dests.concat(nbGrid(from)))];
 const to=yield* pick(dests,`🥾 Куди йде ${unitName(u).toLowerCase()} з «${rName(from)}»?`);if(to==null)return null;
 const f=R(from),o=R(to),opts=[];
 RES.forEach(k=>{if(f.res[k]>0&&!(frogsEnemy()&&k==='frog'))opts.push({l:`Нести ${RESA[k]} (тут ${f.res[k]})`,v:k,ic:k})});
 if(f.trap>0)opts.push({l:`Нести пастку (тут ${f.trap})`,v:'trap',ic:'trap'});
 if(S.sc===13&&f.m.some(x=>x.k==='liz'))opts.push({l:'Нести людоящера',v:'liz',ic:'liz'});
 const viaPortal=!nbP(from).includes(to);
 if(S.sc===18&&!viaPortal&&f.m.some(x=>x.k==='pup'))opts.push({l:'Нести цуценя гнола',v:'pup',ic:'pup'});
 let carry='';if(opts.length){opts.push({l:'Іти з порожніми руками',v:'',ic:'mv'});carry=yield* ask(`Що ${unitName(u).toLowerCase()} несе в «${rName(to)}»?`,opts,true);if(carry==null)return null}
 f.m.splice(f.m.indexOf(u),1);o.m.push(u);
 if(carry==='trap'){f.trap--;o.trap++}else if(carry==='liz'||carry==='pup'){const x=f.m.find(z=>z.k===carry);f.m.splice(f.m.indexOf(x),1);o.m.push(x);if(carry==='pup'&&to===vault()&&o.ev.some(e=>e.k==='dragonev')){o.ev.splice(o.ev.findIndex(e=>e.k==='dragonev'),1);L('Цуценя заспокоює Драконицю: −1 жетон події',to)}}else if(carry){f.res[carry]--;o.res[carry]++}
 if(S.sc===9)checkSewer();
 yield* F(`🥾 ${unitName(u)}: ${rName(from)} → ${rName(to)}${carry?' (несе '+(RESN[carry]||(carry==='liz'?'людоящера':'цуценя'))+')':''}`,to);
 yield* checkInstant();return {room:to}}

function* hitHeroBy(r,how){const o=R(r),t=monTargets(r);if(!t.length)return null;let tg=t[0];
 if(t.length>1){const kinds=[];t.forEach(x=>{const key=x.k==='h'?x.h.c+(x.h.a?'a':'e')+x.h.hp:x.k==='frog'?'frog':'dragon';if(!kinds.find(k=>k.key===key))kinds.push({key,x})});
  if(kinds.length>1)tg=yield* ask('Кого атакуєте?',kinds.map(k=>({l:k.x.k==='h'?`${hName(k.x.h)}${k.x.h.a?'':' (виснажений)'}${k.x.h.hp>1?' · '+k.x.h.hp+'♥':''}`:k.x.k==='frog'?'Жаба-ворог':'Скажена Дракониця',v:k.x,hero:k.x.h})),true);if(tg==null)return null}
 if(tg.k==='frog'){o.res.frog--;yield* F(`${how} ${pName(S.cur)} проганяє жабу (${rName(r)})`,r);return {room:r}}
 if(tg.k==='u'){yield* dmgUnit(r,tg.u,1,null,`${how} ${pName(S.cur)} б’є Драконицю`);return {room:r}}
 yield* hurtHero(r,tg.h,1,`${how} ${pName(S.cur)} атакує: ${hName(tg.h)}`);return {room:r}}
function* aMelee(fix){const rooms=(fix!=null?[fix]:ownRooms()).filter(r=>monTargets(r).length);
 if(!rooms.length){if(fix==null)yield* F('Немає героїв у кімнатах з вашими монстрами');return null}
 const r=rooms.length===1&&fix!=null?rooms[0]:yield* pick(rooms,'🗡 Ближня атака: кімната з вашим монстром і героєм');if(r==null)return null;
 return yield* hitHeroBy(r,'🗡')}
function* aRanged(fix){const src=fix!=null?[fix]:ownRooms();const rooms=[...new Set(src.flatMap(nbP))].filter(r=>monTargets(r).length);
 if(!rooms.length){if(fix==null)yield* F('Немає героїв у суміжних кімнатах');return null}
 const r=yield* pick(rooms,'🏹 Дальня атака: кімната з героєм поруч із вашим монстром');if(r==null)return null;
 return yield* hitHeroBy(r,'🏹')}
function* aPlace(k,fix){if(k==='port'){if(S.sup.port<=0){yield* F('Жетонів порталів не лишилось');return null}
  const rooms=(fix!=null?[fix]:ownRooms()).filter(r=>R(r).port!==2);const r=yield* pick(rooms,'🌀 Портал: кімната з вашим монстром');if(r==null)return null;if(R(r).port===0)S.sup.port--;R(r).port=2;yield* F(`🌀 ${pName(S.cur)} відкриває портал у «${rName(r)}»`,r);return {room:r}}
 const sup=k==='trap'?S.sup.trap:S.sup[k];if(sup<=0){yield* F(`У запасі немає: ${RESN[k]}`);return null}
 const r=fix!=null?fix:yield* pick(ownRooms(),`Покладіть ${RESA[k]} в кімнату з вашим монстром`);if(r==null)return null;
 if(k==='trap'){R(r).trap++;S.sup.trap--}else{R(r).res[k]++;S.sup[k]--}
 yield* F(`${pName(S.cur)} кладе ${RESA[k]} в «${rName(r)}»`,r);return {room:r}}
function* aDiscardRes(k){const rooms=ownRooms().filter(r=>R(r).res[k]>0);const r=yield* pick(rooms,`Скиньте ${RESA[k]} з кімнати з вашим монстром`);if(r==null)return null;R(r).res[k]--;S.sup[k]++;yield* F(`${pName(S.cur)} скидає ${RESA[k]} в «${rName(r)}»`,r);return {room:r}}
function* aSummonInto(r,n){const p=P();if(r==null){r=yield* pick(ownRooms(),'Куди викликати монстра?');if(r==null)return null}let c=0;
 for(let i=0;i<n&&p.lair>0;i++){R(r).m.push({id:++S.nid,p:S.cur,hp:CLANS[p.c].hp});p.lair--;c++}
 if(c)yield* F(`➕ ${pName(S.cur)}: ${c} монстр(и) з лігва в «${rName(r)}»`,r);else yield* F('Лігво порожнє');return {room:r}}
function* aAmbush(n,t){const p=P();let rooms=roomsOfType(t);if(!rooms.length)rooms=[vault()];let c=0;
 if(p.lair<=0){yield* F('Лігво порожнє — засідка неможлива');return null}
 for(let i=0;i<n&&p.lair>0;i++){const r=yield* pick(rooms,`Засідка: виклик ${i+1}/${n} у кімнату типу «${TYPES[t]}»${c?' (або «Готово»)':''}`);if(r==null)break;R(r).m.push({id:++S.nid,p:S.cur,hp:CLANS[p.c].hp});p.lair--;c++;yield* F(`➕ ${pName(S.cur)} з’являється в «${rName(r)}»`,r)}
 return c?{room:null}:null}
function* aSwarm(X){const rooms=ownRooms();const r=yield* pick(rooms,`Зграя: усі ваші монстри в одній кімнаті виконують «${ACTN[X]}»`);if(r==null)return null;
 const us=R(r).m.filter(mine);yield* F(`Зграя в «${rName(r)}»: ${us.length} монстр(и) діють`,r);
 for(const u of us){if(X==='mv'){if(!R(r).m.includes(u))continue;yield* aMove(r,u)}else if(X==='mel'){if(!R(r).m.includes(u))continue;yield* aMelee(r)}else if(X==='rng')yield* aRanged(r);else if(X==='act')yield* aAct(r);else yield* doTok(X,{room:r})}
 return {room:r}}
function* aSurge(A,B){const res=yield* doTok(A);if(!res)return null;
 const free=yield* ask(`Навала вдалася! Безкоштовно: ${ACTN[tokLabel(B)]||(B.sum?'виклик '+B.sum+' монстрів':'виклик монстра')}?`,[{l:'Так',v:1},{l:'Ні',v:0}]);
 if(free){if(B==='sum1')yield* aSummonInto(res.room,1);else if(B.sum)yield* aSummonInto(res.room,B.sum);else yield* doTok(B)}
 return res}
function* aReinforce(X){const p=P(),got=[],rest=[];const seen=[];
 for(let i=0;i<3;i++){if(!p.deck.length){if(!p.disc.length)break;p.deck=shuffle(p.disc.splice(0))}seen.push(p.deck.shift())}
 seen.forEach(c=>{if(c.o.some(o=>o.some(t=>t===X||(t&&t.sw===X))))got.push(c);else rest.push(c)});
 p.hand.push(...got);p.disc.push(...rest);
 yield {t:'show',title:`Зміцнення: шукаємо «${ACTN[X]}»`,cards:seen,take:got.map(c=>c.n)};
 yield* F(`${pName(S.cur)} переглядає 3 карти: бере ${got.length}, скидає ${rest.length}`);return {room:null}}

/* ---------- активація ---------- */
function roomActBlocked(r){const o=R(r);if(o.xb)return true;if(S.sc===9&&o.k==='SEW'&&!o.m.some(u=>u.k==='imp'))return true;return false}
function checkSewer(){const s=rIdx('SEW');if(s>=0)R(s).xb=R(s).m.some(u=>u.k==='imp')?0:1}
function clanReady(){return S.rm.some(r=>r.m.some(u=>u.p===S.cur))}
function* aAct(fix){let r=fix;
 if(r==null){const opts=[];if(clanReady())opts.push({l:`Здібність клану: ${CLANS[P().c].ab}`,v:'clan',ic:'act'});if(ownRooms().length)opts.push({l:'Активувати кімнату з вашим монстром',v:'room',ic:'act'});
  if(!opts.length){yield* F('Немає монстрів у підземеллі');return null}
  const c=opts.length===1?opts[0].v:yield* ask('🖐 Активація: що робите?',opts,true);if(c==null)return null;
  if(c==='clan')return yield* clanAbility();
  r=yield* pick(ownRooms(),'🖐 Оберіть кімнату з вашим монстром');if(r==null)return null}
 const o=R(r),d=ROOMS[o.k],opts=[];const bl=roomActBlocked(r);
 if(d.act&&!d.act.dun){
  if(d.act.put){const k=d.act.put,sup=k==='trap'?S.sup.trap:S.sup[k];opts.push({l:`${d.n}: покласти ${RESA[k]}${sup<=0?' (запас вичерпано)':''}`,v:'put',d:bl||sup<=0,ic:k})}
  if(d.act.buy){const [k,t]=d.act.buy,has=o.res[k]>0,av=S.mk.some(m=>m.it===t);opts.push({l:`${d.n}: скинути ${RESA[k]} і взяти «${ITYPE[t]}»${!has?' (немає '+RESN[k]+')':!av?' (немає на ринку)':''}`,v:'buy',d:bl||!has||!av,ic:t})}
  if(d.act.lab)opts.push({l:'Лабораторія: витягнути карту Гільдії й узяти карту тактики з ринку',v:'lab',d:bl,ic:'tac'});
  if(d.act.build)opts.push({l:`Будмайданчик: скинути монети й збудувати кімнату${o.res.coin<1?' (потрібна монета)':''}`,v:'build',d:bl||o.res.coin<1||!(S.blueprints||[]).length,ic:'coin'});
 }
 if(o.port===1)opts.push({l:'Завершити портал',v:'port',ic:'port'});
 if((S.sc===6||S.sc===14)&&o.ev.some(e=>!e.up&&(e.k==='x'||e.k==='wolf'||e.k==='ticket')))opts.push({l:'Перевернути жетон події',v:'flip',ic:'ev'});
 if(S.sc===9&&o.k==='VAU')opts.push({l:`Викликати біса у сховище${S.pool.imp<=0?' (немає фігурок)':''}`,v:'imp',d:S.pool.imp<=0,ic:'imp'});
 if(!fix&&clanReady())opts.push({l:`Здібність клану: ${CLANS[P().c].ab}`,v:'clan',ic:'act'});
 if(fix&&clanReady())opts.push({l:`Здібність клану: ${CLANS[P().c].ab}`,v:'clan',ic:'act'});
 if(!opts.length){yield* F(`«${d.n}» не має дії активації`);return null}
 const c=yield* ask(`🖐 Активація: ${d.n}${bl?' (дію кімнати закрито жетоном «Х»)':''}`,opts,true);if(c==null)return null;
 if(c==='clan')return yield* clanAbility();
 if(c==='put'){const k=d.act.put;if(k==='trap'){o.trap++;S.sup.trap--}else{o.res[k]++;S.sup[k]--}yield* F(`🖐 «${d.n}»: +${RESN[k]}`,r);return {room:r}}
 if(c==='port'){o.port=2;yield* F(`🌀 Портал у «${d.n}» завершено`,r);return {room:r}}
 if(c==='imp'){o.m.push({id:++S.nid,p:-2,k:'imp',hp:1});S.pool.imp--;yield* F('Новий біс-прислужник у сховищі',r);return {room:r}}
 if(c==='flip'){const e=o.ev.find(x=>!x.up&&(x.k==='x'||x.k==='wolf'||x.k==='ticket'));e.up=1;
  if(e.k==='wolf')yield* F('🐺 Знайдено вовкулаку!',r);else if(e.k==='ticket'){o.ev.splice(o.ev.indexOf(e),1);const g=draw(P(),2);yield* F(`🎫 Золотий квиток! ${pName(S.cur)} бере ${g} карти`,r)}else{if(S.sc===14)o.ev.splice(o.ev.indexOf(e),1);yield* F('Жетон «Х»: нічого',r)}return {room:r}}
 if(c==='buy'){const [k,t]=d.act.buy;const choices=S.mk.map((m,i)=>({m,i})).filter(x=>x.m.it===t);
  const i=yield* ask(`Оберіть: ${ITYPE[t]}`,choices.map(x=>({l:x.m,v:x.i,card:1})),true);if(i==null)return null;
  o.res[k]--;S.sup[k]++;const it=S.mk.splice(i,1)[0];P().disc.push(it);if(S.it.length)S.mk.splice(i,0,S.it.shift());
  yield* F(`🛒 ${pName(S.cur)} отримує «${it.n}» (у скид)`,r);return {room:r}}
 if(c==='lab'){const card=gDraw();if(card){S.gd.push(card);yield* F(`Лабораторія: Гільдія — ${gName(card)}`,r);if(card.k==='h'||(card.k==='s'&&(card.n==='Скелет')))yield* jail(card.k==='h'?card.c:'skel')}
  const ch=S.mk.map((m,i)=>({m,i})).filter(x=>x.m.it==='tac');
  if(ch.length){const i=yield* ask('Лабораторія: візьміть карту тактики з ринку',ch.map(x=>({l:x.m,v:x.i,card:1})),true);if(i!=null){const it=S.mk.splice(i,1)[0];P().disc.push(it);if(S.it.length)S.mk.splice(i,0,S.it.shift());yield* F(`🧪 ${pName(S.cur)} отримує «${it.n}»`,r)}}
  else yield* F('На ринку немає карт тактики',r);
  yield* resolveHeroes();return {room:r}}
 if(c==='build')return yield* build(r);
 return null}
function* clanAbility(){const c=P().c,me=S.cur;
 if(c==='dragon'){S.rm.forEach(r=>r.m.forEach(u=>{if(u.p===me)u.hp=CLANS.dragon.hp}));yield* F('🐲 Дракон зализує рани: усі рани знято');return {room:null}}
 if(c==='lizard'){const rooms=S.rm.map((r,i)=>i).filter(i=>R(i).m.some(u=>u.p===me));const tg=[...new Set(rooms.flatMap(nbP))].filter(r=>monTargets(r).length);
  const r=yield* pick(tg,'Людоящір: дистанційна атака по сусідній кімнаті');if(r==null)return null;return yield* hitHeroBy(r,'🏹')}
 if(c==='gnoll'){const rooms=S.rm.map((r,i)=>i).filter(i=>R(i).m.some(u=>u.p===me)&&monTargets(i).length);const r=yield* pick(rooms,'Гнол: ближня атака');if(r==null)return null;return yield* hitHeroBy(r,'🗡')}
 if(c==='slime'){draw(P(),1);yield* F('🟣 Слизун ділиться: +1 карта');return {room:null}}
 if(c==='skel'){if(S.sup.bone<=0){yield* F('Кісток у запасі немає');return null}const rooms=S.rm.map((r,i)=>i).filter(i=>R(i).m.some(u=>u.p===me));const r=yield* pick(rooms,'Скелет: кістка в кімнату зі скелетом');if(r==null)return null;R(r).res.bone++;S.sup.bone--;yield* F(`💀 Скелет кладе кістку в «${rName(r)}»`,r);return {room:r}}
 if(c==='rat'){if(P().lair<=0){yield* F('Лігво порожнє');return null}const rooms=S.rm.map((r,i)=>i).filter(i=>R(i).m.some(u=>u.p===me));const r=yield* pick(rooms,'Щурник: новий щурник у кімнату з вашим щурником');if(r==null)return null;return yield* aSummonInto(r,1)}
 if(c==='imp')return yield* aMove(null,null,false);
 if(c==='ghost'){const rooms=S.rm.map((r,i)=>i).filter(i=>R(i).m.some(u=>u.p===me));const r=yield* pick(rooms,'Привид: звідки летимо (крізь стіни)?');if(r==null)return null;const u=R(r).m.find(x=>x.p===me);return yield* aMove(r,u,true)}
 if(c==='witch'){if(S.sup.port<=0){yield* F('Порталів не лишилось');return null}const rooms=S.rm.map((r,i)=>i).filter(i=>R(i).m.some(u=>u.p===me)&&R(i).port!==2);const r=yield* pick(rooms,'Відьма: завершений портал у кімнату з відьмою');if(r==null)return null;if(R(r).port===0)S.sup.port--;R(r).port=2;yield* F(`🌀 Відьма відкриває портал у «${rName(r)}»`,r);return {room:r}}
 return null}
function* build(r){const o=R(r);const max=Math.min(3,o.res.coin);const opts=[];for(let v=1;v<=max;v++){const has=S.tr.some(t=>t.v===v);opts.push({l:`Скинути ${v} монет(и) → скарб ${v}${has?'':' (жетона немає)'}`,v,d:!has})}
 const v=yield* ask('Будмайданчик: скільки монет витратити?',opts,true);if(v==null)return null;
 const bpk=yield* ask('Оберіть креслення',S.blueprints.map(k=>({l:ROOMS[k].n+' ('+TYPES[ROOMS[k].t]+')',v:k,room:k})),true);if(bpk==null)return null;
 const cells=[];S.rm.forEach(a=>[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{const x=a.x+dx,y=a.y+dy;if(x<0||y<0||x>4||y>4)return;if(S.rm.some(b=>b.x===x&&b.y===y))return;if(!cells.some(c=>c.x===x&&c.y===y))cells.push({x,y})}));
 if(!cells.length){yield* F('Немає вільного місця');return null}
 const cell=yield {t:'cell',cells,msg:`Де збудувати «${ROOMS[bpk].n}»?`};if(cell==null)return null;
 const nbs=S.rm.map((b,i)=>i).filter(i=>Math.abs(R(i).x-cell.x)+Math.abs(R(i).y-cell.y)===1);
 let link=nbs[0];if(nbs.length>1){link=yield* ask('З якою кімнатою з’єднати прохід?',nbs.map(i=>({l:rName(i),v:i})),false)}
 o.res.coin-=v;S.sup.coin+=v;const ti=S.tr.findIndex(t=>t.v===v);const tr=S.tr.splice(ti,1)[0];
 S.rm.push({k:bpk,x:cell.x,y:cell.y,tr,tv:v,res:{coin:0,bone:0,frog:0,book:0},trap:0,port:0,ev:[],xb:0,m:[],h:[]});const ni=S.rm.length-1;S.ln.push([ni,link]);
 S.blueprints.splice(S.blueprints.indexOf(bpk),1);if(S.bp.length)S.blueprints.push(S.bp.shift());S.built.push(bpk);
 yield* F(`🏗 Збудовано «${ROOMS[bpk].n}» зі скарбом ${v}`,ni);return {room:r}}

/* ---------- темниця (ризик) ---------- */
function* dungeonRisk(){if(S.dunUsed)return false;const card=gDraw();if(!card){yield* F('Колода Гільдії порожня');return false}S.dunUsed=1;S.gd.push(card);S.lastG=card;
 const jr=jailRoom();yield* F(`⚡ ${pName(S.cur)} ризикує: Гільдія — ${gName(card)}`,jr);
 if(card.k==='h'||(card.k==='s'&&card.n==='Скелет')){yield* jail(card.k==='h'?card.c:'skel');const g=draw(P(),3);yield* F(`${pName(S.cur)} бере ${g} карти тактики`,jr);yield* resolveHeroes()}
 else yield* F('Карта сценарію — нічого не відбувається',jr);
 return true}

/* ---------- Гільдія ---------- */
function gName(c){if(!c)return '';if(c.k==='h')return `${c.ep?'епічн. ':''}${HEROES[c.c].n} (${TYPES[c.t]})`;return `«${c.n}»${c.t?' ('+c.t.map(t=>TYPES[t]).join(', ')+')':''}`}
function gDraw(){if(!S.g.length){if(S.wave===1){S.wave=2;S.g=shuffle(S.gd.splice(0));L('🌊 Колода Гільдії скінчилась — перетасовуємо. Хвиля 2!',null,'h')}else{S.gEnd=1;return null}}return S.g.shift()}
function* drawAndPlay(){if(S.over)return;const c=gDraw();if(!c)return;S.lastG=c;yield* F(`🃏 Гільдія: ${gName(c)}`,null,'g');
 if(c.k==='h')yield* summonCard(c.c,[c.t]);else yield* scenCard(c);
 S.gd.push(c);
 yield* resolveHeroes();yield* checkInstant()}
function* extraGuild(n,why){for(let i=0;i<n&&!S.over;i++){if(why&&i===0)yield* F(why);yield* drawAndPlay()}}
function summonRooms(types){let rooms=[];types.forEach(t=>{if(t==='spec')rooms.push(...S.rm.map((r,i)=>i).filter(i=>rType(i)==='spec'));else rooms.push(...roomsOfType(t))});return [...new Set(rooms)]}
function* summonCard(cls,types){let rooms=summonRooms(types);
 if(!rooms.length){if(S.epic){const opts=[vault(),...S.rm.map((r,i)=>i).filter(i=>rType(i)==='spec')];const r=yield* pick(opts,'Зруйноване підземелля: герой з’являється у сховищі або в особливій кімнаті',false);rooms=[r]}else return}
 let outside=false;for(const r of rooms){if(S.over)return;yield* summonHero(cls,r);if(r!==jailRoom())outside=true}
 if(cls==='w'&&outside&&(S.sc===12||S.sc===17)){const lab=rIdx('LAB');if(lab>=0){yield* F('Надзусилля: 3-й воїн у лабораторії',lab);yield* summonHero('w',lab)}}}
function* summonHero(cls,r,o={}){
 if(S.pool[cls]<=0){let any=0;for(let i=0;i<S.rm.length;i++){const rm=R(i);if(rm.h.some(h=>h.c===cls)){rm.h.forEach(h=>{if(!h.a){h.a=1;any=1}})}}
  yield* F(`Жетонів «${HEROES[cls].n}» не лишилось: усі такі герої та їхні сусіди знову активні`,null);return null}
 S.pool[cls]--;const h={id:++S.nid,c:cls,a:1,hp:heroHP(cls),ep:S.epic&&HCARDS[cls]?1:0};R(r).h.push(h);
 const jr=jailRoom(),inJail=r===jr&&R(r).k!=='VAU';
 yield* F(`${heroIcon(cls)} ${hName(h)} з’являється: ${rName(r)}${inJail?' (у темниці)':''}`,r);
 // хизування
 yield* showOff(h,r,inJail);
 if(!R(r).h.includes(h))return null;
 if(inJail&&cls!=='m')h.a=0;
 // сценарні реакції на виклик
 if(cls==='m'&&(S.sc===10||S.sc===16)&&S.pool.rat>0){S.pool.rat--;R(r).h.push({id:++S.nid,c:'rat',a:inJail?0:1,hp:1});yield* F('🎺 Сурмач-щурник іде за магом',r)}
 if(cls==='a'&&S.sc===16&&S.pool.ghost>0){S.pool.ghost--;R(r).h.push({id:++S.nid,c:'ghost',a:inJail?0:1,hp:1});yield* F('🎸 Привид-металіст іде за лучницею',r)}
 if(cls==='r'&&(S.sc===7||S.sc===17)){let n=0;S.rm.forEach((rm,i)=>{if(rm.h.some(x=>x.c==='r'))rm.h.forEach(x=>{if(!x.a){x.a=1;n++}})});if(n)yield* F('Організована злочинність: пройдисвітки знову активні',r)}
 if(cls==='slime'&&S.sc===19){for(let i=0;i<S.rm.length;i++){if(i===r)continue;const rm=R(i);if(rm.h.some(x=>x.c==='slime'&&!x.a)&&S.pool.slime>0){S.pool.slime--;rm.h.push({id:++S.nid,c:'slime',a:1,hp:1});rm.h.forEach(x=>x.a=1);yield* F('Розділяй та завойовуй: ще один слизун, герої надихнулися',i)}}}
 yield* heroArrive(h,r,true);return h}
function heroIcon(c){return {r:'🗡️',w:'🪓',a:'🏹',m:'🧙‍♂️',rat:'🐀',ghost:'👻',skel:'💀',slime:'🟣'}[c]||'⚔'}
function* showOff(h,r,inJail){const o=R(r);
 if(h.c==='r'){if(o.trap>0){o.trap--;S.sup.trap++;yield* F('🗡️ Пройдисвітка знешкоджує пастку',r)}}
 else if(h.c==='w'){let lim=h.ep?1:2,rm=0;const kinds=RES.filter(k=>o.res[k]>0&&!(S.sc===5&&k==='book'));
  while(lim>0&&RES.some(k=>o.res[k]>0&&!(S.sc===5&&k==='book'))){const ks=RES.filter(k=>o.res[k]>0&&!(S.sc===5&&k==='book'));let k=ks[0];if(ks.length>1)k=yield* ask(`Воїн трощить ресурс у «${rName(r)}» — який саме? (${rm+1}/${h.ep?1:2})`,ks.map(x=>({l:RESN[x],v:x,ic:x})));o.res[k]--;if(!(S.sc===17&&k==='book'))S.sup[k]++;lim--;rm++}
  if(rm)yield* F(`🪓 Воїн скидає ${rm} ресурс(и)`,r)}
 else if(h.c==='a'){yield* archerShot(r,h)}
 else if(h.c==='m'){if(inJail){o.h.forEach(x=>x.a=1);yield* F(h.ep?'🧙‍♂️ Епічний маг надихає всіх у темниці':'🧙‍♂️ Маг відмикає темницю: усі в’язні активні!',r)}}}
function* archerShot(r,h){const goals=S.sc===13?heroGoals():[vault()];const d=distFrom(goals);let c=nbP(r).filter(j=>heroTargets(j).length);
 if(h.ep){const nx=nextRooms(r,goals);c=c.filter(j=>nx.includes(j))}
 if(!c.length)return;const m=Math.min(...c.map(j=>d[j]??99));c=c.filter(j=>(d[j]??99)===m);let t=c[0];
 if(c.length>1)t=yield* pick(c,'Лучниця цілиться: кімнати рівноцінні — оберіть, куди вона стріляє',false);
 yield* F(`🏹 Лучниця стріляє в «${rName(t)}»`,t);yield* heroHitsMonster(t,h,true)}
function* heroArrive(h,r,summoned){const o=R(r);
 if(S.sc===14){const e=o.ev.find(x=>!x.up&&(x.k==='x'||x.k==='ticket'));if(e){o.ev.splice(o.ev.indexOf(e),1);if(e.k==='ticket'){yield* F('🎫 Герой знайшов Золотий квиток! +2 карти Гільдії',r);yield* extraGuild(2)}else yield* F('Герой перевернув жетон «Х»',r)}}
 if(!summoned&&h.ep){if(h.c==='r'&&o.trap>0){o.trap--;S.sup.trap++;yield* F('Епічна пройдисвітка знешкоджує пастку',r)}if(h.c==='m'&&o.port===2){o.port=1;yield* F('Епічний маг закриває портал',r)}}
 while(o.trap>0&&o.h.includes(h)){o.trap--;S.sup.trap++;if(yield* hurtHero(r,h,1,`🪤 Пастка в «${rName(r)}» б’є ${hName(h)}`))return}
 if(!o.h.includes(h))return;
 if(h.a&&R(r).k!=='DUN'&&!(['rat'].includes(h.c))){const ex=o.h.filter(x=>!x.a&&x!==h);if(ex.length){ex.forEach(x=>x.a=1);yield* F(`${hName(h)} надихає ${ex.length} виснажених героїв`,r)}}
 if(!summoned&&h.ep){if(h.c==='w'){const t=heroTargets(r);if(t.length){yield* F('Епічний воїн з ходу атакує',r);yield* heroHitsMonster(r,h,true)}}if(h.c==='a')yield* archerShot(r,h)}}
function* hurtHero(r,h,n,msg){h.hp-=n;if(h.hp<=0){const o=R(r);o.h.splice(o.h.indexOf(h),1);if(S.pool[h.c]!=null)S.pool[h.c]++;yield* F(`${msg} — ${hName(h)} залишає підземелля`,r);
  if(h.ep&&S.sup.coin>0){o.res.coin++;S.sup.coin--;L('Підземельний збір: +монета',r)}return true}
 yield* F(`${msg} (лишилось ${h.hp}♥)`,r);return false}
function* heroHitsMonster(r,h,noExhaust){const t=heroTargets(r);if(!t.length)return;let tg=t[0];
 if(t.length>1){const kinds=[];t.forEach(x=>{const key=x.k==='frog'?'frog':(x.u.p>=0?'p'+x.u.p:x.u.k)+':'+x.u.hp;if(!kinds.find(k=>k.key===key))kinds.push({key,x})});
  if(kinds.length>1)tg=yield* ask(`${hName(h)} атакує в «${rName(r)}» — кого саме вдарять?`,kinds.map(k=>({l:k.x.k==='frog'?'Жаба':`${unitName(k.x.u)}${(k.x.u.mx||CLANS[S.pl[k.x.u.p]?.c]?.hp||1)>1?' ('+k.x.u.hp+'♥)':''}`,v:k.x})),false)}
 if(tg.k==='frog'){R(r).res.frog--;yield* F(`${hName(h)} прибиває жабу`,r);return}
 // реакція «Захист»
 const u=tg.u;
 for(let pi=0;pi<S.pl.length&&!(S.tut&&S.tut.noDef);pi++){const pl=S.pl[pi];if(!R(r).m.some(x=>x.p===pi))continue;const defs=pl.hand.map((c,i)=>({c,i})).filter(x=>x.c.o.some(o=>o.includes('def')));
  if(!defs.length)continue;const ch=yield* ask(`🛡 ${pName(pi)}: ${hName(h)} атакує ${unitName(u).toLowerCase()} у «${rName(r)}». Скинути карту із Захистом, щоб зменшити ушкодження?`,defs.map(x=>({l:x.c,v:x.i,card:1})).concat([{l:'Не захищатися',v:-1}]));
  if(ch!=null&&ch>=0){const c=pl.hand.splice(ch,1)[0];pl.disc.push(c);yield* F(`🛡 ${pName(pi)} скидає «${c.n}» — Захист! Ушкодження 0`,r);return}}
 yield* dmgUnit(r,u,1,h)}
function* dmgUnit(r,u,n,h,msg){const o=R(r);
 if(u.k==='pup'){const d=distFrom([vault()]);const far=nbP(r).filter(j=>(d[j]??0)>(d[r]??0));let to=far[0];if(far.length>1)to=yield* pick(far,'Цуценя тікає далі від сховища — куди?',false);if(to!=null){o.m.splice(o.m.indexOf(u),1);R(to).m.push(u)}const v=vault();R(v).ev.push({k:'dragonev',up:1});yield* F('Цуценя гнола відбігає, у сховищі +1 жетон події',to??r);yield* dragonCheck18();return}
 u.hp-=n;
 if(u.hp>0){yield* F(`${msg||(h?hName(h)+' б’є':'Удар')}: ${unitName(u)} отримує рану (${u.hp}♥)`,r);return}
 o.m.splice(o.m.indexOf(u),1);
 if(u.p>=0)S.pl[u.p].lair++;else if(u.k==='imp')S.pool.imp++;else if(u.k==='liz')S.pool.liz++;else if(u.k==='witch')S.pool.witch++;
 if(u.k==='dragon'){S.flags.rage=0;R(vault()).ev=R(vault()).ev.filter(e=>e.k!=='dragonev');if(S.sc===18){u.hp=9;o.m.push(u);yield* F('🐲 Дракониця заспокоїлась',r)}else yield* F('🐲 Дракониця заспокоїлась і пішла шукати вовкулаку',r);return}
 yield* F(`${msg||(h?hName(h)+' б’є':'Удар')}: ${unitName(u)} залишає підземелля`,r);
 if(h&&h.c==='skel'&&S.pool.skel>0){S.pool.skel--;o.h.push({id:++S.nid,c:'skel',a:0,hp:1});yield* F('Неживий марш: з’являється ще один скелет',r)}
 yield* checkInstant()}
function* resolveHeroes(){let guard=0;
 while(!S.over&&guard++<400){let best=null,bd=1e9;const d=distFrom(heroGoals());
  S.rm.forEach((o,i)=>o.h.forEach(h=>{if(h.a){const dd=d[i]??50;if(dd<bd){bd=dd;best={h,r:i}}}}));
  if(!best)break;yield* heroAct(best.h,best.r)}}
function* heroAct(h,r){const o=R(r);
 if(heroTargets(r).length){h.a=0;if(!canAttackH(h)){yield* F(`${hName(h)} не вміє атакувати й чекає`,r);return}yield* F(`${hName(h)} атакує в «${rName(r)}»`,r);yield* heroHitsMonster(r,h);return}
 if(o.tr){const looters=o.h.filter(x=>x.a&&canLootH(x));if(looters.length>=o.tr.v){const v=o.tr.v;looters.sort((a,b)=>(b===h)-(a===h));looters.slice(0,v).forEach(x=>x.a=0);yield* loot(r);return}
  o.h.forEach(x=>x.a=0);yield* F(`Героїв замало для скарбу ${o.tr.v} — чекають підкріплення (${rName(r)})`,r);return}
 const goals=heroGoals(),nx=nextRooms(r,goals);if(!nx.length){h.a=0;return}
 let to=nx[0];if(nx.length>1)to=yield* pick(nx,`Герої в «${rName(r)}» просуваються — шляхи рівноцінні, оберіть куди`,false);
 const group=o.h.filter(x=>x.a);if((S.sc===10||S.sc===16)&&group.some(x=>x.c==='m'))o.h.forEach(x=>{if(x.c==='rat'&&!group.includes(x)){x.a=1;group.push(x)}});
 group.forEach(x=>{o.h.splice(o.h.indexOf(x),1);R(to).h.push(x)});
 yield* F(`${group.map(hName).join(', ')}: ${rName(r)} → ${rName(to)}`,to);
 for(const x of group)if(R(to).h.includes(x))yield* heroArrive(x,to,false)}
function* loot(r){const o=R(r),t=o.tr;o.tr=null;yield* F(`💰 Герої грабують скарб ${t.v} у «${rName(r)}»: ${TEFF[t.e][0]}!`,r);
 if(S.sc===8&&o.k==='SEW'&&S.flags.mermaid){S.flags.mermaid=0;o.ev=o.ev.filter(e=>e.k!=='mermaid');yield* F('🎤 Русалка більше не співає. Спустошення: добір до 4 карт',r)}
 if(t.e==='def'){S.over='lose';S.overWhy='Героям дістався скарб 4.';yield* F('☠️ Скарб 4 загарбано. Поразка!',r,'h');return}
 if(t.e==='mar'){const ks=RES.filter(k=>o.res[k]>0);if(ks.length){let k=ks[0];if(ks.length>1)k=yield* ask('Мародерство: який ресурс втрачаєте?',ks.map(x=>({l:RESN[x],v:x,ic:x})));o.res[k]--;S.sup[k]++;yield* F(`Мародерство: зникає ${RESN[k]}`,r)}else yield* F('Мародерство: ресурсів немає',r)}
 if(t.e==='cur')yield* allDiscard('Прокляття');
 if(t.e==='heal'){o.h.forEach(x=>x.a=1);yield* F('Лікування: герої в кімнаті знову активні',r)}
 if(t.e==='pri'){const c=gDraw();if(c){S.gd.push(c);yield* F(`В’язень: Гільдія — ${gName(c)}`,r);if(c.k==='h')yield* jail(c.c);else if(c.n==='Скелет')yield* jail('skel')}}}
function* allDiscard(why){for(let i=0;i<S.pl.length;i++){const p=S.pl[i];if(!p.hand.length)continue;const ch=yield* ask(`${why}: ${pName(i)} скидає 1 карту тактики з руки на вибір`,p.hand.map((c,k)=>({l:c,v:k,card:1})),false);const c=p.hand.splice(ch,1)[0];p.disc.push(c);L(`${pName(i)} скидає «${c.n}»`)}yield {t:'frame',r:null}}
function* jail(cls){const jr=jailRoom();if(jr<0){yield* F('Темниці немає — героя відпущено');return}yield* F(`⛓ ${HEROES[cls].n} — до темниці`,jr);yield* summonHero(cls,jr)}

/* ---------- карти сценаріїв ---------- */
function* scenCard(c){const v=vault();
 switch(c.n){
 case 'Відьма':{const a=rIdx('APO');if(R(a).res.frog>0){R(a).res.frog--;S.sup.frog++;yield* F('🧙‍♀️ Відьма з’їдає жаб’ячу юшку й задоволена',a)}else{yield* F('🧙‍♀️ Жаб немає — відьма проклинає!',a);yield* allDiscard('Прокляття відьми')}break}
 case 'Кат':{yield* F('🪓 Кат: наступного героя — до темниці');const n=gDraw();if(n){S.gd.push(n);yield* F(`Гільдія: ${gName(n)}`);if(n.k==='h')yield* jail(n.c)}yield* resolveHeroes();yield* drawAndPlay();break}
 case 'Троль':{if(R(v).res.coin>=2){R(v).res.coin-=2;S.sup.coin+=2;yield* F('👹 Троль забирає 2 монети оренди',v)}else{yield* F('👹 Платити нічим — примусове виселення!',v);yield* allDiscard('Виселення');yield* drawAndPlay()}break}
 case 'Король жаб':{yield* F('🐸 За Вальгаллу! Жаби атакують');yield* frogsBite();const s=rIdx('SEW');R(s).res.frog+=2;yield* F('Дві нові жаби в каналізації',s);break}
 case 'Бібліотекар':{const l=rIdx('LIB'),n=R(l).res.book;if(S.sc===17){if(n){R(l).res.book=0;S.sup.book=Math.max(0,S.sup.book);yield* F(`📚 Бібліотекар назавжди краде ${n} книг(и)`,l)}else yield* extraGuild(2,'📚 Книг немає — Гільдія збирає загін: +2 карти')}
  else{if(n){R(l).res.book=0;S.sup.book+=n;yield* F(`📚 Бібліотекар забирає ${n} книг(и)`,l);checkBooks()}else yield* extraGuild(2,'📚 Книг немає — оголошення про збори: +2 карти Гільдії')}break}
 case 'Вовкулака':{const wr=S.rm.findIndex(r=>r.ev.some(e=>e.k==='wolf'));const found=wr>=0&&R(wr).ev.find(e=>e.k==='wolf').up;
  if(found&&R(wr).res.bone>0){S.sup.bone+=R(wr).res.bone;R(wr).res.bone=0;yield* F('🐺 Вовкулака гризе кістки й задоволений',wr)}else yield* extraGuild(2,found?'🐺 Кісток немає — вовкулака йде полювати! +2 карти':'🐺 Вовкулаку не знайдено — він полює! +2 карти');
  placeTokens(SC().wolfSpots.split(' ').map(rIdx),'wolf');yield* F('Блукаюче чудовисько: жетони перемішано');break}
 case 'Грабіжниця':{const rs=S.rm.map((r,i)=>i).filter(i=>i!==v&&R(i).h.some(h=>h.c==='r')&&R(i).tr);const any=S.rm.some(r=>r.h.some(h=>h.c==='r'));
  if(rs.length){const r=yield* pick(rs,'Грабіжниця: з якої кімнати зникне скарб?',false);R(r).tr=null;yield* F('🦹 Скарб тихо зникає без ефекту',r)}
  else if(!any){yield* F('🦹 Пройдисвіток немає — 2 героїв до темниці');for(let i=0;i<2;i++){const n=gDraw();if(n){S.gd.push(n);if(n.k==='h')yield* jail(n.c)}}}else yield* F('🦹 Красти нічого');break}
 case 'Русалка':{if(S.flags.mermaid){S.pl.forEach(p=>draw(p,1));yield* F('🎤 Русалка співає: усі беруть по карті, Гільдія надсилає ще одного фаната');yield* drawAndPlay()}else yield* extraGuild(2,'🎤 Русалки немає — +2 карти Гільдії');break}
 case 'Схопіть їх, хлопці':{const rs=S.rm.map((r,i)=>i).filter(i=>R(i).m.some(u=>u.k==='imp'));if(!rs.length){yield* extraGuild(2,'Бісів немає — Гільдія нападає: +2 карти');break}
  for(const r of rs){if(S.sup.trap>0){R(r).trap++;S.sup.trap--}}yield* F('Біси розставляють пастки у своїх кімнатах');break}
 case 'Парад':{const rs=S.rm.map((r,i)=>i).filter(i=>R(i).h.some(h=>h.c==='m'));if(!rs.length){yield* extraGuild(2,'🎺 Магів немає — +2 карти Гільдії');break}
  for(const r of rs)yield* summonHero('rat',r);break}
 case 'Дракон':{const dr=S.rm.some(r=>r.m.some(u=>u.k==='dragon'));
  if(S.sc===18){const vp=R(v).m.filter(u=>u.k==='pup').length;if(S.flags.rage){yield* F('🐲 Дракониця вже скажена: 2 героїв до темниці');for(let i=0;i<2;i++){const n=gDraw();if(n){S.gd.push(n);if(n.k==='h')yield* jail(n.c)}}}else if(!vp){R(v).ev.push({k:'dragonev',up:1},{k:'dragonev',up:1});yield* F('🐲 Цуценят немає: Дракониця втрачає терпіння (+2 жетони)',v);yield* dragonCheck18()}else yield* F('🐲 Дракониця грається з цуценятами',v);break}
  if(dr){yield* F('🐲 Дракониця вже тут: 2 героїв до темниці');for(let i=0;i<2;i++){const n=gDraw();if(n){S.gd.push(n);if(n.k==='h')yield* jail(n.c)}}break}
  R(v).ev.push({k:'dragonev',up:1},{k:'dragonev',up:1});const n=R(v).ev.filter(e=>e.k==='dragonev').length;yield* F(`🐲 Дракониця шукає вовкулаку: ${n} жетон(и) у сховищі`,v);
  if(n>=4){R(v).m.push({id:++S.nid,p:-6,k:'dragon',hp:9,mx:9});S.flags.rage=1;yield* F('🔥 Скажена Дракониця у сховищі!',v)}break}
 case 'Просування':{let any=0;for(let i=0;i<S.rm.length;i++)R(i).h.forEach(h=>{if(h.c==='w')any=1});
  if(!any){yield* extraGuild(1,'Воїнів немає — +1 карта Гільдії');break}
  const ws=[];S.rm.forEach((o,i)=>o.h.forEach(h=>{if(h.c==='w')ws.push({h,i})}));yield* F('⚔ Прорив! Воїни активні й просуваються');
  for(const {h,i} of ws){h.a=1;const nx=nextRooms(i,[v]);if(!nx.length||!R(i).h.includes(h))continue;let to=nx[0];if(nx.length>1)to=yield* pick(nx,'Куди проривається воїн?',false);R(i).h.splice(R(i).h.indexOf(h),1);R(to).h.push(h);yield* F(`Воїн: ${rName(i)} → ${rName(to)}`,to);yield* heroArrive(h,to,false)}break}
 case 'Вилуплятко':{const rs=S.rm.map((r,i)=>i).filter(i=>R(i).m.filter(u=>u.k==='liz').length>=2);if(rs.length&&S.pool.liz>0){const r=yield* pick(rs,'Вилуплятко: де вилупиться людоящір?',false);R(r).m.push({id:++S.nid,p:-3,k:'liz',hp:1});S.pool.liz--;yield* F('🥚 Новий людоящір!',r)}else{yield* F('🥚 Вилупитися ніде');yield* allDiscard('Вилуплятко')}break}
 case 'Полювання на залишки':{const rs=summonRooms(c.t);S.rm.forEach(r=>r.ev=r.ev.filter(e=>e.k!=='x'&&e.k!=='ticket'));const toks=shuffle(['x','x','x','ticket']);shuffle(rs.slice()).slice(0,4).forEach((ri,i)=>R(ri).ev.push({k:toks[i],up:0}));yield* F('🎫 Жетони сховано в кімнатах');
  for(const ri of rs){const o=R(ri);if(o.h.length){const e=o.ev.find(x=>!x.up);if(e){o.ev.splice(o.ev.indexOf(e),1);if(e.k==='ticket'){yield* F('Герой одразу знайшов квиток! +2 карти Гільдії',ri);yield* extraGuild(2)}}}}break}
 case 'Некромант':{const lab=rIdx('LAB');if(S.pool.skel>=2){yield* F('💀 Виселення: 2 скелети в лабораторії',lab);yield* summonHero('skel',lab);yield* summonHero('skel',lab)}else{yield* F('💀 Скелетів забракло: героя до темниці, кожен скидає карту');const n=gDraw();if(n){S.gd.push(n);if(n.k==='h')yield* jail(n.c)}yield* allDiscard('Виселення')}break}
 case 'Скелет':{yield* summonCard('skel',c.t);break}
 case 'Гітарне соло':{const gs=[];S.rm.forEach((o,i)=>o.h.forEach(h=>{if(h.c==='ghost')gs.push({h,i})}));if(!gs.length){yield* F('🎸 Привидів немає');yield* allDiscard('Гітарне соло');break}
  for(const {h,i} of gs){const nx=nextRooms(i,[v]);if(!nx.length)continue;const to=nx[0];R(i).h.splice(R(i).h.indexOf(h),1);R(to).h.push(h);R(to).h.forEach(x=>x.a=1);yield* F(`🎸 Привид: ${rName(i)} → ${rName(to)}`,to)}break}
 case 'Шабаш відьом':{const ws=[];S.rm.forEach((o,i)=>o.m.forEach(u=>{if(u.k==='witch')ws.push({u,i})}));
  if(!ws.length){if(S.pool.witch>0){R(v).m.push({id:++S.nid,p:-4,k:'witch',hp:2,mx:2,nm:'Синтія'});S.pool.witch--}const s=rIdx('SEW');if(S.pool.witch>0){R(s).m.push({id:++S.nid,p:-4,k:'witch',hp:2,mx:2,nm:'Ольга'});S.pool.witch--}yield* F('🧙‍♀️ Відьми повертаються!',v);break}
  const olga=ws.find(w=>w.u.nm==='Ольга'),syn=ws.find(w=>w.u.nm==='Синтія');
  if(olga){const s=rIdx('SEW');R(s).res.frog++;yield* F('🐸 Ольга кличе жабу в каналізацію',s)}
  if(syn){let at=syn.i;const ports=S.rm.map((r,i)=>i).filter(i=>i!==at&&R(i).port===2&&R(at).port===2);if(ports.length){const to=yield* pick(ports.concat([at]),'Синтія: перейти через портал? (оберіть кімнату або її поточну)',false);if(to!==at){R(at).m.splice(R(at).m.indexOf(syn.u),1);R(to).m.push(syn.u);at=to;yield* F('Синтія крокує крізь портал',to)}}
   const tg=nbP(at).concat([at]).filter(i=>R(i).h.length);if(tg.length){const t=yield* pick(tg,'Синтія: у кого стріляти?',false);const h=R(t).h[0];yield* hurtHero(t,h,1,`✨ Синтія вражає: ${hName(h)}`)}}
  break}
 case 'Цуценята':{const rs=S.rm.map((r,i)=>i).filter(i=>i!==v&&R(i).m.some(u=>u.k==='pup'));if(!rs.length)break;const r=yield* pick(rs,'До мене, цуцику! Цуценята з якої кімнати біжать до сховища?',false);const nx=nextRooms(r,[v]);if(!nx.length)break;let to=nx[0];if(nx.length>1)to=yield* pick(nx,'Куди біжать цуценята?',false);
  const ps=R(r).m.filter(u=>u.k==='pup');ps.forEach(u=>{R(r).m.splice(R(r).m.indexOf(u),1);R(to).m.push(u)});
  if(to===v){for(let i=0;i<ps.length;i++){const k=R(v).ev.findIndex(e=>e.k==='dragonev');if(k>=0)R(v).ev.splice(k,1)}}
  yield* F(`🐶 ${ps.length} цуценят біжать: ${rName(r)} → ${rName(to)}`,to);yield* checkInstant();break}
 case 'Слизький бюрократ':{yield* summonCard('slime',c.t);break}
 default:yield* F('Карта сценарію без ефекту')}}
function checkBooks(){if(S.sc!==5)return;const tot=S.rm.reduce((s,r)=>s+r.res.book,0);if(tot===0&&!S.flags.booksFree){S.flags.booksFree=1;S.rm.forEach(r=>{if(r.k==='LIB'||r.k==='AUD')r.xb=0});L('📚 Книг у підземеллі не лишилось — «Х» знято з бібліотеки та аудиторії',null,'h')}}
function* frogsBite(){for(let i=0;i<S.rm.length;i++){const o=R(i);for(let f=0;f<o.res.frog;f++){const us=o.m.filter(u=>u.k!=='pup');if(!us.length)break;let u=us[0];if(us.length>1)u=(yield* chooseUnit(i,x=>x.k!=='pup','Жаба кусає — кого?'))||us[0];yield* dmgUnit(i,u,1,null,'🐸 Жаба кусає')}}}
function* dragonCheck18(){const v=vault();const n=R(v).ev.filter(e=>e.k==='dragonev').length;if(S.sc===18){if(n>=4&&!S.flags.rage){S.flags.rage=1;yield* F('🔥 Дракониця скаженіє!',v)}if(S.flags.rage&&n===0){S.flags.rage=0;yield* F('🐲 Дракониця заспокоїлась',v)}}}
function* checkInstant(){if(S.over)return;
 if(S.sc===13&&!S.rm.some(r=>r.m.some(u=>u.k==='liz'))){S.over='lose';S.overWhy='Не лишилось жодного людоящера.';yield* F('☠️ Людоящерів не лишилось. Поразка!',null,'h')}
 if(S.sc===18&&R(vault()).m.filter(u=>u.k==='pup').length>=7){S.over='win';S.overWhy='Усі цуценята в сховищі з Драконицею!';yield* F('🎉 Усі цуценята зі своєю бабусею. Перемога!',null,'h')}
 if(S.sc===18)yield* dragonCheck18();
 if(S.sc===5)checkBooks()}

/* ---------- кінець ходу ---------- */
function handSize(i){if(S.sc===8&&!S.flags.mermaid)return 4;if(S.sc===16&&S.wave===1&&R(rIdx('LAB')).m.some(u=>u.p===i))return 7;return 5}
function* endTurn(){const p=P(),me=S.cur;S.pend=[];S.ph=3;
 p.disc.push(...p.play.splice(0));const need=handSize(me)-p.hand.length;if(need>0)draw(p,need);
 yield* F(`${pName(me)}: очищення, рука — ${p.hand.length} карт`,null);
 if(S.sc===17)yield* frogArmy();
 S.ph=4;const n=DIF[S.df][S.wave-1]+(S.sc===8&&S.flags.mermaid?1:0);
 L(`⚔ Вторгнення героїв: ${n} карт(и) Гільдії`,null,'h');yield {t:'frame',r:null};
 for(let i=0;i<n&&!S.over;i++){if(S.gEnd)break;yield* drawAndPlay()}
 if(!S.over)yield* afterTurn();
 if(!S.over&&S.wave===2&&!S.g.length)S.gEnd=1;
 if(!S.over&&S.gEnd){yield* finalCheck();return}
 if(S.over)return;
 S.cur=(S.cur+1)%S.pl.length;S.ph=1;L(`Хід: ${pName(S.cur)}`,null,'turn');yield* startTurn();yield {t:'frame',r:null}}
function* afterTurn(){
 if(S.sc===4){const v=vault();const moves=[];S.rm.forEach((o,i)=>{for(let f=0;f<o.res.frog;f++){const nx=nextRooms(i,[v]);if(nx.length)moves.push([i,nx[0]])}});
  moves.forEach(([a,b])=>{R(a).res.frog--;R(b).res.frog++});if(moves.length)yield* F(`🐸 Жаби просуваються до сховища (${moves.length})`);yield* frogsBite()}
 if((S.sc===11||S.sc===18)&&S.flags.rage){const v=vault();yield* F('🔥 Скажена Дракониця дихає вогнем у сусідні зі сховищем кімнати',v);
  for(const i of nbP(v)){const o=R(i);for(const h of o.h.slice())yield* hurtHero(i,h,1,'🔥 Вогонь');for(const u of o.m.slice()){if(u.k==='pup'||u.k==='dragon')continue;yield* dmgUnit(i,u,1,null,'🔥 Вогонь')}}}}
function* frogArmy(){for(let k=0;k<2;k++){const rs=S.rm.map((r,i)=>i).filter(i=>R(i).res.frog>0);if(!rs.length)return;
  const r=yield* pick(rs,`Армія короля жаб (${k+1}/2): оберіть жабу або «Готово»`,true);if(r==null)return;
  const opts=[{l:'Перемістити жабу',v:'mv',ic:'frog'}];if(R(r).h.length)opts.push({l:'Атакувати героя',v:'atk',ic:'mel'});const c=yield* ask('Що робить жаба?',opts,true);if(c==null)return;
  if(c==='mv'){const to=yield* pick(nbP(r),'Куди стрибає жаба?');if(to==null)return;R(r).res.frog--;R(to).res.frog++;yield* F(`🐸 Жаба: ${rName(r)} → ${rName(to)}`,to)}
  else{const h=R(r).h[0];yield* hurtHero(r,h,1,'🐸 Жаба атакує')}}}
function* finalCheck(){if(S.over)return;
 if(S.sc===11&&S.rm.some(r=>r.m.some(u=>u.k==='dragon'))){S.over='lose';S.overWhy='Наприкінці гри Дракониця досі в підземеллі.';yield* F('☠️ Дракониця лишилась у підземеллі. Поразка!',null,'h');return}
 if(S.sc===18&&R(vault()).m.filter(u=>u.k==='pup').length<7){S.over='lose';S.overWhy='Не всі цуценята дісталися Дракониці.';yield* F('☠️ Цуценята не зібралися разом. Поразка!',null,'h');return}
 if(S.sc===20&&(S.bp.length||S.blueprints.length)){S.over='lose';S.overWhy='Збудовано не всі кімнати.';yield* F('☠️ Підземелля не відбудоване. Поразка!',null,'h');return}
 S.over='win';S.overWhy='Ви пережили обидві хвилі Гільдії.';yield* F('🎉 Обидві хвилі відбито. Перемога!',null,'h')}

/* ---------- оновлення предметів (фаза 2) ---------- */
function refreshItems(handIdx,idxs){const p=P();const c=p.hand.splice(handIdx,1)[0];p.disc.push(c);idxs.sort((a,b)=>b-a).forEach(i=>{S.it.push(S.mk.splice(i,1)[0])});while(S.mk.length<5&&S.it.length)S.mk.push(S.it.shift());L(`${pName(S.cur)} скидає «${c.n}» і оновлює ${idxs.length} предмет(и)`)}
const ACTN={mv:'Переміщення',act:'Активація',mel:'Ближня атака',rng:'Дистанційна атака',card:'Отримання карти',def:'Захист',trap:'Пастка',port:'Портал',coin:'Монета',bone:'Кістка',frog:'Жаба',book:'Книга',sw:'Зграя',amb:'Засідка',nv:'Навала',rf:'Зміцнення',sum1:'Виклик монстра'};

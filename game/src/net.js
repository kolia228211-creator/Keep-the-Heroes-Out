/* ===================== ГРА ПО МЕРЕЖІ (програма для Windows) =====================
 Як у Minecraft: один гравець «відкриває гру для мережі», інші підключаються за IP:порт
 (через Radmin VPN — адреси 26.x.x.x). Сервер живе в оболонці програми (window.hhn.net).
 На сайті window.hhn немає — тоді цей файл нічого не робить, і працюють онлайн-кімнати claude.ai.
 Синхронізація та сама, що в онлайн-кімнатах: спільний документ {s,fr,v,by} через DOC.set(). */
const LAN=(typeof window!=='undefined'&&window.hhn&&window.hhn.net)||null;
const lan={on:false,host:false,peers:[],status:null,off:null,addr:''};
const lsGet=(k,d='')=>{try{return localStorage.getItem(k)||d}catch(e){return d}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const LAN_PORT=47777;

/* ---------- спільне ---------- */
function lanDoc(){return {set:async data=>{const r=await LAN.set(data);if(!r.ok)throw new Error(r.error)}}}
function lanListen(){if(lan.off)lan.off();lan.off=LAN.on(ev=>{
 if(ev.t==='doc'){if(ev.data)applyRoomDoc(ev.data)}
 else if(ev.t==='peers'){lan.peers=ev.list||[];if(ui.scr==='game'&&S&&!ui.busy)$('#top')&&($('#top').innerHTML=topHTML());if($('#lanpeers'))$('#lanpeers').innerHTML=lanPeersHTML()}
 else if(ev.t==='joined')toast(`${ev.name} підключається до гри`);
 else if(ev.t==='left')toast(`${ev.name} відключився`);
 else if(ev.t==='lost')toast('Зв’язок із хостом обірвався — перепідключаюсь…');
 else if(ev.t==='restored')toast('Зв’язок відновлено');
 else if(ev.t==='closed')lanEnd(ev.reason)})}
function applyRoomDoc(d){if(!d||typeof d.s!=='string')return;if(S&&!ui.joining&&(d.by===TAB||d.v<=S.v))return;
 let ns,fr;try{ns=JSON.parse(d.s);fr=JSON.parse(d.fr||'[]')}catch(e){return}
 const first=ui.joining||ui.scr!=='game';ui.joining=0;S=ns;ui.scr='game';
 if(first){$('#app').innerHTML='';closeModal();render();if(ui.seat==null)seatPick()}else replay(fr)}
function lanStop(){if(lan.off)lan.off();lan.off=null;if(lan.on)LAN.leave();lan.on=false;lan.host=false;lan.peers=[];lan.status=null}
function lanEnd(reason){if(!lan.on)return;if(UNSUB)UNSUB();UNSUB=null;DOC=null;ui.seat=null;
 modal(`<h3>Гру по мережі завершено</h3><p>${esc(reason||'')}</p><p class="mu">Партію можна продовжити самому на цьому комп’ютері або вийти в меню.</p><div class="row end"><button onclick="closeModal();render()">Продовжити тут</button><button class="primary" onclick="closeModal();ui.scr='menu';render()">У меню</button></div>`);if(S)render()}
window.lanSeat=i=>{if(lan.on||lan.connecting)LAN.seat(i)};
const lanName=()=>{const el=$('#lanname');const n=((el&&el.value)||lsGet('hhn-name')||'').trim().slice(0,24);if(n)lsSet('hhn-name',n);return n};

/* ---------- меню ---------- */
window.lanMenu=()=>modal(`<h3>Гра по мережі</h3><p>Як у Minecraft: один гравець відкриває гру, інші підключаються до нього за адресою. Усі мають бути в одній мережі <b>Radmin VPN</b> (або в одній домашній мережі).</p>
 <div class="opts"><button class="opt" onclick="closeModal();ui.cfg.mode='online';ui.scr='pick';render()">🌐 <span><b>Відкрити гру для мережі</b><br><small class="mu">Оберіть сценарій і кланів — друзі підключаться до вас</small></span></button>
 <button class="opt" onclick="lanJoinModal()">🔌 <span><b>Підключитися до гри друга</b><br><small class="mu">Потрібна адреса, яку покаже друг</small></span></button>
 <button class="opt" onclick="savesScreen()">💾 <span><b>Відкрити збережену гру для мережі</b><br><small class="mu">Продовжити партію з друзями</small></span></button></div>
 <div class="row end"><button class="ghost" onclick="closeModal()">Закрити</button></div>`);
window.lanJoinModal=()=>{modal(`<h3>Підключитися до гри друга</h3>
 <div class="lanform"><label for="lanname">Ваше ім’я</label><input id="lanname" maxlength="24" value="${esc(lsGet('hhn-name'))}" placeholder="Наприклад, Коля" autocomplete="off">
 <label for="lanaddr">Адреса друга</label><input id="lanaddr" value="${esc(lsGet('hhn-last-host'))}" placeholder="26.12.34.56:47777" autocomplete="off" spellcheck="false"></div>
 <p class="mu">Адресу показує програма друга після «Відкрити для мережі». Ви обидва маєте бути в одній мережі Radmin VPN.</p><p id="lanerr" class="lanerr" hidden></p>
 <div class="row end"><button class="ghost" onclick="closeModal()">Скасувати</button><button class="primary" id="lango" onclick="lanJoin()">Підключитися</button></div>`);
 setTimeout(()=>{const i=$(lsGet('hhn-name')?'#lanaddr':'#lanname');i&&i.focus()},30);
 $('#lanaddr').onkeydown=e=>{if(e.key==='Enter')lanJoin()}};
window.lanJoin=async()=>{const name=lanName(),addr=(($('#lanaddr')||{}).value||'').trim(),err=$('#lanerr'),go=$('#lango');
 const fail=t=>{ui.joining=0;if(lan.off){lan.off();lan.off=null}if(err){err.textContent=t;err.hidden=false}if(go){go.disabled=false;go.textContent='Підключитися'}};
 if(!name)return fail('Введіть своє ім’я — його побачать інші гравці.');if(!addr)return fail('Введіть адресу друга, наприклад 26.12.34.56:47777');
 lsSet('hhn-last-host',addr);if(go){go.disabled=true;go.textContent='Підключаюсь…'}if(err)err.hidden=true;lan.connecting=true;lan.addr=addr;
 if(UNSUB){UNSUB();UNSUB=null}DOC=null;ui.seat=null;ui.joining=1;lanListen();
 const r=await LAN.join({addr,name,gv:GAME_VERSION});lan.connecting=false;if(!r.ok)return fail(r.error);
 lan.on=true;lan.host=false;lan.addr=addr;lan.status=r;DOC=lanDoc();UNSUB=lanStop;ui.cfg.code=addr;
 // гра приходить одразу після підключення; якщо ще ні — показуємо очікування (applyRoomDoc закриє вікно)
 if(ui.joining)modal(`<h3>Підключено до ${esc(addr)}</h3><p>Чекаємо, поки хост почне гру…</p><div class="row end"><button class="ghost" onclick="ui.joining=0;lanStop();UNSUB=null;DOC=null;closeModal()">Від’єднатися</button></div>`)};

/* ---------- хост ---------- */
function lanSetupHTML(){return `<div class="lanform"><label for="lanname">Ваше ім’я</label><input id="lanname" maxlength="24" value="${esc(lsGet('hhn-name'))}" placeholder="Наприклад, Коля" autocomplete="off">
 <label for="lanport">Порт</label><input id="lanport" inputmode="numeric" value="${esc(lsGet('hhn-port',String(LAN_PORT)))}" style="max-width:110px"></div>
 <p class="mu">Друзі підключатимуться до вашого комп’ютера. Після запуску програма покаже адресу — надішліть її друзям. Порт міняйте, лише якщо ${LAN_PORT} чимось зайнятий.</p>
 <div class="row"><button class="primary big" onclick="lanHost()">🌐 Відкрити гру для мережі</button></div>`}
window.lanHost=async fromSave=>{const name=lanName();if(!name&&$('#lanname'))return toast('Введіть своє ім’я — його побачать друзі.');
 const pEl=$('#lanport');const port=pEl?Math.floor(+pEl.value):+lsGet('hhn-port',String(LAN_PORT));if(!(port>0&&port<65536))return toast('Порт — це число від 1 до 65535, наприклад 47777');lsSet('hhn-port',String(port));
 if(UNSUB){UNSUB();UNSUB=null}DOC=null;lanListen();
 const r=await LAN.host({port,name:name||'Хост',gv:GAME_VERSION});
 if(!r.ok){if(lan.off){lan.off();lan.off=null}return modal(`<h3>Не вдалося відкрити гру для мережі</h3><p>${esc(r.error)}</p><div class="row end"><button class="primary" onclick="closeModal()">Добре</button></div>`)}
 lan.on=true;lan.host=true;lan.status=r;lan.peers=r.peers||[];DOC=lanDoc();UNSUB=lanStop;ui.cfg.code='гра по мережі';
 if(!fromSave){newGame({sc:ui.cfg.sc,df:ui.cfg.df,clans:ui.cfg.clans.slice(0,ui.cfg.np)});ui.scr='game';$('#app').innerHTML='';ui.seat=null}
 commit();render();seatPick(true)};
window.lanHostSave=async id=>{await loadSave(id);if(S&&!ui.busy)lanHost(true);else setTimeout(()=>lanHost(true),50)};
function lanAddrHTML(){const st=lan.status||{},port=st.port||LAN_PORT,as=st.addresses||[];const kind={radmin:'Radmin VPN',lan:'домашня мережа',other:'інша мережа'};
 const rows=as.map(a=>`<div class="lanaddr ${a.kind}"><code>${esc(a.ip)}:${port}</code><small>${kind[a.kind]}</small><button class="ghost" onclick="navigator.clipboard&&navigator.clipboard.writeText('${a.ip}:${port}');toast('Адресу скопійовано')">Копіювати</button></div>`).join('');
 return `<div class="lanbox"><b>Друзі підключаються за адресою:</b>${rows||'<p class="lanerr">Не знайдено жодної мережі. Перевірте, що комп’ютер підключений до інтернету або Radmin VPN.</p>'}
 ${as.some(a=>a.kind==='radmin')?'':'<p class="lanwarn">Radmin VPN не ввімкнено. Якщо друзі грають з інших будинків, увімкніть Radmin VPN, зайдіть в одну мережу з ними й відкрийте гру ще раз.</p>'}
 <p class="mu">Якщо Windows спитає про брандмауер — поставте <b>обидві галочки</b> (приватні й загальнодоступні мережі) і натисніть «Дозволити доступ»: мережу Radmin Windows часто вважає загальнодоступною.</p></div>`}
function lanSeatTitle(host){if(!(lan.on||lan.connecting))return '';return host&&lan.host?'Гру відкрито для мережі':`Ви підключилися до гри (${esc(lan.addr)})`}
function lanSeatExtra(host){return lan.on&&host&&lan.host?lanAddrHTML():''}

/* ---------- гравці в грі ---------- */
function lanPeersHTML(){const who=p=>p.seat==null?'обирає клан':p.seat<0?'дивиться':S&&S.pl[p.seat]?CLANS[S.pl[p.seat].c].n:'—';
 return lan.peers.map(p=>`<div class="lanpeer">${p.seat!=null&&p.seat>=0?`<span class="dot" style="background:${PCOL[p.seat]}"></span>`:'<span class="dot"></span>'}<b>${esc(p.name)}</b>${p.host?' <small class="mu">хост</small>':''}${p.me?' <small class="mu">(ви)</small>':''}<span class="mu">${who(p)}</span></div>`).join('')||'<p class="mu">Нікого немає.</p>'}
function lanBadge(){if(!lan.on)return '';return `<button class="ghost lanbadge" onclick="lanInfo()" title="Гра по мережі: ${lan.peers.map(p=>esc(p.name)).join(', ')}">🌐<span> ${lan.peers.length}</span></button>`}
window.lanInfo=()=>modal(`<h3>${lan.host?'Ваша гра відкрита для мережі':'Гра по мережі · '+esc(lan.addr)}</h3><h4>Гравці</h4><div id="lanpeers" class="lanpeers">${lanPeersHTML()}</div>
 ${lan.host?lanAddrHTML():''}
 <div class="row end"><button class="ghost" onclick="lanLeave()">${lan.host?'Закрити гру для мережі':'Від’єднатися'}</button><button onclick="closeModal();seatPick()">Змінити клан</button><button class="primary" onclick="closeModal()">Добре</button></div>`);
window.lanLeave=()=>{if(ui.lanLeaveArm){ui.lanLeaveArm=0;const wasHost=lan.host;if(UNSUB)UNSUB();UNSUB=null;DOC=null;ui.seat=null;closeModal();render();toast(wasHost?'Гру закрито для мережі. Партія лишилась у вас.':'Ви від’єдналися від гри.');return}
 ui.lanLeaveArm=1;toast(lan.host?'Натисніть ще раз: друзі від’єднаються від гри.':'Натисніть ще раз, щоб від’єднатися.');setTimeout(()=>ui.lanLeaveArm=0,4000)};

/* Гра по мережі, як у Minecraft: один гравець «відкриває гру для мережі»
   (у його програмі запускається сервер), інші підключаються за IP:порт.

   Модель та сама, що в онлайн-кімнатах сайту: спільний документ гри {s, fr, v, by}.
   Хто зробив хід — надсилає весь стан, сервер зберігає його й розсилає іншим.
   Модуль не залежить від Electron: події віддає через emit(), тому його можна тестувати в Node. */
const os = require('os');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PROTO = 1;
const DEFAULT_PORT = 47777;
const MAX_PAYLOAD = 16 * 1024 * 1024;
const PING_MS = 10000;
const RECONNECT_TRIES = 15;
const RECONNECT_MS = 2000;

/** IPv4-адреси цього комп’ютера. Radmin VPN роздає адреси 26.x.x.x — їх показуємо першими. */
function addresses() {
  const out = [];
  for (const [iface, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal || a.address.startsWith('169.254.')) continue;
      const radmin = a.address.startsWith('26.') || /radmin/i.test(iface);
      const lan = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
      out.push({ ip: a.address, iface, kind: radmin ? 'radmin' : lan ? 'lan' : 'other' });
    }
  }
  const rank = { radmin: 0, lan: 1, other: 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** "26.1.2.3:47777", "26.1.2.3" → {host, port} */
function parseAddr(s) {
  const m = /^\s*([A-Za-z0-9.\-]+)(?::(\d{1,5}))?\s*$/.exec(String(s || ''));
  if (!m) throw new Error('Адреса має виглядати так: 26.12.34.56:47777');
  const port = m[2] ? Number(m[2]) : DEFAULT_PORT;
  if (port < 1 || port > 65535) throw new Error('Неправильний порт');
  return { host: m[1], port };
}

const cleanName = n => String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24) || 'Гравець';
const send = (ws, msg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };

class Lan {
  /** @param {{emit:(ev:object)=>void, log?:Function}} o */
  constructor(o) {
    this.emit = o.emit;
    this.log = o.log || (() => {});
    this.reset();
  }

  reset() {
    this.mode = null; // 'host' | 'client' | null
    this.doc = null;
    this.peers = new Map(); // id → {id, name, seat}
    this.myId = null;
    this.mySeat = null;
    this.port = null;
    this.clientPeers = [];
  }

  status() {
    return {
      mode: this.mode,
      port: this.port,
      addresses: this.mode === 'host' ? addresses() : [],
      peers: this.peerList(),
      target: this.target || null,
    };
  }

  peerList() {
    if (this.mode === 'client') return this.clientPeers || [];
    return [...this.peers.values()].map(p => ({ name: p.name, seat: p.seat, host: p.id === 'host', me: p.id === this.myId }));
  }

  emitPeers() {
    this.emit({ t: 'peers', list: this.peerList() });
  }

  /* ===================== ХОСТ ===================== */

  async host({ port = DEFAULT_PORT, name, gv }) {
    await this.leave();
    const wss = new WebSocketServer({ port, host: '0.0.0.0', maxPayload: MAX_PAYLOAD, clientTracking: true });
    await new Promise((resolve, reject) => {
      wss.once('listening', resolve);
      wss.once('error', e => reject(e.code === 'EADDRINUSE'
        ? new Error(`Порт ${port} уже зайнятий. Можливо, гра вже відкрита в іншому вікні — або оберіть інший порт.`)
        : e));
    });
    this.reset();
    this.wss = wss;
    this.mode = 'host';
    this.port = wss.address().port;
    this.gv = gv;
    this.myId = 'host';
    this.peers.set('host', { id: 'host', name: cleanName(name), seat: null });
    wss.on('connection', (ws, req) => this.onConnection(ws, req));
    wss.on('error', e => this.log('[lan] помилка сервера:', e.message));
    this.pinger = setInterval(() => {
      for (const ws of wss.clients) {
        if (ws.alive === false) { ws.terminate(); continue; }
        ws.alive = false;
        try { ws.ping(); } catch {}
      }
    }, PING_MS);
    this.log('[lan] сервер на порту', this.port);
    this.emitPeers();
    return this.status();
  }

  onConnection(ws, req) {
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    ws.on('message', raw => {
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      if (!ws.peer) {
        if (m.t !== 'hello') return ws.close();
        if (m.proto !== PROTO) return this.reject(ws, 'Версії програм не збігаються. Перезапустіть програму, щоб вона оновилась.');
        if (m.gv !== this.gv) return this.reject(ws, `Різні версії гри: у хоста ${this.gv}, у вас ${m.gv}. Перезапустіть програму (і хост, і ви), щоб обидві оновились.`);
        const peer = { id: crypto.randomBytes(6).toString('hex'), name: cleanName(m.name), seat: Number.isInteger(m.seat) ? m.seat : null, ip };
        ws.peer = peer;
        this.peers.set(peer.id, peer);
        send(ws, { t: 'welcome', you: peer.id, doc: this.doc, peers: this.peerListFor(peer.id) });
        this.broadcastPeers();
        this.emit({ t: 'joined', name: peer.name });
        this.log('[lan] підключився', peer.name, ip);
        return;
      }
      if (m.t === 'set' && m.data && typeof m.data === 'object') {
        this.doc = m.data;
        for (const c of this.wss.clients) if (c !== ws && c.peer) send(c, { t: 'doc', data: m.data });
        this.emit({ t: 'doc', data: m.data });
      } else if (m.t === 'seat') {
        ws.peer.seat = Number.isInteger(m.seat) ? m.seat : null;
        this.broadcastPeers();
      }
    });
    ws.on('close', () => {
      if (!ws.peer) return;
      this.peers.delete(ws.peer.id);
      this.broadcastPeers();
      if (this.mode === 'host') this.emit({ t: 'left', name: ws.peer.name });
    });
    ws.on('error', () => {});
  }

  reject(ws, reason) {
    send(ws, { t: 'reject', reason });
    setTimeout(() => ws.close(), 100);
  }

  peerListFor(id) {
    return [...this.peers.values()].map(p => ({ name: p.name, seat: p.seat, host: p.id === 'host', me: p.id === id }));
  }

  broadcastPeers() {
    if (this.mode !== 'host') return;
    for (const c of this.wss.clients) if (c.peer) send(c, { t: 'peers', list: this.peerListFor(c.peer.id) });
    this.emitPeers();
  }

  /* ===================== КЛІЄНТ ===================== */

  async join({ addr, name, gv }) {
    const { host, port } = parseAddr(addr);
    await this.leave();
    this.reset();
    this.mode = 'client';
    this.target = `${host}:${port}`;
    this.hello = { t: 'hello', proto: PROTO, name: cleanName(name), gv };
    this.leaving = false;
    try {
      await this.connect(host, port);
    } catch (e) {
      this.reset();
      throw e;
    }
    return this.status();
  }

  connect(host, port) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${host}:${port}`, { handshakeTimeout: 6000, maxPayload: MAX_PAYLOAD });
      this.ws = ws;
      let settled = false;
      const done = (err, v) => { if (settled) return; settled = true; err ? reject(err) : resolve(v); };
      const watchdog = () => {
        clearTimeout(ws.dog);
        ws.dog = setTimeout(() => ws.terminate(), PING_MS * 2.5);
      };
      ws.on('open', () => { watchdog(); send(ws, { ...this.hello, seat: this.mySeat }); });
      ws.on('ping', watchdog);
      ws.on('message', raw => {
        let m;
        try { m = JSON.parse(raw); } catch { return; }
        watchdog();
        if (m.t === 'welcome') {
          this.myId = m.you;
          this.doc = m.doc;
          this.setPeers(m.peers);
          done(null);
          this.emit({ t: 'doc', data: m.doc, initial: true });
        } else if (m.t === 'doc') {
          this.doc = m.data;
          this.emit({ t: 'doc', data: m.data });
        } else if (m.t === 'peers') {
          this.setPeers(m.list);
        } else if (m.t === 'reject') {
          this.leaving = true;
          done(new Error(m.reason));
          this.emit({ t: 'closed', reason: m.reason });
        } else if (m.t === 'closed') {
          this.leaving = true;
          this.emit({ t: 'closed', reason: 'Хост завершив гру по мережі.' });
        }
      });
      ws.on('error', e => {
        done(new Error(friendlyNetError(e, host, port)));
      });
      ws.on('close', () => {
        clearTimeout(ws.dog);
        if (!settled) done(new Error(`Не вдалося підключитися до ${host}:${port}.`));
        if (this.ws !== ws) return;
        if (this.mode === 'client' && !this.leaving && settled) this.reconnect(host, port);
        else if (this.leaving && this.mode === 'client') this.reset();
      });
    });
  }

  async reconnect(host, port) {
    this.emit({ t: 'lost' });
    for (let i = 0; i < RECONNECT_TRIES; i++) {
      await new Promise(r => setTimeout(r, RECONNECT_MS));
      if (this.mode !== 'client' || this.leaving) return;
      try {
        await this.connect(host, port);
        this.emit({ t: 'restored' });
        return;
      } catch (e) {
        if (this.leaving) return;
      }
    }
    this.emit({ t: 'closed', reason: 'Зв’язок із хостом втрачено.' });
    this.reset();
  }

  setPeers(list) {
    this.clientPeers = Array.isArray(list) ? list : [];
    this.emitPeers();
  }

  /* ===================== СПІЛЬНЕ ===================== */

  set(data) {
    if (this.mode === 'host') {
      this.doc = data;
      for (const c of this.wss.clients) if (c.peer) send(c, { t: 'doc', data });
      return true;
    }
    if (this.mode === 'client') {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('немає зв’язку з хостом');
      send(this.ws, { t: 'set', data });
      return true;
    }
    throw new Error('гра по мережі не запущена');
  }

  seat(i) {
    this.mySeat = Number.isInteger(i) ? i : null;
    if (this.mode === 'host') {
      this.peers.get('host').seat = this.mySeat;
      this.broadcastPeers();
    } else if (this.mode === 'client') {
      send(this.ws, { t: 'seat', seat: this.mySeat });
    }
  }

  async leave() {
    const mode = this.mode;
    if (mode === 'host') {
      clearInterval(this.pinger);
      for (const c of this.wss.clients) send(c, { t: 'closed' });
      await new Promise(r => setTimeout(r, 50));
      for (const c of this.wss.clients) c.terminate();
      await new Promise(r => this.wss.close(() => r()));
      this.wss = null;
    } else if (mode === 'client') {
      this.leaving = true;
      try { this.ws && this.ws.close(); } catch {}
      this.ws = null;
    }
    this.reset();
    this.target = null;
  }
}

function friendlyNetError(e, host, port) {
  const c = e && e.code;
  if (c === 'ECONNREFUSED') return `За адресою ${host}:${port} ніхто не відкрив гру. Перевірте, що друг натиснув «Відкрити для мережі», і що порт правильний.`;
  if (c === 'ETIMEDOUT' || c === 'EHOSTUNREACH' || c === 'ENETUNREACH' || /timed out|timeout/i.test(e.message))
    return `Комп’ютер ${host} не відповідає. Перевірте, що ви обидва в одній мережі Radmin VPN і що брандмауер Windows у друга дозволяє програму.`;
  if (c === 'ENOTFOUND') return `Адресу ${host} не знайдено. Введіть IP, наприклад 26.12.34.56.`;
  return `Не вдалося підключитися до ${host}:${port}: ${e.message}`;
}

module.exports = { Lan, addresses, parseAddr, DEFAULT_PORT, PROTO };

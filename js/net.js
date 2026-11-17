// Networking for a static site: the host's browser is the server.
// Two transports, used side by side (a player can hold both at once):
//  1) Relay over public MQTT brokers (WebSocket). Works on almost any network; payloads are
//     end-to-end encrypted (ECDH P-256 + AES-GCM) so other people on the broker can't read hands.
//  2) Peer-to-peer WebRTC via PeerJS signalling. Lower latency when NATs allow it (STUN only —
//     the free public TURN servers are gone, so P2P is a bonus path, never the only one).
// Both expose the same tiny "link": { kind, send(obj), close(), onmessage, onclose }.

const PEER_PREFIX = 'peckingorder-v1-';
const PEER_SRC = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const MQTT_SRC = 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js';
export const BROKERS = [
  { url: 'wss://broker.hivemq.com:8884/mqtt' },
  { url: 'wss://broker.emqx.io:8084/mqtt' },
  { url: 'wss://public.cloud.shiftr.io', username: 'public', password: 'public' }, // port 443: gets through strict networks
  { url: 'wss://test.mosquitto.org:8081/mqtt' },
];
const PEER_OPTS = {
  debug: 0,
  config: { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }] },
};
const topic = (code) => `peckingorder/v2/${code}`;

export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export function makeCode() {
  let s = '';
  const a = new Uint32Array(6);
  crypto.getRandomValues(a);
  for (const x of a) s += CODE_CHARS[x % CODE_CHARS.length];
  return s;
}
export const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
const rid = (n = 12) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => (b % 36).toString(36)).join('');

const scripts = {};
function loadScript(src) {
  if (!scripts[src]) {
    scripts[src] = new Promise((res, rej) => {
      const el = document.createElement('script');
      el.src = src; el.async = true; el.crossOrigin = 'anonymous';
      el.onload = () => res();
      el.onerror = () => { delete scripts[src]; el.remove(); rej(new Error('Could not load ' + src)); };
      document.head.appendChild(el);
    });
  }
  return scripts[src];
}
const loadPeer = () => loadScript(PEER_SRC).then(() => window.Peer);
const loadMqtt = () => loadScript(MQTT_SRC).then(() => window.mqtt);

/* ---------- end-to-end encryption for the relay ---------- */
const te = new TextEncoder(), td = new TextDecoder();
function b64(buf) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
const newKeys = () => crypto.subtle.generateKey(ECDH, false, ['deriveKey']);
const pubOf = async (kp) => b64(await crypto.subtle.exportKey('raw', kp.publicKey));
async function sharedKey(kp, theirPub) {
  const pub = await crypto.subtle.importKey('raw', unb64(theirPub), ECDH, false, []);
  return crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, kp.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
  return { iv: b64(iv), d: b64(ct) };
}
async function unseal(key, m) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(m.iv) }, key, unb64(m.d));
  return JSON.parse(td.decode(pt));
}
/** Run async jobs strictly in order (keeps encrypted messages ordered). */
function serial() {
  let chain = Promise.resolve();
  return (job) => { chain = chain.then(job).catch(() => {}); return chain; };
}

function makeLink(kind, sendFn, closeFn) {
  const L = {
    kind, open: true, onmessage: null, onclose: null,
    send(o) { if (L.open) { try { sendFn(o); } catch (e) { /* dropped */ } } },
    close() { if (!L.open) return; L.open = false; try { closeFn(); } catch (e) { /* ignore */ } L.onclose && L.onclose(); },
    _recv(o) { if (L.open && L.onmessage) L.onmessage(o); },
    _closed() { if (!L.open) return; L.open = false; L.onclose && L.onclose(); },
  };
  return L;
}
const timeout = (ms, why) => new Promise((_, rej) => setTimeout(() => rej(new Error(why)), ms));

/* ======================= HOST ======================= */
export class HostNet {
  constructor(code, onLink) {
    this.code = code;
    this.onLink = onLink;
    this.peer = null;
    this.mqtts = [];
    this.stopped = false;
    this.p2p = false;
    this.relay = false;
  }

  async start({ p2p = true, relay = true } = {}) {
    this.keys = await newKeys();
    this.pub = await pubOf(this.keys);
    const [a, b] = await Promise.allSettled([
      p2p ? this._startP2P() : Promise.reject(new Error('off')),
      relay ? this._startRelay() : Promise.reject(new Error('off')),
    ]);
    this.p2p = a.status === 'fulfilled';
    this.relay = b.status === 'fulfilled';
    if (a.status === 'rejected' && a.reason && a.reason.message === 'unavailable-id' && !this.relay) {
      this.stop();
      throw new Error('taken');
    }
    if (!this.p2p && !this.relay) { this.stop(); throw new Error('offline'); }
    if (p2p) this._watch = setInterval(() => this._checkPeer(), 6000);
    return { p2p: this.p2p, relay: this.relay };
  }

  /** Call when the page becomes visible again: re-attach to signalling + brokers right away. */
  wake() {
    if (this.stopped) return;
    this._checkPeer();
    for (const c of this.mqtts) { if (!c.connected && !c.reconnecting) { try { c.reconnect(); } catch (e) { /* ignore */ } } }
  }

  _checkPeer() {
    if (this.stopped || this._peerStarting) return;
    const p = this.peer;
    if (!p || p.destroyed) { this._startP2P().then(() => { this.p2p = true; }, () => {}); return; }
    if (p.disconnected) { try { p.reconnect(); } catch (e) { /* ignore */ } }
  }

  async _startP2P() {
    const Peer = await loadPeer();
    this._peerStarting = true;
    try {
      await Promise.race([timeout(12000, 'timeout'), new Promise((res, rej) => {
        const peer = new Peer(PEER_PREFIX + this.code, PEER_OPTS);
        this.peer = peer;
        let opened = false;
        peer.on('open', () => { opened = true; res(); });
        peer.on('error', (e) => {
          if (!opened) { try { peer.destroy(); } catch (x) { /* ignore */ } rej(new Error(e.type || 'error')); }
        });
        peer.on('disconnected', () => {
          // signalling dropped (sleep, network change): get back on so new players can still find us
          if (!this.stopped && !peer.destroyed) setTimeout(() => { try { if (peer.disconnected && !peer.destroyed) peer.reconnect(); } catch (e) { /* ignore */ } }, 1200);
        });
        peer.on('connection', (conn) => {
          conn.on('open', () => {
            const L = makeLink('p2p', (o) => conn.send(o), () => conn.close());
            conn.on('data', (d) => L._recv(d));
            conn.on('close', () => L._closed());
            conn.on('error', () => L._closed());
            this.onLink(L);
          });
        });
      })]);
    } finally {
      this._peerStarting = false;
    }
  }

  async _startRelay() {
    const mqtt = await loadMqtt();
    const T = topic(this.code);
    const one = (b) => new Promise((res, rej) => {
      const client = mqtt.connect(b.url, {
        clientId: 'poh_' + rid(10), clean: true, connectTimeout: 7000, reconnectPeriod: 2000, keepalive: 20,
        username: b.username, password: b.password,
      });
      const links = new Map(); // cid -> { L, key, inbox }
      let ready = false;
      const t = setTimeout(() => { if (!ready) { client.end(true); rej(new Error('relay timeout')); } }, 9000);
      const out = (cid, obj) => client.publish(`${T}/c/${cid}`, JSON.stringify(obj), { qos: 1 });
      client.on('connect', () => {
        client.subscribe(T + '/h', { qos: 1 }, (e) => {
          if (e || ready) return;
          ready = true; clearTimeout(t); this.mqtts.push(client); res();
        });
      });
      client.on('message', async (_t, buf) => {
        let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
        if (!m || typeof m.c !== 'string' || m.c.length > 40) return;
        const cid = m.c;
        if (m.k === 'open') {
          if (typeof m.pub !== 'string') return;
          const old = links.get(cid);
          if (old) { links.delete(cid); old.L._closed(); }
          let key;
          try { key = await sharedKey(this.keys, m.pub); } catch (e) { return; }
          const queue = serial();
          const L = makeLink('relay',
            (o) => queue(async () => out(cid, { k: 'msg', ...(await seal(key, o)) })),
            () => { links.delete(cid); out(cid, { k: 'close' }); });
          links.set(cid, { L, key, inbox: serial() });
          out(cid, { k: 'ack', pub: this.pub });
          this.onLink(L);
        } else if (m.k === 'msg') {
          const e = links.get(cid);
          if (!e) { out(cid, { k: 'close' }); return; } // we don't know this player (e.g. host reloaded): make them re-handshake
          e.inbox(async () => { const o = await unseal(e.key, m); e.L._recv(o); });
        } else if (m.k === 'close') {
          const e = links.get(cid);
          if (e) { links.delete(cid); e.L._closed(); }
        }
      });
      client.on('error', () => { /* mqtt.js keeps retrying */ });
    });
    return new Promise((res, rej) => {
      let fails = 0;
      BROKERS.forEach((b) => one(b).then(res, () => { if (++fails === BROKERS.length) rej(new Error('relay down')); }));
    });
  }

  stop() {
    this.stopped = true;
    clearInterval(this._watch);
    try { this.peer && this.peer.destroy(); } catch (e) { /* ignore */ }
    for (const c of this.mqtts) { try { c.end(true); } catch (e) { /* ignore */ } }
    this.mqtts = [];
  }
}

/* ======================= CLIENT ======================= */
export async function p2pConnect(code, ms = 10000) {
  const Peer = await loadPeer();
  return new Promise((res, rej) => {
    const peer = new Peer(PEER_OPTS);
    let done = false;
    const fail = (why) => {
      if (done) return;
      done = true; clearTimeout(t);
      try { peer.destroy(); } catch (e) { /* ignore */ }
      rej(new Error(why));
    };
    const t = setTimeout(() => fail('timeout'), ms);
    peer.on('error', (e) => fail(e.type === 'peer-unavailable' ? 'notfound' : (e.type || 'error')));
    peer.on('open', () => {
      const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
      conn.on('open', () => {
        if (done) return;
        done = true; clearTimeout(t);
        const L = makeLink('p2p', (o) => conn.send(o), () => { conn.close(); setTimeout(() => peer.destroy(), 200); });
        conn.on('data', (d) => L._recv(d));
        conn.on('close', () => { L._closed(); try { peer.destroy(); } catch (e) { /* ignore */ } });
        conn.on('error', () => L._closed());
        res(L);
      });
      conn.on('error', () => fail('conn'));
    });
  });
}

async function relayConnectOne(b, code, kp, myPub) {
  const mqtt = await loadMqtt();
  const T = topic(code);
  const cid = rid(14);
  return new Promise((res, rej) => {
    // reconnectPeriod > 0: a broker blip just pauses the link; the session heartbeat decides when it's really gone
    const client = mqtt.connect(b.url, {
      clientId: 'poc_' + rid(10), clean: true, connectTimeout: 7000, reconnectPeriod: 2000, keepalive: 20,
      username: b.username, password: b.password,
    });
    let done = false, L = null, key = null;
    const inbox = serial(), outbox = serial();
    const fail = (why) => { if (done) return; done = true; clearTimeout(t); try { client.end(true); } catch (e) { /* ignore */ } rej(new Error(why)); };
    const t = setTimeout(() => fail('notfound'), 7000);
    client.on('connect', () => {
      client.subscribe(`${T}/c/${cid}`, { qos: 1 }, (e) => {
        if (e) return fail('sub');
        if (!L) client.publish(T + '/h', JSON.stringify({ c: cid, k: 'open', pub: myPub }), { qos: 1 });
      });
    });
    client.on('message', async (_t, buf) => {
      let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
      if (m.k === 'ack' && !done && typeof m.pub === 'string') {
        done = true; clearTimeout(t);
        try { key = await sharedKey(kp, m.pub); } catch (e) { client.end(true); rej(new Error('crypto')); return; }
        L = makeLink('relay',
          (o) => outbox(async () => client.publish(T + '/h', JSON.stringify({ c: cid, k: 'msg', ...(await seal(key, o)) }), { qos: 1 })),
          () => { client.publish(T + '/h', JSON.stringify({ c: cid, k: 'close' }), { qos: 1 }); setTimeout(() => client.end(true), 300); });
        L.broker = b.url;
        res(L);
      } else if (m.k === 'msg' && L && key) {
        inbox(async () => { const o = await unseal(key, m); L._recv(o); });
      } else if (m.k === 'close' && L) { L._closed(); client.end(true); }
    });
    client.on('error', () => { if (!L && !client.connected) { /* keep trying until the timeout */ } });
  });
}

/** Connect over the relay: every broker at once, first one where the host answers wins. */
export async function relayConnect(code) {
  const kp = await newKeys();
  const myPub = await pubOf(kp);
  const attempts = BROKERS.map((b) => relayConnectOne(b, code, kp, myPub));
  try {
    const L = await Promise.any(attempts);
    attempts.forEach((p) => p.then((x) => { if (x !== L) x.close(); }, () => {}));
    return L;
  } catch (e) {
    throw new Error('notfound');
  }
}

export const _internals = { PEER_PREFIX, topic };

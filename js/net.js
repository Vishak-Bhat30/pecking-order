// Networking for a static site: the host's browser is the server.
//  1) Peer-to-peer WebRTC via PeerJS (free public signalling + TURN), encrypted, low latency.
//  2) Fallback relay over public MQTT brokers (WebSocket) when P2P can't connect.
// Both expose the same tiny "link" interface: { kind, send(obj), close(), onmessage, onclose }.

const PEER_PREFIX = 'peckingorder-v1-';
const PEER_SRC = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const MQTT_SRC = 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js';
const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
const topic = (code) => `peckingorder/v1/${code}`;

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
      el.onerror = () => { delete scripts[src]; rej(new Error('Could not load ' + src)); };
      document.head.appendChild(el);
    });
  }
  return scripts[src];
}
const loadPeer = () => loadScript(PEER_SRC).then(() => window.Peer);
const loadMqtt = () => loadScript(MQTT_SRC).then(() => window.mqtt);

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
    const [a, b] = await Promise.allSettled([
      p2p ? this._startP2P() : Promise.reject(new Error('off')),
      relay ? this._startRelay() : Promise.reject(new Error('off')),
    ]);
    this.p2p = a.status === 'fulfilled';
    this.relay = b.status === 'fulfilled';
    if (a.status === 'rejected' && a.reason && a.reason.message === 'unavailable-id') {
      this.stop();
      throw new Error('taken');
    }
    if (!this.p2p && !this.relay) { this.stop(); throw new Error('offline'); }
    return { p2p: this.p2p, relay: this.relay };
  }

  async _startP2P() {
    const Peer = await loadPeer();
    return Promise.race([timeout(12000, 'timeout'), new Promise((res, rej) => {
      const peer = new Peer(PEER_PREFIX + this.code, { debug: 0 });
      this.peer = peer;
      let opened = false;
      peer.on('open', () => { opened = true; res(); });
      peer.on('error', (e) => { if (!opened) rej(new Error(e.type || 'error')); });
      peer.on('disconnected', () => {
        // keep the signalling connection alive so new players can still find us
        if (!this.stopped && !peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch (e) { /* ignore */ } }, 1500);
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
  }

  async _startRelay() {
    const mqtt = await loadMqtt();
    const T = topic(this.code);
    const one = (url) => new Promise((res, rej) => {
      const client = mqtt.connect(url, {
        clientId: 'poh_' + rid(10), clean: true, connectTimeout: 6000, reconnectPeriod: 2500, keepalive: 30,
      });
      const links = new Map(); // cid -> link
      let ready = false;
      const t = setTimeout(() => { if (!ready) { client.end(true); rej(new Error('relay timeout')); } }, 8000);
      client.on('connect', () => {
        client.subscribe(T + '/h', { qos: 1 }, (e) => {
          if (e) return;
          if (!ready) { ready = true; clearTimeout(t); this.mqtts.push(client); res(); }
        });
      });
      client.on('message', (_t, buf) => {
        let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
        if (!m || typeof m.c !== 'string' || m.c.length > 40) return;
        const out = `${T}/c/${m.c}`;
        if (m.k === 'open') {
          const old = links.get(m.c);
          if (old) old._closed();
          const L = makeLink('relay',
            (o) => client.publish(out, JSON.stringify({ k: 'msg', d: o }), { qos: 1 }),
            () => { client.publish(out, JSON.stringify({ k: 'close' }), { qos: 1 }); links.delete(m.c); });
          links.set(m.c, L);
          client.publish(out, JSON.stringify({ k: 'ack' }), { qos: 1 });
          this.onLink(L);
        } else if (m.k === 'msg') {
          const L = links.get(m.c);
          if (L) L._recv(m.d);
        } else if (m.k === 'close') {
          const L = links.get(m.c);
          if (L) { links.delete(m.c); L._closed(); }
        }
      });
      client.on('error', () => { /* mqtt.js retries */ });
    });
    // succeed if any broker works
    return new Promise((res, rej) => {
      let fails = 0;
      BROKERS.forEach((u) => one(u).then(res, () => { if (++fails === BROKERS.length) rej(new Error('relay down')); }));
    });
  }

  stop() {
    this.stopped = true;
    try { this.peer && this.peer.destroy(); } catch (e) { /* ignore */ }
    for (const c of this.mqtts) { try { c.end(true); } catch (e) { /* ignore */ } }
    this.mqtts = [];
  }
}

/* ======================= CLIENT ======================= */
async function p2pConnect(code) {
  const Peer = await loadPeer();
  return new Promise((res, rej) => {
    const peer = new Peer({ debug: 0 });
    let done = false;
    const fail = (why) => {
      if (done) return;
      done = true; clearTimeout(t);
      try { peer.destroy(); } catch (e) { /* ignore */ }
      rej(new Error(why));
    };
    const t = setTimeout(() => fail('timeout'), 9000);
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
        peer.on('disconnected', () => { /* signalling lost; data channel may live on */ });
        res(L);
      });
      conn.on('error', () => fail('conn'));
    });
  });
}

async function relayConnectOne(url, code) {
  const mqtt = await loadMqtt();
  const T = topic(code);
  const cid = rid(14);
  return new Promise((res, rej) => {
    const client = mqtt.connect(url, { clientId: 'poc_' + rid(10), clean: true, connectTimeout: 6000, reconnectPeriod: 0, keepalive: 30 });
    let done = false, L = null;
    const fail = (why) => { if (done) return; done = true; clearTimeout(t); try { client.end(true); } catch (e) { /* ignore */ } rej(new Error(why)); };
    const t = setTimeout(() => fail('notfound'), 6000);
    client.on('connect', () => {
      client.subscribe(`${T}/c/${cid}`, { qos: 1 }, (e) => {
        if (e) return fail('sub');
        client.publish(T + '/h', JSON.stringify({ c: cid, k: 'open' }), { qos: 1 });
      });
    });
    client.on('message', (_t, buf) => {
      let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
      if (m.k === 'ack' && !done) {
        done = true; clearTimeout(t);
        L = makeLink('relay',
          (o) => client.publish(T + '/h', JSON.stringify({ c: cid, k: 'msg', d: o }), { qos: 1 }),
          () => { client.publish(T + '/h', JSON.stringify({ c: cid, k: 'close' }), { qos: 1 }); setTimeout(() => client.end(true), 300); });
        res(L);
      } else if (m.k === 'msg' && L) L._recv(m.d);
      else if (m.k === 'close' && L) { L._closed(); client.end(true); }
    });
    client.on('close', () => { if (L) L._closed(); else fail('unreachable'); });
    client.on('error', () => { if (!L) fail('unreachable'); });
  });
}

async function relayConnect(code) {
  // Try every broker at once; the first one where the host answers wins.
  const attempts = BROKERS.map((u) => relayConnectOne(u, code));
  try {
    const L = await Promise.any(attempts);
    attempts.forEach((p) => p.then((x) => { if (x !== L) x.close(); }, () => {}));
    return L;
  } catch (e) {
    throw new Error('notfound');
  }
}

/**
 * Connect to a room. mode: 'auto' (P2P, then relay), 'p2p' or 'relay'.
 * Resolves to a link; rejects with Error('notfound') or other reasons.
 */
export async function connectToRoom(code, { mode = 'auto', onStatus = () => {} } = {}) {
  let p2pErr = null;
  if (mode !== 'relay') {
    onStatus('Knocking on the coop door…');
    try { return await p2pConnect(code); } catch (e) { p2pErr = e; }
    if (mode === 'p2p') throw p2pErr;
  }
  onStatus(p2pErr ? 'Trying the back door (relay)…' : 'Connecting via relay…');
  return relayConnect(code);
}

export const _internals = { PEER_PREFIX, BROKERS };

// A player's connection to a room — over the network (relay and/or P2P links at the same time)
// or straight into the local Host.
//
// Robustness rules:
//  * Every message goes out on every open link; both sides drop duplicates (sid/mid up, hid/seq down).
//  * A link only counts as dead after a long silence, and never because *we* were asleep
//    (phones freeze background tabs; we detect that from timer gaps and visibility changes).
//  * Missing link types are re-opened in the background with backoff, so a hiccup on one path
//    is invisible as long as the other path is up.
import { p2pConnect, relayConnect } from './net.js';

const TICK_MS = 2000;
const PING_MS = 4000;
const DEAD_MS = 22000;          // silence on a link before we drop it
const HOST_AWAY_DEAD_MS = 6 * 60e3; // host told us it's backgrounded: be patient
const SLEEP_GAP_MS = 8000;      // a tick this late means our own page was frozen
const GIVE_UP_MS = 12 * 60e3;   // stop retrying after this long with no link at all
const SHOW_BANNER_AFTER = 3500;

export function playerId() {
  let id = null;
  try { id = localStorage.getItem('po_pid'); } catch (e) { /* ignore */ }
  if (!id) {
    id = 'p_' + Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join('');
    try { localStorage.setItem('po_pid', id); } catch (e) { /* ignore */ }
  }
  return id;
}

const FATAL = /already running|full|turned you away|Bad player/;

export class Session {
  /**
   * @param {object} o  { code, pid, name, look, host?: Host, mode?: 'auto'|'p2p'|'relay' }
   * handlers: onRoom(room), onGame(view), onEmote(msg), onError(text), onStatus(state, detail), onEnd(reason)
   * onStatus states: 'connecting' | 'connected' | 'reconnecting' | 'hostAway'
   */
  constructor(o) {
    Object.assign(this, { code: o.code, pid: o.pid, name: o.name, look: o.look, host: o.host || null, mode: o.mode || 'auto' });
    this.isHost = !!this.host;
    this.links = new Set();
    this.ended = false;
    this.h = {};
    this.sid = Math.random().toString(36).slice(2, 10);
    this.mid = 0;
    this.hid = null;
    this.hs = 0;
    this.outbox = [];
    this.trying = { p2p: false, relay: false };
    this.nextTry = { p2p: 0, relay: 0 };
    this.backoff = { p2p: 0, relay: 0 };
    this.hostAway = false;
    this.lastLinkAt = Date.now();
    this.state = 'connecting';
  }

  on(handlers) { Object.assign(this.h, handlers); return this; }
  _emit(k, ...a) { try { this.h[k] && this.h[k](...a); } catch (e) { console.error(e); } }

  get kinds() { return [...this.links].map((l) => l.kind); }
  _wants(kind) { return this.mode === 'auto' || this.mode === kind; }

  /** Resolves once welcomed into the room over at least one path; rejects with a human-readable Error.
   *  Safe to call more than once: later calls just wait for the first connection. */
  connect() {
    if (!this._connecting) this._connecting = this._connect();
    return this._connecting;
  }

  async _connect() {
    if (this.isHost) {
      this.host.onLocal = (m) => this._onMsg(m);
      this._setState('connected');
      this.host._broadcastRoom();
      if (this.host.game) this.host._sendGame(this.pid);
      return;
    }
    this._emit('onStatus', 'connecting', 'Knocking on the coop door…');
    const tries = [];
    if (this._wants('relay')) tries.push(this._open('relay'));
    if (this._wants('p2p')) tries.push(this._open('p2p'));
    try {
      await Promise.any(tries);
    } catch (agg) {
      const errs = (agg.errors || []).map((e) => e.message);
      const fatal = errs.find((m) => FATAL.test(m));
      throw new Error(fatal || (errs.every((m) => m === 'notfound' || m === 'timeout')
        ? 'No coop found with that code. Check the letters and make sure the host still has the game open.'
        : 'Could not reach the barnyard — check your connection and try again.'));
    }
    this.lastTick = Date.now();
    this._tick = setInterval(() => this._onTick(), TICK_MS);
    this._vis = () => this._onVisible();
    document.addEventListener('visibilitychange', this._vis);
    addEventListener('online', this._vis);
  }

  /** Open one link of the given kind and complete the hello/welcome handshake on it. */
  async _open(kind) {
    this.trying[kind] = true;
    try {
      const link = kind === 'p2p' ? await p2pConnect(this.code) : await relayConnect(this.code);
      if (this.ended) { link.close(); throw new Error('ended'); }
      await this._handshake(link);
      this.backoff[kind] = 0;
      return link;
    } catch (e) {
      // P2P often can't work between some networks; don't hammer it. The relay retries quickly.
      const base = kind === 'p2p' ? 15000 : 1500;
      const cap = kind === 'p2p' ? 120000 : 8000;
      this.backoff[kind] = Math.min(cap, this.backoff[kind] ? this.backoff[kind] * 2 : base);
      this.nextTry[kind] = Date.now() + this.backoff[kind];
      throw e;
    } finally {
      this.trying[kind] = false;
    }
  }

  _handshake(link) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => { link.close(); rej(new Error('timeout')); }, 9000);
      link.onmessage = (m) => {
        if (!m) return;
        if (m.t === 'welcome') {
          clearTimeout(t);
          this._addLink(link);
          res();
        } else if (m.t === 'reject') {
          clearTimeout(t);
          link.close();
          rej(new Error(m.reason || 'The host turned you away.'));
        }
      };
      link.onclose = () => { clearTimeout(t); rej(new Error('closed')); };
      link.send({ t: 'hello', pid: this.pid, name: this.name, look: this.look, sid: this.sid, v: 2 });
    });
  }

  _addLink(link) {
    const now = Date.now();
    link.lastHeard = now;
    link.lastPing = now;
    link.onmessage = (m) => { link.lastHeard = Date.now(); this._onMsg(m); };
    link.onclose = () => {
      this.links.delete(link);
      if (!this.links.size) this.lastLinkAt = Date.now();
      this._refreshState();
    };
    this.links.add(link);
    this.lastLinkAt = now;
    // anything typed while we were cut off
    const queued = this.outbox.splice(0);
    for (const m of queued) link.send(m);
    this._refreshState();
  }

  _onTick() {
    if (this.ended) return;
    const now = Date.now();
    const gap = now - this.lastTick;
    this.lastTick = now;
    if (gap > SLEEP_GAP_MS) this._wokeUp(now);
    const deadAfter = this.hostAway ? HOST_AWAY_DEAD_MS : DEAD_MS;
    for (const l of [...this.links]) {
      if (now - l.lastPing >= PING_MS) { l.lastPing = now; l.send({ t: 'ping' }); }
      if (now - l.lastHeard > deadAfter) l.close();
    }
    this._ensureLinks(now);
    this._refreshState();
    if (!this.links.size && now - this.lastLinkAt > GIVE_UP_MS) this._end('lost');
  }

  /** Our page was frozen (phone in pocket / app switch): give every link a short, fair re-check. */
  _wokeUp(now) {
    for (const l of this.links) { l.lastHeard = Math.max(l.lastHeard, now - DEAD_MS + 7000); l.lastPing = 0; }
    this.nextTry = { p2p: Math.min(this.nextTry.p2p, now), relay: now };
  }

  _onVisible() {
    if (document.visibilityState !== 'visible' || this.ended) return;
    const now = Date.now();
    this._wokeUp(now);
    for (const l of this.links) { l.lastPing = now; l.send({ t: 'ping' }); }
    this._ensureLinks(now);
  }

  _ensureLinks(now) {
    for (const kind of ['relay', 'p2p']) {
      if (!this._wants(kind) || this.trying[kind] || now < this.nextTry[kind]) continue;
      if ([...this.links].some((l) => l.kind === kind)) continue;
      this._open(kind).catch((e) => {
        if (FATAL.test(e.message) && !this.links.size) this._end('rejected', e.message);
      });
    }
  }

  _setState(s, detail) {
    if (s === this.state) return;
    this.state = s;
    this._emit('onStatus', s, detail);
  }

  _refreshState() {
    if (this.ended) return;
    if (this.links.size) { this._setState(this.hostAway ? 'hostAway' : 'connected', this.kinds.join('+')); return; }
    if (Date.now() - this.lastLinkAt > SHOW_BANNER_AFTER || this.state === 'hostAway') this._setState(this.hostAway ? 'hostAway' : 'reconnecting');
  }

  _onMsg(m) {
    if (!m || typeof m !== 'object') return;
    if (m._h) { // de-duplicate (the same message can arrive over two links)
      if (m._h !== this.hid) { this.hid = m._h; this.hs = 0; }
      if (m._s <= this.hs) return;
      this.hs = m._s;
    }
    switch (m.t) {
      case 'room': this.room = m.room; this._emit('onRoom', m.room); break;
      case 'game': this._emit('onGame', m.view); break;
      case 'emote': this._emit('onEmote', m); break;
      case 'err': this._emit('onError', m.error); break;
      case 'away': this.hostAway = true; this._refreshState(); this._setState('hostAway'); break;
      case 'back': this.hostAway = false; this._refreshState(); break;
      case 'kicked': this._end('kicked'); break;
      case 'closed': this._end('closed'); break;
      default: break;
    }
    if (this.hostAway && m.t !== 'away' && m.t !== 'pong') { this.hostAway = false; this._refreshState(); }
  }

  _end(reason, detail) {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this._tick);
    if (this._vis) { document.removeEventListener('visibilitychange', this._vis); removeEventListener('online', this._vis); }
    for (const l of [...this.links]) { l.onclose = null; l.close(); }
    this.links.clear();
    this._emit('onEnd', reason, detail);
  }

  send(m) {
    if (this.ended) return;
    if (this.isHost) { const mm = JSON.parse(JSON.stringify(m)); setTimeout(() => this.host.handle(this.pid, mm), 0); return; }
    const msg = { ...m, sid: this.sid, mid: ++this.mid };
    if (!this.links.size) {
      if (msg.t !== 'ping') { this.outbox.push(msg); if (this.outbox.length > 20) this.outbox.shift(); }
      return;
    }
    for (const l of this.links) l.send(msg);
  }

  input(inp) { this.send({ t: 'in', input: inp }); }

  leave() {
    if (this.ended) return;
    this.send({ t: 'leave' });
    if (this.isHost) { this.host.stop(); }
    setTimeout(() => this._end('left'), 250);
  }
}

// A player's connection to a room — either over the network or straight into the local Host.
import { connectToRoom } from './net.js';

const PING_MS = 4000;
const LOST_MS = 13000;
const RECONNECT_FOR_MS = 4 * 60 * 1000;

export function playerId() {
  let id = null;
  try { id = localStorage.getItem('po_pid'); } catch (e) { /* ignore */ }
  if (!id) {
    id = 'p_' + Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join('');
    try { localStorage.setItem('po_pid', id); } catch (e) { /* ignore */ }
  }
  return id;
}

export class Session {
  /**
   * @param {object} o  { code, pid, name, look, host?: Host, mode?: 'auto'|'p2p'|'relay' }
   * handlers: onRoom(room), onGame(view), onEmote(msg), onError(text), onStatus(state, detail), onEnd(reason)
   */
  constructor(o) {
    Object.assign(this, { code: o.code, pid: o.pid, name: o.name, look: o.look, host: o.host || null, mode: o.mode || 'auto' });
    this.isHost = !!this.host;
    this.link = null;
    this.ended = false;
    this.h = {};
  }

  on(handlers) { Object.assign(this.h, handlers); return this; }
  _emit(k, ...a) { try { this.h[k] && this.h[k](...a); } catch (e) { console.error(e); } }

  /** Resolves once welcomed into the room; rejects with a human-readable Error. */
  async connect() {
    if (this.isHost) {
      this.host.onLocal = (m) => this._onMsg(m);
      this._emit('onStatus', 'connected');
      this.host._broadcastRoom();
      if (this.host.game) this.host._sendGame(this.pid);
      return;
    }
    await this._connectOnce((s) => this._emit('onStatus', 'connecting', s));
    this._startPing();
  }

  async _connectOnce(onStatus) {
    let link;
    try {
      link = await connectToRoom(this.code, { mode: this.mode, onStatus });
    } catch (e) {
      throw new Error(e.message === 'notfound' || e.message === 'timeout'
        ? 'No coop found with that code. Check the letters and make sure the host is still in the room.'
        : 'Could not reach the barnyard — check your connection and try again.');
    }
    return new Promise((res, rej) => {
      const t = setTimeout(() => { link.close(); rej(new Error('The host did not answer. Try again in a moment.')); }, 9000);
      link.onmessage = (m) => {
        if (!m) return;
        if (m.t === 'welcome') {
          clearTimeout(t);
          this.link = link;
          this.lastHeard = Date.now();
          link.onmessage = (mm) => this._onMsg(mm);
          link.onclose = () => this._lost();
          this._emit('onStatus', 'connected', link.kind);
          res();
        } else if (m.t === 'reject') {
          clearTimeout(t);
          link.close();
          rej(new Error(m.reason || 'The host turned you away.'));
        }
      };
      link.onclose = () => { clearTimeout(t); rej(new Error('Connection closed.')); };
      link.send({ t: 'hello', pid: this.pid, name: this.name, look: this.look, v: 1 });
    });
  }

  _startPing() {
    clearInterval(this._ping);
    this._ping = setInterval(() => {
      if (!this.link) return;
      this.link.send({ t: 'ping' });
      if (Date.now() - this.lastHeard > LOST_MS) this.link.close();
    }, PING_MS);
  }

  _onMsg(m) {
    if (!m || typeof m !== 'object') return;
    this.lastHeard = Date.now();
    switch (m.t) {
      case 'room': this.room = m.room; this._emit('onRoom', m.room); break;
      case 'game': this._emit('onGame', m.view); break;
      case 'emote': this._emit('onEmote', m); break;
      case 'err': this._emit('onError', m.error); break;
      case 'kicked': this._end('kicked'); break;
      case 'closed': this._end('closed'); break;
      default: break;
    }
  }

  async _lost() {
    if (this.ended || this.reconnecting) return;
    this.link = null;
    this.reconnecting = true;
    this._emit('onStatus', 'reconnecting');
    const until = Date.now() + RECONNECT_FOR_MS;
    let wait = 800;
    while (!this.ended && Date.now() < until) {
      await new Promise((r) => setTimeout(r, wait));
      if (this.ended) break;
      try {
        await this._connectOnce(() => this._emit('onStatus', 'reconnecting'));
        this.reconnecting = false;
        return;
      } catch (e) {
        if (/already running|full|turned you away/.test(e.message)) { this._end('rejected', e.message); return; }
        wait = Math.min(wait * 1.6, 5000);
      }
    }
    this.reconnecting = false;
    if (!this.ended) this._end('lost');
  }

  _end(reason, detail) {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this._ping);
    if (this.link) { const l = this.link; this.link = null; l.onclose = null; l.close(); }
    this._emit('onEnd', reason, detail);
  }

  send(m) {
    if (this.ended) return;
    if (this.isHost) { const mm = JSON.parse(JSON.stringify(m)); setTimeout(() => this.host.handle(this.pid, mm), 0); return; }
    if (this.link) this.link.send(m);
  }

  input(inp) { this.send({ t: 'in', input: inp }); }

  leave() {
    if (this.ended) return;
    this.send({ t: 'leave' });
    if (this.isHost) { this.host.stop(); }
    setTimeout(() => this._end('left'), 150);
  }
}

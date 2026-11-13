// The host: runs the authoritative game in the host player's browser.
import { HostNet } from './net.js';
import * as E from './engine.js';
import { botDecide, BOT_NAMES } from './bot.js';
import { MAX_PLAYERS, MIN_PLAYERS } from './roles.js';

const GRACE_MS = 2600;          // extra response time to cover the client-side announcement animation
const AUTO_BOT_AFTER_MS = 45000; // a disconnected player is covered by a bot after this long
const HEARTBEAT_LOST_MS = 13000;
const SAVE_KEY = 'po_host';
const N_COLORS = 8, N_HATS = 8;
const EVENTS_SENT = 36;

const cleanName = (n) => String(n || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12) || 'Chick';
const cleanLook = (l) => ({
  color: Math.abs(parseInt(l && l.color, 10) || 0) % N_COLORS,
  hat: Math.abs(parseInt(l && l.hat, 10) || 0) % N_HATS,
});
const EMOTES = ['bawk', 'liar', 'trust', 'hmm', 'nice', 'gg', 'oops', 'honk'];

export class Host {
  constructor({ code, self, onLocal, restore, offline = false }) {
    this.code = code;
    this.offline = offline;
    this.self = self;
    this.onLocal = onLocal;
    this.links = new Map();
    this.lastSeen = new Map();
    this.offlineSince = new Map();
    this.botTimers = new Map();
    this.win = { id: null, t: null, deadline: 0, total: 0 };
    if (restore) {
      this.room = restore.room;
      this.game = restore.game;
      for (const p of this.room.players) if (!p.isBot && p.id !== self.pid) { p.connected = false; this.offlineSince.set(p.id, Date.now()); }
    } else {
      this.room = {
        code, hostId: self.pid, phase: 'lobby', gameNo: 0,
        settings: { timer: 20 },
        players: [{ id: self.pid, name: cleanName(self.name), look: cleanLook(self.look), isBot: false, connected: true }],
      };
      this.game = null;
    }
  }

  async start(opts) {
    let res = { offline: true };
    if (!this.offline) {
      this.net = new HostNet(this.code, (link) => this._onLink(link));
      res = await this.net.start(opts);
    }
    this._hb = setInterval(() => this._heartbeat(), 2500);
    this._broadcastRoom();
    if (this.game) this._afterChange();
    return res;
  }

  stop() {
    clearInterval(this._hb);
    for (const { t } of this.botTimers.values()) clearTimeout(t);
    clearTimeout(this.win.t);
    for (const L of this.links.values()) { L.send({ t: 'closed' }); L.close(); }
    this.net && this.net.stop();
    if (!this.offline) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
  }

  /* ---------- connections ---------- */
  _onLink(link) {
    link.onmessage = (m) => this._onMsg(link, m);
    link.onclose = () => {
      const pid = link.pid;
      if (pid && this.links.get(pid) === link) {
        this.links.delete(pid);
        this._setConnected(pid, false);
      }
    };
  }

  _onMsg(link, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') return this._hello(link, m);
    if (!link.pid) return;
    this.lastSeen.set(link.pid, Date.now());
    if (m.t === 'ping') { link.send({ t: 'pong' }); return; }
    this.handle(link.pid, m);
  }

  _hello(link, m) {
    const pid = String(m.pid || '').slice(0, 40);
    if (!pid || pid === this.self.pid) { link.send({ t: 'reject', reason: 'Bad player id' }); return; }
    let p = this.room.players.find((x) => x.id === pid);
    if (!p) {
      if (this.room.phase !== 'lobby') { link.send({ t: 'reject', reason: 'A game is already running in this room. Ask the host to start a new one!' }); return; }
      if (this.room.players.length >= MAX_PLAYERS) { link.send({ t: 'reject', reason: 'This coop is full (6 players max).' }); return; }
      p = { id: pid, name: this._uniqueName(cleanName(m.name)), look: this._freeLook(cleanLook(m.look)), isBot: false, connected: true };
      this.room.players.push(p);
      this._emoteAll(pid, 'joined');
    } else {
      p.connected = true;
      if (p.autoBot) {
        p.autoBot = false; p.isBot = false;
        if (this.game) E.setBot(this.game, pid, false);
      }
      this._emoteAll(pid, 'back');
    }
    this.offlineSince.delete(pid);
    const old = this.links.get(pid);
    if (old && old !== link) { old.pid = null; old.close(); }
    link.pid = pid;
    this.links.set(pid, link);
    this.lastSeen.set(pid, Date.now());
    link.send({ t: 'welcome', pid, code: this.code, hostId: this.self.pid });
    this._broadcastRoom();
    if (this.game) this._sendGame(pid);
    this._persist();
  }

  _setConnected(pid, on) {
    const p = this.room.players.find((x) => x.id === pid);
    if (!p || p.isBot && !p.autoBot) return;
    if (!on) {
      p.connected = false;
      this.offlineSince.set(pid, Date.now());
      if (this.room.phase === 'lobby') {
        // in the lobby, a dropped player simply leaves (they can rejoin with the code)
        this.room.players = this.room.players.filter((x) => x.id !== pid);
        this._emoteAll(pid, 'left', p.name);
      }
      this._broadcastRoom();
      this._persist();
    }
  }

  _heartbeat() {
    const now = Date.now();
    for (const [pid, L] of this.links) {
      if (now - (this.lastSeen.get(pid) || 0) > HEARTBEAT_LOST_MS) { L.close(); }
    }
    if (this.game && this.game.stage !== 'over') {
      for (const p of this.room.players) {
        if (p.isBot || p.connected || p.id === this.self.pid) continue;
        const since = this.offlineSince.get(p.id) || now;
        if (now - since > AUTO_BOT_AFTER_MS) {
          p.isBot = true; p.autoBot = true;
          E.setBot(this.game, p.id, true);
          this._emoteAll(p.id, 'botcover');
          this._broadcastRoom();
          this._afterChange();
        }
      }
    }
  }

  /* ---------- message handling (remote + local) ---------- */
  handle(pid, m) {
    const isHost = pid === this.self.pid;
    switch (m.t) {
      case 'in': return this._input(pid, m.input);
      case 'look': {
        if (this.room.phase !== 'lobby') return;
        const p = this.room.players.find((x) => x.id === pid);
        if (p) { p.look = cleanLook(m.look); if (m.name) p.name = this._uniqueName(cleanName(m.name), pid); this._broadcastRoom(); }
        return;
      }
      case 'emote': {
        if (!EMOTES.includes(m.id)) return;
        const now = Date.now();
        const p = this.room.players.find((x) => x.id === pid);
        if (!p || (p._lastEmote && now - p._lastEmote < 1200)) return;
        p._lastEmote = now;
        this._emoteAll(pid, m.id);
        return;
      }
      case 'leave': {
        const L = this.links.get(pid);
        if (this.room.phase === 'lobby') {
          this.room.players = this.room.players.filter((x) => x.id !== pid);
          this._emoteAll(pid, 'left');
        } else {
          this._setConnected(pid, false);
          this.offlineSince.set(pid, Date.now() - AUTO_BOT_AFTER_MS); // cover with a bot right away
          this._heartbeat();
        }
        if (L) { this.links.delete(pid); L.close(); }
        this._broadcastRoom();
        return;
      }
    }
    if (!isHost) return;
    // ---- host-only commands ----
    switch (m.t) {
      case 'addBot': {
        if (this.room.phase !== 'lobby' || this.room.players.length >= MAX_PLAYERS) return;
        const used = new Set(this.room.players.map((p) => p.name));
        const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot ' + this.room.players.length;
        const id = 'bot_' + Math.random().toString(36).slice(2, 9);
        this.room.players.push({ id, name, look: this._freeLook({ color: Math.floor(Math.random() * N_COLORS), hat: 1 + Math.floor(Math.random() * (N_HATS - 1)) }), isBot: true, connected: true });
        this._emoteAll(id, 'joined');
        this._broadcastRoom();
        return;
      }
      case 'kick': {
        if (this.room.phase !== 'lobby' || m.pid === this.self.pid) return;
        const L = this.links.get(m.pid);
        if (L) { L.send({ t: 'kicked' }); this.links.delete(m.pid); setTimeout(() => L.close(), 200); }
        this.room.players = this.room.players.filter((x) => x.id !== m.pid);
        this._broadcastRoom();
        return;
      }
      case 'settings': {
        const t = parseInt(m.settings && m.settings.timer, 10);
        if ([0, 10, 20, 30, 45].includes(t)) this.room.settings.timer = t;
        this._broadcastRoom();
        return;
      }
      case 'start': return this._startGame();
      case 'rematch': return this._startGame();
      case 'toLobby': {
        this.game = null;
        this.room.phase = 'lobby';
        // drop players who are gone; un-bot anyone who was only covered
        this.room.players = this.room.players.filter((p) => p.connected || (p.isBot && !p.autoBot) || p.id === this.self.pid);
        this._clearTimers();
        this._broadcastRoom();
        this._persist();
        return;
      }
    }
  }

  _startGame() {
    const ps = this.room.players;
    if (ps.length < MIN_PLAYERS) return;
    // shuffle seating a little so the host isn't always first? keep join order (players arrange themselves)
    const prevSeq = this.game ? this.game.seq : 0;
    this.room.gameNo = (this.room.gameNo || 0) + 1;
    this.game = E.createGame(ps.map((p) => ({ id: p.id, name: p.name, look: p.look, isBot: p.isBot })), { seqStart: prevSeq + 1000 });
    this.room.phase = 'game';
    this._clearTimers();
    this._broadcastRoom();
    this._afterChange();
  }

  _input(pid, input) {
    if (!this.game) return;
    const p = this.game.players.find((x) => x.id === pid);
    if (!p || p.isBot) return;
    const r = E.applyInput(this.game, pid, input);
    if (!r.ok) { this._send(pid, { t: 'err', error: r.error }); return; }
    this._afterChange();
  }

  /* ---------- game loop plumbing ---------- */
  _afterChange() {
    this._schedule();
    this._broadcastGame();
    this._persist();
  }

  _clearTimers() {
    for (const { t } of this.botTimers.values()) clearTimeout(t);
    this.botTimers.clear();
    clearTimeout(this.win.t);
    this.win = { id: null, t: null, deadline: 0, total: 0 };
  }

  _schedule() {
    const g = this.game;
    if (!g || g.stage === 'over') { this._clearTimers(); return; }
    // response window timer
    if (g.stage === 'respond') {
      const wid = g.ctx.window.id;
      if (this.win.id !== wid) {
        clearTimeout(this.win.t);
        const secs = this.room.settings.timer;
        this.win = { id: wid, t: null, deadline: 0, total: 0 };
        if (secs) {
          const ms = secs * 1000 + GRACE_MS;
          this.win.deadline = Date.now() + ms;
          this.win.total = ms;
          this.win.t = setTimeout(() => {
            if (this.game === g && E.applyTimeout(g, wid)) this._afterChange();
          }, ms);
        }
      }
    } else if (this.win.id !== null) {
      clearTimeout(this.win.t);
      this.win = { id: null, t: null, deadline: 0, total: 0 };
    }
    // bots
    const pend = E.pending(g);
    const wanted = new Set();
    for (const { pid, kind } of pend) {
      const pl = g.players.find((x) => x.id === pid);
      if (!pl || !pl.isBot) continue;
      const key = `${kind}:${kind === 'respond' ? g.ctx.window.id : kind === 'lose' ? g.loseId : g.turnId}`;
      wanted.add(pid);
      const cur = this.botTimers.get(pid);
      if (cur && cur.key === key) continue;
      if (cur) clearTimeout(cur.t);
      const delay = kind === 'action' ? 2300 + Math.random() * 1800
        : kind === 'respond' ? 2000 + Math.random() * 2600
        : 1400 + Math.random() * 1000;
      const t = setTimeout(() => {
        this.botTimers.delete(pid);
        if (this.game !== g) return;
        const v = E.viewFor(g, pid);
        if (!v.prompt) return;
        const inp = botDecide(v, pid);
        if (inp && E.applyInput(g, pid, inp).ok) this._afterChange();
      }, delay);
      this.botTimers.set(pid, { key, t });
    }
    for (const [pid, v] of this.botTimers) if (!wanted.has(pid)) { clearTimeout(v.t); this.botTimers.delete(pid); }
  }

  _viewFor(pid) {
    const v = E.viewFor(this.game, pid);
    v.events = v.events.slice(-EVENTS_SENT);
    v.gameNo = this.room.gameNo;
    if (this.game.stage === 'respond' && this.win.id === this.game.ctx.window.id && this.win.deadline) {
      v.timer = { windowId: this.win.id, remaining: Math.max(0, this.win.deadline - Date.now()), total: this.win.total };
    }
    return v;
  }

  _sendGame(pid) {
    if (!this.game) return;
    this._send(pid, { t: 'game', view: this._viewFor(pid) });
  }

  _broadcastGame() {
    if (!this.game) return;
    for (const p of this.room.players) if (!p.isBot || p.autoBot) this._sendGame(p.id);
  }

  _roomView() {
    const r = this.room;
    return {
      code: r.code, hostId: r.hostId, phase: r.phase, gameNo: r.gameNo, settings: { ...r.settings }, offline: this.offline,
      players: r.players.map((p) => ({ id: p.id, name: p.name, look: p.look, isBot: p.isBot && !p.autoBot, covered: !!p.autoBot, connected: p.isBot && !p.autoBot ? true : p.connected })),
      net: this.net ? { p2p: this.net.p2p, relay: this.net.relay } : null,
    };
  }

  _broadcastRoom() {
    const msg = { t: 'room', room: this._roomView() };
    for (const p of this.room.players) if (!p.isBot || p.autoBot) this._send(p.id, msg);
  }

  _send(pid, msg) {
    if (pid === this.self.pid) { const m = JSON.parse(JSON.stringify(msg)); setTimeout(() => this.onLocal && this.onLocal(m), 0); return; }
    const L = this.links.get(pid);
    if (L) L.send(msg);
  }

  _emoteAll(pid, id, name) {
    const msg = { t: 'emote', pid, id, name };
    for (const p of this.room.players) if (!p.isBot || p.autoBot) this._send(p.id, msg);
  }

  _uniqueName(name, selfId) {
    const taken = new Set(this.room.players.filter((p) => p.id !== selfId).map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 99; i++) { const n = name.slice(0, 10) + i; if (!taken.has(n.toLowerCase())) return n; }
    return name;
  }

  _freeLook(look) {
    const used = new Set(this.room.players.map((p) => p.look.color));
    if (!used.has(look.color)) return look;
    for (let k = 1; k < N_COLORS; k++) { const c = (look.color + k) % N_COLORS; if (!used.has(c)) return { ...look, color: c }; }
    return look;
  }

  _persist() {
    if (this.offline) return;
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ code: this.code, self: this.self, room: this.room, game: this.game, savedAt: Date.now() }));
      } catch (e) { /* quota or private mode */ }
    }, 250);
  }

  static saved() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (s && Date.now() - s.savedAt < 45 * 60 * 1000) return s;
    } catch (e) { /* ignore */ }
    return null;
  }
  static clearSaved() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
}

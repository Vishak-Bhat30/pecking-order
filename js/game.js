// In-game screen: board, prompts, and the event → animation pipeline.
import { ROLES, ACTIONS, ACTION_IDS } from './roles.js';
import { characterSVG, cardBackSVG, iconSVG } from './art.js';
import audio from './audio.js';
import { fx } from './fx.js';
import { $, $$, esc, el, cardFront, cardBack, hen, corn, roleTag, toast } from './dom.js';

export const EMOTES = { bawk: 'Bawk!', liar: 'Liar!', trust: 'Trust me', hmm: 'Hmm…', nice: 'Nice one', gg: 'GG', oops: 'Oops', honk: 'HONK!' };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SLASH = `<svg viewBox="0 0 100 100"><g fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"><path d="M22 18 Q48 50 70 86"/><path d="M38 12 Q62 46 82 78"/><path d="M8 30 Q32 60 52 92"/></g><g fill="none" stroke="#D7263D" stroke-width="3" stroke-linecap="round"><path d="M22 18 Q48 50 70 86"/><path d="M38 12 Q62 46 82 78"/><path d="M8 30 Q32 60 52 92"/></g></svg>`;

export class GameUI {
  constructor(root, { session, me, room, onRules, onLeave, onCopy }) {
    Object.assign(this, { root, s: session, me, room, onRules, onLeave, onCopy });
    this.queue = [];
    this.busy = false;
    this.view = null;
    this.lastSeq = -1;
    this.gameNo = null;
    this.mode = null;
    this.exSel = [];
    this.panelKey = '';
    this.logN = 0;
  }

  destroy() { clearInterval(this.timerInt); this.dead = true; $$('.announce, .over-back').forEach((x) => x.remove()); }

  setRoom(room) {
    this.room = room;
    if (!this.view) return;
    for (const rp of room.players) {
      const seat = this.seat(rp.id);
      if (!seat) continue;
      seat.classList.toggle('offline', !rp.connected && !rp.isBot);
      const b = $('.badges', seat);
      if (b) b.innerHTML = (rp.isBot ? '<i class="bdg">bot</i>' : '') + (rp.covered ? '<i class="bdg warn">bot covering</i>' : !rp.connected ? '<i class="bdg warn">offline</i>' : '') + (rp.id === room.hostId ? '<i class="bdg host">host</i>' : '');
    }
  }

  push(view) {
    view._at = performance.now();
    this.queue.push(view);
    if (!this.busy) this._drain();
  }

  async _drain() {
    this.busy = true;
    while (this.queue.length && !this.dead) {
      const v = this.queue.shift();
      let animate = true;
      if (v.gameNo !== this.gameNo) {
        this._build(v);
        this.gameNo = v.gameNo;
        const startIdx = v.events.findIndex((e) => e.type === 'start');
        if (startIdx >= 0 && v.events.length - startIdx < 6) this.lastSeq = v.events[startIdx].seq - 1;
        else { animate = false; }
      }
      const fresh = v.events.filter((e) => e.seq > this.lastSeq);
      for (const ev of fresh) {
        this.lastSeq = ev.seq;
        this._log(ev, v);
        if (!animate) continue;
        fx.speed = this.queue.length > 2 ? 3.2 : this.queue.length > 0 ? 1.5 : 1;
        try { await this._animate(ev, v); } catch (e) { console.error(e); }
        if (this.dead) return;
      }
      fx.speed = 1;
      this.view = v;
      this._render(v);
    }
    this.busy = false;
  }

  /* ================= build ================= */
  P(id) { return this.view_ && this.view_.players.find((p) => p.id === id); }
  seat(id) { return this.root.querySelector(`.seat[data-pid="${id}"]`); }
  seatOrHand(id) { return id === this.me ? $('.hand', this.root) || this.seat(id) : this.seat(id); }

  _build(v) {
    this.view_ = v;
    const meIdx = v.players.findIndex((p) => p.id === this.me);
    const order = meIdx < 0 ? v.players : [...v.players.slice(meIdx + 1), ...v.players.slice(0, meIdx)];
    const me = v.players[meIdx];
    this.root.innerHTML = `
    <div class="game">
      <div class="g-bar">
        ${this.room && this.room.offline ? '<span class="pill">Practice</span>' : `<button class="pill code-pill" data-a="copy" title="Copy invite link">Room <b>${esc(this.s.code)}</b></button>`}
        <span class="pill round-pill">Round <b class="round-n">1</b></span>
        <span class="sp"></span>
        <button class="pill" data-a="log">Log</button>
        <button class="pill" data-a="rules">Rules</button>
        <button class="pill" data-a="leave">Leave</button>
      </div>
      <div class="g-wrap">
        <div class="table">
          <div class="opps n${order.length}">${order.map((p) => this._seatHTML(p, false)).join('')}</div>
          <div class="center">
            <div class="pile deck-pile"><div class="stack">${cardBack()}${cardBack()}${cardBack()}</div><div class="pile-lbl">Deck <b class="deck-n">${v.deckCount}</b></div></div>
            <div class="status"><div class="st-main"></div><div class="st-sub"></div><div class="st-who"></div></div>
            <div class="pile bank-pile"><div class="sack">${iconSVG('sack')}</div><div class="pile-lbl">Bank</div></div>
          </div>
          <div class="mine">
            ${me ? this._seatHTML(me, true) : ''}
            <div class="hand"></div>
          </div>
          <div class="panel"></div>
          <div class="emotes">${Object.entries(EMOTES).map(([k, t]) => `<button class="emo" data-emo="${k}">${t}</button>`).join('')}</div>
        </div>
        <aside class="log"><div class="log-h">Barnyard gossip <button class="pill sm" data-a="log">Close</button></div><ol class="log-list"></ol></aside>
      </div>
    </div>`;
    this.panelKey = '';
    this.handKey = '';
    this.logN = 0;
    this.mode = null;
    const root = this.root;
    root.querySelector('.g-bar').addEventListener('click', (e) => this._bar(e));
    root.querySelector('.log').addEventListener('click', (e) => this._bar(e));
    root.querySelector('.panel').addEventListener('click', (e) => this._panelClick(e));
    root.querySelector('.opps').addEventListener('click', (e) => this._seatClick(e));
    root.querySelector('.hand').addEventListener('click', (e) => this._handClick(e));
    root.querySelector('.emotes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-emo]');
      if (!b) return;
      this.s.send({ t: 'emote', id: b.dataset.emo });
      b.disabled = true; setTimeout(() => { b.disabled = false; }, 1300);
    });
    if (this.room) this.setRoom(this.room);
  }

  _seatHTML(p, isMe) {
    return `<div class="seat ${isMe ? 'me-seat' : ''}" data-pid="${p.id}">
      ${hen(p.look)}
      <div class="plate"><span class="nm">${esc(p.name)}${isMe ? ' <i>(you)</i>' : ''}</span>${corn(p.coins)}</div>
      ${isMe ? '' : `<div class="mcards">${p.cards.map((c, i) => this._mcHTML(c, i)).join('')}</div>`}
      <div class="badges"></div>
    </div>`;
  }

  _mcHTML(c, i) {
    const shown = c.dead || c.role;
    return `<div class="mc ${c.dead ? 'dead' : ''} ${shown ? 'flipped' : ''}" data-slot="${i}"><div class="flip"><div class="face fb">${cardBack('mini')}</div><div class="face ff">${shown ? cardFront(c.role, { mini: true }) : ''}</div></div><div class="xmark"></div></div>`;
  }

  /* ================= render ================= */
  _render(v) {
    this.view_ = v;
    const root = this.root;
    $('.round-n', root).textContent = v.round;
    $('.deck-n', root).textContent = v.deckCount;
    const ctx = v.ctx;
    const waiting = new Set();
    const passed = new Set();
    if (v.stage === 'action') waiting.add(v.turn);
    if (v.stage === 'respond' && ctx.window) { ctx.window.responders.forEach((id) => (ctx.window.passed.includes(id) ? passed : waiting).add(id)); }
    if (v.stage === 'lose' && v.losing) waiting.add(v.losing.pid);
    if (v.stage === 'exchange') waiting.add(ctx.actor);
    for (const p of v.players) {
      const seat = this.seat(p.id);
      if (!seat) continue;
      const cl = seat.classList;
      cl.toggle('turn', v.turn === p.id && v.stage !== 'over');
      cl.toggle('dead', !p.alive);
      cl.toggle('waiting', waiting.has(p.id) && v.stage === 'respond');
      cl.toggle('passed', passed.has(p.id));
      cl.toggle('is-target', !!ctx && ctx.target === p.id && v.stage !== 'action');
      cl.toggle('winner', v.winner === p.id);
      const hw = $('.hen-wrap', seat);
      hw.classList.toggle('turn', v.turn === p.id && v.stage === 'action');
      hw.classList.toggle('think', waiting.has(p.id) && v.stage !== 'action');
      hw.classList.toggle('dead', !p.alive);
      hw.classList.toggle('cheer', v.winner === p.id);
      $('.corn-amt b', seat).textContent = p.coins;
      const mc = $('.mcards', seat);
      if (mc) {
        const key = p.cards.map((c) => (c.dead ? 'd' + c.role : c.role ? 'r' + c.role : 'h')).join(',');
        if (mc.dataset.key !== key) { mc.dataset.key = key; mc.innerHTML = p.cards.map((c, i) => this._mcHTML(c, i)).join(''); }
      }
    }
    const meP = v.players.find((p) => p.id === this.me);
    if (meP) this._renderHand(meP, v);
    this._renderStatus(v);
    // targeting highlights
    const targeting = this.mode && this.mode.kind === 'target' && v.prompt && v.prompt.kind === 'action';
    if (!targeting) this.mode = null;
    for (const p of v.players) {
      const seat = this.seat(p.id);
      if (seat) seat.classList.toggle('targetable', !!targeting && p.alive && p.id !== this.me);
    }
    this._renderPanel(v, meP);
    this._renderOver(v);
    if (this.room) this.setRoom(this.room);
    audio.setMood(v.stage === 'over' ? 'victory' : (v.prompt && v.prompt.kind === 'respond') ? 'tense' : 'game');
  }

  _renderHand(me, v) {
    const hand = $('.hand', this.root);
    const key = me.cards.map((c) => (c.dead ? 'd' : '') + c.role).join(',');
    const old = (this.handKey || '').split(',');
    if (key !== this.handKey) {
      this.handKey = key;
      hand.innerHTML = me.cards.map((c, i) => `<div class="hcard ${c.dead ? 'dead' : ''} ${old[i] !== key.split(',')[i] && !c.dead ? 'fresh' : ''}" data-slot="${i}">
        <div class="flip"><div class="face fb">${cardBack()}</div><div class="face ff">${cardFront(c.role)}</div></div>
        <div class="xmark big"></div>${c.dead ? '<div class="dead-lbl">Lost</div>' : ''}
      </div>`).join('');
    }
    const choosing = v.prompt && v.prompt.kind === 'lose';
    $$('.hcard', hand).forEach((h) => h.classList.toggle('choosable', choosing && !h.classList.contains('dead')));
  }

  _name(id) { const p = this.P(id); return p ? `<b class="who">${esc(p.name)}</b>` : '?'; }

  _renderStatus(v) {
    const ctx = v.ctx;
    const isMe = (id) => id === this.me;
    const N = (id, cap) => (isMe(id) ? `<b class="who">${cap ? 'You' : 'you'}</b>` : this._name(id));
    const vb = (id, you, other) => (isMe(id) ? you : other);
    let main = '', sub = '', who = '';
    const A = ctx && ACTIONS[ctx.action];
    const tgt = ctx && ctx.target ? ` on ${N(ctx.target)}` : '';
    switch (v.stage) {
      case 'action':
        main = isMe(v.turn) ? 'Your turn' : `${N(v.turn, 1)} is deciding…`;
        sub = isMe(v.turn) ? 'Pick an action below — bluffing is allowed!' : '';
        break;
      case 'respond': {
        const w = ctx.window;
        if (w.kind === 'blockChallenge') { main = `${N(ctx.block.blocker, 1)} ${vb(ctx.block.blocker, 'block', 'blocks')} with ${roleTag(ctx.block.role)}`; sub = 'Anyone may challenge the block'; }
        else if (w.kind === 'block') { main = `${N(ctx.actor, 1)} proved it — ${A.name}${tgt}`; sub = `${N(ctx.target, 1)} may still block`; }
        else if (ctx.claim) { main = `${N(ctx.actor, 1)} ${vb(ctx.actor, 'claim', 'claims')} ${roleTag(ctx.claim)} · ${A.name}${tgt}`; sub = A.blockedBy.length ? `Challenge it, or ${N(ctx.target)} may block` : 'Anyone may challenge'; }
        else { main = `${N(ctx.actor, 1)} ${vb(ctx.actor, 'harvest', 'harvests')} 2 corn`; sub = `Anyone may block by claiming the ${roleTag('rooster')}`; }
        who = w.responders.map((id) => `<span class="rs ${w.passed.includes(id) ? 'ok' : ''}">${esc((this.P(id) || {}).name || '?')}</span>`).join('');
        break;
      }
      case 'lose': main = `${N(v.losing.pid, 1)} must give up a card`; break;
      case 'exchange': main = `${N(ctx.actor, 1)} ${vb(ctx.actor, 'are', 'is')} swapping cards with the ${roleTag('owl')}…`; break;
      case 'over': main = `${N(v.winner, 1)} ${vb(v.winner, 'rule', 'rules')} the roost!`; break;
      default: main = '…';
    }
    const st = $('.status', this.root);
    $('.st-main', st).innerHTML = main;
    $('.st-sub', st).innerHTML = sub;
    $('.st-who', st).innerHTML = who;
  }

  _renderPanel(v, me) {
    const panel = $('.panel', this.root);
    const pr = v.prompt;
    let key, html;
    if (v.stage === 'over') { key = 'over'; html = ''; }
    else if (!me || !me.alive) { key = 'out'; html = `<div class="pn-msg">You're out of the coop. Cheer (or heckle) from the fence!</div>`; }
    else if (pr && pr.kind === 'action') {
      if (this.mode && this.mode.kind === 'target') {
        const A = ACTIONS[this.mode.action];
        key = 'target:' + this.mode.action + v.turnId;
        html = `<div class="pn-title">${A.ask || 'Pick a rival'}</div><div class="pn-sub">Tap a glowing rival.</div><div class="pn-row"><button class="btn ghost" data-cancel>Cancel</button></div>`;
      } else {
        const mine = me.cards.filter((c) => !c.dead).map((c) => c.role);
        key = `action:${v.turnId}:${me.coins}:${mine.join()}`;
        html = `<div class="pn-title">Your move${pr.mustBarnstorm ? ' — <span class="warn">10+ corn: you must use Knockout!</span>' : ''}</div>
          <div class="act-grid">${ACTION_IDS.map((a) => this._actBtn(a, me, mine, pr, v)).join('')}</div>`;
      }
    } else if (pr && pr.kind === 'respond') {
      key = 'respond:' + pr.windowId;
      html = this._respondHTML(v, me, pr);
    } else if (pr && pr.kind === 'lose') {
      key = 'lose:' + pr.loseId;
      const why = { challenge: 'Your challenge failed', bluff: 'You were caught bluffing', raid: 'The Fox attacked you', barnstorm: 'You got knocked out' }[pr.reason] || 'Ouch';
      html = `<div class="pn-title">${why} — give up a card</div><div class="pn-sub">Tap the card you want to lose. It will be revealed to everyone.</div>`;
    } else if (pr && pr.kind === 'exchange') {
      key = 'ex:' + v.turnId;
      this.exSel = [];
      html = `<div class="pn-title">Owl swap: keep ${pr.keep} card${pr.keep > 1 ? 's' : ''}, the rest go back</div>
        <div class="ex-row">${pr.pool.map((r, i) => `<button class="ex-card" data-ex="${i}">${cardFront(r)}<span class="ex-lbl">${i < pr.keep ? 'yours' : 'new'}</span></button>`).join('')}</div>
        <div class="pn-row"><button class="btn gold" data-exok disabled>Keep these</button></div>`;
    } else {
      const ctx = v.ctx;
      let wait = 'Watching the barnyard…';
      if (v.stage === 'action') wait = `Waiting for ${esc((this.P(v.turn) || {}).name)}…`;
      else if (v.stage === 'respond' && ctx.window) wait = ctx.window.passed.includes(this.me) ? 'You let it slide. Waiting on the others…' : 'Waiting on the others…';
      else if (v.stage === 'lose') wait = `Waiting for ${esc((this.P(v.losing.pid) || {}).name)} to pick a card…`;
      else if (v.stage === 'exchange') wait = 'The Owl is pondering…';
      key = 'wait:' + wait;
      html = `<div class="pn-wait"><span class="dots"><i></i><i></i><i></i></span>${wait}</div>`;
    }
    if (key === this.panelKey) return;
    this.panelKey = key;
    clearInterval(this.timerInt);
    panel.innerHTML = html;
    panel.classList.toggle('empty', !html);
    if (html) panel.animate([{ transform: 'translateY(14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'ease-out' });
    if (pr && pr.kind === 'respond' && v.timer) this._startTimer(v);
  }

  _actBtn(a, me, mine, pr, v) {
    const A = ACTIONS[a];
    const R = A.claim && ROLES[A.claim];
    const targets = v.players.filter((p) => p.alive && p.id !== this.me);
    const disabled = (A.cost && me.coins < A.cost) || (pr.mustBarnstorm && a !== 'barnstorm') || (A.target && !targets.length);
    const bluff = A.claim && !mine.includes(A.claim);
    return `<button class="act-btn ${R ? 'role-btn' : 'gen-btn'} ${bluff ? 'bluff' : ''}" data-act="${a}" ${disabled ? 'disabled' : ''} ${R ? `style="--bg:${R.bg};--rink:${R.ink}"` : ''} title="${esc(A.desc)}">
      <span class="ab-ic">${R ? characterSVG(A.claim) : iconSVG(a)}</span>
      <span class="ab-tx"><b>${A.name}</b><small>${R ? R.name + ' · ' : ''}${A.short}</small></span>
      ${bluff ? '<i class="bluff-tag">bluff</i>' : ''}
    </button>`;
  }

  _respondHTML(v, me, pr) {
    const ctx = v.ctx;
    const A = ACTIONS[ctx.action];
    const mine = me.cards.filter((c) => !c.dead).map((c) => c.role);
    const actorName = esc((this.P(ctx.actor) || {}).name);
    const onMe = ctx.target === this.me;
    let title;
    if (pr.windowKind === 'blockChallenge') title = `${esc((this.P(ctx.block.blocker) || {}).name)} claims ${roleTag(ctx.block.role)} to block ${ctx.actor === this.me ? 'your' : actorName + "'s"} ${A.name}`;
    else if (pr.windowKind === 'block') title = `${actorName} really is the ${roleTag(ctx.claim)}. Block the ${A.name}?`;
    else if (ctx.claim) title = `${actorName} claims ${roleTag(ctx.claim)} to ${A.name}${ctx.target ? (onMe ? ' <b class="warn">you</b>' : ' ' + esc((this.P(ctx.target) || {}).name)) : ''}`;
    else title = `${actorName} wants to Harvest 2 corn`;
    const btns = [];
    if (pr.canChallenge) btns.push(`<button class="btn red" data-respond="challenge"><span class="bi">${iconSVG('challenge')}</span>Challenge</button>`);
    for (const r of pr.blockRoles) {
      const R = ROLES[r];
      btns.push(`<button class="btn role" data-block="${r}" style="--bg:${R.bg};--rink:${R.ink}"><span class="bi">${characterSVG(r)}</span>Block as ${R.name}${mine.includes(r) ? '' : '<i class="bluff-tag">bluff</i>'}</button>`);
    }
    const passLbl = onMe && (ctx.action === 'raid') ? 'Accept fate' : pr.windowKind === 'blockChallenge' && ctx.actor === this.me ? 'Accept the block' : 'Let it slide';
    btns.push(`<button class="btn ghost" data-respond="pass">${passLbl}</button>`);
    const timer = v.timer ? `<div class="timer"><svg viewBox="0 0 40 40"><circle class="tr-bg" cx="20" cy="20" r="17"/><circle class="tr-fg" cx="20" cy="20" r="17"/></svg><span></span></div>` : '';
    return `<div class="pn-title">${title}</div><div class="pn-row resp">${btns.join('')}${timer}</div>`;
  }

  _startTimer(v) {
    const total = v.timer.total;
    const end = v._at + v.timer.remaining;
    const fg = $('.timer .tr-fg', this.root), lbl = $('.timer span', this.root);
    if (!fg) return;
    let lastSec = null;
    const C = 2 * Math.PI * 17;
    fg.style.strokeDasharray = C;
    const tick = () => {
      const left = Math.max(0, end - performance.now());
      fg.style.strokeDashoffset = C * (1 - left / total);
      const sec = Math.ceil(left / 1000);
      lbl.textContent = sec;
      if (sec !== lastSec) {
        if (sec <= 5 && sec > 0) audio.play('tick', { volume: 0.6 });
        lastSec = sec;
        $('.timer', this.root)?.classList.toggle('low', sec <= 5);
      }
      if (left <= 0) clearInterval(this.timerInt);
    };
    tick();
    this.timerInt = setInterval(tick, 100);
  }

  /* ================= input ================= */
  _bar(e) {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    audio.play('click');
    if (b.dataset.a === 'log') this.root.querySelector('.g-wrap').classList.toggle('show-log');
    if (b.dataset.a === 'rules') this.onRules();
    if (b.dataset.a === 'leave') this.onLeave();
    if (b.dataset.a === 'copy') this.onCopy();
  }

  _panelClick(e) {
    const v = this.view;
    if (!v) return;
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    audio.play('click');
    if (b.dataset.act) {
      const a = b.dataset.act, A = ACTIONS[a];
      if (A.target) {
        const targets = v.players.filter((p) => p.alive && p.id !== this.me);
        if (targets.length === 1) { this._send({ type: 'action', action: a, target: targets[0].id }); return; }
        this.mode = { kind: 'target', action: a };
        this._render(v);
        return;
      }
      this._send({ type: 'action', action: a });
    } else if (b.dataset.cancel != null) {
      this.mode = null; this._render(v);
    } else if (b.dataset.respond) {
      this._send({ type: b.dataset.respond, windowId: v.prompt.windowId });
    } else if (b.dataset.block) {
      this._send({ type: 'block', role: b.dataset.block, windowId: v.prompt.windowId });
    } else if (b.dataset.ex != null) {
      const i = +b.dataset.ex, keep = v.prompt.keep;
      const at = this.exSel.indexOf(i);
      if (at >= 0) this.exSel.splice(at, 1);
      else { this.exSel.push(i); if (this.exSel.length > keep) this.exSel.shift(); }
      $$('.ex-card', this.root).forEach((x) => x.classList.toggle('sel', this.exSel.includes(+x.dataset.ex)));
      $('[data-exok]', this.root).disabled = this.exSel.length !== keep;
      audio.play('flip');
    } else if (b.dataset.exok != null) {
      this._send({ type: 'exchange', keep: this.exSel.slice() });
    }
  }

  _seatClick(e) {
    const seat = e.target.closest('.seat.targetable');
    if (!seat || !this.mode) return;
    audio.play('click');
    const action = this.mode.action;
    this.mode = null;
    this._send({ type: 'action', action, target: seat.dataset.pid });
  }

  _handClick(e) {
    const c = e.target.closest('.hcard.choosable');
    if (!c) return;
    audio.play('click');
    this._send({ type: 'lose', index: +c.dataset.slot });
  }

  _send(inp) {
    // optimistic lock: hide the prompt until the host answers
    const panel = $('.panel', this.root);
    panel.innerHTML = `<div class="pn-wait"><span class="dots"><i></i><i></i><i></i></span>Sent…</div>`;
    this.panelKey = 'sent';
    clearInterval(this.timerInt);
    $$('.seat.targetable', this.root).forEach((s) => s.classList.remove('targetable'));
    $$('.hcard.choosable', this.root).forEach((s) => s.classList.remove('choosable'));
    this.s.input(inp);
    clearTimeout(this._unlock);
    this._unlock = setTimeout(() => { if (this.panelKey === 'sent' && this.view && !this.busy && !this.queue.length) { this.panelKey = ''; this._render(this.view); } }, 5000);
  }

  emote(m) {
    const seat = this.seat(m.pid);
    const sys = { joined: 'joined', left: 'left the room', back: 'is back!', botcover: 'dropped — a bot is covering' };
    const nm = (this.room && this.room.players.find((p) => p.id === m.pid) || {}).name || m.name || 'Someone';
    if (sys[m.id]) { if (m.id !== 'joined') toast(`${nm} ${sys[m.id]}`); return; }
    if (!EMOTES[m.id]) return;
    if (seat) fx.bubble(seat, EMOTES[m.id], { tone: m.id === 'liar' ? 'red' : '' });
    audio.play(m.id === 'honk' ? 'goose' : m.id === 'bawk' ? 'join' : 'click', { volume: 0.55 });
  }

  /* ================= log ================= */
  _log(ev, v) {
    const N = (id) => { const p = v.players.find((x) => x.id === id); return `<b>${esc(p ? p.name : '?')}</b>`; };
    let t = '';
    const A = ev.action && ACTIONS[ev.action];
    switch (ev.type) {
      case 'start': t = `New game! ${N(ev.first)} goes first.`; break;
      case 'turn': t = ''; break;
      case 'action':
        t = A.claim ? `${N(ev.actor)} claims ${roleTag(A.claim)} → ${A.name}${ev.target ? ' on ' + N(ev.target) : ''}`
          : `${N(ev.actor)} ${A.did}${ev.target ? ' ' + N(ev.target) : ''}.`;
        break;
      case 'challenge': t = `${N(ev.challenger)} challenges ${N(ev.claimant)}!`; break;
      case 'proven': t = `${N(ev.pid)} reveals a real ${roleTag(ev.role)} and draws a new card.`; break;
      case 'bluffed': t = `${N(ev.pid)} was bluffing — no ${roleTag(ev.role)}!`; break;
      case 'block': t = `${N(ev.pid)} blocks with ${roleTag(ev.role)}.`; break;
      case 'blocked': t = `The block holds. ${N(ev.actor)}'s ${A.name} fails.`; break;
      case 'lose': t = `${N(ev.pid)} loses ${roleTag(ev.role)}.`; break;
      case 'eliminated': t = `${N(ev.pid)} is out of the coop!`; break;
      case 'gain': t = `${N(ev.pid)} +${ev.amount} corn.`; break;
      case 'steal': t = `${N(ev.to)} snatches ${ev.amount} corn from ${N(ev.from)}.`; break;
      case 'refund': t = `${N(ev.pid)} gets ${ev.amount} corn back.`; break;
      case 'foresight': t = `${N(ev.pid)} draws ${ev.count} cards.`; break;
      case 'exchanged': t = `${N(ev.pid)} returns ${ev.count} cards to the deck.`; break;
      case 'fizzle': t = `${N(ev.actor)}'s ${A.name} fizzles.`; break;
      case 'win': t = `${N(ev.pid)} wins the game!`; break;
      default: t = '';
    }
    if (!t) return;
    const ol = $('.log-list', this.root);
    if (!ol) return;
    const li = document.createElement('li');
    li.className = 'lg-' + ev.type;
    li.innerHTML = t;
    ol.appendChild(li);
    if (++this.logN > 160) ol.firstElementChild.remove();
    ol.scrollTop = ol.scrollHeight;
  }

  /* ================= animations ================= */
  _bump(id, delta) {
    const s = this.seat(id);
    const b = s && $('.corn-amt b', s);
    if (!b) return;
    b.textContent = Math.max(0, (parseInt(b.textContent, 10) || 0) + delta);
    b.parentElement.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 260 });
  }

  _henFx(id, cls, ms = 650) {
    const h = this.seat(id) && $('.hen-wrap', this.seat(id));
    if (!h) return;
    h.classList.remove(cls); void h.offsetWidth; h.classList.add(cls);
    setTimeout(() => h.classList.remove(cls), ms);
  }

  async _announce({ role, icon, title, sub = '', from, tone = 'claim', hold = 1150 }) {
    const W = innerWidth, H = innerHeight;
    const ov = el(`<div class="announce tone-${tone}">
      <div class="ann-glow"></div>
      <div class="ann-stage">${role ? cardFront(role, { act: true, cls: 'ann-card' }) : `<div class="ann-icon">${iconSVG(icon)}</div>`}</div>
      <div class="ann-text"><div class="ann-title">${esc(title)}</div><div class="ann-sub">${esc(sub)}</div></div>
    </div>`);
    document.body.appendChild(ov);
    const stage = $('.ann-stage', ov), text = $('.ann-text', ov);
    const f = fx.center(from);
    const dx = f.x - W / 2, dy = f.y - H / 2;
    ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 / fx.speed, fill: 'both' });
    stage.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(.15) rotate(-25deg)` },
      { transform: 'translate(0,0) scale(1.08) rotate(4deg)', offset: 0.65 },
      { transform: 'translate(0,0) scale(1) rotate(0deg)' },
    ], { duration: 560 / fx.speed, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'both' });
    text.animate([{ transform: 'translateY(20px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380 / fx.speed, delay: 220 / fx.speed, fill: 'both', easing: 'ease-out' });
    setTimeout(() => fx.burst({ x: W / 2, y: H / 2 - 40 }, { type: 'spark', count: 22, power: 1.4, colors: role ? [ROLES[role].bg, '#fff', ROLES[role].ink] : ['#FFD166', '#fff'] }), 380 / fx.speed);
    await fx.wait(hold);
    const out = ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260 / fx.speed, fill: 'both' });
    stage.animate([{ transform: 'none' }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5}px) scale(.4)` }], { duration: 260 / fx.speed, fill: 'both', easing: 'ease-in' });
    await out.finished.catch(() => {});
    ov.remove();
  }

  async _animate(ev, v) {
    const root = this.root;
    const P = (id) => v.players.find((p) => p.id === id) || this.P(id) || { name: '?' };
    const nm = (id) => (id === this.me ? 'You' : P(id).name);
    const seat = (id) => this.seat(id);
    const bank = $('.bank-pile .sack', root), deck = $('.deck-pile .stack', root);
    const A = ev.action && ACTIONS[ev.action];
    switch (ev.type) {
      case 'start': {
        audio.play('start');
        await fx.wait(300);
        audio.play('deal');
        const ids = v.players.map((p) => p.id);
        const jobs = [];
        ids.concat(ids).forEach((id, k) => {
          jobs.push(fx.wait(k * 70).then(() => fx.fly({ from: deck, to: this.seatOrHand(id), html: cardBackSVG(), size: id === this.me ? 56 : 34, duration: 480, spin: 360 })));
        });
        await Promise.all(jobs);
        break;
      }
      case 'turn': {
        // keep the turn ring in sync before the next view lands
        $$('.seat.turn', root).forEach((s) => s.classList.remove('turn'));
        seat(ev.pid)?.classList.add('turn');
        if (ev.pid === this.me) { audio.play('turn'); fx.bubble(seat(ev.pid), 'Your turn!', { tone: 'gold', ms: 1400 }); }
        await fx.wait(200);
        break;
      }
      case 'action': {
        const tName = ev.target ? nm(ev.target) : '';
        if (ev.paid) {
          audio.play('spend');
          this._bump(ev.actor, -ev.paid);
          fx.fly({ from: seat(ev.actor), to: bank, n: Math.min(ev.paid, 7), html: iconSVG('corn'), size: 22, stagger: 45, duration: 520 });
        }
        if (A.claim) {
          audio.play(A.claim);
          audio.play(ev.action, { delay: 0.45 });
          const sub = `${A.name}${tName ? ' → ' + tName : ''} · ${A.short}`;
          await this._announce({ role: A.claim, title: `${nm(ev.actor)} ${ev.actor === this.me ? 'claim' : 'claims'} the ${ROLES[A.claim].name}`, sub, from: seat(ev.actor) });
        } else if (ev.action === 'peck') {
          audio.play('peck');
          this._henFx(ev.actor, 'hit', 300);
          fx.bubble(seat(ev.actor), 'Collect +1', { ms: 1000 });
          await fx.wait(300);
        } else if (ev.action === 'forage') {
          audio.play('forage');
          await this._announce({ icon: 'forage', title: `${nm(ev.actor)} ${ev.actor === this.me ? 'Harvest' : 'Harvests'}!`, sub: '+2 corn — a Rooster can block it', from: seat(ev.actor), tone: 'plain', hold: 900 });
        } else if (ev.action === 'barnstorm') {
          audio.play('barnstorm');
          fx.shake(1.3, 700);
          await this._announce({ icon: 'barnstorm', title: `${nm(ev.actor)} ${ev.actor === this.me ? 'go' : 'goes'} for a Knockout!`, sub: `${tName} loses a card — no blocking`, from: seat(ev.actor), tone: 'storm', hold: 900 });
        }
        break;
      }
      case 'pass': {
        const s = seat(ev.pid);
        if (s) { s.classList.add('passed'); fx.bubble(s, ev.auto ? '…' : pick(['Pass', 'Fine', 'Sure', 'Okay', 'Go on']), { ms: 1000, tone: 'muted' }); }
        await fx.wait(80);
        break;
      }
      case 'challenge': {
        audio.play('challenge');
        fx.bubble(seat(ev.challenger), pick(['Liar!', 'Prove it!', 'I doubt it!', 'Nope!', 'Bawk-squat!']), { tone: 'red', ms: 1500 });
        this._henFx(ev.challenger, 'cheer', 700);
        fx.shake(1);
        fx.flash('rgba(215,38,61,.25)');
        await fx.stamp('CHALLENGE!', { at: seat(ev.claimant), tone: 'red' });
        break;
      }
      case 'proven': {
        audio.play('reveal');
        audio.play('truth', { delay: 0.5 });
        await this._announce({ role: ev.role, title: `${nm(ev.pid)} really ${ev.pid === this.me ? 'are' : 'is'} the ${ROLES[ev.role].name}!`, sub: `${nm(ev.challenger)} guessed wrong`, from: seat(ev.pid), tone: 'truth', hold: 1050 });
        break;
      }
      case 'swap': {
        audio.play('swap');
        const s = this.seatOrHand(ev.pid);
        await fx.fly({ from: s, to: deck, html: cardBackSVG(), size: 40, duration: 380 });
        await fx.fly({ from: deck, to: s, html: cardBackSVG(), size: 40, duration: 380 });
        break;
      }
      case 'bluffed': {
        audio.play('bluff');
        fx.burst(seat(ev.pid), { type: 'feather', count: 14 });
        this._henFx(ev.pid, 'hit');
        fx.bubble(seat(ev.pid), pick(['Oops…', 'Worth a shot', 'Bawk…', 'Er…']), { ms: 1500 });
        await fx.stamp('BLUFF!', { at: seat(ev.pid), tone: 'red', rotate: 7 });
        break;
      }
      case 'block': {
        audio.play(ev.role);
        await this._announce({ role: ev.role, title: `${nm(ev.pid)} ${ev.pid === this.me ? 'block' : 'blocks'} with the ${ROLES[ev.role].name}`, sub: `Stopping ${nm(ev.actor)}'s ${A.name}`, from: seat(ev.pid), tone: 'block' });
        break;
      }
      case 'blocked': {
        audio.play('block');
        fx.burst(seat(ev.actor), { type: 'spark', count: 16, colors: ['#cfe8ff', '#ffffff', '#8ecae6'] });
        await fx.stamp('BLOCKED', { at: seat(ev.actor), tone: 'blue', rotate: -5 });
        break;
      }
      case 'hit': {
        const s = this.seatOrHand(ev.pid);
        if (ev.action === 'raid') {
          audio.play('raid');
          fx.overlay(s, SLASH, 'fx-slash', 700);
          await fx.wait(260);
          audio.play('hit');
        } else {
          audio.play('hit');
          fx.burst(s, { type: 'dust', count: 26, power: 1.5 });
          await fx.overlay(s, iconSVG('barnstorm'), 'fx-tornado', 800);
        }
        this._henFx(ev.pid, 'hit');
        fx.shake(0.8);
        await fx.wait(300);
        break;
      }
      case 'lose': {
        audio.play('lose');
        this._henFx(ev.pid, 'hit');
        if (ev.pid === this.me) {
          const hc = $(`.hcard[data-slot="${ev.slot}"]`, root);
          if (hc) { hc.classList.add('dying'); fx.burst(hc, { type: 'feather', count: 16 }); }
        } else {
          const mc = seat(ev.pid) && $(`.mc[data-slot="${ev.slot}"]`, seat(ev.pid));
          if (mc) {
            $('.ff', mc).innerHTML = cardFront(ev.role, { mini: true });
            mc.classList.add('flipped');
            setTimeout(() => mc.classList.add('dead'), 450 / fx.speed);
            fx.burst(mc, { type: 'feather', count: 10 });
          }
        }
        await fx.wait(900);
        break;
      }
      case 'eliminated': {
        audio.play('eliminated');
        const s = seat(ev.pid);
        if (s) { s.classList.add('dead'); $('.hen-wrap', s).classList.add('dead'); }
        fx.burst(s, { type: 'feather', count: 34, power: 1.6 });
        fx.bubble(s, ev.pid === this.me ? "You're out!" : 'Out of the coop!', { ms: 1600 });
        await fx.wait(1000);
        break;
      }
      case 'gain': {
        audio.play(ev.amount > 1 ? 'cornMany' : 'corn');
        await fx.fly({ from: bank, to: seat(ev.pid), n: ev.amount, html: iconSVG('corn'), size: 24, onArrive: () => this._bump(ev.pid, 1) });
        break;
      }
      case 'refund': {
        audio.play('cornMany');
        await fx.fly({ from: bank, to: seat(ev.pid), n: ev.amount, html: iconSVG('corn'), size: 22, stagger: 60, onArrive: () => this._bump(ev.pid, 1) });
        break;
      }
      case 'steal': {
        if (!ev.amount) { fx.bubble(seat(ev.from), 'Empty pockets!'); await fx.wait(500); break; }
        audio.play('cornMany');
        await fx.fly({ from: seat(ev.from), to: seat(ev.to), n: ev.amount, html: iconSVG('corn'), size: 24, arc: 0.5,
          onArrive: () => { this._bump(ev.from, -1); this._bump(ev.to, 1); } });
        break;
      }
      case 'foresight': {
        await fx.fly({ from: deck, to: this.seatOrHand(ev.pid), n: ev.count, html: cardBackSVG(), size: 44, stagger: 140, duration: 520 });
        break;
      }
      case 'exchanged': {
        audio.play('swap');
        await fx.fly({ from: this.seatOrHand(ev.pid), to: deck, n: ev.count, html: cardBackSVG(), size: 44, stagger: 140, duration: 520 });
        break;
      }
      case 'fizzle': fx.bubble(seat(ev.actor), 'Fizzled…'); await fx.wait(400); break;
      case 'win': {
        const me = ev.pid === this.me;
        audio.play(me ? 'win' : 'defeat');
        this._henFx(ev.pid, 'cheer', 4000);
        fx.rain('confetti', 2600);
        fx.rain('feather', 1600);
        fx.burst(seat(ev.pid), { type: 'corn', count: 30, power: 1.6 });
        await fx.wait(1400);
        break;
      }
      default: break;
    }
  }

  /* ================= game over ================= */
  _renderOver(v) {
    const ex = $('.over-back');
    if (v.stage !== 'over') { if (ex) ex.remove(); return; }
    if (ex && ex.dataset.game === String(v.gameNo)) return;
    if (ex) ex.remove();
    const w = v.players.find((p) => p.id === v.winner) || v.players[0];
    const isHost = this.room && this.room.hostId === this.me;
    const o = el(`<div class="over-back" data-game="${v.gameNo}"><div class="over">
      <div class="over-hen">${hen(w.look, 'cheer')}<div class="over-crown">${iconSVG('crown')}</div></div>
      <h2>${w.id === this.me ? 'You rule the roost!' : esc(w.name) + ' rules the roost!'}</h2>
      <p>${w.id === this.me ? 'You out-bluffed the whole barnyard.' : 'Better luck next harvest.'}</p>
      <div class="over-hands">${v.players.map((p) => `<div class="oh ${p.id === w.id ? 'win' : ''}"><span>${esc(p.name)}</span><div class="oh-cards">${p.cards.map((c) => cardFront(c.role, { mini: true, cls: c.dead ? 'dead' : '' })).join('')}</div></div>`).join('')}</div>
      <div class="over-btns">${isHost ? '<button class="btn big gold" data-over="rematch">Rematch</button><button class="btn" data-over="lobby">Back to lobby</button>' : '<div class="pn-wait">Waiting for the host to start a rematch…</div>'}<button class="btn ghost" data-over="leave">Leave</button></div>
    </div></div>`);
    o.addEventListener('click', (e) => {
      const b = e.target.closest('[data-over]');
      if (!b) return;
      audio.play('click');
      if (b.dataset.over === 'rematch') this.s.send({ t: 'rematch' });
      if (b.dataset.over === 'lobby') this.s.send({ t: 'toLobby' });
      if (b.dataset.over === 'leave') this.onLeave(true);
    });
    document.body.appendChild(o);
    o.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
    $('.over', o).animate([{ transform: 'scale(.7) translateY(40px)' }, { transform: 'scale(1.03)', offset: 0.7 }, { transform: 'none' }], { duration: 600, easing: 'ease-out' });
  }
}

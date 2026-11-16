// Pecking Order rules engine.
// Pure, serialisable state machine (plain JSON state, seeded RNG, no clocks, no DOM) so the
// host can persist it and tests can fuzz it in Node.

import { ROLE_IDS, ACTIONS } from './roles.js';

export const START_COINS = 2;
export const COPIES = 3;
export const MUST_BARNSTORM_AT = 10;
const MAX_EVENTS = 80;

/* ---------------- helpers ---------------- */
function rand(s) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(s) {
  const a = s.deck;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
const P = (s, id) => s.players.find((p) => p.id === id);
export const isAlive = (p) => !!p && p.cards.some((c) => !c.dead);
const liveIdx = (p) => p.cards.map((c, i) => (c.dead ? -1 : i)).filter((i) => i >= 0);
const alivePlayers = (s) => s.players.filter(isAlive);
const cur = (s) => s.players[s.turn];
const ok = () => ({ ok: true });
const err = (error) => ({ ok: false, error });

function emit(s, type, data = {}) {
  s.events.push({ seq: ++s.seq, type, ...data });
  if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
}

/* ---------------- setup ---------------- */
export function createGame(players, opts = {}) {
  const s = {
    v: 1,
    seq: opts.seqStart || 0,
    rng: (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0,
    players: players.map((p) => ({
      id: p.id, name: p.name, look: p.look, isBot: !!p.isBot, coins: START_COINS, cards: [],
    })),
    deck: [],
    turn: 0,
    round: 1,
    turnId: 0,
    windowId: 0,
    loseId: 0,
    stage: 'action',
    ctx: null,
    loseQueue: [],
    after: null,
    winner: null,
    events: [],
  };
  for (const r of ROLE_IDS) for (let i = 0; i < COPIES; i++) s.deck.push(r);
  shuffle(s);
  for (let k = 0; k < 2; k++) for (const p of s.players) p.cards.push({ role: s.deck.pop(), dead: false });
  s.turn = opts.firstPlayer ?? Math.floor(rand(s) * s.players.length);
  if (s.players.length === 2) s.players[s.turn].coins = 1; // two-player balance rule
  emit(s, 'start', { first: cur(s).id, players: s.players.map((p) => p.id) });
  s.turnId++;
  emit(s, 'turn', { pid: cur(s).id });
  return s;
}

/* ---------------- input ---------------- */
export function applyInput(s, pid, inp) {
  if (!inp || typeof inp !== 'object') return err('Bad input');
  if (s.stage === 'over') return err('The game is over');
  const p = P(s, pid);
  if (!p) return err('Unknown player');
  if (!isAlive(p)) return err('You are out of the game');
  switch (inp.type) {
    case 'action': return doAction(s, p, inp);
    case 'pass':
    case 'challenge':
    case 'block': return doRespond(s, p, inp);
    case 'lose': return doLose(s, p, inp);
    case 'exchange': return doExchange(s, p, inp);
    default: return err('Bad input');
  }
}

function doAction(s, p, inp) {
  if (s.stage !== 'action') return err('Not time for an action');
  if (cur(s).id !== p.id) return err('It is not your turn');
  const A = ACTIONS[inp.action];
  if (!A) return err('Unknown action');
  if (p.coins >= MUST_BARNSTORM_AT && inp.action !== 'barnstorm') return err(`With ${MUST_BARNSTORM_AT}+ corn you must use Knockout`);
  if (A.cost && p.coins < A.cost) return err('Not enough corn');
  let target = null;
  if (A.target) {
    target = P(s, inp.target);
    if (!target || target.id === p.id || !isAlive(target)) return err('Pick a rival who is still in the game');
  }
  s.ctx = {
    action: inp.action, actor: p.id, target: target ? target.id : null, claim: A.claim,
    paid: 0, block: null, window: null, targetPassed: false, exchange: null,
  };
  if (A.cost) { p.coins -= A.cost; s.ctx.paid = A.cost; }
  emit(s, 'action', { actor: p.id, action: inp.action, target: s.ctx.target, claim: A.claim, paid: s.ctx.paid });

  if (inp.action === 'peck' || inp.action === 'barnstorm') { resolveAction(s); return ok(); }
  const others = alivePlayers(s).filter((x) => x.id !== p.id).map((x) => x.id);
  const blockers = A.blockedBy.length ? (inp.action === 'forage' ? others : [s.ctx.target]) : [];
  const responders = A.claim ? others : blockers;
  if (!openWindow(s, 'action', responders, !!A.claim, blockers, A.blockedBy)) resolveAction(s);
  return ok();
}

function openWindow(s, kind, responders, canChallenge, blockers, blockRoles) {
  const live = responders.filter((id) => isAlive(P(s, id)));
  if (!live.length) return false;
  s.windowId++;
  s.ctx.window = {
    id: s.windowId, kind, responders: live, passed: [], canChallenge,
    blockers: blockers.filter((id) => isAlive(P(s, id))), blockRoles: blockRoles.slice(),
  };
  s.stage = 'respond';
  return true;
}

function doRespond(s, p, inp) {
  if (s.stage !== 'respond') return err('Nothing to respond to');
  const ctx = s.ctx, w = ctx.window;
  if (inp.windowId != null && inp.windowId !== w.id) return err('Too late');
  if (!w.responders.includes(p.id)) return err('This one is not your call');
  if (w.passed.includes(p.id)) return err('You already let it go');

  if (inp.type === 'pass') {
    w.passed.push(p.id);
    if (p.id === ctx.target) ctx.targetPassed = true;
    emit(s, 'pass', { pid: p.id, kind: w.kind });
    if (w.responders.every((id) => w.passed.includes(id))) closeWindow(s);
    return ok();
  }
  if (inp.type === 'challenge') {
    if (!w.canChallenge) return err('Nothing to challenge');
    if (w.kind === 'blockChallenge') challengeClaim(s, p.id, ctx.block.blocker, ctx.block.role, 'blockProven', 'blockBluff');
    else challengeClaim(s, p.id, ctx.actor, ctx.claim, 'actionProven', 'actionBluff');
    return ok();
  }
  // block
  if (!w.blockers.includes(p.id) || !w.blockRoles.includes(inp.role)) return err('You cannot block that');
  ctx.block = { blocker: p.id, role: inp.role };
  emit(s, 'block', { pid: p.id, role: inp.role, actor: ctx.actor, action: ctx.action });
  const others = alivePlayers(s).filter((x) => x.id !== p.id).map((x) => x.id);
  if (!openWindow(s, 'blockChallenge', others, true, [], [])) blockHolds(s);
  return ok();
}

function closeWindow(s) {
  const w = s.ctx.window;
  s.ctx.window = null;
  if (w.kind === 'blockChallenge') blockHolds(s);
  else resolveAction(s);
}

/** Host calls this when the response timer for window `windowId` runs out. */
export function applyTimeout(s, windowId) {
  if (s.stage !== 'respond' || !s.ctx || !s.ctx.window || s.ctx.window.id !== windowId) return false;
  const w = s.ctx.window;
  for (const id of w.responders) {
    if (!w.passed.includes(id)) {
      w.passed.push(id);
      if (id === s.ctx.target) s.ctx.targetPassed = true;
      emit(s, 'pass', { pid: id, kind: w.kind, auto: true });
    }
  }
  closeWindow(s);
  return true;
}

function challengeClaim(s, challengerId, claimantId, role, onProven, onBluff) {
  s.ctx.window = null;
  s.stage = 'resolving';
  emit(s, 'challenge', { challenger: challengerId, claimant: claimantId, role });
  const c = P(s, claimantId);
  const idx = c.cards.findIndex((x) => !x.dead && x.role === role);
  if (idx >= 0) {
    emit(s, 'proven', { pid: claimantId, role, challenger: challengerId });
    s.deck.push(role);
    shuffle(s);
    c.cards[idx] = { role: s.deck.pop(), dead: false };
    emit(s, 'swap', { pid: claimantId, slot: idx });
    queueLose(s, challengerId, 'challenge', onProven);
  } else {
    emit(s, 'bluffed', { pid: claimantId, role, challenger: challengerId });
    queueLose(s, claimantId, 'bluff', onBluff);
  }
}

function queueLose(s, pid, reason, after) {
  s.loseQueue.push({ pid, reason });
  s.after = after;
  advance(s);
}

function advance(s) {
  while (s.loseQueue.length) {
    const q = s.loseQueue[0];
    const p = P(s, q.pid);
    const live = liveIdx(p);
    if (!live.length) { s.loseQueue.shift(); continue; }
    if (live.length === 1) {
      s.loseQueue.shift();
      killCard(s, p, live[0], q.reason);
      if (s.stage === 'over') return;
      continue;
    }
    s.stage = 'lose';
    s.loseId++;
    return; // wait for the player to choose
  }
  const after = s.after;
  s.after = null;
  runAfter(s, after);
}

function killCard(s, p, i, reason) {
  p.cards[i].dead = true;
  emit(s, 'lose', { pid: p.id, role: p.cards[i].role, slot: i, reason });
  if (!isAlive(p)) {
    emit(s, 'eliminated', { pid: p.id });
    if (alivePlayers(s).length <= 1) gameOver(s);
  }
}

function doLose(s, p, inp) {
  if (s.stage !== 'lose') return err('You do not need to lose a card');
  const q = s.loseQueue[0];
  if (!q || q.pid !== p.id) return err('Not your card to lose');
  const i = inp.index;
  if (!Number.isInteger(i) || !p.cards[i] || p.cards[i].dead) return err('Pick one of your live cards');
  s.loseQueue.shift();
  s.stage = 'resolving';
  killCard(s, p, i, q.reason);
  if (s.stage === 'over') return ok();
  advance(s);
  return ok();
}

function runAfter(s, tag) {
  if (s.stage === 'over') return;
  const ctx = s.ctx;
  switch (tag) {
    case 'actionProven': {
      // Actor really had the role; the challenger has paid for it. Target may still block.
      const A = ACTIONS[ctx.action];
      const t = ctx.target && P(s, ctx.target);
      if (A.blockedBy.length && t && isAlive(t) && !ctx.targetPassed) {
        if (openWindow(s, 'block', [t.id], false, [t.id], A.blockedBy)) return;
      }
      resolveAction(s);
      return;
    }
    case 'actionBluff': {
      const a = P(s, ctx.actor);
      if (ctx.paid && isAlive(a)) {
        a.coins += ctx.paid;
        emit(s, 'refund', { pid: a.id, amount: ctx.paid });
      }
      emit(s, 'fail', { actor: ctx.actor, action: ctx.action });
      endTurn(s);
      return;
    }
    case 'blockProven': blockHolds(s); return;
    case 'blockBluff': resolveAction(s); return;
    default: endTurn(s);
  }
}

function blockHolds(s) {
  const { block, actor, action } = s.ctx;
  emit(s, 'blocked', { pid: block.blocker, role: block.role, actor, action });
  endTurn(s);
}

function resolveAction(s) {
  const ctx = s.ctx;
  ctx.window = null;
  s.stage = 'resolving';
  const a = P(s, ctx.actor);
  const t = ctx.target ? P(s, ctx.target) : null;
  if (!isAlive(a)) { endTurn(s); return; }
  const gain = (n) => { a.coins += n; emit(s, 'gain', { pid: a.id, amount: n, action: ctx.action }); };
  switch (ctx.action) {
    case 'peck': gain(1); break;
    case 'forage': gain(2); break;
    case 'tribute': gain(3); break;
    case 'pilfer': {
      if (!isAlive(t)) { emit(s, 'fizzle', { actor: a.id, action: ctx.action }); break; }
      const n = Math.min(2, t.coins);
      t.coins -= n; a.coins += n;
      emit(s, 'steal', { from: t.id, to: a.id, amount: n });
      break;
    }
    case 'raid':
    case 'barnstorm': {
      if (!isAlive(t)) { emit(s, 'fizzle', { actor: a.id, action: ctx.action }); break; }
      emit(s, 'hit', { pid: t.id, by: a.id, action: ctx.action });
      queueLose(s, t.id, ctx.action, 'endTurn');
      return;
    }
    case 'foresight': {
      const drawn = [s.deck.pop(), s.deck.pop()].filter(Boolean);
      ctx.exchange = { drawn };
      s.stage = 'exchange';
      emit(s, 'foresight', { pid: a.id, count: drawn.length });
      return;
    }
  }
  endTurn(s);
}

function doExchange(s, p, inp) {
  if (s.stage !== 'exchange' || s.ctx.actor !== p.id) return err('No exchange in progress');
  const live = liveIdx(p);
  const pool = [...live.map((i) => p.cards[i].role), ...s.ctx.exchange.drawn];
  const keep = inp.keep;
  if (!Array.isArray(keep) || keep.length !== live.length || new Set(keep).size !== keep.length ||
      keep.some((k) => !Number.isInteger(k) || k < 0 || k >= pool.length)) {
    return err(`Keep exactly ${live.length} card${live.length > 1 ? 's' : ''}`);
  }
  live.forEach((ci, k) => { p.cards[ci].role = pool[keep[k]]; });
  pool.forEach((r, i) => { if (!keep.includes(i)) s.deck.push(r); });
  shuffle(s);
  s.ctx.exchange = null;
  emit(s, 'exchanged', { pid: p.id, count: pool.length - keep.length });
  endTurn(s);
  return ok();
}

function gameOver(s) {
  const alive = alivePlayers(s);
  s.stage = 'over';
  s.winner = alive.length ? alive[0].id : null;
  s.loseQueue = [];
  s.after = null;
  if (s.ctx) s.ctx.window = null;
  emit(s, 'win', { pid: s.winner });
}

function endTurn(s) {
  if (s.stage === 'over') return;
  if (alivePlayers(s).length <= 1) { gameOver(s); return; }
  s.ctx = null;
  s.stage = 'action';
  const n = s.players.length;
  let i = s.turn;
  do { i = (i + 1) % n; } while (!isAlive(s.players[i]));
  if (i <= s.turn) s.round++;
  s.turn = i;
  s.turnId++;
  emit(s, 'turn', { pid: cur(s).id });
}

/* ---------------- queries ---------------- */

/** Who the game is currently waiting on. */
export function pending(s) {
  switch (s.stage) {
    case 'action': return [{ pid: cur(s).id, kind: 'action' }];
    case 'respond': {
      const w = s.ctx.window;
      return w.responders.filter((id) => !w.passed.includes(id)).map((pid) => ({ pid, kind: 'respond' }));
    }
    case 'lose': return [{ pid: s.loseQueue[0].pid, kind: 'lose' }];
    case 'exchange': return [{ pid: s.ctx.actor, kind: 'exchange' }];
    default: return [];
  }
}

function promptFor(s, pid) {
  const me = P(s, pid);
  if (!me || !isAlive(me)) return null;
  switch (s.stage) {
    case 'action':
      if (cur(s).id !== pid) return null;
      return { kind: 'action', mustBarnstorm: me.coins >= MUST_BARNSTORM_AT, turnId: s.turnId };
    case 'respond': {
      const w = s.ctx.window;
      if (!w.responders.includes(pid) || w.passed.includes(pid)) return null;
      return {
        kind: 'respond', windowId: w.id, windowKind: w.kind, canChallenge: w.canChallenge,
        blockRoles: w.blockers.includes(pid) ? w.blockRoles.slice() : [],
      };
    }
    case 'lose': {
      const q = s.loseQueue[0];
      return q.pid === pid ? { kind: 'lose', reason: q.reason, loseId: s.loseId } : null;
    }
    case 'exchange': {
      if (s.ctx.actor !== pid) return null;
      const live = liveIdx(me);
      return { kind: 'exchange', pool: [...live.map((i) => me.cards[i].role), ...s.ctx.exchange.drawn], keep: live.length };
    }
    default: return null;
  }
}

/** Personalised, hidden-information-safe view for one player (or a spectator when pid is null). */
export function viewFor(s, pid) {
  const over = s.stage === 'over';
  const ctx = s.ctx;
  return {
    stage: s.stage,
    round: s.round,
    turn: cur(s).id,
    turnId: s.turnId,
    deckCount: s.deck.length,
    winner: s.winner,
    players: s.players.map((p) => ({
      id: p.id, name: p.name, look: p.look, isBot: p.isBot, coins: p.coins, alive: isAlive(p),
      cards: p.cards.map((c) => (c.dead ? { role: c.role, dead: true } : (p.id === pid || over) ? { role: c.role } : {})),
    })),
    ctx: ctx && {
      action: ctx.action, actor: ctx.actor, target: ctx.target, claim: ctx.claim, paid: ctx.paid,
      block: ctx.block && { ...ctx.block },
      window: ctx.window && {
        id: ctx.window.id, kind: ctx.window.kind, responders: ctx.window.responders.slice(),
        passed: ctx.window.passed.slice(), canChallenge: ctx.window.canChallenge,
      },
    },
    losing: s.stage === 'lose' ? { ...s.loseQueue[0] } : null,
    prompt: promptFor(s, pid),
    events: s.events.slice(),
  };
}

/** Replace a human with a bot (or hand control back) without disturbing the game. */
export function setBot(s, pid, isBot) {
  const p = P(s, pid);
  if (p) p.isBot = !!isBot;
}

// Fuzz the rules engine with bots + random garbage inputs. Run: node test/engine.fuzz.mjs [games]
import { createGame, applyInput, applyTimeout, pending, viewFor, isAlive } from '../js/engine.js';
import { botDecide } from '../js/bot.js';
import { ROLE_IDS, ACTION_IDS } from '../js/roles.js';

const N = +process.argv[2] || 3000;
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const stats = { games: 0, turns: 0, events: {}, winners: 0, timeouts: 0, rejected: 0, maxTurns: 0 };

function check(s, tag) {
  const counts = Object.fromEntries(ROLE_IDS.map((r) => [r, 0]));
  for (const r of s.deck) counts[r]++;
  for (const r of (s.ctx?.exchange?.drawn || [])) counts[r]++;
  for (const p of s.players) for (const c of p.cards) counts[c.role]++;
  for (const r of ROLE_IDS) if (counts[r] !== 3) throw new Error(`${tag}: role ${r} count ${counts[r]}`);
  for (const p of s.players) {
    if (p.coins < 0 || !Number.isInteger(p.coins)) throw new Error(`${tag}: bad coins ${p.coins}`);
    if (p.cards.length !== 2) throw new Error(`${tag}: hand size`);
  }
  // hidden info: views must not leak other players' live roles
  for (const viewer of s.players) {
    const v = viewFor(s, viewer.id);
    for (const vp of v.players) if (vp.id !== viewer.id && s.stage !== 'over')
      for (const c of vp.cards) if (!c.dead && c.role) throw new Error(`${tag}: leak`);
    JSON.stringify(v);
  }
  if (s.stage !== 'over') {
    const pend = pending(s);
    if (!pend.length) throw new Error(`${tag}: stuck in ${s.stage}`);
  }
}

for (let g = 0; g < N; g++) {
  const n = 2 + (g % 5);
  const players = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, look: {}, isBot: true }));
  const s = createGame(players, { seed: g * 7919 + 1 });
  check(s, `g${g} start`);
  let steps = 0;
  while (s.stage !== 'over') {
    if (++steps > 5000) throw new Error(`g${g}: too many steps`);
    // random garbage from random players
    if (rnd() < 0.3) {
      const p = pick(s.players);
      const junk = pick([{ type: 'action', action: pick(ACTION_IDS), target: pick(s.players).id }, { type: 'pass' }, { type: 'challenge' },
        { type: 'block', role: pick(ROLE_IDS) }, { type: 'lose', index: Math.floor(rnd() * 3) }, { type: 'exchange', keep: [0, 1] }, null, { type: 'zzz' }]);
      const before = JSON.stringify(s);
      const r = applyInput(s, p.id, junk);
      if (!r.ok) { stats.rejected++; if (JSON.stringify(s) !== before) throw new Error(`g${g}: rejected input mutated state ${JSON.stringify(junk)} ${r.error}`); }
      check(s, `g${g} junk`);
      continue;
    }
    const pend = pending(s);
    if (s.stage === 'respond' && rnd() < 0.08) { applyTimeout(s, s.ctx.window.id); stats.timeouts++; check(s, `g${g} timeout`); continue; }
    const { pid } = pick(pend);
    const v = viewFor(s, pid);
    const inp = botDecide(v, pid, rnd);
    if (!inp) throw new Error(`g${g}: bot had no move for ${JSON.stringify(v.prompt)}`);
    const r = applyInput(s, pid, inp);
    if (!r.ok) throw new Error(`g${g}: bot move rejected: ${r.error} ${JSON.stringify(inp)} stage=${s.stage}`);
    check(s, `g${g} step${steps}`);
  }
  const alive = s.players.filter(isAlive);
  if (alive.length !== 1 || alive[0].id !== s.winner) throw new Error(`g${g}: bad winner`);
  stats.games++; stats.winners++;
  stats.turns += s.turnId; stats.maxTurns = Math.max(stats.maxTurns, s.turnId);
}
console.log('OK', stats, 'avg turns', (stats.turns / stats.games).toFixed(1));

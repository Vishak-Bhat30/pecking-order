// Barnyard bots. They decide from their own personalised view only (no peeking).
import { ACTIONS, ROLE_IDS } from './roles.js';
import { COPIES, MUST_BARNSTORM_AT } from './engine.js';

const VALUE = { rooster: 5, fox: 4.2, goose: 4, raccoon: 3.2, owl: 2.6 };

export const BOT_NAMES = ['Clucky', 'Nugget', 'Pip', 'Henrietta', 'Waddles', 'Biscuit', 'Peaches', 'Dot', 'Pepper', 'Mabel'];

export function botDecide(v, me, rnd = Math.random) {
  const pr = v.prompt;
  if (!pr) return null;
  const self = v.players.find((p) => p.id === me);
  const mine = self.cards.filter((c) => !c.dead).map((c) => c.role);
  const has = (r) => mine.includes(r);
  const opps = v.players.filter((p) => p.alive && p.id !== me);
  // How many copies of `role` can I account for (my live cards + every revealed card)?
  const seen = (role) => mine.filter((r) => r === role).length +
    v.players.reduce((n, p) => n + p.cards.filter((c) => c.dead && c.role === role).length, 0);
  const lives = (p) => p.cards.filter((c) => !c.dead).length;
  const threat = (list) => list.slice().sort((a, b) => (lives(b) - lives(a)) || (b.coins - a.coins) || (rnd() - 0.5))[0];

  if (pr.kind === 'action') {
    const c = self.coins;
    if (pr.mustBarnstorm || (c >= 7 && rnd() < 0.9)) return { type: 'action', action: 'barnstorm', target: threat(opps).id };
    if (has('fox') && c >= 3 && rnd() < 0.85) return { type: 'action', action: 'raid', target: threat(opps).id };
    if (has('rooster') && rnd() < 0.9) return { type: 'action', action: 'tribute' };
    const rich = opps.filter((p) => p.coins >= 2).sort((a, b) => b.coins - a.coins)[0];
    if (has('raccoon') && rich && rnd() < 0.85) return { type: 'action', action: 'pilfer', target: rich.id };
    if (has('owl') && rnd() < 0.45) return { type: 'action', action: 'foresight' };
    // Bluffs (only when the claimed role isn't already fully accounted for)
    const r = rnd();
    if (r < 0.22 && seen('rooster') < COPIES) return { type: 'action', action: 'tribute' };
    if (r < 0.30 && c >= 3 && seen('fox') < COPIES) {
      const weak = opps.filter((p) => lives(p) === 1)[0] || threat(opps);
      return { type: 'action', action: 'raid', target: weak.id };
    }
    if (r < 0.38 && rich && seen('raccoon') < COPIES) return { type: 'action', action: 'pilfer', target: rich.id };
    if (seen('rooster') >= COPIES || rnd() < 0.55) return { type: 'action', action: 'forage' };
    return { type: 'action', action: 'peck' };
  }

  if (pr.kind === 'respond') {
    const ctx = v.ctx;
    const isBlockWindow = pr.windowKind === 'blockChallenge';
    const claimRole = isBlockWindow ? ctx.block.role : ctx.claim;
    const imTarget = ctx.target === me;
    // Certain bluff: all copies accounted for.
    if (pr.canChallenge && claimRole && seen(claimRole) >= COPIES) return { type: 'challenge', windowId: pr.windowId };

    if (pr.blockRoles.length) {
      const real = pr.blockRoles.find(has);
      if (real && (ctx.action !== 'forage' || rnd() < 0.8)) return { type: 'block', role: real, windowId: pr.windowId };
      if (ctx.action === 'raid' && imTarget) {
        const desperate = lives(self) === 1;
        if (desperate && pr.canChallenge && rnd() < 0.4) return { type: 'challenge', windowId: pr.windowId };
        if (seen('goose') < COPIES && rnd() < (desperate ? 0.65 : 0.25)) return { type: 'block', role: 'goose', windowId: pr.windowId };
      }
      if (ctx.action === 'pilfer' && imTarget && self.coins >= 2 && rnd() < 0.18) {
        const fake = pr.blockRoles.find((r) => seen(r) < COPIES);
        if (fake) return { type: 'block', role: fake, windowId: pr.windowId };
      }
    }
    if (pr.canChallenge) {
      let p = 0.06;
      if (imTarget) p += 0.1;
      if (claimRole && seen(claimRole) === COPIES - 1) p += 0.12;
      if (isBlockWindow && ctx.actor === me) p += 0.08;
      if (rnd() < p) return { type: 'challenge', windowId: pr.windowId };
    }
    return { type: 'pass', windowId: pr.windowId };
  }

  if (pr.kind === 'lose') {
    const live = self.cards.map((c, i) => ({ c, i })).filter((x) => !x.c.dead);
    const dup = live.length === 2 && live[0].c.role === live[1].c.role;
    if (dup) return { type: 'lose', index: live[0].i };
    live.sort((a, b) => VALUE[a.c.role] - VALUE[b.c.role]);
    return { type: 'lose', index: live[0].i };
  }

  if (pr.kind === 'exchange') {
    const idx = pr.pool.map((r, i) => i).sort((a, b) => VALUE[pr.pool[b]] - VALUE[pr.pool[a]] + (rnd() - 0.5) * 0.4);
    const keep = [];
    for (const i of idx) {
      if (keep.length >= pr.keep) break;
      if (keep.some((k) => pr.pool[k] === pr.pool[i]) && idx.length - keep.length > pr.keep - keep.length) continue;
      keep.push(i);
    }
    for (const i of idx) if (keep.length < pr.keep && !keep.includes(i)) keep.push(i);
    return { type: 'exchange', keep };
  }
  return null;
}

export const _test = { VALUE, ROLE_IDS, ACTIONS, MUST_BARNSTORM_AT };

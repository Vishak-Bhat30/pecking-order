// Deterministic rule scenarios. Run: node test/engine.rules.mjs
import { createGame, applyInput as A, viewFor } from '../js/engine.js';
let fails = 0;
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.log('FAIL', msg, 'got', JSON.stringify(a), 'want', JSON.stringify(b)); } else console.log('ok  ', msg); };
function game(hands, coins = [2, 2, 2]) {
  const s = createGame(hands.map((_, i) => ({ id: 'p' + i, name: 'P' + i, look: {} })), { seed: 1, firstPlayer: 0 });
  const all = hands.flat(); s.deck = [];
  for (const r of ['rooster', 'fox', 'raccoon', 'owl', 'goose']) for (let i = 0; i < 3; i++) s.deck.push(r);
  for (const r of all) s.deck.splice(s.deck.indexOf(r), 1);
  s.players.forEach((p, i) => { p.cards = hands[i].map((role) => ({ role, dead: false })); p.coins = coins[i]; });
  return s;
}
const lives = (s, i) => s.players[i].cards.filter((c) => !c.dead).length;
const ok = (r, m) => { if (!r.ok) { fails++; console.log('FAIL', m, r.error); } };

// 1. Tribute unchallenged
let s = game([['rooster', 'owl'], ['fox', 'goose'], ['raccoon', 'owl']]);
ok(A(s, 'p0', { type: 'action', action: 'tribute' }), 'tribute');
ok(A(s, 'p1', { type: 'pass' }), 'p1 pass'); ok(A(s, 'p2', { type: 'pass' }), 'p2 pass');
eq([s.players[0].coins, s.stage, s.players[s.turn].id], [5, 'action', 'p1'], 'tribute +3 then next turn');

// 2. Bluff tribute challenged -> actor loses card (chooses), no coins
s = game([['fox', 'owl'], ['fox', 'goose'], ['raccoon', 'owl']]);
A(s, 'p0', { type: 'action', action: 'tribute' });
ok(A(s, 'p2', { type: 'challenge' }), 'challenge');
eq([s.stage, s.loseQueue[0].pid], ['lose', 'p0'], 'bluffer must choose a card');
ok(A(s, 'p0', { type: 'lose', index: 1 }), 'lose owl');
eq([s.players[0].coins, lives(s, 0), s.players[0].cards[1].dead, s.players[s.turn].id], [2, 1, true, 'p1'], 'no gain, owl dead, next turn');

// 3. True tribute challenged -> challenger loses, actor swaps card and gains
s = game([['rooster', 'owl'], ['fox', 'goose'], ['raccoon', 'owl']]);
A(s, 'p0', { type: 'action', action: 'tribute' });
A(s, 'p1', { type: 'challenge' });
eq([s.stage, s.loseQueue[0].pid], ['lose', 'p1'], 'challenger chooses loss');
A(s, 'p1', { type: 'lose', index: 0 });
eq([s.players[0].coins, lives(s, 1), s.players[s.turn].id], [5, 1, 'p1'], 'tribute resolves after failed challenge');

// 4. Raid: target challenges and loses -> then can still block (has goose) -> blocks -> unchallenged block holds; coins stay spent
s = game([['fox', 'owl'], ['goose', 'raccoon'], ['raccoon', 'owl']], [3, 2, 2]);
A(s, 'p0', { type: 'action', action: 'raid', target: 'p1' });
eq(s.players[0].coins, 0, 'raid paid 3 upfront');
A(s, 'p1', { type: 'challenge' });
A(s, 'p1', { type: 'lose', index: 1 }); // loses raccoon
eq([s.stage, s.ctx.window.kind, s.ctx.window.responders], ['respond', 'block', ['p1']], 'target gets block window after failed challenge');
A(s, 'p1', { type: 'block', role: 'goose' });
A(s, 'p0', { type: 'pass' }); A(s, 'p2', { type: 'pass' });
eq([lives(s, 1), s.players[0].coins, s.players[s.turn].id], [1, 0, 'p1'], 'block holds, raid coins spent');

// 5. Raid: target bluff-blocks with goose, actor challenges -> target loses both cards (double loss)
s = game([['fox', 'owl'], ['rooster', 'raccoon'], ['raccoon', 'owl']], [3, 2, 2]);
A(s, 'p0', { type: 'action', action: 'raid', target: 'p1' });
A(s, 'p1', { type: 'block', role: 'goose' });
A(s, 'p0', { type: 'challenge' });
eq([s.stage, s.loseQueue[0].pid], ['lose', 'p1'], 'bluff blocker chooses first loss');
A(s, 'p1', { type: 'lose', index: 0 });
eq([lives(s, 1), s.players[1].cards.every((c) => c.dead)], [0, true], 'raid then auto-takes last card');
eq(s.events.some((e) => e.type === 'eliminated' && e.pid === 'p1'), true, 'eliminated event');

// 6. Bluffed raid challenged -> refund 3
s = game([['rooster', 'owl'], ['goose', 'raccoon'], ['raccoon', 'owl']], [4, 2, 2]);
A(s, 'p0', { type: 'action', action: 'raid', target: 'p2' });
A(s, 'p1', { type: 'challenge' });
A(s, 'p0', { type: 'lose', index: 0 });
eq([s.players[0].coins, lives(s, 2)], [4, 2], 'refund on caught bluff, target safe');

// 7. Forage blocked by rooster claim, challenged and proven -> forage fails, challenger loses
s = game([['fox', 'owl'], ['rooster', 'raccoon'], ['raccoon', 'owl']]);
A(s, 'p0', { type: 'action', action: 'forage' });
eq(s.ctx.window.canChallenge, false, 'forage itself cannot be challenged');
A(s, 'p2', { type: 'block', role: 'rooster' });
A(s, 'p0', { type: 'challenge' }); // p2 bluffing
A(s, 'p2', { type: 'lose', index: 1 });
eq([s.players[0].coins, lives(s, 2)], [4, 1], 'bluffed block -> forage resolves');

// 8. Pilfer steals min(2, coins); owl blocks
s = game([['raccoon', 'owl'], ['goose', 'fox'], ['owl', 'goose']], [2, 1, 5]);
A(s, 'p0', { type: 'action', action: 'pilfer', target: 'p1' });
A(s, 'p1', { type: 'pass' }); A(s, 'p2', { type: 'pass' });
eq([s.players[0].coins, s.players[1].coins], [3, 0], 'pilfer takes only 1 when target has 1');
s = game([['raccoon', 'owl'], ['goose', 'fox'], ['owl', 'goose']], [2, 1, 5]);
A(s, 'p0', { type: 'action', action: 'pilfer', target: 'p2' });
A(s, 'p2', { type: 'block', role: 'owl' }); A(s, 'p0', { type: 'pass' }); A(s, 'p1', { type: 'pass' });
eq([s.players[0].coins, s.players[2].coins], [2, 5], 'owl block');

// 9. Must barnstorm at 10; barnstorm unblockable
s = game([['raccoon', 'owl'], ['goose', 'fox'], ['owl', 'goose']], [10, 1, 5]);
eq(A(s, 'p0', { type: 'action', action: 'tribute' }).ok, false, '10+ corn forces barnstorm');
A(s, 'p0', { type: 'action', action: 'barnstorm', target: 'p2' });
eq([s.stage, s.players[0].coins, s.loseQueue[0].pid], ['lose', 3, 'p2'], 'barnstorm -> target chooses');

// 10. Foresight exchange keeps 2 of 4; with one life keeps 1 of 3
s = game([['owl', 'fox'], ['goose', 'fox'], ['owl', 'goose']]);
A(s, 'p0', { type: 'action', action: 'foresight' }); A(s, 'p1', { type: 'pass' }); A(s, 'p2', { type: 'pass' });
const v = viewFor(s, 'p0');
eq([v.prompt.kind, v.prompt.pool.length, v.prompt.keep], ['exchange', 4, 2], 'exchange prompt');
eq(viewFor(s, 'p1').prompt, null, 'others see no exchange prompt');
eq(A(s, 'p0', { type: 'exchange', keep: [0] }).ok, false, 'must keep exactly 2');
const want = [v.prompt.pool[2], v.prompt.pool[3]];
A(s, 'p0', { type: 'exchange', keep: [2, 3] });
eq(s.players[0].cards.map((c) => c.role), want, 'kept drawn cards');

// 11. Block challenged and proven: challenger loses, block holds
s = game([['fox', 'owl'], ['goose', 'raccoon'], ['raccoon', 'owl']], [3, 2, 2]);
A(s, 'p0', { type: 'action', action: 'raid', target: 'p1' });
A(s, 'p1', { type: 'block', role: 'goose' });
A(s, 'p2', { type: 'challenge' });
A(s, 'p2', { type: 'lose', index: 0 });
eq([lives(s, 1), lives(s, 2), s.players[s.turn].id], [2, 1, 'p1'], 'proven block holds');

// 12. Last-card challenge ends game immediately (2 players)
s = game([['fox', 'owl'], ['goose', 'raccoon']], [2, 2]);
s.players[1].cards[1].dead = true;
A(s, 'p0', { type: 'action', action: 'foresight' });
A(s, 'p1', { type: 'challenge' });
eq([s.stage, s.winner], ['over', 'p0'], 'game over when last opponent falls');

console.log(fails ? `${fails} FAILURES` : 'ALL RULE TESTS PASSED');
process.exit(fails ? 1 : 0);

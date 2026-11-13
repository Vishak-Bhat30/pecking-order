# Pecking Order 🐓

An animated online bluffing game for 2–6 players. Play it in the browser: **https://vishak-bhat30.github.io/pecking-order/**

Create a room, share the 6-letter code (or the invite link), and out-bluff your friends. You can also play **Practice vs bots** offline.

## How to play

Everyone secretly holds 2 character cards and starts with 2 corn. On your turn you do one thing:

| Action | Who | Effect |
|---|---|---|
| Peck | anyone | +1 corn |
| Forage | anyone | +2 corn (any Rooster can block) |
| Barnstorm | anyone | pay 7: a rival loses a card (cannot be stopped; you must do this at 10+ corn) |
| Tribute | claim **Rooster** | +3 corn |
| Raid | claim **Fox** | pay 3: a rival loses a card (the target can block with a Goose) |
| Pilfer | claim **Raccoon** | steal 2 corn (the target can block with a Raccoon or Owl) |
| Foresight | claim **Owl** | draw 2 cards, then return 2 |

You can claim any character, whether or not you hold it. Anyone can **challenge** a claim:

- If the claim was true, the challenger loses a card.
- If it was a bluff, the bluffer loses a card and the move fails.

Blocks are claims too, so they can be challenged. Lose both cards and you're out. The last bird standing wins.

## Features

- Five original characters (Rooster, Fox, Raccoon, Owl, Goose). Each has its own idle animation and its own action animation.
- All sound effects and the background music are synthesized in the browser with Web Audio. There are no audio files.
- Join with a code: the host's browser runs the game.
  - Players connect peer-to-peer over WebRTC via PeerJS.
  - If that fails, they fall back automatically to a public MQTT relay.
  - No server to run, so it is hosted for free on GitHub Pages.
- Reconnects:
  - Refresh mid-game and you rejoin automatically.
  - If the host refreshes, the room resumes.
  - Anyone who drops out is covered by a bot after 45 seconds.
- Bots you can add to any room. An optional response timer, emotes, a game log, and a rules sheet.
- Works on phones and laptops, and respects reduced-motion settings.

## Run locally

It's a static site with no build step:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Add `?net=relay` or `?net=p2p` to the URL to force one connection method.

## Tests

```sh
node test/engine.rules.mjs     # rule scenarios (challenges, blocks, refunds, double losses…)
node test/engine.fuzz.mjs 2000 # random bot games + junk input; checks invariants and hidden info
```

## Layout

| Path | Contents |
|---|---|
| `js/engine.js` | Pure, serialisable rules engine |
| `js/bot.js` | Bot AI. Bots only see their own view. |
| `js/host.js` | Room, lobby, timers and bots. Runs in the host's browser. |
| `js/net.js` | PeerJS and MQTT transports |
| `js/session.js` | Player connection and reconnect |
| `js/game.js` | Game screen and the event → animation pipeline |
| `js/main.js` | Home and lobby |
| `js/art.js`, `css/art.css` | SVG characters and their animations |
| `js/audio.js` | Synthesized sound effects and music |
| `js/fx.js` | Particles, flying corn, stamps |
| `dev/` | Previews of the art and sounds |

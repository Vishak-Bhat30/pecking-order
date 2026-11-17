# Pecking Order 🐓

An animated online bluffing game for 2–6 players. Play it in the browser: **https://vishak-bhat30.github.io/pecking-order/**

Create a room, share the 6-letter code (or the invite link), and out-bluff your friends. You can also play **Practice vs bots** offline.

## How to play

Everyone secretly holds 2 character cards and starts with 2 corn. On your turn you do one thing:

| Action | Who | Effect |
|---|---|---|
| Collect | anyone | +1 corn |
| Harvest | anyone | +2 corn (anyone claiming the Rooster can block) |
| Knockout | anyone | pay 7: a rival loses a card (cannot be stopped; you must do this at 10+ corn) |
| Tax | claim **Rooster** | +3 corn |
| Attack | claim **Fox** | pay 3: a rival loses a card (the target can block by claiming the Goose) |
| Snatch | claim **Raccoon** | steal 2 corn (the target can block by claiming the Raccoon or Owl) |
| Swap | claim **Owl** | draw 2 cards, keep the ones you like, put 2 back |

You can claim any character, whether or not you hold it. Anyone can **challenge** a claim:

- If the claim was true, the challenger loses a card.
- If it was a bluff, the bluffer loses a card and the move fails.

Blocks are claims too, so they can be challenged. Lose both cards and you're out. The last bird standing wins.

## Features

- Five original characters (Rooster, Fox, Raccoon, Owl, Goose). Each has its own idle animation and its own action animation.
- All sound effects and the background music are synthesized in the browser with Web Audio. There are no audio files.
- Join with a code: the host's browser runs the game, with no server to run, so it is hosted for free on GitHub Pages.
  - Each player connects over two paths at once. One is an end-to-end encrypted relay through public MQTT brokers, one of them on port 443. The other is a direct peer-to-peer WebRTC link.
  - If one path drops, the other keeps the game going, and the dropped path re-opens in the background.
  - Phones that sleep or switch apps are handled: the host tells everyone to wait, and players who wake up reconnect within seconds.
- Reconnects:
  - Refresh mid-game and you rejoin automatically.
  - If the host refreshes, the room resumes.
  - Anyone who drops out is covered by a bot after 45 seconds.
- Bots you can add to any room. An optional response timer, emotes, a game log, and a rules sheet.
- Works on phones and laptops, and respects reduced-motion settings.

## Install it on your phone

It's a Progressive Web App, so it installs from the browser with no app store needed:

- **iPhone / iPad:** open the site in Safari, tap **Share**, then tap **Add to Home Screen**.
- **Android:** open it in Chrome and tap **Install the app** on the home screen. You can also use the **⋮** menu and choose **Install app**.
- **Laptop:** in Chrome or Edge, click the install icon in the address bar.

The installed app opens full-screen with its own icon. Practice mode works offline.

## Run locally

It's a static site with no build step:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Add `?net=relay` or `?net=p2p` to the URL to use only one connection path.

## Deploying changes

Run `node tools/stamp-sw.mjs` before committing. It stamps `sw.js` with a hash of the app files, so installed copies pick up the new version. Then push to `main`, and GitHub Pages rebuilds in about a minute.

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

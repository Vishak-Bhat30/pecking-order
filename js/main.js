// App shell: home, lobby, routing, connection flows.
import { ROLES, ROLE_IDS, ACTIONS, MAX_PLAYERS } from './roles.js';
import { characterSVG, iconSVG, HEN_COLORS, HEN_HATS } from './art.js';
import audio from './audio.js';
import { fx } from './fx.js';
import { $, $$, esc, el, cardFront, hen, toast, modal } from './dom.js';
import { Host } from './host.js';
import { Session, playerId } from './session.js';
import { makeCode, normCode } from './net.js';
import { GameUI } from './game.js';

const app = $('#app');
const params = new URLSearchParams(location.search);
const NET_MODE = ['p2p', 'relay'].includes(params.get('net')) ? params.get('net') : 'auto';

const S = {
  screen: null,
  pid: playerId(),
  name: load('po_name', ''),
  look: load('po_look', null) || { color: Math.floor(Math.random() * 8), hat: Math.floor(Math.random() * 8) },
  session: null,
  host: null,
  room: null,
  game: null,
};

function load(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }

fx.init($('#fx'));

/* ================= sound toggles (always visible) ================= */
const ICON_SFX = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path class="on" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path class="off" d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_MUSIC = '<svg viewBox="0 0 24 24"><path d="M9 17V6l10-2v11" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="7" cy="17" r="2.6" fill="currentColor"/><circle cx="17" cy="15" r="2.6" fill="currentColor"/><path class="off" d="M3 3l18 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
function mountToggles() {
  const t = el(`<div class="toggles">
    <button class="tg" data-tg="sfx" title="Sound effects">${ICON_SFX}</button>
    <button class="tg" data-tg="music" title="Music">${ICON_MUSIC}</button></div>`);
  const sync = () => {
    $('[data-tg=sfx]', t).classList.toggle('is-off', !audio.sfxOn);
    $('[data-tg=music]', t).classList.toggle('is-off', !audio.musicOn);
  };
  t.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tg]');
    if (!b) return;
    audio.unlock();
    if (b.dataset.tg === 'sfx') audio.setSfx(!audio.sfxOn); else audio.setMusic(!audio.musicOn);
    audio.play('click');
    sync();
  });
  sync();
  document.body.appendChild(t);
}
mountToggles();

/* ================= look editor ================= */
function lookEditor(onChange) {
  const box = el(`<div class="look-ed">
    <div class="swatches">${HEN_COLORS.map((c, i) => `<button class="sw" data-c="${i}" title="${esc(c.name)}" style="--c:${c.body};--s:${c.shade}"></button>`).join('')}</div>
    <div class="hat-pick"><button class="arrow" data-h="-1" aria-label="Previous hat">‹</button><span class="hat-name"></span><button class="arrow" data-h="1" aria-label="Next hat">›</button></div>
  </div>`);
  const sync = () => {
    $$('.sw', box).forEach((b) => b.classList.toggle('on', +b.dataset.c === S.look.color));
    $('.hat-name', box).textContent = HEN_HATS[S.look.hat] || 'No hat';
  };
  box.addEventListener('click', (e) => {
    const c = e.target.closest('[data-c]'), h = e.target.closest('[data-h]');
    if (!c && !h) return;
    if (c) S.look = { ...S.look, color: +c.dataset.c };
    if (h) S.look = { ...S.look, hat: (S.look.hat + +h.dataset.h + HEN_HATS.length) % HEN_HATS.length };
    save('po_look', S.look);
    audio.play('click');
    sync();
    onChange && onChange();
  });
  sync();
  return box;
}

/* ================= home ================= */
function showHome(prefillCode = '') {
  teardown();
  keepAwake(false);
  document.body.classList.remove('reconnecting');
  S.screen = 'home';
  document.body.className = 'on-home';
  audio.setMood('menu');
  const saved = Host.saved();
  const title = 'Pecking Order';
  app.innerHTML = `
  <div class="home">
    <h1 class="logo" aria-label="${title}">${title.split('').map((ch, i) => ch === ' ' ? '<span class="gap"></span>' : `<span style="--i:${i}">${ch}</span>`).join('')}</h1>
    <p class="tagline">A barnyard game of bluffing, betrayal &amp; corn.</p>
    <div class="parade">${ROLE_IDS.map((r, i) => `<button class="parader" data-role="${r}" style="--bg:${ROLES[r].bg};--rink:${ROLES[r].ink};--i:${i}">
        <span class="pd-art">${characterSVG(r)}</span><span class="pd-name">${ROLES[r].name}</span></button>`).join('')}</div>
    <div class="home-card">
      ${saved ? `<div class="resume"><span>You were hosting room <b>${esc(saved.code)}</b></span><button class="btn sm gold" id="resume">Resume</button><button class="btn sm ghost" id="forget">Forget</button></div>` : ''}
      <div class="me-edit">
        <div class="me-hen">${hen(S.look)}</div>
        <div class="me-fields">
          <label class="lbl">Your name<input id="nm" maxlength="12" autocomplete="nickname" placeholder="e.g. Nugget" value="${esc(S.name)}"></label>
          <div class="ed-slot"></div>
        </div>
      </div>
      <div class="pn-row stretch"><button class="btn big gold" id="create">Create a room</button><button class="btn big" id="practice" title="Play offline against bots">Practice vs bots</button></div>
      <div class="or"><span>or join your friends</span></div>
      <form class="join-row" id="joinf">
        <input id="code" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ROOM CODE" value="${esc(prefillCode)}">
        <button class="btn big" id="join" type="submit">Join</button>
      </form>
      <div class="status-line" id="hstatus"></div>
      <div class="home-links"><button class="link" id="howto">How to play</button>${isStandalone() ? '' : `<button class="link install-link" id="install">${ICON_PHONE}Install the app</button>`}</div>
    </div>
    <footer class="foot">2–6 players · 10–15 minutes · works on phones &amp; laptops</footer>
  </div>`;
  const meHen = $('.me-hen', app);
  $('.ed-slot', app).replaceWith(lookEditor(() => { meHen.innerHTML = hen(S.look); meHen.firstElementChild.classList.add('cheer'); }));
  $('#nm', app).addEventListener('input', (e) => { S.name = e.target.value; save('po_name', S.name); });
  const codeIn = $('#code', app);
  codeIn.addEventListener('input', () => { const p = codeIn.selectionStart; codeIn.value = normCode(codeIn.value); codeIn.setSelectionRange(p, p); });
  $('#create', app).addEventListener('click', () => createRoom());
  $('#practice', app).addEventListener('click', () => practice());
  $('#joinf', app).addEventListener('submit', (e) => { e.preventDefault(); joinRoom(codeIn.value); });
  $('#howto', app).addEventListener('click', showRules);
  $('#install', app)?.addEventListener('click', installApp);
  if (saved) {
    $('#resume', app).addEventListener('click', () => resumeHost(saved));
    $('#forget', app).addEventListener('click', () => { Host.clearSaved(); showHome(); });
  }
  $('.parade', app).addEventListener('click', (e) => {
    const b = e.target.closest('.parader');
    if (!b) return;
    const r = b.dataset.role;
    audio.unlock();
    audio.play(r);
    b.classList.remove('act'); void b.offsetWidth; b.classList.add('act');
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('act'), 1600);
    fx.bubble(b, ROLES[r].quip, { ms: 1800 });
    fx.burst(b, { type: 'spark', count: 12, colors: [ROLES[r].bg, '#fff'] });
  });
  if (prefillCode) setTimeout(() => (S.name ? $('#join', app) : $('#nm', app)).focus(), 50);
}

function busy(on, text = '') {
  $$('#create, #join, #resume, #practice', app).forEach((b) => { b.disabled = on; });
  const st = $('#hstatus', app);
  if (st) st.innerHTML = on ? `<span class="dots"><i></i><i></i><i></i></span>${esc(text)}` : esc(text);
}

function needName() {
  const n = (S.name || '').trim();
  if (n) return n;
  const i = $('#nm', app);
  if (i) { i.focus(); i.classList.add('shake'); setTimeout(() => i.classList.remove('shake'), 500); }
  audio.play('error');
  toast('Pick a name first!', 'err');
  return null;
}

/* ================= flows ================= */
async function createRoom() {
  audio.unlock();
  const name = needName();
  if (!name) return;
  audio.play('click');
  busy(true, 'Building your coop…');
  let host = null, code = null;
  for (let attempt = 0; attempt < 3 && !host; attempt++) {
    code = makeCode();
    const h = new Host({ code, self: { pid: S.pid, name, look: S.look } });
    try { await h.start({ p2p: NET_MODE !== 'relay', relay: NET_MODE !== 'p2p' }); host = h; } catch (e) {
      if (e.message !== 'taken') { busy(false, 'Could not open a room — check your internet connection and try again.'); audio.play('error'); return; }
    }
  }
  if (!host) { busy(false, 'Could not open a room. Try again.'); return; }
  await enterSession(new Session({ code, pid: S.pid, name, look: S.look, host }), host);
}

async function practice() {
  audio.unlock();
  const name = (S.name || '').trim() || 'You';
  audio.play('click');
  const host = new Host({ code: 'SOLO', self: { pid: S.pid, name, look: S.look }, offline: true });
  await host.start();
  for (let i = 0; i < 3; i++) host.handle(S.pid, { t: 'addBot' });
  await enterSession(new Session({ code: 'SOLO', pid: S.pid, name, look: S.look, host }), host);
}

async function resumeHost(saved) {
  audio.unlock();
  busy(true, 'Re-opening your coop…');
  const host = new Host({ code: saved.code, self: saved.self, restore: saved });
  const until = Date.now() + 25000;
  for (;;) {
    try { await host.start({ p2p: NET_MODE !== 'relay', relay: NET_MODE !== 'p2p' }); break; } catch (e) {
      if (e.message === 'taken' && Date.now() < until) { await new Promise((r) => setTimeout(r, 2500)); continue; }
      busy(false, 'Could not re-open the room.');
      Host.clearSaved();
      return;
    }
  }
  S.pid = saved.self.pid;
  await enterSession(new Session({ code: saved.code, pid: saved.self.pid, name: saved.self.name, look: saved.self.look, host }), host);
}

async function joinRoom(raw) {
  audio.unlock();
  const code = normCode(raw);
  const name = needName();
  if (!name) return;
  if (code.length !== 6) { toast('Room codes have 6 letters.', 'err'); audio.play('error'); $('#code', app)?.focus(); return; }
  audio.play('click');
  busy(true, 'Knocking on the coop door…');
  const s = new Session({ code, pid: S.pid, name, look: S.look, mode: NET_MODE });
  s.on({ onStatus: (st, d) => { if (st === 'connecting' && d) busy(true, d); } });
  try { await s.connect(); } catch (e) { busy(false, e.message); audio.play('error'); return; }
  save('po_last', { code, at: Date.now() });
  await enterSession(s, null);
}

async function enterSession(session, host) {
  S.session = session;
  S.host = host;
  if (!(host && host.offline)) history.replaceState(null, '', `?room=${session.code}${NET_MODE !== 'auto' ? '&net=' + NET_MODE : ''}`);
  session.on({
    onRoom: (room) => {
      S.room = room;
      if (room.phase === 'lobby') { if (S.screen !== 'lobby') showLobby(); else renderLobby(); }
      if (S.game) S.game.setRoom(room);
    },
    onGame: (view) => {
      if (S.screen !== 'game') showGame();
      S.game.push(view);
    },
    onEmote: (m) => {
      if (S.screen === 'game' && S.game) S.game.emote(m);
      else if (S.screen === 'lobby') lobbyEmote(m);
    },
    onError: (txt) => { toast(txt, 'err'); audio.play('error'); },
    onStatus: (st) => {
      const banner = $('.reconnect-banner');
      if (banner) banner.textContent = st === 'hostAway'
        ? 'The host switched apps or locked their phone. The game will continue when they are back…'
        : 'Connection hiccup. Reconnecting…';
      document.body.classList.toggle('reconnecting', st === 'reconnecting' || st === 'hostAway');
    },
    onEnd: (reason, detail) => {
      const msg = { kicked: 'The host removed you from the room.', closed: 'The host closed the room.', lost: 'Lost connection to the room.', rejected: detail || 'Could not rejoin the room.' }[reason];
      S.session = null;
      if (msg) toast(msg, 'err');
      if (reason !== 'left') audio.play('leave');
      history.replaceState(null, '', location.pathname);
      showHome();
    },
  });
  await session.connect();
  if (host) host.onLocal = (m) => session._onMsg(m);
  if (!S.room) {
    // first room message comes asynchronously
    setTimeout(() => { if (S.screen !== 'lobby' && S.screen !== 'game' && S.room) showLobby(); }, 50);
  }
}

function leave(force) {
  const go = () => {
    audio.play('leave');
    if (S.session) S.session.leave();
    else showHome();
  };
  if (force) return go();
  const isHost = !!S.host;
  const m = modal(`<h2>Leave the room?</h2><p>${isHost ? 'You are the host — leaving closes the room for everyone.' : 'You can rejoin with the same code while the game is running.'}</p>
    <div class="pn-row"><button class="btn red" data-y>Leave</button><button class="btn ghost" data-n>Stay</button></div>`, { cls: 'small' });
  m.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-y]')) { m.close(); go(); }
    if (e.target.closest('[data-n]')) m.close();
  });
}

function teardown() {
  if (S.game) { S.game.destroy(); S.game = null; }
  $$('.announce, .over-back, .modal-back').forEach((x) => x.remove());
}

/* ================= lobby ================= */
function showLobby() {
  teardown();
  keepAwake(true);
  S.screen = 'lobby';
  document.body.className = 'on-lobby';
  audio.setMood('menu');
  app.innerHTML = `<div class="lobby">
    <div class="lobby-top"><button class="btn sm ghost" id="lleave">‹ Leave</button></div>
    <div class="lobby-card">
      ${S.host && S.host.offline ? `<div class="code-box"><div class="code-lbl">Practice game</div><div class="practice-note">Just you and the bots. Nothing goes over the internet. Add or remove bots, then start.</div></div>` : `<div class="code-box">
        <div class="code-lbl">Room code</div>
        <div class="code-tiles">${S.session.code.split('').map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</div>
        <div class="code-btns">
          <button class="btn sm" id="ccode">Copy code</button>
          <button class="btn sm" id="clink">Copy invite link</button>
          ${navigator.share ? '<button class="btn sm" id="share">Share…</button>' : ''}
        </div>
      </div>`}
      <div class="perch"></div>
      <div class="lobby-bottom"></div>
      <button class="link" id="howto">How to play</button>
    </div>
  </div>`;
  $('#lleave', app).addEventListener('click', () => leave());
  $('#ccode', app)?.addEventListener('click', () => copy(S.session.code, 'Code copied!'));
  $('#clink', app)?.addEventListener('click', () => copy(inviteLink(), 'Invite link copied!'));
  $('#share', app)?.addEventListener('click', () => navigator.share({ title: 'Pecking Order', text: `Join my Pecking Order game! Room code ${S.session.code}`, url: inviteLink() }).catch(() => {}));
  $('#howto', app).addEventListener('click', showRules);
  $('.code-tiles', app)?.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 400, easing: 'cubic-bezier(.2,1.5,.4,1)' });
  renderLobby();
}

const inviteLink = () => `${location.origin}${location.pathname}?room=${S.session.code}`;
function copy(text, msg) {
  audio.play('copy');
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(msg), () => {
    const t = el('<textarea></textarea>'); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); toast(msg); } catch (e) { toast(text); }
    t.remove();
  });
}

function renderLobby() {
  if (S.screen !== 'lobby' || !S.room) return;
  const room = S.room;
  const isHost = room.hostId === S.pid;
  const perch = $('.perch', app);
  const prev = new Set($$('.chick', perch).map((x) => x.dataset.pid));
  const slots = [];
  for (const p of room.players) {
    slots.push(`<div class="chick ${prev.has(p.id) ? '' : 'new'} ${p.connected ? '' : 'offline'}" data-pid="${p.id}">
      ${hen(p.look)}
      <div class="ck-name">${esc(p.name)}${p.id === S.pid ? ' <i>(you)</i>' : ''}</div>
      <div class="ck-tags">${p.id === room.hostId ? '<i class="bdg host">host</i>' : ''}${p.isBot ? '<i class="bdg">bot</i>' : ''}</div>
      ${isHost && p.id !== S.pid ? `<button class="kick" data-kick="${p.id}" title="Remove">✕</button>` : ''}
    </div>`);
  }
  for (let i = room.players.length; i < MAX_PLAYERS; i++) slots.push('<div class="chick empty"><div class="egg"></div><div class="ck-name">open seat</div></div>');
  perch.innerHTML = slots.join('');
  if (room.players.length > prev.size && prev.size) audio.play('join');
  $$('.chick.new', perch).forEach((c, k) => c.animate([{ transform: 'translateY(-60px)', opacity: 0 }, { transform: 'translateY(4px)', opacity: 1, offset: 0.7 }, { transform: 'none' }], { duration: 520, delay: k * 60, easing: 'ease-out' }));
  perch.onclick = (e) => {
    const k = e.target.closest('[data-kick]');
    if (k) { audio.play('click'); S.session.send({ t: 'kick', pid: k.dataset.kick }); }
  };
  const bottom = $('.lobby-bottom', app);
  const enough = room.players.length >= 2;
  const keyNow = `${isHost}|${room.players.length}|${room.settings.timer}`;
  if (bottom.dataset.key === keyNow) return;
  bottom.dataset.key = keyNow;
  bottom.innerHTML = `
    <div class="lb-me"><div class="lbl">Your look</div><div class="ed-slot"></div></div>
    ${isHost ? `
      <div class="lb-host">
        <div class="lb-set"><span class="lbl">Response timer</span>
          <div class="seg">${[0, 10, 20, 30, 45].map((t) => `<button class="${room.settings.timer === t ? 'on' : ''}" data-timer="${t}">${t ? t + 's' : 'Off'}</button>`).join('')}</div>
        </div>
        <div class="pn-row">
          <button class="btn" id="addbot" ${room.players.length >= MAX_PLAYERS ? 'disabled' : ''}>+ Add a bot</button>
          <button class="btn big gold" id="start" ${enough ? '' : 'disabled'}>Start game</button>
        </div>
        <div class="hint">${enough ? 'Everyone in? Start whenever you like.' : 'Share the code — you need at least 2 players (bots count).'}</div>
        ${room.offline ? '' : '<div class="host-warn"><b>You are the host.</b> Your phone runs the game, so keep this screen open. If you switch apps or lock the phone, the game pauses for everyone until you come back.</div>'}
      </div>` : `<div class="pn-wait"><span class="dots"><i></i><i></i><i></i></span>Waiting for the host to start the game…</div>`}`;
  $('.ed-slot', bottom).replaceWith(lookEditor(() => S.session.send({ t: 'look', look: S.look })));
  if (isHost) {
    $('#addbot', bottom).addEventListener('click', () => { audio.play('click'); S.session.send({ t: 'addBot' }); });
    $('#start', bottom).addEventListener('click', () => { audio.play('click'); S.session.send({ t: 'start' }); });
    $$('[data-timer]', bottom).forEach((b) => b.addEventListener('click', () => { audio.play('click'); S.session.send({ t: 'settings', settings: { timer: +b.dataset.timer } }); }));
  }
}

function lobbyEmote(m) {
  const c = $(`.chick[data-pid="${m.pid}"]`, app);
  if (m.id === 'left') { toast(`${m.name || 'A player'} left`); return; }
  if (m.id === 'joined' && c) { fx.burst(c, { type: 'feather', count: 10 }); }
}

/* ================= game ================= */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* not supported or denied */ }
}
document.addEventListener('visibilitychange', () => { if (S.screen === 'game' || S.screen === 'lobby') keepAwake(true); });

function showGame() {
  teardown();
  keepAwake(true);
  S.screen = 'game';
  document.body.className = 'on-game';
  S.game = new GameUI(app, {
    session: S.session, me: S.pid, room: S.room,
    onRules: showRules, onLeave: (force) => leave(force),
    onCopy: () => copy(inviteLink(), 'Invite link copied!'),
  });
}

/* ================= rules ================= */
function showRules() {
  audio.play('open');
  const act = (id) => { const A = ACTIONS[id]; return `<div class="ru-act"><span class="ru-ic">${A.claim ? characterSVG(A.claim) : iconSVG(id)}</span><div><b>${A.name}</b> <small>${A.claim ? 'claim ' + ROLES[A.claim].name : 'anyone'}</small><p>${esc(A.desc)}</p></div></div>`; };
  modal(`
    <h2>How to play</h2>
    <p class="lead">Every player secretly holds <b>2 cards</b> and starts with <b>2 corn</b>. Lose both cards and you're out of the coop. <b>The last bird standing rules the roost.</b></p>
    <h3>On your turn, do one thing</h3>
    <div class="ru-grid">${['peck', 'forage', 'barnstorm'].map(act).join('')}</div>
    <p>Or claim one of the barnyard characters and use its power — <b>whether or not you actually hold that card</b>:</p>
    <div class="ru-cast">${ROLE_IDS.map((r) => `<div class="ru-role">${cardFront(r)}</div>`).join('')}</div>
    <h3>Challenge!</h3>
    <p>Whenever someone claims a character (to act <i>or</i> to block), anyone can call their bluff.
    If they really have it, they show it, shuffle it back for a fresh card, and the challenger loses a card.
    If they were bluffing, <b>they</b> lose a card and their move fails (any corn they paid comes back).</p>
    <h3>Blocks</h3>
    <p><b>Harvest</b> can be blocked by anyone claiming the Rooster. An <b>Attack</b> can be blocked by its target claiming the Goose.
    A <b>Snatch</b> can be blocked by its target claiming the Raccoon or the Owl. Blocks are claims too, so they can be challenged.</p>
    <h3>Losing cards</h3>
    <p>When you lose a card you choose which one, and it's turned face-up for all to see. Lost cards are useful intel: there are only <b>3 of each character</b> in the deck.</p>
    <h3>Tips</h3>
    <ul><li>With <b>10+ corn</b> you must use <b>Knockout</b>.</li><li>In a 2-player game the first player starts with 1 corn.</li>
    <li>If you drop out mid-game, rejoin with the same code on the same device. A bot covers you after 45 seconds.</li></ul>
  `, { cls: 'rules', onClose: () => audio.play('close') });
}

/* ================= boot ================= */
/* ================= install as an app (PWA) ================= */
const ICON_PHONE = '<svg viewBox="0 0 24 24" class="li-ic"><rect x="6" y="2" width="12" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v7m-3-3 3 3 3-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="18.5" r="1" fill="currentColor"/></svg>';
const ICON_SHARE = '<svg viewBox="0 0 24 24" class="li-ic"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
function isStandalone() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });
addEventListener('appinstalled', () => { installEvt = null; toast('Installed! Open Pecking Order from your home screen.'); $('#install')?.remove(); });

async function installApp() {
  audio.play('click');
  if (installEvt) {
    const evt = installEvt;
    installEvt = null;
    evt.prompt();
    try { await evt.userChoice; } catch (e) { /* ignore */ }
    return;
  }
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const iosSteps = `<div class="inst-card ${ios ? 'here' : ''}"><h3>iPhone &amp; iPad</h3><ol>
      <li>Open this page in <b>Safari</b>.</li>
      <li>Tap the <b>Share</b> button <span class="inl">${ICON_SHARE}</span> (bottom of the screen on iPhone).</li>
      <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol></div>`;
  const androidSteps = `<div class="inst-card ${android ? 'here' : ''}"><h3>Android</h3><ol>
      <li>Open this page in <b>Chrome</b>.</li>
      <li>Tap the <b>⋮</b> menu (top right).</li>
      <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li></ol></div>`;
  const desktopSteps = `<div class="inst-card ${!ios && !android ? 'here' : ''}"><h3>Laptop / desktop</h3><ol>
      <li>In <b>Chrome</b> or <b>Edge</b>, click the install icon at the right end of the address bar,</li>
      <li>or open the browser menu and choose <b>Install Pecking Order</b>.</li></ol></div>`;
  const order = ios ? [iosSteps, androidSteps, desktopSteps] : android ? [androidSteps, iosSteps, desktopSteps] : [desktopSteps, androidSteps, iosSteps];
  audio.play('open');
  modal(`<div class="inst-head"><img src="icons/icon-192.png" alt="" width="72" height="72"><div><h2>Get the app</h2>
    <p>Pecking Order installs straight from your browser. No app store needed. It gets its own icon, opens full-screen, and Practice mode even works offline.</p></div></div>
    <div class="inst-grid">${order.join('')}</div>`, { cls: 'install', onClose: () => audio.play('close') });
}

const hadSW = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // a new version was installed: refresh right away if nobody is mid-game, otherwise it applies next launch
    if (hadSW && !reloading && S.screen === 'home' && !S.session) { reloading = true; location.reload(); }
  });
}

const urlCode = normCode(params.get('room'));
const saved = Host.saved();
const last = load('po_last', null);
if (urlCode && saved && saved.code === urlCode) {
  showHome(urlCode);
  resumeHost(saved);
} else if (urlCode && last && last.code === urlCode && Date.now() - last.at < 3 * 3600e3 && S.name) {
  showHome(urlCode);
  joinRoom(urlCode);
} else {
  showHome(urlCode);
}
window.__po = S; // handy for debugging

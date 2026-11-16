// Pecking Order service worker: makes the game installable and lets it start offline.
// VERSION is stamped by `node tools/stamp-sw.mjs` (a hash of every file in ASSETS) — run it before each deploy.
const VERSION = 'e0c0e2420311';
const CACHE = 'po-' + VERSION;
const RUNTIME = 'po-runtime';
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "favicon.svg",
  "css/art.css",
  "css/style.css",
  "js/art.js",
  "js/audio.js",
  "js/bot.js",
  "js/dom.js",
  "js/engine.js",
  "js/fx.js",
  "js/game.js",
  "js/host.js",
  "js/main.js",
  "js/net.js",
  "js/roles.js",
  "js/session.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-192.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('po-') && k !== CACHE && k !== RUNTIME).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    const scope = new URL(self.registration.scope);
    const rel = url.pathname.slice(scope.pathname.length);
    if (req.mode === 'navigate') {
      // the app itself (any ?room=… link) comes from the cache; other pages (dev/…) go to the network
      if (rel === '' || rel === 'index.html') {
        e.respondWith(caches.match('index.html', { cacheName: CACHE }).then((r) => r || fetch(req)));
      }
      return;
    }
    e.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((r) => r || fetch(req)));
    return;
  }
  // Fonts and the networking libraries: serve cached copy, refresh in the background.
  if (/^(fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)$/.test(url.hostname)) {
    e.respondWith(caches.open(RUNTIME).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});

// Bump VERSION on every deploy — the app reloads itself onto the new version.
const VERSION = 'puffkins-v1.1.3';
const ASSETS = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'fonts/mplusrounded-500.woff2', 'fonts/mplusrounded-800.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'assets/rooms/boba.webp',
  'assets/rooms/bunny.webp',
  'assets/rooms/snow.webp',
  'assets/puffs/boba-base.webp',
  'assets/puffs/boba-chew.webp',
  'assets/puffs/boba-dirty.webp',
  'assets/puffs/boba-eat.webp',
  'assets/puffs/boba-sad.webp',
  'assets/puffs/boba-sick.webp',
  'assets/puffs/boba-sleep.webp',
  'assets/puffs/bunny-base.webp',
  'assets/puffs/bunny-chew.webp',
  'assets/puffs/bunny-dirty.webp',
  'assets/puffs/bunny-drowsy.webp',
  'assets/puffs/bunny-eat.webp',
  'assets/puffs/bunny-sad.webp',
  'assets/puffs/bunny-sick.webp',
  'assets/puffs/bunny-sleep.webp',
  'assets/puffs/bunny-verysad.webp',
  'assets/puffs/snow-base.webp',
  'assets/puffs/snow-chew.webp',
  'assets/puffs/snow-dirty.webp',
  'assets/puffs/snow-eat.webp',
  'assets/puffs/snow-sad.webp',
  'assets/puffs/snow-sick.webp',
  'assets/puffs/snow-sleep.webp',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('puffkins-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// network first (always fresh when online), cache as offline fallback
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});

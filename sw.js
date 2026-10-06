// Работа без сети: сначала из кэша. Меняешь файлы сайта — подними CACHE.
const CACHE = 'slog-v5';
const FILES = ['./', 'index.html', 'css/slog.css', 'js/data.js', 'js/store.js', 'js/app.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'sprites/cat-peek.png', 'sprites/star-yellow.png', 'fonts/fonts.css',
  'fonts/nunito-normal-cyrillic.woff2', 'fonts/nunito-normal-latin.woff2', 'fonts/nunito-italic-cyrillic.woff2',
  'fonts/nunito-italic-latin.woff2', 'fonts/mplus-normal-cyrillic.woff2', 'fonts/mplus-normal-latin.woff2'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});

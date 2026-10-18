const VER = '202610181508';
const CACHE = 'zadza-' + VER;
const FILES = ['./', 'index.html', 'style.css?v=' + VER, 'fonts.css?v=' + VER, 'data.js?v=' + VER, 'app.js?v=' + VER, 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'fonts/bodoni-moda-latin-wght-normal.woff2', 'fonts/bodoni-moda-latin-ext-wght-normal.woff2',
  'fonts/bodoni-moda-latin-wght-italic.woff2', 'fonts/bodoni-moda-latin-ext-wght-italic.woff2',
  'fonts/instrument-sans-latin-wght-normal.woff2', 'fonts/instrument-sans-latin-ext-wght-normal.woff2'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match(e.request, { ignoreSearch: true })).then(r => r ||
    fetch(e.request).then(res => { const c = res.clone(); caches.open(CACHE).then(ch => ch.put(e.request, c)); return res; })
      .catch(() => caches.match('index.html'))));
});

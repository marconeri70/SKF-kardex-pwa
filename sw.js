
const CACHE = 'kardex-clean-v1';
const ASSETS = ['/', '/index.html', '/app.js', '/manifest.webmanifest', '/assets/icon-192.png', '/assets/icon-512.png', '/data/kardex.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE && caches.delete(k)))));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

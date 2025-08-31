const CACHE_NAME = 'kardex-cache-v5';
const ASSETS = [
  './',
  './index.html',
  './app.js?v=5',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './data/kardex.json',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request).then(fresp => {
      const clone = fresp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone)).catch(()=>{});
      return fresp;
    }).catch(()=>resp))
  );
});

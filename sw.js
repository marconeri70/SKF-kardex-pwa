const CACHE_NAME = 'kardex-cache-v11';

const ASSETS = [
  './manifest.webmanifest?v=11',
  './assets/icon-192.png?v=11',
  './assets/icon-512.png?v=11',
  './data/kardex.json',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Network-first per HTML e app.js
  const isHTML = req.mode === 'navigate' || (req.destination === 'document');
  if (isHTML || url.pathname.endsWith('/app.js')) {
    e.respondWith(
      fetch(req).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Network-first per icone
  if (url.pathname.includes('/assets/icon-') && url.pathname.endsWith('.png')) {
    e.respondWith(
      fetch(req).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first per il resto
  e.respondWith(
    caches.match(req).then(resp => resp || fetch(req).then(fresp => {
      const clone = fresp.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, clone));
      return fresp;
    }).catch(()=>resp))
  );
});




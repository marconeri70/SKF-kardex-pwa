const CACHE_NAME = 'kardex-cache-v16';
const ASSETS = [
  './manifest.webmanifest?v=16',
  './assets/icon-192.png?v=16',
  './assets/icon-512.png?v=16',
  './data/kardex.json',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  const isHTML = req.mode === 'navigate' || (req.destination === 'document');
  if (isHTML || url.pathname.endsWith('/app.js')) {
    e.respondWith(
      fetch(req).then(resp => { caches.open(CACHE_NAME).then(c => c.put(req, resp.clone())); return resp; })
                .catch(() => caches.match(req))
    );
    return;
  }
  if (url.pathname.includes('/assets/icon-') && url.pathname.endsWith('.png')) {
    e.respondWith(
      fetch(req).then(resp => { caches.open(CACHE_NAME).then(c => c.put(req, resp.clone())); return resp; })
                .catch(() => caches.match(req))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(resp => resp || fetch(req).then(fr => { caches.open(CACHE_NAME).then(c => c.put(req, fr.clone())); return fr; }).catch(()=>resp))
  );
});

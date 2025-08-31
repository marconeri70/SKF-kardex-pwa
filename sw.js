const CACHE_NAME = 'kardex-cache-v6';

// Assets statici da cache-first
const ASSETS = [
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
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Network-first per HTML e navigazioni (index, root)
  const isHTML = req.mode === 'navigate' || 
                 (req.destination === 'document') ||
                 url.pathname.endsWith('/') || 
                 url.pathname.endsWith('/index.html');

  if (isHTML) {
    e.respondWith(
      fetch(req).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => 
          cache.put(url.pathname === '/' ? './' : req.url, clone)
        ).catch(()=>{});
        return resp;
      }).catch(() => 
        caches.match(req).then(c => c || caches.match('./index.html'))
      )
    );
    return;
  }

  // Network-first anche per app.js e sw.js (così si aggiornano subito)
  if (url.pathname.endsWith('/app.js') || url.pathname.endsWith('/sw.js')) {
    e.respondWith(
      fetch(req).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(()=>{});
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first per tutto il resto
  e.respondWith(
    caches.match(req).then(resp => resp || fetch(req).then(fresp => {
      const clone = fresp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(()=>{});
      return fresp;
    }).catch(()=>resp))
  );
});


const CACHE_NAME = 'kardex-cache-v17';
const ASSETS = [
  './manifest.webmanifest?v=17',
  './assets/icon-192.png?v=17',
  './assets/icon-512.png?v=17',
  './data/kardex.json',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
});
self.addEventListener('fetch', e=>{
  const req=e.request, url=new URL(req.url);
  const isHTML = req.mode==='navigate' || req.destination==='document';
  if (isHTML || url.pathname.endsWith('/app.js')) {
    e.respondWith(fetch(req).then(r=>{caches.open(CACHE_NAME).then(c=>c.put(req,r.clone())); return r;}).catch(()=>caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req).then(r=> r || fetch(req).then(fr=>{caches.open(CACHE_NAME).then(c=>c.put(req,fr.clone())); return fr;})));
});

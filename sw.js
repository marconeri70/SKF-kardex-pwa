const CACHE_NAME = 'kardex-cache-v39.9';
const ASSETS = [
  './manifest.webmanifest?v=30.1',
  './assets/icon-192.png?v=30.1',
  './assets/icon-512.png?v=30.1',
  './data/kardex.json',
  './data/warehouse-index-2026.json',
  './app.js?v=39.9',
  './cloud.js?v=39.9',
  './index.html?v=39.9',
  './catalogo.html?v=37.2',
  './ripiano.html'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'||req.destination==='document'){
    event.respondWith(fetch(req,{cache:'no-store'}).then(res=>{
      if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(req,copy)));}
      return res;
    }).catch(()=>caches.match(req).then(cached=>cached||caches.match('./index.html?v=30.1'))));
    return;
  }
  if(url.pathname.endsWith('/app.js')||url.pathname.endsWith('/cloud.js')){
    event.respondWith(fetch(req,{cache:'no-store'}).then(res=>{
      if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(req,copy)));}
      return res;
    }).catch(()=>caches.match(req)));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
    if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(req,copy)));}
    return res;
  })));
});


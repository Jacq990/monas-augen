const CACHE='monas-augen-final-v9';
const CORE=['./','index.html','styles.css?v=8','app.js?v=8','artworks.json','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','favicon.png','social-preview.jpg'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('./',copy));
          return response;
        })
        .catch(()=>caches.match(event.request).then(response=>response||caches.match('./')))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response=>response||fetch(event.request).then(networkResponse=>{
      const copy=networkResponse.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return networkResponse;
    }))
  );
});

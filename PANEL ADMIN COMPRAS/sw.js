/* Service Worker — Ferretería Oviedo Compras — oviedo-v20260513-1643 */
const CACHE='oviedo-v20260513-1643';
const ASSETS=['/oviedo-COMPRAS.html','/index.html','/data/compras.json','/logo_oviedo.jpg','/logo_oviedo_white.jpg'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return c.addAll(ASSETS.map(function(u){return new Request(u,{cache:'reload'});})
    ).catch(function(){});
  }));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);})
    ).then(function(){return self.clients.claim();});
  }));
});
self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET')return;
  e.respondWith(caches.open(CACHE).then(function(cache){
    return cache.match(e.request).then(function(cached){
      var net=fetch(e.request).then(function(resp){
        if(resp&&resp.ok)cache.put(e.request,resp.clone());
        return resp;
      }).catch(function(){return cached;});
      return cached||net;
    });
  }));
});
self.addEventListener('message',function(e){
  if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting();
});

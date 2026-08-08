// Digging Deep — service worker
// Strategy: precache the app shell (small, changes often); network-first for
// everything else with a short timeout, falling back to a cached copy if one
// exists. Nothing ever blocks on the cache — if the browser's local cache
// storage is stuck or over quota, requests still complete via the network
// instead of hanging forever.
var CACHE_VERSION = 'dd-cache-v2';
var SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache){
      return cache.addAll(SHELL_FILES);
    }).then(function(){ return self.skipWaiting(); }).catch(function(){ })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_VERSION; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); }).catch(function(){ })
  );
});

function timeoutAfter(ms, value){
  return new Promise(function(resolve){ setTimeout(function(){ resolve(value); }, ms); });
}

self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  var networkPromise = fetch(req).then(function(res){
    if(res && res.status === 200){
      caches.open(CACHE_VERSION).then(function(cache){
        cache.put(req, res.clone()).catch(function(){ });
      }).catch(function(){ });
    }
    return res;
  }).catch(function(){ return null; });

  event.respondWith(
    Promise.race([networkPromise, timeoutAfter(5000, null)]).then(function(res){
      if(res) return res;
      return Promise.race([caches.match(req), timeoutAfter(3000, null)]).then(function(cached){
        if(cached) return cached;
        return networkPromise.then(function(res2){
          return res2 || new Response('Offline and no cached copy available.', {status: 503, statusText: 'Offline'});
        });
      });
    }).catch(function(){
      return new Response('Offline and no cached copy available.', {status: 503, statusText: 'Offline'});
    })
  );
});

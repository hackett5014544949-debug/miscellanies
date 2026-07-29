// Digging Deep — service worker
// Strategy: precache the app shell (small, changes often); runtime cache-first
// for everything else (the Bible/reference JSON files are large and effectively
// static, so once fetched once they're kept for offline use and only refreshed
// when the cache version below is bumped).
var CACHE_VERSION = 'dd-cache-v1';
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
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_VERSION; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return; // don't intercept Google Fonts etc.

  event.respondWith(
    caches.match(req).then(function(cached){
      var networkFetch = fetch(req).then(function(res){
        if(res && res.status === 200){
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function(cache){ cache.put(req, copy); });
        }
        return res;
      }).catch(function(){ return cached; });
      // Cache-first for the big static reference/data files so the app keeps
      // working fully offline once they've been loaded once; otherwise prefer
      // the network so edits to index.html show up promptly, falling back to
      // cache if offline.
      if(cached && /\.json$/.test(url.pathname)) return cached;
      return networkFetch.then(function(res){ return res; }).catch(function(){ return cached; });
    })
  );
});

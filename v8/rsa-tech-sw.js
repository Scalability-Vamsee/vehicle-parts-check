// RSA Tech — Service Worker (network-first, install shell for offline fallback)
const CACHE = 'rsa-tech-v1';
const PRECACHE = [
  'rsa-tech.html',
  'rsa-tech-manifest.json',
  '../logo.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
  // Notify clients about update
  self.clients.matchAll({type:'window'}).then(cls =>
    cls.forEach(cl => cl.postMessage({type:'SW_UPDATED'}))
  );
});

// Network-first: always try live; fall back to cache for shell assets only
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (
    url.hostname.includes('supabase') ||
    url.hostname.includes('cdn.jsdelivr') ||
    url.hostname.includes('fonts.googleapis') ||
    url.hostname.includes('fonts.gstatic') ||
    url.protocol === 'chrome-extension:'
  ) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Refresh cache on successful live fetch
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

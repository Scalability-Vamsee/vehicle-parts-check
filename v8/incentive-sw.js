// Incentive Portal — Service Worker (network-first, cache only as an offline fallback)
// incentive.html is DELIBERATELY NOT precached: it changes on every deploy (this project pushes
// it frequently — see fleetpro/docs/PUSH-DISCIPLINE.md), and a precached copy would get served as
// a silent fallback on any flaky-network fetch, showing techs an arbitrarily stale version with no
// indication anything was wrong. Instead, the fetch handler below caches each same-origin asset
// AS OF ITS LAST SUCCESSFUL LOAD, so if a fallback is ever needed it's the most recent good copy,
// not an install-time snapshot.
const CACHE = 'incentive-v2';
const PRECACHE = [
  'incentive-manifest.json',
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
      // notify open tabs so they can prompt a reload onto the new version
      .then(() => self.clients.matchAll({type: 'window'}))
      .then(clients => clients.forEach(c => c.postMessage({type: 'SW_UPDATED'})))
  );
});

// Network-first: always try live data; opportunistically refresh the fallback cache on success;
// fall back to the last-known-good cached copy only if the network fetch fails outright.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Pass through Supabase, CDN, fonts — never cache these
  if (
    url.hostname.includes('supabase') ||
    url.hostname.includes('unpkg') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('cdnjs') ||
    url.protocol === 'chrome-extension:'
  ) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && e.request.method === 'GET') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

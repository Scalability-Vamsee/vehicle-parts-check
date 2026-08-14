// RSA Tech — Service Worker v3
// Handles: network-first caching, Web Push notifications, background ticket polling
const CACHE = 'rsa-tech-v3';
const SB_URL = 'https://clkfvmmlgwcvntxnolsv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsa2Z2bW1sZ3djdm50eG5vbHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDQ2NTgsImV4cCI6MjA5MDEyMDY1OH0.FA33GFQisWX_hDeGCWqL5yAZmPcuQRdxZX32I23lyoY';

const PRECACHE = ['rsa-tech.html', 'rsa-tech-manifest.json', '../logo.jpg'];

// Background polling state (in-memory; resets if SW is killed)
let _authToken = null;
let _techName = null;
let _seenTickets = new Set();
let _pollTimer = null;

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
  // Notify any open clients that there's a new SW version
  self.clients.matchAll({ type: 'window' }).then(cls =>
    cls.forEach(cl => cl.postMessage({ type: 'SW_UPDATED' }))
  );
});

// ── Fetch: network-first, cache shell on success ──────────────────────────────
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
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── Web Push: show notification when server sends a push ──────────────────────
// (Phase 2: requires VAPID setup. Handled here so future push works automatically.)
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title || '🔔 New RSA Ticket', {
      body: data.body || 'Tap to view your ticket',
      icon: '/v8/icon-192.png',
      badge: '/v8/icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      data: { url: '/v8/rsa-tech.html', ticketNumber: data.ticketNumber },
      tag: data.ticketNumber ? 'rsa-ticket-' + data.ticketNumber : 'rsa-alert',
      renotify: true
    })
  );
});

// ── Notification click: focus or open the PWA ────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/v8/rsa-tech.html';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes('rsa-tech.html'));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});

// ── Messages from main thread ─────────────────────────────────────────────────
self.addEventListener('message', e => {
  if (!e.data) return;
  switch (e.data.type) {
    case 'SET_AUTH':
      _authToken = e.data.token;
      _techName  = e.data.techName;
      startBgPoll();
      break;
    case 'CLEAR_AUTH':
      _authToken = null;
      _techName  = null;
      stopBgPoll();
      _seenTickets.clear();
      break;
    case 'MARK_SEEN':
      // Main thread reports which tickets are already accepted — avoid re-alerting
      (e.data.tickets || []).forEach(t => _seenTickets.add(t));
      break;
  }
});

// ── Background polling (60s) — fires when app is backgrounded / minimised ────
function startBgPoll() {
  if (_pollTimer) return;
  _pollTimer = setInterval(pollNewTickets, 60000);
}

function stopBgPoll() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

async function pollNewTickets() {
  if (!_authToken || !_techName) return;
  try {
    // Use prefix wildcard so "Karan Luitel" matches "Karan Luitel (BLR)" etc.
    const res = await fetch(
      SB_URL + '/rest/v1/rsa_tickets_cache'
        + '?technician_name=ilike.' + encodeURIComponent(_techName + '%')
        + '&select=ticket_number,reg_number,category,fault_details'
        + '&order=created_at_ist.desc&limit=20',
      { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + _authToken } }
    );
    if (!res.ok) return;
    const tickets = await res.json();

    for (const t of tickets) {
      if (_seenTickets.has(t.ticket_number)) continue;

      // Check if already accepted by this tech
      const evRes = await fetch(
        SB_URL + '/rest/v1/ticket_events'
          + '?ticket_number=eq.' + encodeURIComponent(t.ticket_number)
          + '&event_type=eq.accepted&select=id&limit=1',
        { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + _authToken } }
      );
      if (!evRes.ok) continue;
      const evs = await evRes.json();

      if (evs.length > 0) {
        _seenTickets.add(t.ticket_number); // already accepted — mark seen
        continue;
      }

      // New unaccepted ticket — notify!
      _seenTickets.add(t.ticket_number);
      await self.registration.showNotification('🔔 New RSA Ticket', {
        body: (t.reg_number || '') + (t.category ? ' — ' + t.category : ''),
        icon: '/v8/icon-192.png',
        badge: '/v8/icon-192.png',
        vibrate: [300, 100, 300, 100, 300],
        data: { url: '/v8/rsa-tech.html', ticketNumber: t.ticket_number },
        tag: 'rsa-ticket-' + t.ticket_number,
        renotify: false
      });
    }
  } catch (err) {
    console.warn('[RSATech SW] poll error', err);
  }
}

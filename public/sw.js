// DoranDoran Service Worker — safe static asset caching
//
// Strategy:
// - Hashed assets (/assets/*): Cache-first (immutable by design — content change = new filename)
// - Navigation (HTML): Network-only (always get latest asset references)
// - Firebase/external: Never cache (real-time data must be fresh)
// - Everything else: Network-only
//
// This is the safest possible caching strategy because:
// 1. Hashed files can NEVER be stale (hash changes when content changes)
// 2. index.html is never cached → new deployments work immediately
// 3. Firebase data is never cached → always real-time

const CACHE_NAME = 'dorandoran-assets-v3';

// Install: activate immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate: clean up old caches, take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: only cache hashed static assets from /assets/
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only cache same-origin requests under /assets/ (Vite's hashed output)
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/assets/')) return;

  // Cache-first for hashed assets (they're immutable)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

const CACHE_NAME = 'diso-commander-shell-v2';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/favicon-32.png',
  '/favicon-16.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png'
];

// The install step caches the static shell plus the hashed build assets that
// Vite injects into index.html, so offline reloads work without a PWA plugin.
async function collectShellAssets() {
  const response = await fetch('/index.html', { cache: 'no-store' });
  const html = await response.text();
  const assetMatches = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g), ([, assetPath]) => assetPath);

  return [...new Set([...APP_SHELL_URLS, ...assetMatches.filter((assetPath) => assetPath.startsWith('/'))])];
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const shellAssets = await collectShellAssets();
      await cache.addAll(shellAssets);
      await self.skipWaiting();
    })()
  );
});

// Old cache buckets are removed eagerly so the icon set and built assets stay
// aligned with whichever version of the app the current worker controls.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put('/index.html', networkResponse.clone());
          return networkResponse;
        } catch (error) {
          const cachedResponse = await caches.match(request);
          return cachedResponse ?? (await caches.match('/index.html'));
        }
      })()
    );
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // Same-origin assets use stale-while-revalidate so the app can start from
  // cache immediately while keeping future visits updated in the background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);
      const networkResponsePromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        return cachedResponse;
      }

      const networkResponse = await networkResponsePromise;
      if (networkResponse) {
        return networkResponse;
      }

      return new Response('Offline', {
        status: 503,
        statusText: 'Offline'
      });
    })()
  );
});

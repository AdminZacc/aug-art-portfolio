/* Service Worker for aug-art-portfolio */
/* Version */
const SW_VERSION = 'v1.0.1';
const PRECACHE_NAME = `precache-${SW_VERSION}`;
const RUNTIME_CACHE = 'runtime';
const IMAGE_CACHE = 'images-v1';
const API_CACHE = 'api-artworks-v1';

// Core assets to pre-cache (add others as needed)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './admin.html',
  './admin.js',
  './auth.html',
  './auth.js',
  './config.public.js',
  './config.example.js',
  './offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![PRECACHE_NAME, RUNTIME_CACHE, IMAGE_CACHE, API_CACHE].includes(k))
          .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isImageRequest(request) {
  return request.destination === 'image' || /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(new URL(request.url).pathname);
}

function isSupabaseArtworks(request) {
  if (request.method !== 'GET') return false;
  const u = new URL(request.url);
  // Only handle same-origin API (avoid intercepting cross-origin Supabase calls)
  if (u.origin !== self.location.origin) return false;
  return /\/rest\/v1\/artworks/i.test(u.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle http(s)
  if (!/^https?:/.test(url.protocol)) return;

  // Navigation requests: network-first fallback to offline page
  if (request.mode === 'navigate') {
    event.respondWith(
  fetch(request).catch(() => caches.match('./offline.html') || caches.match('./index.html'))
    );
    return;
  }

  // Images: cache-first with limit
  if (isImageRequest(request)) {
    event.respondWith(cacheFirstLimit(request, IMAGE_CACHE, 70));
    return;
  }

  // Supabase artworks GET: stale-while-revalidate
  if (isSupabaseArtworks(request)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Default: try cache, then network
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(resp => {
      const copy = resp.clone();
      // Optionally cache static same-origin GET
      if (request.method === 'GET' && url.origin === self.location.origin) {
        caches.open(RUNTIME_CACHE).then(c => c.put(request, copy));
      }
      return resp;
    }))
  );
});

async function cacheFirstLimit(request, cacheName, maxEntries = 60) {
  const cache = await caches.open(cacheName);
  const match = await cache.match(request);
  if (match) return match;
  try {
    const response = await fetch(request, { mode: request.mode, credentials: request.credentials });
    if (response.ok) {
      await cache.put(request, response.clone());
      trimCache(cache, maxEntries);
    }
    return response;
  } catch (e) {
    return match || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedPromise = cache.match(request);
  const networkPromise = fetch(request)
    .then(resp => { if (resp.ok) cache.put(request, resp.clone()); return resp; })
    .catch(() => undefined);
  const cached = await cachedPromise;
  return cached || networkPromise || fetch(request);
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const removals = keys.slice(0, keys.length - maxEntries);
  await Promise.all(removals.map(k => cache.delete(k)));
}

// Listen for skipWaiting message for future upgrades
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

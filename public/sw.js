/* eslint-disable no-restricted-globals */
/**
 * Service Worker - PWA Offline-First
 * Security-First, Zero-Trust. Alcance mínimo.
 * Las URLs de precache se inyectan en build (scripts/inject-precache.mjs).
 */
const CACHE_STATIC = 'static-v1';
const CACHE_DYNAMIC = 'content-v1';
const MAX_DYNAMIC_ENTRIES = 50;
// Inyectado en build: scripts/inject-precache.mjs
const STATIC_PRECACHE = '__PRECACHE_URLS__';

// Rutas que NUNCA deben cachearse (APIs sensibles, administración)
const NO_CACHE_PATHS = [
  '/api/profile',
  '/api/profile/photo',
  '/api/actions/consume',
  '/api/cron/',
];

function shouldNotCache(url) {
  const path = new URL(url).pathname;
  return NO_CACHE_PATHS.some(p => path.startsWith(p));
}

self.addEventListener('install', (event) => {
  const urls = Array.isArray(STATIC_PRECACHE)
    ? STATIC_PRECACHE
    : (typeof STATIC_PRECACHE === 'string' && STATIC_PRECACHE !== '__PRECACHE_URLS__'
      ? JSON.parse(STATIC_PRECACHE) : ['/', '/manifest.webmanifest']);

  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(urls);
    }).then(() => self.skipWaiting())
    .catch((err) => {
      console.warn('[SW] Precache falló, continuando:', err);
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_STATIC && key !== CACHE_DYNAMIC) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stale-while-revalidate para App Shell; cache-first para navegación
async function handleFetch(request) {
  if (request.method !== 'GET') return fetch(request);
  const url = request.url;
  if (shouldNotCache(url)) return fetch(request);

  const parsed = new URL(url);
  const isNav = parsed.pathname === '/' || parsed.pathname === '/index.html';
  const isAsset = parsed.pathname.startsWith('/assets/') || parsed.pathname === '/manifest.webmanifest';

  if (isNav || isAsset) {
    const cached = await caches.match(request);
    const p = fetch(request).then((res) => {
      if (res.ok && !shouldNotCache(url)) {
        const clone = res.clone();
        caches.open(CACHE_STATIC).then((c) => c.put(request, clone));
      }
      return res;
    });
    return cached || p;
  }

  // Contenido dinámico público (ej. futuras APIs de feed)
  if (parsed.pathname.startsWith('/api/') && !shouldNotCache(url)) {
    const cached = await caches.match(request);
    const p = fetch(request).then(async (res) => {
      if (res.ok) {
        const cache = await caches.open(CACHE_DYNAMIC);
        await cache.put(request, res.clone());
        const keys = await cache.keys();
        if (keys.length > MAX_DYNAMIC_ENTRIES) {
          await cache.delete(keys[0]);
        }
      }
      return res;
    }).catch(() => cached || new Response('{ "error": "Sin conexión" }', {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }));
    return cached || p;
  }

  return fetch(request);
}

self.addEventListener('fetch', (event) => {
  event.respondWith(handleFetch(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-denuncias') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'SYNC_OFFLINE_QUEUE' }));
      })
    );
  }
});

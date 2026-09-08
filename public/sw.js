// Service Worker para APPles Financial PWA (Android & Web)
const CACHE_NAME = 'apples-fin-v25';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js?v=25',
  '/index.css?v=25',
  '/manifest.json'
];

// Instalación del Service Worker: Pre-guardar activos para validez PWA
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => console.log('PWACache warning:', err));
    })
  );
  self.skipWaiting();
});

// Activación del Service Worker: eliminar cachés obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia Network-First con Fallback en Caché (PWA Compliance)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, guardar copia en caché para offline
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

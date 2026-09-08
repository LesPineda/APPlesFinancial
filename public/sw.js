// Service Worker para APPles Financial PWA (Android & Web)
const CACHE_NAME = 'apples-fin-v20';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js?v=20',
  '/index.css?v=20',
  '/manifest.json'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activación del Service Worker: eliminar todos los cachés viejos inmediatamente
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Estrategia Network Only / Network First con Fallback para recursos estáticos
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Forzar siempre obtener la última versión desde la red
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

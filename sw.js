// ============================================================
// sw.js — Ferretería Oviedo — Service Worker
// Bloque 4: PWA Update Banner — detección de nueva versión
// BUILD_DATE se actualiza automáticamente al hacer deploy
// ============================================================

var BUILD_DATE = '2026-05-25 10:39:13'; // ← actualizado por update-sw-version.js
var CACHE_NAME = 'oviedo-' + BUILD_DATE.replace(/[^0-9]/g,'').slice(0,12);

// Assets estáticos que se cachean en instalación (NO incluir HTML)
var PRECACHE_ASSETS = [
  '/firebase-config.js',
  '/logo_oviedo.jpg',
  '/logo_oviedo_white.jpg',
  '/manifest.json',
  '/manifest-admin.json',
  '/manifest-cliente.json'
];

// Extensiones que se sirven desde caché (Cache-First)
var CACHE_FIRST_EXTS = ['.js', '.css', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.woff', '.woff2', '.ico'];

// ── INSTALL: pre-cachear assets estáticos ───────────────────
self.addEventListener('install', function(event) {
  // NO skipWaiting aquí: esperar que el banner lo pida
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_ASSETS).catch(function() { /* continuar aunque falle */ });
    })
  );
});

// ── ACTIVATE: limpiar caches anteriores ────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k)   { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim(); // tomar control de todas las pestañas inmediatamente
    })
  );
});

// ── FETCH ──────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Solo manejar GET del mismo origen
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Nunca cachear Firestore / Firebase APIs / Google CDN / Datos.json / sw.js mismo
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com') ||
      url.hostname.includes('fonts.google') ||
      url.pathname.includes('Datos.json') ||
      url.pathname === '/sw.js') return;

  // ── NAVIGATION (HTML) → Network-First ──────────────────
  // Siempre intentar red primero; solo fallback a caché si sin conexión
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/') {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          // Guardar copia fresca en caché (para offline)
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function() {
        // Sin red → servir desde caché
        return caches.match(event.request).then(function(cached) {
          return cached || new Response('<h2>Sin conexión</h2><p>Necesitas internet para acceder por primera vez.</p>',
            { status: 503, headers: { 'Content-Type': 'text/html' } });
        });
      })
    );
    return;
  }

  // ── ASSETS ESTÁTICOS → Cache-First ─────────────────────
  var ext = url.pathname.substring(url.pathname.lastIndexOf('.')).toLowerCase();
  if (CACHE_FIRST_EXTS.indexOf(ext) !== -1) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response && response.status === 200 && response.type === 'basic') {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
          }
          return response;
        });
      })
    );
    return;
  }

  // Resto: pasar directo a la red sin cachear
});

// ── SKIP_WAITING: recibe mensaje del banner ────────────────
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

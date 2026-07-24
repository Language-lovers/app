const CACHE_NAME = 'lovelang-v1';
const ASSETS = [
  'index.html',
  'style.css',
  'app.js',
  'phrases.js',
  'bg.jpg'
];

// Install the background service and save assets into phone memory
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Serve assets directly from phone memory when offline
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});

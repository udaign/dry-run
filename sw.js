const CACHE_NAME = 'matrices-cache-v1';
const urlsToCache = [
  '/matrices/',
  '/matrices/index.html',
  '/matrices/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap',
  '/matrices/public/images/favicon.png',
  '/matrices/public/images/icon-192x192.png',
  '/matrices/public/images/icon-512x512.png',
  '/matrices/public/images/maskable-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response; // Cache hit
        }

        // Not in cache, fetch from network
        return fetch(event.request).then(
          (response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200) {
              return response;
            }
            
            // Only cache responses from http/https protocols.
            if(!response.url || !response.url.startsWith('http')) {
                return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(err => {
            console.error('Fetch failed; returning offline page instead.', err);
            // You can return a fallback offline page here if you have one.
        });
      })
    );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Service Worker sa error handling-om
const CACHE_NAME = 'twitter-blocked-users-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Cache install failed:', error);
        // Ignoriši greške od browser ekstenzija
        if (error.message && error.message.includes('chrome-extension')) {
          console.log('Ignoring chrome-extension cache error');
          return;
        }
        throw error;
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Vrati cached verziju ili fetch iz mreže
        return response || fetch(event.request);
      })
      .catch((error) => {
        console.log('Fetch failed:', error);
        // Ignoriši greške od browser ekstenzija
        if (error.message && error.message.includes('chrome-extension')) {
          console.log('Ignoring chrome-extension fetch error');
          return new Response('', { status: 200 });
        }
        throw error;
      })
  );
});

// Error handling za sve neuhvaćene greške
self.addEventListener('error', (event) => {
  if (event.message && event.message.includes('chrome-extension')) {
    console.log('Ignoring chrome-extension error:', event.message);
    event.preventDefault();
  }
});

self.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('chrome-extension')) {
    console.log('Ignoring chrome-extension promise rejection:', event.reason.message);
    event.preventDefault();
  }
});

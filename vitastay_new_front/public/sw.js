/* BKG-017 / BIC-087 — installable shell. Never cache API or KYC. Native stores are later. */
const CACHE = 'vitastay-shell-v1';
const SHELL = ['/search', '/manifest.webmanifest', '/images/logo.png'];

const shouldBypass = (url) => {
  const path = url.pathname || '';
  if (path.startsWith('/api')) return true;
  if (path.startsWith('/uploads/tenants')) return true;
  if (path.startsWith('/uploads/vita-eye')) return true;
  if (path.startsWith('/uploads/kyc')) return true;
  return false;
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (shouldBypass(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/search').then((hit) => hit || caches.match(request)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const cacheable = response.ok
          && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/images/'));
        if (cacheable) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});

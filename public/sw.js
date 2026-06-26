const CACHE = 'km-v2';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // API-запросы — только сеть, без кэша
  if (url.hostname === 'functions.poehali.dev') return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request).then((res) => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
      return cached || network;
    })
  );
});

// Push-уведомления
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'КорпМессенджер', {
      body: data.body ?? 'Новое сообщение',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag ?? 'km-msg',
      data: { url: data.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const url = e.notification.data?.url ?? '/';
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = e.data;
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag ?? 'km-msg',
      silent: false,
    });
  }
});

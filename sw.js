// Service worker de l'Appli LBG : affiche les notifications, même quand l'appli est fermée.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Écurie la Barthe Grande', {
    body: d.body || '',
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '' },
  }));
});

// Toucher la notification ouvre l'appli à la bonne page (discussion, planning, fiche du cheval…).
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || '';
  const target = new URL('./' + hash, self.registration.scope).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) { c.postMessage({ type: 'lbg-open', url: hash }); return c.focus(); }
    }
    return self.clients.openWindow(target);
  })());
});

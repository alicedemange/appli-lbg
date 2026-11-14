// Service worker de l'Appli LBG : affiche les notifications, même quand l'appli est fermée.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Macaron sur l'icône de l'appli : nombre de nouveautés depuis la dernière ouverture.
const BADGE = 'https://lbg.local/badge';
async function getBadge() { try { const r = await (await caches.open('lbg-badge')).match(BADGE); return r ? Number(await r.text()) || 0 : 0; } catch (_) { return 0; } }
async function setBadge(n) {
  try { await (await caches.open('lbg-badge')).put(BADGE, new Response(String(n))); } catch (_) {}
  try { if (n > 0) await self.navigator.setAppBadge(n); else await self.navigator.clearAppBadge(); } catch (_) {}
}
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'lbg-badge') e.waitUntil(setBadge(Number(e.data.n) || 0)); });

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(Promise.all([getBadge().then((n) => setBadge(n + 1)), self.registration.showNotification(d.title || 'Écurie la Barthe Grande', {
    body: d.body || '',
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '' },
  })]));
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

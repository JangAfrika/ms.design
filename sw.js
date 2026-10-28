const CACHE = 'ms-bms-shell-v12';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['index.html', 'logo.png', 'icons/icon-192.png']).catch(() => {}))); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // server and Google calls are never kept
  e.respondWith(fetch(req).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((m) => m || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { const j = e.data ? e.data.json() : {}; d = j.data || j; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  const scope = self.registration.scope;
  let url = new URL('notifications.html', scope).href;
  try { const u = new URL(d.link || 'notifications.html', scope); if (u.origin === self.location.origin && u.href.indexOf(scope) === 0) url = u.href; } catch (x) {  }
  const unread = Number(d.unread) || 0;
  const badge = self.navigator && 'setAppBadge' in self.navigator ? (unread > 0 ? self.navigator.setAppBadge(unread) : self.navigator.clearAppBadge()).catch(() => null) : Promise.resolve();
  const icon = new URL('icons/icon-192.png', scope).href;
  e.waitUntil(Promise.all([badge, self.registration.showNotification(d.title || 'MS BMS', { body: d.body || '', icon, badge: icon, data: { url },
    tag: d.type === 'message' ? url : undefined, renotify: d.type === 'message' })]));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || new URL('notifications.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.indexOf(self.registration.scope) === 0 && 'focus' in c) return c.focus().then(() => ('navigate' in c ? c.navigate(url) : undefined)).catch(() => self.clients.openWindow(url));
    }
    return self.clients.openWindow(url);
  }));
});

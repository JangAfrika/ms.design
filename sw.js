/* Keeps the app's own files (pages, scripts, styles, icons) so it opens fast and can be installed. Business data is never stored here:
   calls to the Apps Script server and to Google always go to the network. Pages and scripts are fetched fresh when online. */
const CACHE = 'ms-bms-shell-v5';
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

/* A system notification (shown by js/notify.js while the app is open or installed) was tapped: focus an open window of the app and
   go to the page, or open the page. There is no 'push' handler: nothing is pushed from a server (see DEPLOY.md). */
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

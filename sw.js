/* Keeps the app's own files (pages, scripts, styles, icons) so it opens fast and can be installed. Business data is never stored here:
   calls to the Apps Script server and to Google always go to the network. Pages and scripts are fetched fresh when online. */
const CACHE = 'ms-bms-shell-v2';
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

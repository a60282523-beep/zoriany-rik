// Зоряний рік — офлайн-кеш. Міняй VERSION при кожному оновленні файлів.
var VERSION = 'zr-v2';
var FILES = ['./', 'index.html', 'style.css', 'data.js', 'app.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.indexOf('/zr-api/') >= 0) { return; }
  if (u.origin === location.origin) {
    // свої файли: спершу мережа (щоб отримати оновлення), без мережі — кеш
    e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(VERSION).then(function (ca) { ca.put(e.request, c); }); return r; }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
  } else if (u.hostname.indexOf('fonts.') === 0) {
    e.respondWith(caches.match(e.request).then(function (m) { return m || fetch(e.request).then(function (r) { var c = r.clone(); caches.open(VERSION).then(function (ca) { ca.put(e.request, c); }); return r; }); }));
  }
});

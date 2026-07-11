// Service worker — network-first (ออนไลน์ได้ล่าสุดเสมอ, ออฟไลน์ fallback แคช)
// เด้งเลข CACHE ทุกครั้งที่ deploy เพื่อเคลียร์แคชเก่า
const CACHE = 'ngern-v5';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/store.js',
  './js/app.js',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // network-first: ดึงของใหม่ก่อนเสมอ อัปเดตแคช; ถ้าออฟไลน์ค่อยใช้แคช
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
  } else {
    // ฟอนต์ ฯลฯ = cache-first (แทบไม่เปลี่ยน)
    e.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
      )
    );
  }
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

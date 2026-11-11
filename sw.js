// Офлайн-режим: приложение сохраняет свои файлы и работает без интернета
const CACHE = 'hd-v51';
const FILES = [
  './',
  'index.html',
  'style.css',
  'storage.js',
  'logger.js',
  'help.js',
  'history.js',
  'report.js',
  'message.js',
  'info.js',
  'bp.js',
  'news.js',
  'stats.js',
  'app.js',
  'manifest.json',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png'
];

// Установка: скачиваем свежие копии всех файлов
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Активация: удаляем копии старых версий
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Сначала пробуем сеть, чтобы всегда была свежая версия.
// Нет сети или она отвечает дольше 3 секунд — берём сохранённую копию.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });

    const network = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
      }
      return res;
    });

    if (!cached) {
      return network.catch(() => caches.match('index.html'));
    }
    const timeout = new Promise(resolve => setTimeout(() => resolve(cached), 3000));
    return Promise.race([network.catch(() => cached), timeout]);
  })());
});

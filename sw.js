// Service Worker for Torihiki Note PWA
const CACHE_NAME = 'torihiki-note-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/icon.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;700;800&display=swap'
];

// インストール時にキャッシュを保存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache.map(url => {
          try {
            return new Request(url, { mode: 'no-cors' });
          } catch (e) {
            return url;
          }
        })).catch(err => {
          console.log('Cache addAll failed:', err);
          // 個別にキャッシュを追加（一部失敗しても続行）
          return Promise.allSettled(
            urlsToCache.map(url => 
              cache.add(url).catch(e => console.log(`Failed to cache ${url}:`, e))
            )
          );
        });
      })
  );
  self.skipWaiting();
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// フェッチイベント：ネットワーク優先、フォールバックでキャッシュ
self.addEventListener('fetch', (event) => {
  // 外部リソース（CDNなど）はキャッシュのみ
  if (event.request.url.startsWith('http') && !event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((response) => {
          // 外部リソースはキャッシュに保存しない（CORS制限のため）
          return response;
        }).catch(() => {
          // オフライン時は空のレスポンスを返す
          return new Response('', { status: 408, statusText: 'Request Timeout' });
        });
      })
    );
    return;
  }

  // ローカルリソースはネットワーク優先、フォールバックでキャッシュ
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 有効なレスポンスをクローンしてキャッシュに保存
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // ネットワークエラー時はキャッシュから取得
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          // index.htmlへのフォールバック（SPA用）
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});


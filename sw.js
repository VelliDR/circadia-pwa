const CACHE_NAME = 'circadia-v2.08';
const ASSETS = [
    './',
    './index.html',
    './css/main.css',
    './app.js',
    './manifest.json',
    './js/db/drinkDatabase.js',
    './js/engine/Pharmacokinetics.js',
    './js/engine/ToleranceEngine.js',
    './js/ui/CanvasChart.js',
    './js/ui/GlassSelect.js'
];

// Yükleme ve Ön Bellekleme
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Eski Önbellek Temizliği (Versiyon Güncellemesi İçin)
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Çevrimdışı İstek Yönetimi (Cache-First)
self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request))
    );
});
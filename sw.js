const CACHE_NAME = 'circadia-v1';
const ASSETS = [
    './',
    './index.html',
    './css/main.css',
    './app.js',
    './manifest.json',
    './js/db/drinkDatabase.js',
    './js/engine/Pharmacokinetics.js',
    './js/engine/ToleranceEngine.js',
    './js/ui/CanvasChart.js'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
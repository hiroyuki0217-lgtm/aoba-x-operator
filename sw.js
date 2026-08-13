self.addEventListener('install', event => event.waitUntil(caches.open('aoba-v1').then(cache => cache.addAll(['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./icon.svg']))));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request))));

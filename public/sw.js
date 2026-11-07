const CACHE='acco-note-shell-v7';
const ASSETS=['/','/index.html','/styles.css','/ako-theme.css','/ui-components.css','/live.css','/live.js','/ui-components.js','/ui-inputs.js','/pwa.js','/ako-mark.svg','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/core/domain.js','/core/store.js','/core/backup.js','/vendor/lucide/icons.js','/vendor/lucide/chevron-down.svg','/vendor/lucide/calendar-days.svg','/vendor/flatpickr/flatpickr.min.js','/vendor/flatpickr/flatpickr.min.css','/vendor/flatpickr/ko.js','/vendor/flatpickr/monthSelect.js','/vendor/flatpickr/monthSelect.css'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('acco-note-shell-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('message',e=>{if(e.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!ASSETS.includes(u.pathname))return;
 e.respondWith((async()=>{const cache=await caches.open(CACHE);if(e.request.mode==='navigate'){try{const response=await fetch(e.request);if(response.ok)await cache.put('/index.html',response.clone());return response;}catch{return await cache.match('/index.html');}}return await cache.match(e.request,{ignoreSearch:true})||fetch(e.request);})());
});

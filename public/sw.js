// Service worker mínimo: rede primeiro, cache só do shell do app para abrir offline.
const C = 'gametask-v3', SHELL = ['/app', '/css/game.css', '/js/app.js', '/icons/icon.svg', '/fonts/lilita-one.woff2', '/fonts/nunito.woff2'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  // "/" muda conforme o login (página de vendas x app): nunca guardar
  const keep = u.pathname !== '/';
  e.respondWith(fetch(e.request).then(r => { if (keep && r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match('/app'))));
});

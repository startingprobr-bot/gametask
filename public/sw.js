// Service worker: rede primeiro, cache só do shell do app para abrir offline, e avisos (Web Push).
const C = 'gametask-v20', SHELL = ['/app', '/css/game.css', '/js/app.js', '/icons/icon.svg', '/fonts/lilita-one.woff2', '/fonts/nunito.woff2'];
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

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'GameTask', body: e.data?.text() || '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'GameTask', {
    body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/badge.png', tag: d.tag, renotify: !!d.tag,
    requireInteraction: !!d.alarm, vibrate: d.alarm ? [300, 120, 300, 120, 500] : [120], data: { url: d.url || '/app#/' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/app#/', location.origin).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async list => {
    const w = list.find(c => new URL(c.url).origin === location.origin);
    if (!w) return clients.openWindow(url);
    // janela já aberta: traz para a frente e manda o app ir para a tela certa (navigate() falha em páginas não controladas)
    await w.focus().catch(() => {});
    w.postMessage({ type: 'go', url });
    await w.navigate(url).catch(() => {});
  }));
});

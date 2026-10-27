// Service worker: red primero (revalida siempre, para ver la última versión sin vaciar nada) y caché como respaldo sin conexión.
// Solo toca sus cachés: los datos de la aplicación (copia de sesión, estado de la interfaz) viven en IndexedDB y sobreviven a las actualizaciones.
const V = 'papers-v35.3', FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'ejemplo_papers.json', 'privacidad.html'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES.map(f => new Request(f, {cache: 'reload'}))))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || /(^|\.)google(apis)?\.com$/.test(new URL(e.request.url).hostname)) return;   // Google (acceso y Drive) va siempre directo: nunca se guarda en caché
  e.respondWith(fetch(e.request, {cache: 'no-cache'}).then(r => { const c = r.clone(); caches.open(V).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});

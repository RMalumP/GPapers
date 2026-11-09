// Service worker: caché primero. La app sale al instante desde la caché de su versión, aunque la red sea lenta o no haya.
// Cada versión (V) se descarga entera al instalarse y no se mezcla con otra: una versión nueva llega por detrás y la app avisa con «Recargar ahora».
// Por eso hay que subir la versión (aquí y APP_V en app.js) en cada publicación: si no cambia, el navegador no ve nada nuevo.
// Solo toca sus cachés: los datos de la aplicación (copia de sesión, estado de la interfaz) viven en IndexedDB y sobreviven a las actualizaciones.
const V = 'papers-v39.19', FILES = ['./', 'index.html', 'style.css', 'movil.css', 'visor.css', 'js/movil.js', 'js/modelo.js', 'js/citas.js', 'js/persistencia.js', 'js/importar.js', 'js/config.js', 'js/lista.js', 'js/edicion.js', 'js/drive.js', 'js/extras.js', 'js/visor.js', 'js/bandeja.js', 'js/resumen.js', 'app.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'ejemplo_papers.json', 'privacidad.html'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES.map(f => new Request(f, {cache: 'reload'}))))); self.skipWaiting(); });
// Las librerías del visor de PDF (lib/: PDF.js y pdf-lib, unos 5 MB) no se descargan al instalar: solo la primera vez que se abre un PDF.
// Van en su propia caché, que no se borra con cada versión de la app (solo cambia si cambian las librerías: subir LIBV).
const LIBV = 'papers-lib-pdfjs-4.10.38';
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== LIBV).map(k => caches.delete(k)))).then(() => clients.claim())));
const net = req => fetch(req, {cache: 'no-cache'}).then(r => { if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(V).then(ca => ca.put(req, c)); } return r; });
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || /(^|\.)google(apis)?\.com$/.test(u.hostname)) return;   // Google (acceso y Drive) va siempre directo: nunca se guarda en caché
  if (u.origin !== location.origin) return e.respondWith(net(req).catch(() => caches.match(req)));
  if (/\/lib\//.test(u.pathname)) return e.respondWith(caches.open(LIBV).then(c => c.match(req).then(r => r || fetch(req).then(x => { if (x.ok) c.put(req, x.clone()); return x; }))));   // imágenes y datos de otras webs: red primero y la caché sin conexión
  // archivos de la aplicación: de la caché de esta versión (la página principal, con o sin ?parámetros); si falta algo, de la red
  const key = req.mode === 'navigate' && /\/(index\.html)?$/.test(u.pathname) ? 'index.html' : req;
  e.respondWith(caches.open(V).then(c => c.match(key, {ignoreSearch: true})).then(r => r || net(req)).catch(() => caches.match(key, {ignoreSearch: true})));
});

/* Service worker: guarda la app en el teléfono para que abra sin internet.
   - Páginas (app y dashboard): primero la versión más reciente de internet;
     si no hay señal (o tarda más de 4 s), la copia guardada en el teléfono.
   - Íconos y demás archivos: copia guardada, actualizada en segundo plano. */
const CACHE = 'registro-supervision-v3';
const ARCHIVOS = ['./', './index.html', './dashboard.html', './manifest.json', './manifest-dashboard.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(ARCHIVOS.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function esPagina(req, url) {
  return req.mode === 'navigate' || req.destination === 'document' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const clave = url.origin + url.pathname;

  if (esPagina(req, url)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const red = await Promise.race([
          fetch(new Request(clave, { cache: 'no-cache', credentials: 'same-origin' })),
          new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), 4000))
        ]);
        if (red && red.ok) { c.put(clave, red.clone()); return red; }
        throw new Error('sin respuesta');
      } catch (err) {
        return (await c.match(clave)) || (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith(caches.open(CACHE).then(async c => {
    const enCache = await c.match(req, { ignoreSearch: true });
    const red = fetch(new Request(clave, { cache: 'no-cache' })).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (enCache) { e.waitUntil(red); return enCache; }
    return (await red) || Response.error();
  }));
});

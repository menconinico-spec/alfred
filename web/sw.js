// Serve solo a rendere la pagina installabile e apribile anche con rete assente.
// Prima prova sempre la rete (così gli aggiornamenti arrivano subito); se manca, usa l'ultima copia della pagina.
// I dati non passano di qui: le richieste all'archivio e a Google non vengono mai conservate.
const NOME = 'alfred-pagina-1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((nomi) => Promise.all(nomi.filter((n) => n !== NOME).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()),
));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((risposta) => {
      if (risposta.ok) {
        const copia = risposta.clone();
        caches.open(NOME).then((c) => c.put(e.request, copia));
      }
      return risposta;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});

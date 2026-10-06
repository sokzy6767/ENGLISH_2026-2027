// Offline režim žiackej appky – verzia 202610061116
// Pracuje len so súbormi z vlastnej adresy, nič iné nepúšťa ani neukladá.
const CACHE = "clil4-202610061116";
const CORE = ["./","./index.html","./app.css","./app.js","./lessons.json","./manifest.webmanifest","./icon-192.png","./icon-512.png","./baloo-2-latin-ext-500.woff2","./baloo-2-latin-500.woff2","./baloo-2-latin-ext-700.woff2","./baloo-2-latin-700.woff2","./baloo-2-latin-ext-800.woff2","./baloo-2-latin-800.woff2","./atkinson-hyperlegible-latin-ext-400.woff2","./atkinson-hyperlegible-latin-400.woff2","./atkinson-hyperlegible-latin-ext-700.woff2","./atkinson-hyperlegible-latin-700.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, url = new URL(r.url);
  if (r.method !== "GET" || url.origin !== self.location.origin) return;
  const fresh = r.mode === "navigate" || /\.(html|js|css|json)$/.test(url.pathname);
  if (fresh) {
    // appka a lekcie: najprv internet (nová verzia), bez internetu uložená kópia
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(hit => hit || caches.match("./index.html"))));
    return;
  }
  // písma a ikony: z pamäte
  e.respondWith(caches.match(r).then(hit => hit || fetch(r)));
});
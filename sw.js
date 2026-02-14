const CACHE = "omri-pro-gym-v1";
const ASSETS = [
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "https://cdn.jsdelivr.net/npm/chart.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null))))
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Don’t cache API calls (always live)
  if (url.pathname.startsWith("/api/")) return;

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((resp) => {
      // Cache new GET resources
      if (e.request.method === "GET" && resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return resp;
    }).catch(()=>cached))
  );
});

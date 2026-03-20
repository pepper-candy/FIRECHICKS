/* eslint-disable no-restricted-globals */
/**
 * Cache-first for Fire Chick CDN assets. Stored in the browser Cache API (shows under
 * Application → Cache Storage for this origin). Bump CACHE_NAME when you change files
 * on the CDN so clients fetch fresh copies.
 */
const ASSET_ORIGIN = "https://firechick-assets.mongklhk.workers.dev";
const CACHE_NAME = "firechick-assets-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("firechick-assets-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (!url.startsWith(ASSET_ORIGIN)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request);
        // Requires CDN CORS so the response is not opaque; otherwise cache.put may fail.
        if (response.ok) {
          try {
            await cache.put(event.request, response.clone());
          } catch (putErr) {
            console.warn("[asset-cache-sw] cache.put failed (check CDN CORS):", putErr);
          }
        }
        return response;
      } catch (err) {
        console.warn("[asset-cache-sw] fetch failed:", err);
        const fallback = await cache.match(event.request);
        if (fallback) return fallback;
        throw err;
      }
    }),
  );
});

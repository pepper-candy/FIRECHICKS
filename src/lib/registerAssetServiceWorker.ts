/**
 * Registers a service worker that cache-firsts CDN game assets (GLB, PNG, MP4).
 * Cache appears under DevTools → Application → Cache Storage for your **app** origin
 * (e.g. your Vercel domain), not the Worker domain.
 */
export function registerAssetServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // Avoid interfering with Vite HMR and local iteration
  if (!import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/asset-cache-sw.js", { scope: "/" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              // New SW waiting; optional: could prompt user to refresh
            }
          });
        });
      })
      .catch((err) => console.warn("[asset-cache-sw] registration failed:", err));
  });
}

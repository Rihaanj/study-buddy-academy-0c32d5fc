// Kill-switch service worker: replaces the old app-shell cache worker.
// Deletes this app's own caches, then unregisters itself so the live
// site is always served fresh from the network.
function isAppCache(name) {
  return name.startsWith("studybud-");
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.allSettled(names.filter(isAppCache).map((n) => caches.delete(n)));
        await self.clients.claim();
        const windows = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(windows.map((c) => c.navigate(c.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);

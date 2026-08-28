import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
}

// No service worker: always serve fresh app code. Remove any previously
// registered worker + caches so nobody is stuck on a stale blank shell.
const CACHE_CLEANUP_VERSION = "4";
if (localStorage.getItem("sb_cache_cleanup") !== CACHE_CLEANUP_VERSION) {
  localStorage.setItem("sb_cache_cleanup", CACHE_CLEANUP_VERSION);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations?.()
      .then((registrations) => registrations.forEach((registration) => registration.unregister()))
      .catch(() => {});
  }
  if (typeof caches !== "undefined") {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => {});
  }
}

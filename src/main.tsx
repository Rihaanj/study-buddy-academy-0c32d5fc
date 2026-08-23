import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// No service worker: always serve fresh app code. Remove any previously
// registered worker + caches so nobody is stuck on a stale blank shell.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations?.()
    .then((rs) => rs.forEach((r) => r.unregister()))
    .catch(() => {});
}
if (typeof caches !== "undefined") {
  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
}

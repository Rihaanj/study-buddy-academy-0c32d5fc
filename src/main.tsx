import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// No app service worker: a stale cached shell was trapping visitors on the
// loading screen. Unregister any leftover registration from older versions.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations?.()
    .then((rs) => rs.forEach((r) => r.unregister()))
    .catch(() => {});
}

import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Register service worker only on production-like hosts (not in Lovable preview iframe).
const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
const host = window.location.hostname;
const isPreview = host.includes("lovableproject.com") || host.includes("id-preview--") || host === "localhost";

if ("serviceWorker" in navigator) {
  if (!isInIframe && !isPreview) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations?.().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  }
}

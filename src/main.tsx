import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary.tsx";
import "./index.css";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <AppErrorBoundary>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </AppErrorBoundary>
  );
}

// Retire stale app-shell workers on every visit. This is intentionally non-blocking:
// React renders immediately while browsers left on an older cached release recover.
const retireLegacyAppWorker = async () => {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations
        .filter((registration) => {
          const workerUrl = registration.active?.scriptURL
            ?? registration.waiting?.scriptURL
            ?? registration.installing?.scriptURL
            ?? "";
          if (!workerUrl) return false;
          const path = new URL(workerUrl).pathname;
          return path === "/sw.js" || path === "/service-worker.js";
        })
        .map((registration) => registration.unregister()),
    );
  } catch {
    // Browser privacy settings can block worker access; the app still renders normally.
  }
};

void retireLegacyAppWorker();

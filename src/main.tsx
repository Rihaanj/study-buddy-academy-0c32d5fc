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

// Retire only the app-shell worker. Messaging workers, if added later, remain intact.
// Storage may be unavailable in strict/privacy browsers, so cleanup must never block React.
const retireLegacyAppWorker = async () => {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations
        .filter((registration) => new URL(registration.scope).origin === window.location.origin)
        .map((registration) => registration.unregister()),
    );
  } catch {
    // The app remains network-first even when the browser blocks worker access.
  }
};

try {
  const cleanupVersion = "5";
  if (window.localStorage.getItem("sb_cache_cleanup") !== cleanupVersion) {
    window.localStorage.setItem("sb_cache_cleanup", cleanupVersion);
    void retireLegacyAppWorker();
  }
} catch {
  void retireLegacyAppWorker();
}

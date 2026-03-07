import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Global safety net for unhandled promise rejections (prevents blank screen crashes)
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled rejection:", event.reason);
  event.preventDefault();
});

// Register service worker only outside Lovable preview
const isLovablePreview =
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.app") ||
  window.location.search.includes("__lovable_token");

let shouldRenderApp = true;

if (isLovablePreview) {
  const url = new URL(window.location.href);

  // Force a one-time cache-busted URL in preview to avoid stale JS chunks from disk cache
  if (!url.searchParams.has("__lcv")) {
    url.searchParams.set("__lcv", Date.now().toString(36));
    shouldRenderApp = false;
    window.location.replace(url.toString());
  } else {
    void (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }

        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        }

        // One hard reload per tab after cleanup to guarantee fresh module graph in preview
        const previewReloadKey = "__lovable_preview_force_reload_v1";
        if (!sessionStorage.getItem(previewReloadKey)) {
          sessionStorage.setItem(previewReloadKey, "1");
          window.location.reload();
        }
      } catch (error) {
        console.warn("Preview cache cleanup failed:", error);
      }
    })();
  }
} else {
  const updateSW = registerSW({
    onNeedRefresh() {
      console.log("New version available - will update on next reload");
    },
    onOfflineReady() {
      console.log("App ready for offline use");
    },
    immediate: true,
  });

  setInterval(() => {
    updateSW();
  }, 5 * 60 * 1000);
}

if (shouldRenderApp) {
  createRoot(document.getElementById("root")!).render(<App />);
}

import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled rejection:", event.reason);
  event.preventDefault();
});

const isNativeApp = (() => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
})();

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  typeof window !== "undefined" && window.location.hostname.includes("id-preview--");

const cleanupServiceWorkers = async () => {
  try {
    if (
      "serviceWorker" in navigator &&
      typeof navigator.serviceWorker.getRegistrations === "function"
    ) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.allSettled(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
    }
  } catch (error) {
    console.warn("Service worker cleanup skipped:", error);
  }
};

const setupServiceWorker = async () => {
  if (typeof window === "undefined") return;

  if (isNativeApp || isInIframe || isPreviewHost) {
    await cleanupServiceWorkers();
    return;
  }

  try {
    if (!("serviceWorker" in navigator)) return;

    const { registerSW } = await import("virtual:pwa-register");
    const updateSW = registerSW({
      onNeedRefresh() {
        console.log("New version available - updating now");
        void updateSW(true);
      },
      onOfflineReady() {
        console.log("App ready for offline use");
      },
      immediate: true,
    });

    window.addEventListener("sw-do-update", () => {
      void updateSW(true);
    });

    const checkForUpdates = () => {
      void updateSW();
    };

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdates();
    });

    window.addEventListener("focus", checkForUpdates);
    window.setInterval(checkForUpdates, 5 * 60 * 1000);
  } catch (error) {
    console.error("Service worker setup failed:", error);
  }
};

void setupServiceWorker();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(<App />);

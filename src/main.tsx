import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Global safety net for unhandled promise rejections (prevents blank screen crashes)
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled rejection:", event.reason);
  event.preventDefault();
});

const isNativeApp = Capacitor.isNativePlatform();

if (isNativeApp && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });
}

if (!isNativeApp) {
  // Register PWA service worker only on web/PWA
  const updateSW = registerSW({
    onNeedRefresh() {
      console.log("New version available - notifying user");
      window.dispatchEvent(new CustomEvent("sw-update-available"));
    },
    onOfflineReady() {
      console.log("App ready for offline use");
    },
    immediate: true,
  });

  window.addEventListener("sw-do-update", () => {
    updateSW(true);
  });

  setInterval(() => {
    updateSW();
  }, 5 * 60 * 1000);
}

createRoot(document.getElementById("root")!).render(<App />);

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

const setupServiceWorker = async () => {
  if (typeof window === "undefined") return;

  if (isNativeApp) {
    try {
      if (
        "serviceWorker" in navigator &&
        typeof navigator.serviceWorker.getRegistrations === "function"
      ) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(registrations.map((registration) => registration.unregister()));
      }
    } catch (error) {
      console.warn("Skipping service worker cleanup on native platform:", error);
    }
    return;
  }

  try {
    if (!("serviceWorker" in navigator)) return;

    const { registerSW } = await import("virtual:pwa-register");
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
      void updateSW(true);
    });

    window.setInterval(() => {
      void updateSW();
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error("Service worker setup failed:", error);
  }
};

void setupServiceWorker();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(<App />);

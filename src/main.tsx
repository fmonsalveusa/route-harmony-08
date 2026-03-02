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

if (isLovablePreview) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
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

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Global safety net for unhandled promise rejections (prevents blank screen crashes)
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled rejection:", event.reason);
  event.preventDefault();
});

// Register PWA service worker for production
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

// Listen for user-triggered update
window.addEventListener("sw-do-update", () => {
  updateSW(true);
});

setInterval(() => {
  updateSW();
}, 5 * 60 * 1000);

createRoot(document.getElementById("root")!).render(<App />);

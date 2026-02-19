import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Global safety net for unhandled promise rejections (prevents blank screen crashes)
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled rejection:", event.reason);
  event.preventDefault();
});

// Register service worker with auto-update strategy
// When a new version is detected, it updates automatically and reloads the page
const updateSW = registerSW({
  onNeedRefresh() {
    // Auto-accept updates without prompting the user
    updateSW(true);
  },
  onOfflineReady() {
    console.log("App ready for offline use");
  },
  // Check for updates every 60 seconds
  immediate: true,
});

// Also check for updates periodically (every 60s)
setInterval(() => {
  updateSW();
}, 60 * 1000);

createRoot(document.getElementById("root")!).render(<App />);

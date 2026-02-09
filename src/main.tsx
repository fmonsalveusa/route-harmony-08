import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global safety net for unhandled promise rejections (prevents blank screen crashes)
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled rejection:", event.reason);
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);

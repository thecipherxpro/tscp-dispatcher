import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    // New content available, could prompt user to refresh
    console.log('New content available, refresh to update.');
  },
  onOfflineReady() {
    console.log('App ready to work offline.');
  },
  onRegistered(registration) {
    console.log('Service worker registered:', registration);
  },
  onRegisterError(error) {
    console.error('Service worker registration error:', error);
  },
});

createRoot(document.getElementById("root")!).render(<App />);

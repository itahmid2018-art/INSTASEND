import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Safely register Service Worker for 100% offline app launches on mobile & TV
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log('[PWA] New app version available');
        },
        onOfflineReady() {
          console.log('[PWA] App ready to work 100% offline without server');
        }
      });
    })
    .catch((err) => {
      // Graceful fallback to native service worker registration if virtual module is unavailable in dev
      console.debug('[PWA] virtual:pwa-register deferred, registering standard SW fallback:', err);
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}


createRoot(document.getElementById('root')!).render(<App />);

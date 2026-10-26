import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker for 100% offline app launches on mobile & TV
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('New app version available');
  },
  onOfflineReady() {
    console.log('App ready to work 100% offline without server');
  }
});

createRoot(document.getElementById('root')!).render(<App />);

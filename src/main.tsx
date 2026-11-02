import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely register Service Worker ONLY in production builds
if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch((err) => {
      console.debug('[PWA] Service worker registration deferred:', err);
    });
}

const container = document.getElementById('root');
if (container) {
  try {
    const root = createRoot(container);
    root.render(<App />);
  } catch (err) {
    console.error('[App Mount Error]', err);
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; font-family: sans-serif;">
        <h2 style="color: #ea4335;">InstaSend Startup Notice</h2>
        <p style="color: #5f6368;">An initial loading error occurred: ${err instanceof Error ? err.message : String(err)}</p>
        <button onclick="location.reload()" style="padding: 0.5rem 1rem; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Reload Page
        </button>
      </div>
    `;
  }
}

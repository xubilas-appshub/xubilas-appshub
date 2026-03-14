import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register service worker early so Chrome/Edge detects PWA installability
// before OneSignal's deferred init. This ensures beforeinstallprompt fires.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/OneSignalSDKWorker.js', { scope: '/' });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

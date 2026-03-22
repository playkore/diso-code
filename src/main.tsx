import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import './styles.css';

// The PWA registration stays at the app entry so the service worker lifecycle
// is initialized exactly once regardless of which route React renders first.
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

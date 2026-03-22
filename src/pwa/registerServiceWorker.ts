// Register the service worker only in production builds so local development
// keeps Vite's fast refresh behavior and avoids stale caches while iterating.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/' })
      .catch((error: unknown) => {
        console.error('Service worker registration failed.', error);
      });
  });
}

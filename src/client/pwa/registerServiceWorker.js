export function registerServiceWorker() {
  // Solo registrar en builds de producción.
  if (import.meta.env.DEV) return;

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Detección básica de nuevas versiones del SW.
        if (registration.waiting) {
          console.info('[PWA] Nueva versión disponible (worker en espera). Recarga recomendada.');
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.info('[PWA] Nueva versión de la aplicación instalada. Recarga para usarla.');
            }
          });
        });
      })
      .catch((error) => {
        console.error('[PWA] Error al registrar el Service Worker', error);
      });
  });
}


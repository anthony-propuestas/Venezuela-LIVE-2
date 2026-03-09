 import React, { useState, useEffect } from 'react';

/**
 * Banner que aparece cuando hay una nueva versión del Service Worker.
 * Permite al usuario recargar de forma segura.
 */
export function PWAUpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;

    const check = () => {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.waiting) setShow(true);
      });
    };

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            setShow(true);
          }
        });
      });
      if (reg.waiting) setShow(true);
    });

    navigator.serviceWorker.addEventListener('controllerchange', check);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', check);
  }, []);

  const handleReload = () => {
    navigator.serviceWorker.ready.then((reg) => {
      reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 p-4 rounded-xl border bg-amber-900/30 border-amber-600/50 text-amber-200 shadow-lg">
      <p className="text-sm font-medium mb-2">Nueva versión disponible</p>
      <p className="text-xs text-amber-300/80 mb-3">Recarga para usar la última versión de la app.</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleReload}
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium"
        >
          Recargar
        </button>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="px-4 py-2 rounded-lg border border-amber-600/50 hover:bg-amber-900/50 text-sm"
        >
          Más tarde
        </button>
      </div>
    </div>
  );
}
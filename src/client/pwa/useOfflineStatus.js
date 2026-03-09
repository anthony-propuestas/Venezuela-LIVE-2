/**
 * Hook para estado de conectividad y cola offline.
 */
import { useState, useEffect, useCallback } from 'react';
import { getPendingCount } from './offlineQueue.js';
import { syncOfflineQueue } from './syncOfflineQueue.js';
import { useError } from '@client/context/ErrorContext';

export function useOfflineStatus() {
  const { addError } = useError();
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(async () => {
    const n = await getPendingCount();
    setPendingCount(n);
    return n;
  }, []);

  const runSync = useCallback(async () => {
    const result = await syncOfflineQueue();
    await refreshPending();
    if (result.abandoned > 0) {
      addError?.(
        `${result.abandoned} ${result.abandoned === 1 ? 'acción no pudo' : 'acciones no pudieron'} sincronizarse. Los datos siguen guardados localmente para reintentar más tarde.`,
        'warning'
      );
    }
  }, [refreshPending, addError]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      runSync();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    refreshPending();
    const interval = setInterval(refreshPending, 10000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
    };
  }, [refreshPending, runSync]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (e) => {
      if (e.data?.type === 'SYNC_OFFLINE_QUEUE') {
        runSync();
      }
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, [runSync]);

  return { isOnline, pendingCount, refreshPending };
}

/**
 * Hook para estado de conectividad y cola offline.
 */
import { useState, useEffect, useCallback } from 'react';
import { getPendingCount } from './offlineQueue.js';
import { syncOfflineQueue } from './syncOfflineQueue.js';

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(async () => {
    const n = await getPendingCount();
    setPendingCount(n);
    return n;
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      syncOfflineQueue().then(() => refreshPending());
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
  }, [refreshPending]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (e) => {
      if (e.data?.type === 'SYNC_OFFLINE_QUEUE') {
        syncOfflineQueue().then(() => refreshPending());
      }
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, [refreshPending]);

  return { isOnline, pendingCount, refreshPending };
}

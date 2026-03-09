/**
 * Sincronización de la cola offline.
 * Fallback manual cuando Background Sync no está disponible.
 */
import {
  getPendingActions,
  markAsSynced,
  markAsFailed,
} from './offlineQueue.js';
import { getCredential } from '@client/auth/session';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const SYNC_TAG = 'sync-denuncias';

async function syncAction(action, credential) {
  const headers = {
    Authorization: `Bearer ${credential}`,
    'Content-Type': 'application/json',
  };

  if (action.type === 'create_proposal') {
    const res = await fetch(`${API_BASE}/api/proposals`, {
      method: 'POST',
      headers,
      body: JSON.stringify(action.payload),
    });
    if (res.ok) return true;
    throw new Error(await res.text().catch(() => `Error ${res.status}`));
  }

  if (action.type === 'add_comment') {
    const res = await fetch(`${API_BASE}/api/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(action.payload),
    });
    if (res.ok) return true;
    throw new Error(await res.text().catch(() => `Error ${res.status}`));
  }

  if (action.type === 'add_note') {
    const res = await fetch(`${API_BASE}/api/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(action.payload),
    });
    if (res.ok) return true;
    throw new Error(await res.text().catch(() => `Error ${res.status}`));
  }

  return false;
}

export async function syncOfflineQueue() {
  const credential = getCredential?.();
  if (!credential) return { synced: 0, failed: 0 };

  const actions = await getPendingActions();
  let synced = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      const ok = await syncAction(action, credential);
      if (ok) {
        await markAsSynced(action.id);
        synced++;
      }
    } catch (err) {
      await markAsFailed(action.id, err.message);
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Registra Background Sync si está disponible.
 */
export function registerBackgroundSync() {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  if (!('sync' in ServiceWorkerRegistration.prototype)) return;

  navigator.serviceWorker.ready.then((reg) => {
    reg.sync.register(SYNC_TAG).catch(() => {});
  });
}
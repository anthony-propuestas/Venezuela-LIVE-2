/**
 * Cola offline - IndexedDB
 * Security-First: sin tokens ni secretos. Zero-Trust: validación estricta.
 * API interna; no exponer IndexedDB directamente.
 */
const DB_NAME = 'venezuela_live_offline';
const DB_VERSION = 1;
const STORE_ACTIONS = 'queuedActions';
const STORE_CACHE = 'cachedEntities';

const ACTION_TYPES = ['create_proposal', 'add_comment', 'add_note'];
const MAX_PAYLOAD_LENGTH = 5000;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_ACTIONS)) {
        const s = db.createObjectStore(STORE_ACTIONS, { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt', { unique: false });
        s.createIndex('type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'id' });
      }
    };
  });
}

function validatePayload(type, payload) {
  if (!ACTION_TYPES.includes(type)) return { valid: false, error: 'Tipo de acción inválido' };
  if (!payload || typeof payload !== 'object') return { valid: false, error: 'Payload inválido' };
  const str = JSON.stringify(payload);
  if (str.length > MAX_PAYLOAD_LENGTH) return { valid: false, error: 'Payload demasiado largo' };
  return { valid: true };
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Encola una acción para sincronización posterior.
 * @param {string} type - create_proposal | add_comment | add_note
 * @param {object} payload - datos validados
 */
export async function enqueueAction(type, payload) {
  const { valid, error } = validatePayload(type, payload);
  if (!valid) throw new Error(error);

  const action = {
    id: uuid(),
    type,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
    lastError: null,
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ACTIONS, 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(action.id);
    tx.objectStore(STORE_ACTIONS).add(action);
  });
}

/**
 * Obtiene todas las acciones pendientes.
 */
export async function getPendingActions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ACTIONS, 'readonly');
    const req = tx.objectStore(STORE_ACTIONS).index('createdAt').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Marca una acción como sincronizada y la elimina.
 */
export async function markAsSynced(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ACTIONS, 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    tx.objectStore(STORE_ACTIONS).delete(id);
  });
}

/**
 * Marca una acción como fallida (para reintentos).
 */
export async function markAsFailed(id, error) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ACTIONS, 'readwrite');
    const req = tx.objectStore(STORE_ACTIONS).get(id);
    req.onsuccess = () => {
      const action = req.result;
      if (action) {
        action.retryCount = (action.retryCount || 0) + 1;
        action.lastError = String(error).slice(0, 200);
        tx.objectStore(STORE_ACTIONS).put(action);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Cuenta de acciones pendientes (para UI).
 */
export async function getPendingCount() {
  const actions = await getPendingActions();
  return actions.length;
}

// Sesión de autenticación en memoria.
// Soporta persistencia opcional en localStorage cuando VITE_PERSIST_SESSIONS=true.

let currentSession = null;
const STORAGE_KEY = 'venlive_session_v1';
const PERSIST_ENABLED = typeof import.meta !== 'undefined' && !!(import.meta.env && import.meta.env.VITE_PERSIST_SESSIONS === 'true');

function loadPersisted() {
  if (!PERSIST_ENABLED) return;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.credential !== 'string') return;
    if (parsed.expiresAt && Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    currentSession = parsed;
  } catch (e) {
    // No hacer nada si parse falla
  }
}

// Intentar cargar sesión persistida al cargar el módulo.
loadPersisted();

/**
 * Establece la sesión actual en memoria.
 * Si la persistencia está activada en build-time, también la guarda en localStorage.
 * @param {{ credential: string; payload?: any; expiresAt?: number; isDevBypass?: boolean }} session
 */
export function setSession(session) {
  if (!session || typeof session.credential !== 'string') {
    currentSession = null;
    if (PERSIST_ENABLED && typeof window !== 'undefined' && window.localStorage) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }
    return;
  }
  currentSession = {
    credential: session.credential,
    payload: session.payload ?? null,
    expiresAt: typeof session.expiresAt === 'number' ? session.expiresAt : null,
    isDevBypass: !!session.isDevBypass,
  };

  if (PERSIST_ENABLED && typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSession));
    } catch (e) {
      // Silencioso si storage falla (p. ej. modo privado o bloqueo)
    }
  }
}

/**
 * Obtiene la sesión actual en memoria, validando expiración.
 * Si no hay sesión en memoria e hay persistencia, intenta recargarla.
 * Devuelve null si no hay sesión o si está expirada.
 */
export function getSession() {
  if (!currentSession && PERSIST_ENABLED) {
    loadPersisted();
  }
  if (!currentSession) return null;
  const { expiresAt } = currentSession;
  if (expiresAt && Date.now() >= expiresAt) {
    // Expirada: limpiar memoria y storage
    currentSession = null;
    if (PERSIST_ENABLED && typeof window !== 'undefined' && window.localStorage) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }
    return null;
  }
  return currentSession;
}

/** Elimina cualquier sesión en memoria y en storage persistente. */
export function clearSession() {
  currentSession = null;
  if (PERSIST_ENABLED && typeof window !== 'undefined' && window.localStorage) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }
}

/** Limpia únicamente la sesión persistente (si existe). */
export function clearPersistentSession() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }
}

/** Devuelve solo el credential (JWT o token bypass) o null si no hay sesión válida. */
export function getCredential() {
  const session = getSession();
  return session?.credential ?? null;
}


// Sesión de autenticación en memoria (Zero-Trust en el cliente).
// No persiste en localStorage, sessionStorage ni IndexedDB.

let currentSession = null;

/**
 * Establece la sesión actual en memoria.
 * @param {{ credential: string; payload?: any; expiresAt?: number; isDevBypass?: boolean }} session
 */
export function setSession(session) {
  if (!session || typeof session.credential !== 'string') {
    currentSession = null;
    return;
  }
  currentSession = {
    credential: session.credential,
    payload: session.payload ?? null,
    expiresAt: typeof session.expiresAt === 'number' ? session.expiresAt : null,
    isDevBypass: !!session.isDevBypass,
  };
}

/**
 * Obtiene la sesión actual en memoria, validando expiración.
 * Devuelve null si no hay sesión o si está expirada.
 */
export function getSession() {
  if (!currentSession) return null;
  const { expiresAt } = currentSession;
  if (expiresAt && Date.now() >= expiresAt) {
    currentSession = null;
    return null;
  }
  return currentSession;
}

/** Elimina cualquier sesión en memoria. */
export function clearSession() {
  currentSession = null;
}

/** Devuelve solo el credential (JWT o token bypass) o null si no hay sesión válida. */
export function getCredential() {
  const session = getSession();
  return session?.credential ?? null;
}


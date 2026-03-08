/**
 * Cliente API para perfil y foto.
 * Usa el credential de Google como Bearer token.
 *
 * En desarrollo, suele bastar con la cadena vacía porque Vite
 * hace proxy de `/api/` hacia el worker. Si se define
 * `VITE_API_BASE_URL`, se usará como base (útil para previews
 * o configuraciones personalizadas).
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const getCredential = () => {
  try {
    const raw = localStorage.getItem('venezuelaLive_auth');
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.credential || null;
  } catch {
    return null;
  }
};

/**
 * Valida el credential con el backend antes de guardar sesión.
 * Si el servidor responde 403 (correo no en allowlist), no se debe guardar nada.
 * @returns {{ ok: true }} | {{ ok: false, status: 403, error: string }}
 */
export async function validateCredential(credential) {
  const res = await fetch(`${API_BASE}/api/profile`, {
    headers: { Authorization: `Bearer ${credential}` },
  });
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, status: 403, error: data?.error || 'Acceso denegado. Correo no autorizado.' };
  }
  return { ok: true };
}

async function apiFetch(path, options = {}) {
  const credential = getCredential();
  if (!credential) {
    throw new Error('SESSION_EXPIRED');
  }
  const headers = {
    Authorization: `Bearer ${credential}`,
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('SESSION_EXPIRED');
    }
    if (res.status === 403) {
      const err = new Error(data?.error || 'Acceso denegado. Correo no autorizado.');
      err.code = 'ACCESS_DENIED';
      throw err;
    }
    const code = data?.error;
    const message = data?.message;
    let msg = message || code || `Error del servidor (${res.status})`;
    if (res.status === 500 && data?.detail) msg += ` — ${data.detail}`;
    const err = new Error(msg);
    if (code) {
      err.code = code;
    }
    throw err;
  }
  return data;
}

export async function getProfile() {
  const { profile } = await apiFetch('/api/profile');
  return profile;
}

export async function saveProfile(body) {
  await apiFetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Verifica si un nombre de usuario está disponible. Devuelve { available, error } o lanza si la petición falla. */
export async function checkUsernameAvailability(username) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    return { available: false, error: 'Indica un nombre de usuario.' };
  }
  const credential = getCredential();
  if (!credential) throw new Error('SESSION_EXPIRED');
  const res = await fetch(
    `${API_BASE}/api/profile/username/check?username=${encodeURIComponent(username.trim())}`,
    { headers: { Authorization: `Bearer ${credential}` } }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    if (res.status === 403) {
      const e = new Error(data?.error || 'Acceso denegado. Correo no autorizado.');
      e.code = 'ACCESS_DENIED';
      throw e;
    }
    const code = data?.error;
    const message = data?.message;
    // 500: error de servidor — no interpretar como "username en uso"
    if (res.status >= 500) {
      throw new Error(message || code || 'Error al verificar disponibilidad.');
    }
    // 400: error de validación — formato inválido
    if (res.status === 400) {
      throw new Error(message || code || 'Formato inválido.');
    }
    return { available: false, error: message || code || 'Nombre de usuario no disponible.' };
  }
  return { available: data.available, error: data.error };
}

export async function uploadProfilePhoto(file) {
  const formData = new FormData();
  formData.append('photo', file);
  await apiFetch('/api/profile/photo', {
    method: 'POST',
    body: formData,
  });
}

export async function deleteProfilePhoto() {
  await apiFetch('/api/profile/photo', { method: 'DELETE' });
}

/** Descarga un reporte PDF semanal. type: 'positives' | 'negatives' | 'volume' */
export async function downloadReport(type) {
  const credential = getCredential();
  if (!credential) throw new Error('SESSION_EXPIRED');
  const res = await fetch(`${API_BASE}/api/reports/weekly/${type}`, {
    headers: { Authorization: `Bearer ${credential}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 403) {
      const e = new Error(data?.error || 'Acceso denegado. Correo no autorizado.');
      e.code = 'ACCESS_DENIED';
      throw e;
    }
    throw new Error(data?.error || `Error al descargar (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte-${type === 'positives' ? 'consenso' : type === 'negatives' ? 'rechazo' : 'conflicto'}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Consume una acción de rate limit. Devuelve { ok: true } o { ok: false, rateLimited: true, action, reason }. */
export async function consumeAction(action) {
  const credential = getCredential();
  if (!credential) throw new Error('SESSION_EXPIRED');
  const res = await fetch(`${API_BASE}/api/actions/consume`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credential}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) {
    return { ok: false, rateLimited: true, action: data.action, reason: data.reason };
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    if (res.status === 403) {
      const e = new Error(data?.error || 'Acceso denegado. Correo no autorizado.');
      e.code = 'ACCESS_DENIED';
      throw e;
    }
    throw new Error(data?.error || `Error (${res.status})`);
  }
  return { ok: true };
}

/** Estado Premium: { isPremium, alias, tickets }. */
export async function getPremiumStatus() {
  return apiFetch('/api/premium/status');
}

/** Envía un ticket de pago. body: { reference, paymentDate, amount }. */
export async function submitPaymentTicket(body) {
  return apiFetch('/api/premium/ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Obtiene la foto de perfil como blob URL (requiere autorización). Devuelve null si no hay foto. */
export async function fetchProfilePhotoBlobURL() {
  const credential = getCredential();
  if (!credential) return null;
  const res = await fetch(`${API_BASE}/api/profile/photo`, {
    headers: { Authorization: `Bearer ${credential}` },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

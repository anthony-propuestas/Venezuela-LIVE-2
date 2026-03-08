import { useState, useCallback } from 'react';
import { GoogleLogin, useGoogleOneTapLogin } from '@react-oauth/google';
import { AlertCircle, Loader2 } from 'lucide-react';
import { validateCredential } from '@client/services/api.service';

const AUTH_STORAGE_KEY = 'venezuelaLive_auth';

/** Cuando es true, la auth con Google está pausada: se muestra "Entrar (modo pruebas)" y cualquiera puede acceder. */
export const AUTH_PAUSED = import.meta.env.VITE_GOOGLE_AUTH_PAUSED === 'true';
const DEV_BYPASS_CREDENTIAL = '__dev_bypass__';

/** Decodifica el JWT de la credencial para obtener payload (exp, email, name, picture). */
function decodeCredentialPayload(credential) {
  try {
    const base64Url = credential.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/** Guarda la sesión en localStorage. */
export function saveAuth(credential) {
  const payload = decodeCredentialPayload(credential);
  if (!payload) return;
  const expiresAt = payload.exp ? payload.exp * 1000 : Date.now() + 60 * 60 * 1000;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    credential,
    payload: { exp: payload.exp, email: payload.email, name: payload.name, picture: payload.picture },
    expiresAt,
  }));
}

/** Elimina la sesión guardada (cerrar sesión). */
export function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/** Guarda una sesión de pruebas (solo cuando AUTH_PAUSED). Permite entrar sin Google. */
export function saveDevBypassAuth() {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 h
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    credential: DEV_BYPASS_CREDENTIAL,
    payload: { email: 'pruebas@local', name: 'Usuario Pruebas', picture: null },
    expiresAt,
  }));
}

/** Comprueba si hay sesión válida guardada. Acepta JWT de Google o sesión de bypass (modo pruebas). */
export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const credential = data?.credential;
    if (!credential || typeof credential !== 'string') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    // Sesión de pruebas (auth pausada)
    if (credential === DEV_BYPASS_CREDENTIAL) {
      if (data.expiresAt && Date.now() >= data.expiresAt) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }
      return data;
    }
    // JWT de Google
    const payload = decodeCredentialPayload(credential);
    if (!payload) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    const exp = payload.exp;
    if (exp && typeof exp === 'number' && exp * 1000 <= Date.now()) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    if (data.expiresAt && Date.now() >= data.expiresAt) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

/**
 * Mensaje amigable según el tipo de error.
 * Google OAuth devuelve errores en distintos formatos:
 * - OAuth: { error: "access_denied" } (string)
 * - Non-OAuth: { type: "popup_closed" | "popup_failed_to_open" | "popup_blocked_by_browser" | "idpiframe_initialization_failed" }
 * - Excepciones JS: { message: "..." }
 */
function getErrorMessage(error) {
  if (!error) return 'No se pudo completar el inicio de sesión. Intenta de nuevo.';
  // Incluir error.type porque Google envía errores no-OAuth con { type: "popup_closed" } etc.
  const msg = typeof error === 'string'
    ? error
    : (error.message || error.error || error.type || String(error)).trim();
  if (!msg) return 'Algo salió mal. Usa el botón "Continuar con Google" para intentar de nuevo.';

  // No mostrar error: usuario cerró/canceló (no es fallo técnico)
  if (/popup_closed|opt_out|no_session|cancel/i.test(msg)) return null;

  // Error de conexión: popup no abrió, red, fetch
  if (/popup_failed|popup_failed_to_open|network|fetch|load failed/i.test(msg)) {
    return 'Error de conexión. Revisa tu internet e intenta de nuevo.';
  }

  // Navegador bloqueó: cookies, iframe, popup bloqueado, third-party
  if (/idpiframe|third_party|cookie|popup_blocked|postMessage/i.test(msg)) {
    return 'El navegador bloqueó el inicio de sesión. Desactiva bloqueadores o usa el botón "Continuar con Google".';
  }

  // Usuario denegó acceso explícitamente
  if (/access_denied|unauthorized/i.test(msg)) {
    return 'Acceso denegado. Prueba con otra cuenta de Google.';
  }

  // Errores de configuración OAuth (ej. invalid_client, invalid_request)
  if (/invalid_client|invalid_request|redirect_uri/i.test(msg)) {
    return 'Error de configuración. Contacta al administrador.';
  }

  return msg || 'Algo salió mal. Usa el botón "Continuar con Google" para intentar de nuevo.';
}

/** Pantalla de login solo para modo pruebas: no usa Google OAuth (evita error "must be used within GoogleOAuthProvider"). */
export function LoginBypass({ setEstaAutenticado }) {
  const handleDevBypass = useCallback(() => {
    saveDevBypassAuth();
    setEstaAutenticado(true);
  }, [setEstaAutenticado]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-slate-300 font-sans">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="flex items-center gap-3 mb-2">
          <img src="https://flagcdn.com/w40/ve.png" alt="Venezuela" className="w-10 h-8 object-cover rounded-sm" />
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="text-yellow-400">VEN</span>
            <span className="text-blue-500">EZU</span>
            <span className="text-red-500">ELA</span>
            <span className="text-white"> LIVE</span>
          </h1>
        </div>
        <p className="text-slate-500 text-sm mb-8">Inicia sesión para acceder</p>
        <div className="w-full flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleDevBypass}
            className="w-full max-w-[320px] flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-xl transition"
          >
            Entrar (modo pruebas)
          </button>
          <p className="text-slate-500 text-xs text-center">
            Inicio de sesión con Google suspendido temporalmente. Cualquiera puede acceder.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Login({ setEstaAutenticado }) {
  const [loginError, setLoginError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSuccess = useCallback(async (response) => {
    const credential = response?.credential;
    if (!credential) return;
    setIsProcessing(true);
    setLoginError(null);
    try {
      const validation = await validateCredential(credential);
      if (!validation.ok && validation.status === 403) {
        setLoginError(validation.error || 'Acceso denegado. Correo no autorizado.');
        return;
      }
      saveAuth(credential);
      setEstaAutenticado(true);
    } catch (e) {
      setLoginError(e?.message || 'No se pudo guardar la sesión. Intenta de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  }, [setEstaAutenticado]);

  const handleError = useCallback((error) => {
    const message = getErrorMessage(error);
    if (message) setLoginError(message);
    else setLoginError(null); // Cerrar One Tap no es error, solo mostramos el botón
  }, []);

  // Evitar One Tap en iframes y en Cursor/entornos embebidos para prevenir
  // "Cannot read properties of null (reading 'postMessage')" (GSI usa iframes + postMessage).
  const isEmbedded =
    typeof window !== 'undefined' && window.self !== window.top;
  const isCursorOrEmbedded =
    typeof window !== 'undefined' &&
    (window.name?.includes?.('Cursor') ||
      /Cursor|CursorBrowser/i.test(navigator.userAgent || ''));
  const oneTapDisabled = isProcessing || isEmbedded || isCursorOrEmbedded;

  useGoogleOneTapLogin({
    onSuccess: handleSuccess,
    onError: handleError,
    cancel_on_tap_outside: false,
    disabled: oneTapDisabled,
  });

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-slate-300 font-sans">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Branding */}
        <div className="flex items-center gap-3 mb-2">
          <img src="https://flagcdn.com/w40/ve.png" alt="Venezuela" className="w-10 h-8 object-cover rounded-sm" />
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="text-yellow-400">VEN</span>
            <span className="text-blue-500">EZU</span>
            <span className="text-red-500">ELA</span>
            <span className="text-white"> LIVE</span>
          </h1>
        </div>
        <p className="text-slate-500 text-sm mb-8">Inicia sesión para acceder</p>

        {/* Error */}
        {loginError && (
          <div className="w-full mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-900/20 border border-red-700/50 text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{loginError}</span>
          </div>
        )}

        {/* Loading */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-cyan-400 mb-6">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Entrando...</span>
          </div>
        )}

        {/* Botón Google (Login solo se monta cuando auth no está pausada; ver app.jsx) */}
        {!isProcessing && (
          <div className="w-full flex justify-center [&>div]:!flex [&>div]:!justify-center">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={(err) => handleError(err?.error || err)}
              useOneTap={false}
              theme="filled_black"
              size="large"
              text="continue_with"
              shape="rectangular"
              width="320"
            />
          </div>
        )}

        <p className="mt-8 text-slate-600 text-xs text-center max-w-[280px]">
          Debes iniciar sesión con Google para usar Venezuela LIVE. No compartimos tu correo con terceros.
        </p>
      </div>
    </div>
  );
}

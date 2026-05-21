import { useState, useCallback, useEffect } from 'react';
import { GoogleLogin, useGoogleOneTapLogin } from '@react-oauth/google';
import { AlertCircle, Loader2, Lightbulb, Users, TrendingUp } from 'lucide-react';
import { validateCredential } from '@client/services/api.service';
import { setSession, clearSession, getSession } from '@client/auth/session';

/** Cuando es true, la auth con Google está pausada: se muestra "Entrar (modo pruebas)" y cualquiera puede acceder. */
export const AUTH_PAUSED = import.meta.env.VITE_GOOGLE_AUTH_PAUSED === 'true';
const DEV_BYPASS_CREDENTIAL = '__dev_bypass__';
export const TOPICS = ['educación', 'salud', 'economía', 'libertad', 'infraestructura', 'futuro'];

/** Calcula el siguiente estado del efecto typewriter. Pure — sin efectos secundarios. */
export function typewriterStep({ displayText, isDeleting, topicIndex }, topics) {
  const currentWord = topics[topicIndex];
  if (isDeleting) {
    if (displayText === '') {
      return { displayText: '', isDeleting: false, topicIndex: (topicIndex + 1) % topics.length };
    }
    return { displayText: currentWord.slice(0, displayText.length - 1), isDeleting, topicIndex };
  }
  if (displayText === currentWord) {
    return { displayText, isDeleting, topicIndex, done: true };
  }
  return { displayText: currentWord.slice(0, displayText.length + 1), isDeleting: false, topicIndex };
}
const KEYFRAMES_CSS = `
  @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
  @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .animate-float { animation: float 6s ease-in-out infinite; }
  .animate-float-slow { animation: float 8s ease-in-out infinite 1s; }
  .animate-float-slower { animation: float 10s ease-in-out infinite 2s; }
  .animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }
  .animate-fade-in-up-1 { animation: fadeInUp 0.6s ease-out 0.1s both; }
  .animate-fade-in-up-2 { animation: fadeInUp 0.6s ease-out 0.2s both; }
  .animate-fade-in-up-3 { animation: fadeInUp 0.6s ease-out 0.35s both; }
  .animate-fade-in-up-4 { animation: fadeInUp 0.6s ease-out 0.5s both; }
  .gradient-animate { background: linear-gradient(135deg, #000000 0%, #1a0a00 25%, #000a1a 50%, #1a0000 75%, #000000 100%); background-size: 400% 400%; animation: gradientShift 12s ease infinite; }
`;

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

/** Guarda la sesión en memoria (no se persiste en storage del navegador). */
export function saveAuth(credential) {
  const payload = decodeCredentialPayload(credential);
  if (!payload) return;
  const expiresAt = payload.exp ? payload.exp * 1000 : Date.now() + 60 * 60 * 1000;
  setSession({
    credential,
    payload: { exp: payload.exp, email: payload.email, name: payload.name, picture: payload.picture },
    expiresAt,
  });
}

/** Elimina la sesión guardada (cerrar sesión). */
export function clearAuth() {
  clearSession();
}

/** Guarda una sesión de pruebas (solo cuando AUTH_PAUSED) en memoria. Permite entrar sin Google. */
export function saveDevBypassAuth() {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 h
  setSession({
    credential: DEV_BYPASS_CREDENTIAL,
    payload: { email: 'pruebas@local', name: 'Usuario Pruebas', picture: null },
    expiresAt,
    isDevBypass: true,
  });
}

/** Comprueba si hay sesión válida guardada en memoria. Acepta JWT de Google o sesión de bypass (modo pruebas). */
export function getStoredAuth() {
  const session = getSession();
  if (!session) return null;
  const { credential, payload, expiresAt } = session;
  return {
    credential,
    payload: payload || null,
    expiresAt: expiresAt || null,
  };
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
    <>
      <style>{KEYFRAMES_CSS}</style>
      <div className="min-h-screen relative overflow-hidden flex gradient-animate">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl animate-float-slow pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-72 h-72 bg-red-500/5 rounded-full blur-3xl animate-float-slower pointer-events-none" />

        <div className="hidden lg:flex flex-col justify-center flex-[3] px-16 py-12 relative z-10">
          <div className="flex items-center gap-3 mb-10 animate-fade-in-up">
            <img src="https://flagcdn.com/w40/ve.png" alt="Venezuela" className="w-10 h-8 object-cover rounded-sm" />
            <span className="text-2xl font-extrabold tracking-tight">
              <span className="text-yellow-400">VEN</span>
              <span className="text-blue-500">EZU</span>
              <span className="text-red-500">ELA</span>
              <span className="text-white"> LIVE</span>
            </span>
          </div>
          <h1 className="text-5xl font-extrabold text-white leading-tight mb-4 animate-fade-in-up-1">
            La voz que<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-blue-400 to-red-400">
              Venezuela necesita
            </span>
          </h1>
          <p className="text-xl text-slate-400 mb-10 animate-fade-in-up-2">
            Impulsa el futuro del país
          </p>
          <div className="space-y-6 animate-fade-in-up-3">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-white font-bold">Propón ideas</p>
                <p className="text-slate-500 text-sm">Comparte soluciones reales para los retos del país</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-bold">Debate abierto</p>
                <p className="text-slate-500 text-sm">Las mejores ideas suben, la comunidad decide</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-white font-bold">Construye el futuro</p>
                <p className="text-slate-500 text-sm">Juntos diseñamos la Venezuela que merecemos</p>
              </div>
            </div>
          </div>
          <p className="mt-12 text-slate-600 text-sm animate-fade-in-up-4">
            "La red social donde las ideas se convierten en cambio real"
          </p>
        </div>

        <div className="flex flex-col items-center justify-center flex-[2] min-h-screen px-8 relative z-10">
          <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-3xl p-8 shadow-2xl animate-fade-in-up">
            <div className="flex lg:hidden items-center gap-3 mb-6 justify-center">
              <img src="https://flagcdn.com/w40/ve.png" alt="Venezuela" className="w-10 h-8 object-cover rounded-sm" />
              <h1 className="text-2xl font-extrabold tracking-tight">
                <span className="text-yellow-400">VEN</span>
                <span className="text-blue-500">EZU</span>
                <span className="text-red-500">ELA</span>
                <span className="text-white"> LIVE</span>
              </h1>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 text-center">Únete al debate</h2>
            <p className="text-slate-500 text-sm text-center mb-8">Inicia sesión para acceder</p>
            <button
              type="button"
              onClick={handleDevBypass}
              className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-xl transition"
            >
              Entrar (modo pruebas)
            </button>
            <p className="text-slate-500 text-xs text-center mt-4">
              Inicio de sesión con Google suspendido temporalmente. Cualquiera puede acceder.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Login({ setEstaAutenticado }) {
  const [loginError, setLoginError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [topicIndex, setTopicIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const speed = isDeleting ? 60 : 110;
    const timeout = setTimeout(() => {
      const next = typewriterStep({ displayText, isDeleting, topicIndex }, TOPICS);
      if (next.done) {
        setTimeout(() => setIsDeleting(true), 1800);
        return;
      }
      setDisplayText(next.displayText);
      setIsDeleting(next.isDeleting);
      setTopicIndex(next.topicIndex);
    }, speed);
    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, topicIndex]);

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
    <>
      <style>{KEYFRAMES_CSS}</style>
      <div className="min-h-screen relative overflow-hidden flex gradient-animate">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl animate-float-slow pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-72 h-72 bg-red-500/5 rounded-full blur-3xl animate-float-slower pointer-events-none" />

        {/* Panel izquierdo — marketing */}
        <div className="hidden lg:flex flex-col justify-center flex-[3] px-16 py-12 relative z-10">
          <div className="flex items-center gap-3 mb-10 animate-fade-in-up">
            <img src="https://flagcdn.com/w40/ve.png" alt="Venezuela" className="w-10 h-8 object-cover rounded-sm" />
            <span className="text-2xl font-extrabold tracking-tight">
              <span className="text-yellow-400">VEN</span>
              <span className="text-blue-500">EZU</span>
              <span className="text-red-500">ELA</span>
              <span className="text-white"> LIVE</span>
            </span>
          </div>
          <h1 className="text-5xl font-extrabold text-white leading-tight mb-4 animate-fade-in-up-1">
            La voz que<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-blue-400 to-red-400">
              Venezuela necesita
            </span>
          </h1>
          <p className="text-xl text-slate-400 mb-10 animate-fade-in-up-2">
            Impulsa la{' '}
            <span className="text-cyan-400 font-semibold">
              {displayText}<span className="animate-pulse">|</span>
            </span>
            {' '}del país
          </p>
          <div className="space-y-6 animate-fade-in-up-3">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-white font-bold">Propón ideas</p>
                <p className="text-slate-500 text-sm">Comparte soluciones reales para los retos del país</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-bold">Debate abierto</p>
                <p className="text-slate-500 text-sm">Las mejores ideas suben, la comunidad decide</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-white font-bold">Construye el futuro</p>
                <p className="text-slate-500 text-sm">Juntos diseñamos la Venezuela que merecemos</p>
              </div>
            </div>
          </div>
          <p className="mt-12 text-slate-600 text-sm animate-fade-in-up-4">
            "La red social donde las ideas se convierten en cambio real"
          </p>
        </div>

        {/* Panel derecho — login */}
        <div className="flex flex-col items-center justify-center flex-[2] min-h-screen px-8 relative z-10">
          <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-3xl p-8 shadow-2xl animate-fade-in-up">
            <div className="flex lg:hidden items-center gap-3 mb-6 justify-center">
              <img src="https://flagcdn.com/w40/ve.png" alt="Venezuela" className="w-10 h-8 object-cover rounded-sm" />
              <h1 className="text-2xl font-extrabold tracking-tight">
                <span className="text-yellow-400">VEN</span>
                <span className="text-blue-500">EZU</span>
                <span className="text-red-500">ELA</span>
                <span className="text-white"> LIVE</span>
              </h1>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 text-center">Únete al debate</h2>
            <p className="text-slate-500 text-sm text-center mb-8">Inicia sesión para acceder</p>

            {loginError && (
              <div className="w-full mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-900/20 border border-red-700/50 text-red-300 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            {isProcessing && (
              <div className="flex items-center justify-center gap-2 text-cyan-400 mb-6">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Entrando...</span>
              </div>
            )}

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

            <p className="mt-8 text-slate-600 text-xs text-center">
              No compartimos tu correo con terceros.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

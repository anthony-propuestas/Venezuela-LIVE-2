import React, { useState, useRef, useCallback, useEffect } from 'react';
import { User, Mail, Calendar, FileText, Tag, Plus, X, ChevronDown, ArrowLeft, LogOut, Camera, Loader2, Save, AtSign, CheckCircle, XCircle } from 'lucide-react';
import { getStoredAuth, clearAuth, AUTH_PAUSED } from '@client/pages/Login/Login.page';
import { useError } from '@client/context/ErrorContext';
import * as api from '@client/services/api.service';

const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

function isSessionExpired(err) {
  return err?.message === 'SESSION_EXPIRED';
}

export default function Profile({
  onBack,
  onLogout,
  userIdeologies,
  setUserIdeologies,
  showIdeologyDropdown,
  setShowIdeologyDropdown,
  availableIdeologies,
}) {
  const { addError } = useError();
  const auth = getStoredAuth();
  const payload = auth?.payload || {};

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  const [birthDate, setBirthDate] = useState('');
  const [description, setDescription] = useState('');
  const [profilePhotoURL, setProfilePhotoURL] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const saveTimeoutRef = useRef(null);
  const usernameCheckRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleApiError = useCallback(
    (err) => {
      if (isSessionExpired(err) || (err?.message && err.message.includes('autorizado'))) {
        if (AUTH_PAUSED) {
          addError('Modo pruebas: el perfil en el backend no está disponible. Ejecuta el worker con npm run dev:worker.', 'dev_profile_unavailable');
          return;
        }
        addError('Tu sesión ha expirado. Inicia sesión de nuevo.', 'session_expired');
        clearAuth();
        onLogout();
        return;
      }
      const msg = err?.message || '';
      const isNetworkError = typeof err?.name === 'string' && err.name === 'TypeError' ||
        /failed to fetch|load failed|network|connection refused/i.test(msg);
      if (isNetworkError) {
        addError('No se pudo conectar al servidor. ¿Está el worker en marcha? Ejecuta en otra terminal: npm run dev:worker', 'warning');
      } else {
        addError(msg || 'Error de conexión. Intenta de nuevo.');
      }
    },
    [addError, onLogout]
  );

  const handleApiErrorRef = useRef(handleApiError);
  const setUserIdeologiesRef = useRef(setUserIdeologies);
  const loadProfileInProgressRef = useRef(false);
  handleApiErrorRef.current = handleApiError;
  setUserIdeologiesRef.current = setUserIdeologies;

  const loadProfile = useCallback(async () => {
    if (loadProfileInProgressRef.current) return;
    loadProfileInProgressRef.current = true;
    setProfileLoadFailed(false);
    setProfileLoading(true);
    let photoBlobURL = null;
    try {
      const profile = await api.getProfile();
      loadProfileInProgressRef.current = false;
      if (!profile) {
        setProfileLoading(false);
        return;
      }
      setDisplayName(profile.displayName ?? '');
      setUsername(profile.username ?? '');
      setBirthDate(profile.birthDate ?? '');
      setDescription(profile.description ?? '');
      setUserIdeologiesRef.current(profile.ideologies ?? []);
      if (profile.hasPhoto) {
        photoBlobURL = await api.fetchProfilePhotoBlobURL();
        if (photoBlobURL) setProfilePhotoURL(photoBlobURL);
      }
    } catch (err) {
      loadProfileInProgressRef.current = false;
      setProfileLoadFailed(true);
      handleApiErrorRef.current(err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveProfileRef = useRef(async (data) => {
    try {
      await api.saveProfile(data);
    } catch (err) {
      handleApiErrorRef.current(err);
    }
  });

  useEffect(() => {
    if (profileLoading) return;
    // Permitir auto-guardado aunque profileLoadFailed — el PUT puede crear el perfil si no existe
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveProfileRef.current({ displayName, username, birthDate, description, ideologies: userIdeologies });
    }, 500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [displayName, username, birthDate, description, userIdeologies, profileLoading]);

  // Verificación de disponibilidad del username en tiempo real (debounce)
  useEffect(() => {
    const raw = username.trim().toLowerCase();
    if (raw.length === 0) {
      setUsernameStatus('idle');
      return;
    }
    if (raw.length < USERNAME_MIN || raw.length > USERNAME_MAX || !USERNAME_REGEX.test(raw)) {
      setUsernameStatus('invalid');
      return;
    }
    if (usernameCheckRef.current) clearTimeout(usernameCheckRef.current);
    setUsernameStatus('checking');
    usernameCheckRef.current = setTimeout(async () => {
      try {
        const { available, error } = await api.checkUsernameAvailability(username);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch (err) {
        setUsernameStatus('idle');
      } finally {
        usernameCheckRef.current = null;
      }
    }, 400);
    return () => {
      if (usernameCheckRef.current) clearTimeout(usernameCheckRef.current);
    };
  }, [username]);

  const handlePhotoChange = useCallback(
    async (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;

      if (!ALLOWED_TYPES.includes(file.type)) {
        addError('Formato no válido. Usa JPG, PNG o WebP.');
        return;
      }
      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        addError('La imagen no debe superar 2 MB.');
        return;
      }

      setPhotoUploading(true);
      try {
        await api.uploadProfilePhoto(file);
        const blobURL = await api.fetchProfilePhotoBlobURL();
        if (blobURL) {
          setProfilePhotoURL((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return blobURL;
          });
        }
      } catch (err) {
        handleApiError(err);
      } finally {
        setPhotoUploading(false);
      }
      e.target.value = '';
    },
    [addError, handleApiError]
  );

  const handleRemovePhoto = useCallback(async () => {
    setPhotoUploading(true);
    try {
      await api.deleteProfilePhoto();
      setProfilePhotoURL((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } catch (err) {
      handleApiError(err);
    } finally {
      setPhotoUploading(false);
    }
  }, [handleApiError]);

  const handleLogout = useCallback(() => {
    try {
      clearAuth();
      onLogout();
    } catch (err) {
      addError(err?.message || 'No se pudo cerrar sesión. Intenta de nuevo.');
    }
  }, [onLogout, addError]);

  /** Guarda en la base de datos: nombre, fecha de nacimiento, descripción e ideologías. */
  const handleSaveProfile = useCallback(async () => {
    setSavingProfile(true);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    try {
      await api.saveProfile({
        displayName,
        username,
        birthDate,
        description,
        ideologies: userIdeologies,
      });
      addError('Información guardada correctamente.', 'success');
    } catch (err) {
      handleApiError(err);
    } finally {
      setSavingProfile(false);
    }
  }, [displayName, username, birthDate, description, userIdeologies, addError, handleApiError]);

  const photoSource = profilePhotoURL || payload.picture || null;
  const displayNameValue = displayName || payload.name || '';
  const emailValue = payload.email || '';

  if (profileLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">Volver al inicio</span>
      </button>

      <h2 className="text-2xl font-bold text-slate-200 mb-8">Perfil</h2>

      <div className="space-y-6">
        {/* Foto de perfil */}
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6">
          <label className="flex items-center gap-2 text-slate-300 text-sm font-medium mb-3">
            <User className="w-4 h-4 text-cyan-400" />
            Foto de perfil
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-slate-700 border-2 border-slate-600 overflow-hidden flex items-center justify-center ring-2 ring-slate-600/50">
                {photoUploading ? (
                  <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                ) : photoSource ? (
                  <img
                    src={photoSource}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-slate-500" />
                )}
              </div>
              {photoSource && !photoUploading && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center"
                  aria-label="Quitar foto"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 text-slate-300 text-sm rounded-lg transition"
              >
                <Camera className="w-4 h-4" />
                {photoUploading ? 'Subiendo...' : 'Cambiar foto'}
              </button>
              <span className="text-xs text-slate-500">JPG, PNG o WebP. Máx. 2 MB</span>
            </div>
          </div>
        </div>

        {/* Nombre */}
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6">
          <label className="flex items-center gap-2 text-slate-300 text-sm font-medium mb-3">
            <User className="w-4 h-4 text-cyan-400" />
            Nombre
          </label>
          <input
            type="text"
            value={displayNameValue}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={payload.name || 'Tu nombre completo'}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        {/* Nombre de usuario (@handle único) */}
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6">
          <label className="flex items-center gap-2 text-slate-300 text-sm font-medium mb-3">
            <AtSign className="w-4 h-4 text-cyan-400" />
            Nombre de usuario
          </label>
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="ejemplo_usuario"
              className={`w-full bg-slate-700/50 border rounded-lg px-4 py-3 pl-9 text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                usernameStatus === 'taken' || usernameStatus === 'invalid'
                  ? 'border-red-500/60 focus:border-red-500'
                  : usernameStatus === 'available'
                    ? 'border-emerald-500/60 focus:border-emerald-500'
                    : 'border-slate-600 focus:border-cyan-500'
              }`}
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">@</span>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
              {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
              {usernameStatus === 'available' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
              {usernameStatus === 'taken' && <XCircle className="w-5 h-5 text-red-500" />}
              {usernameStatus === 'invalid' && username.trim().length > 0 && <XCircle className="w-5 h-5 text-amber-500" />}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Letras, números y guiones bajos. {USERNAME_MIN}-{USERNAME_MAX} caracteres. Debe ser único.
          </p>
          {usernameStatus === 'taken' && <p className="mt-1 text-xs text-red-400">Ese nombre de usuario ya está en uso.</p>}
          {usernameStatus === 'invalid' && username.trim().length > 0 && (
            <p className="mt-1 text-xs text-amber-400">
              Formato inválido o longitud incorrecta ({USERNAME_MIN}-{USERNAME_MAX} caracteres).
            </p>
          )}
        </div>

        {/* Correo */}
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6">
          <label className="flex items-center gap-2 text-slate-300 text-sm font-medium mb-3">
            <Mail className="w-4 h-4 text-cyan-400" />
            Correo electrónico
          </label>
          <input
            type="email"
            value={emailValue}
            readOnly
            placeholder="tu@correo.com"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none cursor-not-allowed opacity-90"
          />
        </div>

        {/* Fecha de nacimiento */}
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6">
          <label className="flex items-center gap-2 text-slate-300 text-sm font-medium mb-3">
            <Calendar className="w-4 h-4 text-cyan-400" />
            Fecha de nacimiento
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        {/* Descripción */}
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6">
          <label className="flex items-center gap-2 text-slate-300 text-sm font-medium mb-3">
            <FileText className="w-4 h-4 text-cyan-400" />
            Descripción
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Cuéntanos sobre ti..."
            rows={4}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition resize-none"
          />
        </div>

        {/* Ideologías */}
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6">
          <label className="flex items-center gap-2 text-slate-300 text-sm font-medium mb-3">
            <Tag className="w-4 h-4 text-cyan-400" />
            Mis Ideologías
          </label>
          <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
            {userIdeologies.length === 0 ? (
              <span className="text-slate-500 text-sm italic">No has seleccionado ninguna ideología</span>
            ) : (
              userIdeologies.map((ideology, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 text-sm rounded-full"
                >
                  {ideology}
                  <button
                    type="button"
                    onClick={() => setUserIdeologies(userIdeologies.filter((_, i) => i !== index))}
                    className="hover:text-cyan-200 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowIdeologyDropdown(!showIdeologyDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Agregar ideología
              <ChevronDown className={`w-4 h-4 transition-transform ${showIdeologyDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showIdeologyDropdown && (
              <div className="absolute left-0 top-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden min-w-[200px]">
                {availableIdeologies
                  .filter((ideology) => !userIdeologies.includes(ideology))
                  .map((ideology, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setUserIdeologies([...userIdeologies, ideology]);
                        setShowIdeologyDropdown(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-cyan-600/20 text-slate-300 hover:text-cyan-400 text-sm transition"
                    >
                      {ideology}
                    </button>
                  ))}
                {availableIdeologies.filter((ideology) => !userIdeologies.includes(ideology)).length === 0 && (
                  <div className="px-4 py-3 text-slate-500 text-sm italic">
                    Ya seleccionaste todas las ideologías
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Guardar información del perfil en la base de datos */}
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6">
          {profileLoadFailed && (
            <div className="mb-4 p-4 bg-amber-900/20 border border-amber-600/40 rounded-xl">
              <p className="text-amber-400 text-sm mb-3">No se pudo cargar el perfil. Asegúrate de que el worker esté en marcha (npm run dev:worker) y que las migraciones estén aplicadas.</p>
              <button
                type="button"
                onClick={loadProfile}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600/60 hover:bg-amber-600 text-amber-200 text-sm font-medium rounded-lg transition"
              >
                Reintentar cargar
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-600/60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition"
            aria-label="Guardar información"
          >
            {savingProfile ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Guardar información
              </>
            )}
          </button>
          <p className="mt-2 text-slate-500 text-xs text-center">
            Guarda nombre, nombre de usuario, fecha de nacimiento, descripción e ideologías. La foto se guarda al subirla.
          </p>
        </div>

        {/* Cerrar sesión */}
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 text-red-400 font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  );
}

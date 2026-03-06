import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, X, CheckCircle } from 'lucide-react';

const ErrorContext = createContext(null);

export function ErrorProvider({ children }) {
  const [error, setError] = useState(null);

  const addError = useCallback((message, type = 'error') => {
    setError({ id: Date.now(), message, type });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <ErrorContext.Provider value={{ error, addError, clearError }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error('useError debe usarse dentro de ErrorProvider');
  return ctx;
}

/** Banner global de errores: mismo estilo que login (bg-red-900/20, border-red-700/50). */
export function ErrorBanner() {
  const { error, clearError } = useError();
  if (!error) return null;

  const isSession = error.type === 'session_expired';
  const isWarning = error.type === 'warning';
  const isSuccess = error.type === 'success';

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
        isSuccess
          ? 'bg-emerald-900/20 border-emerald-700/50 text-emerald-300'
          : isWarning
            ? 'bg-amber-900/20 border-amber-700/50 text-amber-300'
            : 'bg-red-900/20 border-red-700/50 text-red-300'
      }`}
      role="alert"
    >
      {isSuccess ? (
        <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      )}
      <span className="flex-1">{error.message}</span>
      <button
        type="button"
        onClick={clearError}
        className="p-1 rounded-lg hover:bg-white/10 transition"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

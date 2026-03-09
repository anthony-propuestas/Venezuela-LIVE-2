import React from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Fallback para vistas sin datos cacheados en modo offline.
 */
export function OfflineEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-slate-400">
      <WifiOff className="w-12 h-12 mb-4 text-slate-600" />
      <p className="text-sm font-medium">Sin conexión y sin datos previos disponibles</p>
      <p className="text-xs mt-1">Conecta a internet para cargar este contenido.</p>
    </div>
  );
}

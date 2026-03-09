import React from 'react';
import { WifiOff, Inbox } from 'lucide-react';

/**
 * Banner discreto para estado offline y acciones en cola.
 */
export function OfflineBanner({ isOnline, pendingCount }) {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/80 border-b border-slate-700/50 text-sm text-slate-300">
      {!isOnline && (
        <span className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-500" />
          Sin conexión. Los cambios se enviarán automáticamente cuando vuelva la conexión.
        </span>
      )}
      {pendingCount > 0 && (
        <span className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-blue-400" />
          {pendingCount} acción{pendingCount !== 1 ? 'es' : ''} en cola
        </span>
      )}
    </div>
  );
}

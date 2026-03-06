/**
 * Listeners que suscriben al Event Bus y procesan gamificación.
 * Ejecutan processGamificationEvent con try-catch para degradación elegante.
 */

import { onGamificationEvent } from './eventBus.js';
import { processGamificationEvent } from './service.js';
import type { GamificationEvent } from './types.js';

/**
 * Registra el listener de gamificación.
 * El context (con DB) debe ser pasado al emitir el evento desde el endpoint.
 */
export function registerGamificationListener(): () => void {
  return onGamificationEvent(async (event: GamificationEvent, context) => {
    if (!context?.DB) {
      console.warn('[Gamification] No DB en contexto, evento ignorado:', event.type);
      return;
    }
    try {
      await processGamificationEvent(context.DB, event);
    } catch (err) {
      console.error('[Gamification] Error procesando evento:', event.type, err);
    }
  });
}

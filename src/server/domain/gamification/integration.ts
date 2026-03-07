/**
 * Helpers para integrar gamificación en endpoints.
 * Ejemplo de uso:
 *
 * // Tras guardar un like exitosamente:
 * emitGamificationEventAsync(c, {
 *   type: 'LIKE_ENTITY',
 *   payload: { userId: c.get('user').userId, entityType: 'proposal', entityId: proposalId },
 * });
 *
 * La gamificación se ejecuta en background (waitUntil). Si falla, no afecta la respuesta.
 */

import type { Context } from 'hono';
import { emitGamificationEvent } from './eventBus.js';
import type { GamificationEvent } from './types.js';

/**
 * Emite un evento de gamificación en background sin bloquear la respuesta.
 * Usa executionCtx.waitUntil para que la gamificación no bloquee el endpoint.
 */
export function emitGamificationEventAsync(
  c: Context<{ Bindings: { DB: D1Database }; Variables: Record<string, unknown> }>,
  event: GamificationEvent
): void {
  const ctx = c.executionCtx;
  if (ctx?.waitUntil) {
    ctx.waitUntil(
      emitGamificationEvent(event, { DB: c.env.DB })
    );
  } else {
    emitGamificationEvent(event, { DB: c.env.DB }).catch((err) =>
      console.error('[Gamification] Evento no pudo procesarse:', err)
    );
  }
}

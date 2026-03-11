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
 * Usa executionCtx.waitUntil cuando existe (Cloudflare production); si no, hace fire-and-forget.
 * No debe lanzar nunca: en dev/local executionCtx puede no existir y provocaría 500.
 */
export function emitGamificationEventAsync(
  c: Context<{ Bindings: { DB: D1Database }; Variables: Record<string, unknown> }>,
  event: GamificationEvent
): void {
  try {
    const ctx = c.executionCtx as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
    if (ctx?.waitUntil && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(
        emitGamificationEvent(event, { DB: c.env.DB })
      );
    } else {
      emitGamificationEvent(event, { DB: c.env.DB }).catch((err) =>
        console.error('[Gamification] Evento no pudo procesarse:', err)
      );
    }
  } catch (err) {
    console.error('[Gamification] emitGamificationEventAsync:', err);
  }
}

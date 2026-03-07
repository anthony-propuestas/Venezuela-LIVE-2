/**
 * Event Bus (Pub-Sub) para gamificación.
 * Permite emitir eventos sin acoplar los controladores a la lógica de logros.
 */

import type { GamificationEvent } from './types.js';

export interface GamificationContext {
  DB: D1Database;
}

type Listener = (
  event: GamificationEvent,
  context: GamificationContext | null
) => void | Promise<void>;

const listeners: Listener[] = [];

/** Suscribe un listener a todos los eventos de gamificación. */
export function onGamificationEvent(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/** Emite un evento. Retorna una Promise para usar con waitUntil (no bloquea la respuesta). */
export function emitGamificationEvent(
  event: GamificationEvent,
  context: GamificationContext | null = null
): Promise<void> {
  const e = { ...event, timestamp: event.timestamp ?? new Date().toISOString() };
  const promises: Promise<void>[] = [];
  for (const listener of listeners) {
    try {
      const result = listener(e, context);
      if (result instanceof Promise) {
        promises.push(
          result.catch((err) => {
            console.error('[Gamification] Listener error:', err);
          }) as Promise<void>
        );
      }
    } catch (err) {
      console.error('[Gamification] Listener sync error:', err);
    }
  }
  return Promise.all(promises).then(() => undefined);
}

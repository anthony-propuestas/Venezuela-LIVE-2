/**
 * Módulo de gamificación: Event-Driven, ACID, degradación elegante.
 * @module gamification
 */

export { GamificationError } from './errors.js';
export {
  emitGamificationEvent,
  onGamificationEvent,
  type GamificationContext,
} from './eventBus.js';
export { processGamificationEvent } from './service.js';
export { registerGamificationListener } from './listeners.js';
export { emitGamificationEventAsync } from './integration.js';
export type {
  GamificationEvent,
  GamificationEventType,
  GamificationEventPayload,
  Achievement,
  UserAchievementRow,
} from './types.js';
export { BASE_XP } from './types.js';

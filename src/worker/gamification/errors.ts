/**
 * Errores personalizados para el módulo de gamificación.
 * Permite identificar fallos y degradar elegantemente sin afectar la acción principal.
 */

export class GamificationError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'GamificationError';
    Object.setPrototypeOf(this, GamificationError.prototype);
  }
}

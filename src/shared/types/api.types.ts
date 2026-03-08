/**
 * Tipos compartidos para API (contrato client/server).
 */

/** Usuario autenticado (JWT o bypass dev). */
export type User = { userId: string; email: string; name: string };

/** Cuerpo de PUT /api/profile */
export interface ProfileUpdateBody {
  displayName?: string;
  username?: string;
  birthDate?: string;
  description?: string;
  ideologies?: string[];
}

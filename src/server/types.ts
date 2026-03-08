/**
 * Tipos para el backend (Pages Functions / Worker).
 * En Pages, context.env cumple EnvWithFetch; ASSETS lo inyecta el runtime.
 */

export type Env = {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  RATE_LIMIT_KV?: KVNamespace;
  RATE_LIMIT?: KVNamespace;
  /** Client ID de Google OAuth (secrets / .dev.vars). */
  GOOGLE_CLIENT_ID: string;
  /** Inyectado por Pages: fetcher para servir assets estáticos. */
  ASSETS: Fetcher;
  DEV_BYPASS_ALLOWED?: string;
  PREMIUM_ALIAS?: string;
  /** Secreto para invocar el cron semanal vía HTTP (solo header X-Cron-Secret). */
  CRON_SECRET: string;
};

export type { User } from '@shared/types/api.types.js';

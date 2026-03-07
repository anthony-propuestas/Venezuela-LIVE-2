import type { Env } from './types';
import { DependencyError } from './errors';

export function isDevBypassAllowed(env: Env): boolean {
  return env.DEV_BYPASS_ALLOWED === 'true';
}

export function getGoogleClientId(env: Env): string {
  const clientId = env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId || typeof clientId !== 'string') {
    throw new DependencyError(
      'CONFIG_ERROR',
      'GOOGLE_CLIENT_ID (o VITE_GOOGLE_CLIENT_ID) no está configurado en el entorno.'
    );
  }
  return clientId;
}

export function getCronSecret(env: Env): string {
  const secret = env.CRON_SECRET;
  if (!secret || typeof secret !== 'string') {
    throw new DependencyError('CONFIG_ERROR', 'CRON_SECRET no está configurado en el entorno.');
  }
  return secret;
}

export function getPremiumAlias(env: Env): string {
  return env.PREMIUM_ALIAS || '0000 0000 0000 0000 0000 0000';
}


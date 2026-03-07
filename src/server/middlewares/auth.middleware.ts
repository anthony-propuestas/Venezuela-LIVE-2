/// <reference types="@cloudflare/workers-types" />
import type { Context } from 'hono';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { Env, User } from '../types.js';
import { getGoogleClientId, isDevBypassAllowed } from '../config.js';
import { UnauthorizedError, mapErrorToResponseBody } from '../errors.js';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const DEV_BYPASS_TOKEN = '__dev_bypass__';
const DEV_BYPASS_USER: User = {
  userId: 'dev-bypass-user',
  email: 'pruebas@local',
  name: 'Usuario Pruebas',
};

type AppBindings = { Bindings: Env; Variables: { user: User } };

export async function verifyAuth(c: Context<AppBindings>): Promise<User | null> {
  const auth = c.req.raw.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  if (token === DEV_BYPASS_TOKEN && isDevBypassAllowed(c.env)) {
    return DEV_BYPASS_USER;
  }

  let clientId: string;
  try {
    clientId = getGoogleClientId(c.env);
  } catch {
    return null;
  }
  try {
    const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
    const { payload } = await jwtVerify(token, jwks, { audience: clientId });
    const userId = payload.sub as string;
    const email = (payload.email as string) || '';
    const name = (payload.name as string) || '';
    return { userId, email, name };
  } catch {
    return null;
  }
}

/** Middleware que exige JWT (o bypass en dev) en todas las rutas /api/* excepto /api/cron/weekly-reports. */
export function createAuthMiddleware() {
  return async (c: Context<AppBindings>, next: () => Promise<void>) => {
    if (c.req.path === '/api/cron/weekly-reports') {
      await next();
      return;
    }
    const user = await verifyAuth(c);
    if (!user) {
      const unauthorized = new UnauthorizedError();
      const { status, body } = mapErrorToResponseBody(unauthorized, isDevBypassAllowed(c.env));
      return c.json(body, status);
    }
    c.set('user', user);
    await next();
  };
}

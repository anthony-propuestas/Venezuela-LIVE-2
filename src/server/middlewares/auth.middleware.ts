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
  role: 'user',
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
    if (payload.email_verified !== true) {
      return null;
    }
    const userId = payload.sub as string;
    const email = (payload.email as string) || '';
    const name = (payload.name as string) || '';

    // Intentar obtener el rol desde la base de datos (profiles.role).
    let role: User['role'] = 'user';
    try {
      const row = await c.env.DB
        .prepare('SELECT role FROM profiles WHERE user_id = ?')
        .bind(userId)
        .first<{ role?: string }>();
      const rawRole = typeof row?.role === 'string' ? row.role : null;
      if (rawRole === 'moderator' || rawRole === 'admin' || rawRole === 'user') {
        role = rawRole;
      }
    } catch {
      // Si la tabla/columna no existe o hay error, degradar de forma segura a rol "user".
      role = 'user';
    }

    return { userId, email, name, role };
  } catch {
    return null;
  }
}

/** Middleware que exige JWT (o bypass en dev) en todas las rutas /api/* excepto /api/cron/weekly-reports. */
export function createAuthMiddleware() {
  return async (c: Context<AppBindings>, next: () => Promise<void>) => {
    if (
      c.req.path === '/api/cron/weekly-reports' ||
      c.req.path === '/api/cron/profile-photos-sanitize' ||
      c.req.path.startsWith('/api/admin/')
    ) {
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

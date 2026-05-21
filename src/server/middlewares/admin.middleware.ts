/// <reference types="@cloudflare/workers-types" />
import { SignJWT, jwtVerify } from 'jose';
import type { Context } from 'hono';
import type { Env } from '../types.js';

type AppBindings = { Bindings: Env };

function secretKey(password: string): Uint8Array {
  return new TextEncoder().encode(password);
}

export async function signAdminToken(password: string): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secretKey(password));
}

export async function verifyAdminToken(token: string, password: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secretKey(password));
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

export function createAdminMiddleware() {
  return async (c: Context<AppBindings>, next: () => Promise<void>) => {
    const password = c.env.ADMIN_PASSWORD;
    if (!password) {
      return c.json({ error: 'Panel de administración no configurado.' }, 503);
    }
    const auth = c.req.raw.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token || !(await verifyAdminToken(token, password))) {
      return c.json({ error: 'No autorizado.' }, 401);
    }
    await next();
  };
}

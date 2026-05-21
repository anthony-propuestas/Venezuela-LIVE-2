import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createAuthMiddleware } from './auth.middleware.js';
import type { Env, User } from '../types.js';

type AppBindings = { Bindings: Env; Variables: { user: User } };

const baseEnv = {
  DEV_BYPASS_ALLOWED: undefined,
  ALLOWLIST_EMAILS: '',
  DB: {} as unknown,
  R2_BUCKET: {} as unknown,
  CRON_SECRET: 'secret',
  ASSETS: {} as unknown,
} as unknown as Env;

function buildTestApp() {
  const app = new Hono<AppBindings>();
  app.use('/api/*', createAuthMiddleware());
  app.all('/api/cron/weekly-reports', (c) => c.json({ reached: true }));
  app.all('/api/cron/profile-photos-sanitize', (c) => c.json({ reached: true }));
  app.get('/api/profile', (c) => c.json({ reached: true }));
  return app;
}

describe('createAuthMiddleware – cron allowlist', () => {
  const app = buildTestApp();

  it('bypasses JWT for /api/cron/weekly-reports', async () => {
    const res = await app.request('/api/cron/weekly-reports', {}, baseEnv);
    expect(res.status).toBe(200);
    const body = await res.json() as { reached: boolean };
    expect(body.reached).toBe(true);
  });

  it('bypasses JWT for /api/cron/profile-photos-sanitize', async () => {
    const res = await app.request('/api/cron/profile-photos-sanitize', {}, baseEnv);
    expect(res.status).toBe(200);
    const body = await res.json() as { reached: boolean };
    expect(body.reached).toBe(true);
  });

  it('returns 401 for /api/profile without Authorization', async () => {
    const res = await app.request('/api/profile', {}, baseEnv);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('UNAUTHORIZED');
  });
});

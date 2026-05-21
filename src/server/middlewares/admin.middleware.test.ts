import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { signAdminToken, verifyAdminToken, createAdminMiddleware } from './admin.middleware.js';
import type { Env } from '../types.js';

type AppBindings = { Bindings: Env };

const TEST_PASSWORD = 'secret-test-password';

function buildTestApp() {
  const app = new Hono<AppBindings>();
  app.use('/api/admin/*', createAdminMiddleware());
  app.get('/api/admin/test', (c) => c.json({ reached: true }));
  return app;
}

describe('signAdminToken / verifyAdminToken', () => {
  it('round-trip con mismo password → true', async () => {
    const token = await signAdminToken(TEST_PASSWORD);
    expect(await verifyAdminToken(token, TEST_PASSWORD)).toBe(true);
  });

  it('password distinto → false', async () => {
    const token = await signAdminToken(TEST_PASSWORD);
    expect(await verifyAdminToken(token, 'otro-password')).toBe(false);
  });

  it('token malformado → false', async () => {
    expect(await verifyAdminToken('not-a-jwt', TEST_PASSWORD)).toBe(false);
  });
});

describe('createAdminMiddleware', () => {
  const app = buildTestApp();

  it('sin ADMIN_PASSWORD → 503', async () => {
    const res = await app.request('/api/admin/test', {}, {} as unknown as Env);
    expect(res.status).toBe(503);
  });

  it('sin Authorization header → 401', async () => {
    const res = await app.request(
      '/api/admin/test',
      {},
      { ADMIN_PASSWORD: TEST_PASSWORD } as unknown as Env,
    );
    expect(res.status).toBe(401);
  });

  it('token inválido → 401', async () => {
    const res = await app.request(
      '/api/admin/test',
      { headers: { Authorization: 'Bearer invalid-token' } },
      { ADMIN_PASSWORD: TEST_PASSWORD } as unknown as Env,
    );
    expect(res.status).toBe(401);
  });

  it('token válido → pasa al handler', async () => {
    const token = await signAdminToken(TEST_PASSWORD);
    const res = await app.request(
      '/api/admin/test',
      { headers: { Authorization: `Bearer ${token}` } },
      { ADMIN_PASSWORD: TEST_PASSWORD } as unknown as Env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reached: boolean };
    expect(body.reached).toBe(true);
  });
});

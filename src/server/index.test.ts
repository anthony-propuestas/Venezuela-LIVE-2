import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./domain/gamification/index.js', () => ({
  registerGamificationListener: vi.fn(),
}));
vi.mock('./domain/reports/controllers.js', () => ({
  handleGetReport: vi.fn(),
  handleCronReports: vi.fn(),
}));
vi.mock('./middlewares/rateLimit.middleware.js', () => ({
  checkAndIncrement: vi.fn(),
}));
vi.mock('./repositories/r2.repository.js', () => ({
  deleteProfilePhotoObject: vi.fn(),
  getProfilePhotoObject: vi.fn(),
  putProfilePhotoObject: vi.fn(),
}));
vi.mock('./domain/media/sanitizer.js', () => ({
  sanitizeImage: vi.fn(),
}));
vi.mock('./domain/gamification/integration.js', () => ({
  emitGamificationEventAsync: vi.fn(),
}));
vi.mock('./repositories/profile.repository.js', () => ({
  upsertProfile: vi.fn().mockResolvedValue(undefined),
  getUserIdByUsername: vi.fn().mockResolvedValue(null),
  countProfiles: vi.fn().mockResolvedValue(1),
  getProfileByUserId: vi.fn().mockResolvedValue(null),
  getGamificationForUser: vi.fn().mockResolvedValue({ totalXp: 0, achievements: [] }),
  getPhotoKeyByUserId: vi.fn().mockResolvedValue(null),
  upsertPhotoKey: vi.fn().mockResolvedValue(undefined),
  clearPhotoKey: vi.fn().mockResolvedValue(undefined),
}));

import { app } from './index.js';
import { upsertProfile } from './repositories/profile.repository.js';
import { signAdminToken } from './middlewares/admin.middleware.js';
import { checkAndIncrement } from './middlewares/rateLimit.middleware.js';
import type { Env } from './types.js';

const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'test-admin-secret';

const adminEnv = {
  DEV_BYPASS_ALLOWED: 'true',
  ALLOWLIST_EMAILS: '',
  DB: {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({ results: [] }),
    }),
  },
  R2_BUCKET: {} as unknown,
  CRON_SECRET: 'test-secret',
  ASSETS: {} as unknown,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} as unknown as Env;

// DEV_BYPASS_USER has email='pruebas@local', name='Usuario Pruebas'
const devEnv = {
  DEV_BYPASS_ALLOWED: 'true',
  ALLOWLIST_EMAILS: '',
  DB: {} as unknown,
  R2_BUCKET: {} as unknown,
  CRON_SECRET: 'test-secret',
  ASSETS: {} as unknown,
} as unknown as Env;

describe('PUT /api/profile – email field (BUGS fix)', () => {
  beforeEach(() => {
    vi.mocked(upsertProfile).mockClear();
  });

  it('saves email from JWT, not the name fallback', async () => {
    const res = await app.request(
      '/api/profile',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer __dev_bypass__',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: 'Test User' }),
      },
      devEnv,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);

    expect(vi.mocked(upsertProfile)).toHaveBeenCalledOnce();
    // Second arg is the UpsertProfileInput
    const input = vi.mocked(upsertProfile).mock.calls[0][1] as { email: string };
    // Must be the JWT email, never the name field ('Usuario Pruebas')
    expect(input.email).toBe('pruebas@local');
  });
});

describe('POST /api/admin/login', () => {
  it('sin ADMIN_EMAIL/ADMIN_PASSWORD en env → 503', async () => {
    const res = await app.request(
      '/api/admin/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'x', password: 'y' }),
      },
      devEnv,
    );
    expect(res.status).toBe(503);
  });

  it('credenciales incorrectas → 401', async () => {
    const res = await app.request(
      '/api/admin/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: 'wrong' }),
      },
      adminEnv,
    );
    expect(res.status).toBe(401);
  });

  it('credenciales correctas → 200 con token', async () => {
    const res = await app.request(
      '/api/admin/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      },
      adminEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
  });
});

describe('GET /api/admin/users', () => {
  it('sin Authorization → 401', async () => {
    const res = await app.request('/api/admin/users', {}, adminEnv);
    expect(res.status).toBe(401);
  });

  it('con token válido → 200', async () => {
    const token = await signAdminToken(ADMIN_PASSWORD);
    const res = await app.request(
      '/api/admin/users',
      { headers: { Authorization: `Bearer ${token}` } },
      adminEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: unknown[] };
    expect(Array.isArray(body.users)).toBe(true);
  });
});

describe('Regression – rutas normales', () => {
  it('GET /api/profile sin token → 401', async () => {
    const res = await app.request('/api/profile', {}, devEnv);
    expect(res.status).toBe(401);
  });
});

const mockPrepareAll = {
  bind: vi.fn().mockReturnThis(),
  all: vi.fn().mockResolvedValue({ results: [] }),
};
const mockBatch = vi.fn().mockResolvedValue([{}, {}]);
const topicsEnv = {
  DEV_BYPASS_ALLOWED: 'true',
  ALLOWLIST_EMAILS: '',
  DB: {
    prepare: vi.fn().mockReturnValue(mockPrepareAll),
    batch: mockBatch,
  },
  R2_BUCKET: {} as unknown,
  CRON_SECRET: 'test-secret',
  ASSETS: {} as unknown,
} as unknown as Env;

const noAuthEnv = {
  DEV_BYPASS_ALLOWED: 'false',
  ALLOWLIST_EMAILS: '',
  DB: {} as unknown,
  R2_BUCKET: {} as unknown,
  CRON_SECRET: 'test-secret',
  ASSETS: {} as unknown,
} as unknown as Env;

describe('GET /api/topics', () => {
  it('devuelve { threads: [] } cuando no hay datos en DB', async () => {
    const res = await app.request('/api/topics', { headers: { Authorization: 'Bearer __dev_bypass__' } }, topicsEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { threads: unknown[] };
    expect(body.threads).toEqual([]);
  });
});

describe('POST /api/topics', () => {
  beforeEach(() => {
    mockBatch.mockClear();
  });

  it('sin auth → 401', async () => {
    const res = await app.request(
      '/api/topics',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'Política', topicText: 'Tema', proposalTitle: 'P', proposalDescription: 'D' }),
      },
      noAuthEnv,
    );
    expect(res.status).toBe(401);
  });

  it('campo requerido faltante → 400 INVALID_TOPIC_DATA', async () => {
    const res = await app.request(
      '/api/topics',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer __dev_bypass__', 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'Política', proposalTitle: 'P', proposalDescription: 'D' }),
      },
      topicsEnv,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('INVALID_TOPIC_DATA');
  });

  it('body válido → 200 con thread', async () => {
    const res = await app.request(
      '/api/topics',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer __dev_bypass__', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'Política',
          subcategory: 'Nacional',
          topicText: 'Un tema de prueba',
          proposalTitle: 'Mi propuesta',
          proposalDescription: 'Una descripción de la propuesta.',
        }),
      },
      topicsEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { thread: { category: string; topic: string; proposals: unknown[] } };
    expect(body.thread.category).toBe('Política');
    expect(body.thread.topic).toBe('Un tema de prueba');
    expect(body.thread.proposals).toHaveLength(1);
    expect(mockBatch).toHaveBeenCalledOnce();
  });
});

// ─── Categories ───────────────────────────────────────────────────────────────

const mockRunCat = vi.fn().mockResolvedValue({ meta: { last_row_id: 42 } });
const mockPrepareCat = {
  bind: vi.fn().mockReturnThis(),
  all: vi.fn().mockResolvedValue({ results: [] }),
  run: mockRunCat,
};
const categoriesEnv = {
  DEV_BYPASS_ALLOWED: 'true',
  ALLOWLIST_EMAILS: '',
  DB: { prepare: vi.fn().mockReturnValue(mockPrepareCat) },
  R2_BUCKET: {} as unknown,
  CRON_SECRET: 'test-secret',
  ASSETS: {} as unknown,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} as unknown as Env;

describe('GET /api/categories', () => {
  it('sin auth → 401', async () => {
    const res = await app.request('/api/categories', {}, noAuthEnv);
    expect(res.status).toBe(401);
  });

  it('con dev bypass → 200 con array de categorías', async () => {
    const res = await app.request(
      '/api/categories',
      { headers: { Authorization: 'Bearer __dev_bypass__' } },
      categoriesEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { categories: unknown[] };
    expect(Array.isArray(body.categories)).toBe(true);
  });
});

describe('Admin categories routes', () => {
  let adminToken: string;

  beforeEach(async () => {
    adminToken = await signAdminToken(ADMIN_PASSWORD);
    mockRunCat.mockClear();
  });

  it('GET /api/admin/categories sin Authorization → 401', async () => {
    const res = await app.request('/api/admin/categories', {}, categoriesEnv);
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/categories con token válido → 200', async () => {
    const res = await app.request(
      '/api/admin/categories',
      { headers: { Authorization: `Bearer ${adminToken}` } },
      categoriesEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { categories: unknown[] };
    expect(Array.isArray(body.categories)).toBe(true);
  });

  it('POST /api/admin/categories sin name → 400', async () => {
    const res = await app.request(
      '/api/admin/categories',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'economia' }),
      },
      categoriesEnv,
    );
    expect(res.status).toBe(400);
  });

  it('POST /api/admin/categories body válido → 200 con id', async () => {
    const res = await app.request(
      '/api/admin/categories',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Economía', slug: 'economia', subcategories: ['Inflación'] }),
      },
      categoriesEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; id: number };
    expect(body.ok).toBe(true);
    expect(typeof body.id).toBe('number');
    expect(mockRunCat).toHaveBeenCalledOnce();
  });

  it('PUT /api/admin/categories/:id con token válido → 200', async () => {
    const res = await app.request(
      '/api/admin/categories/1',
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Economía', slug: 'economia', subcategories: [] }),
      },
      categoriesEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(mockRunCat).toHaveBeenCalledOnce();
  });

  it('DELETE /api/admin/categories/:id con token válido → 200', async () => {
    const res = await app.request(
      '/api/admin/categories/1',
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      categoriesEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(mockRunCat).toHaveBeenCalledOnce();
  });
});

const premiumEnv = {
  DEV_BYPASS_ALLOWED: 'true',
  ALLOWLIST_EMAILS: '',
  DB: {} as unknown,
  R2_BUCKET: {} as unknown,
  CRON_SECRET: 'test-secret',
  ASSETS: { fetch: async () => new Response('Not Found', { status: 404 }) } as unknown,
} as unknown as Env;

describe('Premium routes eliminadas', () => {
  it('GET /api/premium/status → 404', async () => {
    const res = await app.request(
      '/api/premium/status',
      { headers: { Authorization: 'Bearer __dev_bypass__' } },
      premiumEnv,
    );
    expect(res.status).toBe(404);
  });

  it('POST /api/premium/ticket → 404', async () => {
    const res = await app.request(
      '/api/premium/ticket',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer __dev_bypass__', 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 10 }),
      },
      premiumEnv,
    );
    expect(res.status).toBe(404);
  });

  it('GET /api/profile no incluye isPremium en la respuesta', async () => {
    const res = await app.request(
      '/api/profile',
      { headers: { Authorization: 'Bearer __dev_bypass__' } },
      devEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { profile: null | Record<string, unknown> };
    if (body.profile !== null) {
      expect(body.profile).not.toHaveProperty('isPremium');
    }
  });
});

// ─── Vote endpoint ─────────────────────────────────────────────────────────────

const mockVoteFirst = vi.fn();
const mockVoteBind = vi.fn().mockReturnValue({ first: mockVoteFirst });
const mockVotePrepare = vi.fn().mockReturnValue({ bind: mockVoteBind });
const mockVoteBatch = vi.fn().mockResolvedValue([{}, {}]);

const voteEnv = {
  DEV_BYPASS_ALLOWED: 'true',
  ALLOWLIST_EMAILS: '',
  DB: { prepare: mockVotePrepare, batch: mockVoteBatch },
  R2_BUCKET: {} as unknown,
  CRON_SECRET: 'test-secret',
  ASSETS: {} as unknown,
} as unknown as Env;

describe('POST /api/proposals/:proposalId/vote', () => {
  beforeEach(() => {
    mockVoteFirst.mockReset();
    mockVoteBatch.mockClear();
    mockVotePrepare.mockClear();
    vi.mocked(checkAndIncrement).mockReset();
  });

  it('sin auth → 401', async () => {
    const res = await app.request(
      '/api/proposals/p1/vote',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'up' }),
      },
      noAuthEnv,
    );
    expect(res.status).toBe(401);
  });

  it('type inválido → 400 INVALID_TYPE', async () => {
    const res = await app.request(
      '/api/proposals/p1/vote',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer __dev_bypass__', 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'bad' }),
      },
      voteEnv,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('INVALID_TYPE');
  });

  it('rate limit excedido → 429 RATE_LIMIT_EXCEEDED', async () => {
    vi.mocked(checkAndIncrement).mockResolvedValueOnce({ allowed: false, reason: 'hourly' });
    const kvEnv = { ...voteEnv, RATE_LIMIT_KV: {} } as unknown as Env;
    const res = await app.request(
      '/api/proposals/p1/vote',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer __dev_bypass__', 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'up' }),
      },
      kvEnv,
    );
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('ya votó esta semana → 409 ALREADY_VOTED', async () => {
    mockVoteFirst.mockResolvedValueOnce({ vote_type: 'up' });
    const res = await app.request(
      '/api/proposals/p1/vote',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer __dev_bypass__', 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'up' }),
      },
      voteEnv,
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('ALREADY_VOTED');
  });

  it('voto válido → 200 con upvotes y downvotes actualizados', async () => {
    mockVoteFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ upvotes: 1, downvotes: 0 });
    const res = await app.request(
      '/api/proposals/p1/vote',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer __dev_bypass__', 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'up' }),
      },
      voteEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { upvotes: number; downvotes: number };
    expect(body.upvotes).toBe(1);
    expect(body.downvotes).toBe(0);
    expect(mockVoteBatch).toHaveBeenCalledOnce();
  });
});

// ─── POST /api/actions/consume ────────────────────────────────────────────────

const consumeKvEnv = { ...devEnv, RATE_LIMIT_KV: {} } as unknown as Env;

describe('POST /api/actions/consume', () => {
  beforeEach(() => {
    vi.mocked(checkAndIncrement).mockReset();
  });

  it('sin auth → 401', async () => {
    const res = await app.request(
      '/api/actions/consume',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'likes' }),
      },
      noAuthEnv,
    );
    expect(res.status).toBe(401);
  });

  it('action inválida → 400 INVALID_ACTION', async () => {
    const res = await app.request(
      '/api/actions/consume',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer __dev_bypass__', 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalid' }),
      },
      devEnv,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('INVALID_ACTION');
  });

  it('sin KV → 200 ok inmediato', async () => {
    const res = await app.request(
      '/api/actions/consume',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer __dev_bypass__', 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'likes' }),
      },
      devEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('con KV, rate limit excedido → 429 RATE_LIMIT_EXCEEDED', async () => {
    vi.mocked(checkAndIncrement).mockResolvedValueOnce({ allowed: false, reason: 'daily' });
    const res = await app.request(
      '/api/actions/consume',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer __dev_bypass__', 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'likes' }),
      },
      consumeKvEnv,
    );
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('con KV, acción válida → 200 ok', async () => {
    vi.mocked(checkAndIncrement).mockResolvedValueOnce({ allowed: true });
    const res = await app.request(
      '/api/actions/consume',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer __dev_bypass__', 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comments' }),
      },
      consumeKvEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

// ─── Rate limit universal (post premium removal) ──────────────────────────────

const topicsKvEnv = { ...topicsEnv, RATE_LIMIT_KV: {} } as unknown as Env;

describe('POST /api/topics – rate limit universal', () => {
  beforeEach(() => {
    vi.mocked(checkAndIncrement).mockReset();
    mockBatch.mockClear();
  });

  it('con KV y rate limit excedido → 429 RATE_LIMIT_EXCEEDED', async () => {
    vi.mocked(checkAndIncrement).mockResolvedValueOnce({ allowed: false, reason: 'daily' });
    const res = await app.request(
      '/api/topics',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer __dev_bypass__', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'Política',
          topicText: 'Tema de prueba',
          proposalTitle: 'Mi propuesta',
          proposalDescription: 'Una descripción.',
        }),
      },
      topicsKvEnv,
    );
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('RATE_LIMIT_EXCEEDED');
  });
});

const mockProposalFirst = vi.fn();
const proposalsKvEnv = {
  DEV_BYPASS_ALLOWED: 'true',
  ALLOWLIST_EMAILS: '',
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({ first: mockProposalFirst }),
    }),
  },
  R2_BUCKET: {} as unknown,
  CRON_SECRET: 'test-secret',
  ASSETS: {} as unknown,
  RATE_LIMIT_KV: {},
} as unknown as Env;

describe('POST /api/topics/:topicId/proposals – rate limit universal', () => {
  beforeEach(() => {
    vi.mocked(checkAndIncrement).mockReset();
    mockProposalFirst.mockReset();
  });

  it('con KV y rate limit excedido → 429 RATE_LIMIT_EXCEEDED', async () => {
    mockProposalFirst.mockResolvedValueOnce({ id: 'test-topic-id' });
    vi.mocked(checkAndIncrement).mockResolvedValueOnce({ allowed: false, reason: 'daily' });
    const res = await app.request(
      '/api/topics/test-topic-id/proposals',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer __dev_bypass__', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Propuesta test', description: 'Descripción de prueba.' }),
      },
      proposalsKvEnv,
    );
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('RATE_LIMIT_EXCEEDED');
  });
});

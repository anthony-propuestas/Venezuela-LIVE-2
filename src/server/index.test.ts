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
vi.mock('./premium.js', () => ({
  isUserPremium: vi.fn().mockResolvedValue(false),
  createPaymentTicket: vi.fn(),
  getTicketsByUser: vi.fn().mockResolvedValue([]),
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
import type { Env } from './types.js';

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

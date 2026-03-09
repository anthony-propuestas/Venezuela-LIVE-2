/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { handleGetReport, handleCronReports } from './domain/reports/controllers';
import { registerGamificationListener } from './domain/gamification/index.js';
import { checkAndIncrement, type RateLimitAction } from './middlewares/rateLimit.middleware.js';
import { createAuthMiddleware } from './middlewares/auth.middleware.js';
import { createErrorHandler } from './middlewares/errors.middleware.js';
import { isUserPremium, createPaymentTicket, getTicketsByUser } from './premium.js';
import type { Env, User } from './types.js';
import { ValidationError, ConflictError, NotFoundError } from './errors';
import { getCronSecret, getGoogleClientId, getPremiumAlias, isDevBypassAllowed } from './config';
import {
  getGamificationForUser,
  getPhotoKeyByUserId,
  getProfileByUserId,
  getUserIdByUsername,
  upsertPhotoKey,
  upsertProfile,
  countProfiles,
  clearPhotoKey,
} from './repositories/profile.repository.js';
import { deleteProfilePhotoObject, getProfilePhotoObject, putProfilePhotoObject } from './repositories/r2.repository.js';
import { sanitizeImage } from './domain/media/sanitizer.js';

registerGamificationListener();

import { USERNAME_MIN, USERNAME_MAX, USERNAME_REGEX } from '@shared/constants.js';

const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type AppBindings = { Bindings: Env; Variables: { user: User } };

const app = new Hono<AppBindings>();

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com",
    "worker-src 'self'",
    "connect-src 'self' https://accounts.google.com https://www.googleapis.com",
    "img-src 'self' data: blob: https://flagcdn.com",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "frame-src 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

app.use('*', async (c, next) => {
  await next();
  const res = c.res;
  if (!res) return;
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value);
  }
});

app.use('/api/*', createAuthMiddleware());
app.onError(createErrorHandler());

app.get('/api/profile', async (c) => {
  const { userId } = c.get('user');
  const db = c.env.DB;

  const row = await getProfileByUserId(db, userId);
  if (!row) {
    return c.json({ profile: null });
  }

  let ideologies: string[] = [];
  if (row.ideologies) {
    try {
      ideologies = JSON.parse(row.ideologies as string);
    } catch {
      ideologies = [];
    }
  }

  const isPremium = Number(row.is_premium ?? 0) === 1;
  const profileBase = {
    displayName: row.display_name ?? '',
    username: row.username ?? '',
    birthDate: row.birth_date ?? '',
    description: row.description ?? '',
    ideologies,
    hasPhoto: !!row.photo_key,
    isPremium,
  };

  const { totalXp, achievements } = await getGamificationForUser(db, userId);

  return c.json({
    profile: {
      ...profileBase,
      gamification: {
        totalXp,
        achievements,
      },
    },
  });
});

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function validateUsername(username: string): { valid: boolean; error?: string } {
  const norm = normalizeUsername(username);
  if (norm.length === 0) return { valid: true };
  if (norm.length < USERNAME_MIN) return { valid: false, error: `El nombre de usuario debe tener al menos ${USERNAME_MIN} caracteres.` };
  if (norm.length > USERNAME_MAX) return { valid: false, error: `El nombre de usuario no puede superar ${USERNAME_MAX} caracteres.` };
  if (!USERNAME_REGEX.test(norm)) return { valid: false, error: 'El nombre de usuario solo puede contener letras, números y guiones bajos.' };
  return { valid: true };
}

app.get('/api/profile/username/check', async (c) => {
  const usernameParam = c.req.query('username');
  const raw = typeof usernameParam === 'string' ? usernameParam : '';

  if (!raw.trim()) {
    throw new ValidationError('INVALID_USERNAME_FORMAT', 'Debes indicar un nombre de usuario.', [
      { field: 'username', message: 'Debes indicar un nombre de usuario.' },
    ]);
  }

  const { valid, error } = validateUsername(raw);
  if (!valid) {
    throw new ValidationError('INVALID_USERNAME_FORMAT', error ?? 'Formato inválido.', [
      { field: 'username', message: error ?? 'Formato inválido.' },
    ]);
  }

  const norm = normalizeUsername(raw);
  const { userId } = c.get('user');
  const db = c.env.DB;

  // Atajo: si la tabla está vacía, cualquier username está disponible
  const total = await countProfiles(db);
  if (total === 0) {
    return c.json({ available: true });
  }

  const existingUserId = await getUserIdByUsername(db, norm);
  const available = !existingUserId || existingUserId === userId;

  return c.json({
    available,
    error: available ? undefined : 'Ese nombre de usuario ya está en uso.',
  });
});

app.put('/api/profile', async (c) => {
  const { userId, email, name } = c.get('user');
  const db = c.env.DB;

  let body: { displayName?: string; username?: string; birthDate?: string; description?: string; ideologies?: string[] };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('INVALID_PROFILE_DATA', 'Datos inválidos.');
  }

  const displayName = String(body.displayName ?? '').slice(0, 500);
  const birthDate = String(body.birthDate ?? '').slice(0, 20);
  const description = String(body.description ?? '').slice(0, 2000);
  const ideologiesJson = JSON.stringify(Array.isArray(body.ideologies) ? body.ideologies : []);

  let username: string | null = null;
  const rawUsername = String(body.username ?? '').trim();
  if (rawUsername.length > 0) {
    const validation = validateUsername(rawUsername);
    if (!validation.valid) {
      throw new ValidationError('INVALID_USERNAME_FORMAT', validation.error ?? 'Formato inválido.', [
        { field: 'username', message: validation.error ?? 'Formato inválido.' },
      ]);
    }
    username = normalizeUsername(rawUsername);
    const existingUserId = await getUserIdByUsername(db, username);
    if (existingUserId && existingUserId !== userId) {
      throw new ConflictError('USERNAME_TAKEN', 'Ese nombre de usuario ya está en uso.');
    }
  }

  await upsertProfile(db, {
    userId,
    email: email || name,
    displayName,
    username,
    birthDate,
    description,
    ideologiesJson,
  });

  return c.json({ ok: true });
});

app.post('/api/profile/photo', async (c) => {
  const { userId } = c.get('user');
  const r2 = c.env.R2_BUCKET;
  const db = c.env.DB;

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    throw new ValidationError('INVALID_FILE', 'Datos de formulario inválidos.');
  }

  const file = formData.get('photo') as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    throw new ValidationError('INVALID_FILE', 'No se recibió ninguna imagen.', [
      { field: 'photo', message: 'No se recibió ninguna imagen.' },
    ]);
  }
  if (file.size > MAX_PHOTO_SIZE) {
    throw new ValidationError('FILE_TOO_LARGE', 'La imagen no debe superar 2 MB.', [
      { field: 'photo', message: 'La imagen no debe superar 2 MB.' },
    ]);
  }

  const mt = file.type || 'image/jpeg';
  if (!ALLOWED_TYPES.includes(mt)) {
    throw new ValidationError('UNSUPPORTED_MEDIA_TYPE', 'Formato no válido. Usa JPG, PNG o WebP.', [
      { field: 'photo', message: 'Formato no válido. Usa JPG, PNG o WebP.' },
    ]);
  }

  const ext = mt === 'image/png' ? 'png' : mt === 'image/webp' ? 'webp' : 'jpg';
  const key = `profiles/${userId}/photo.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const originalBytes = new Uint8Array(arrayBuffer);
  const { buffer: cleanBuffer, mimeType } = await sanitizeImage(originalBytes, mt);

  await putProfilePhotoObject(r2, key, cleanBuffer, mimeType);
  await upsertPhotoKey(db, userId, key);

  return c.json({ ok: true });
});

app.delete('/api/profile/photo', async (c) => {
  const { userId } = c.get('user');
  const r2 = c.env.R2_BUCKET;
  const db = c.env.DB;

  const key = await getPhotoKeyByUserId(db, userId);
  if (!key) {
    // No hay foto registrada; operación idempotente.
    return c.json({ ok: true });
  }

  await deleteProfilePhotoObject(r2, key);
  await clearPhotoKey(db, userId);

  return c.json({ ok: true });
});

/** Consume una cuota de rate limit. Devuelve 200 OK o 429 si límite excedido. */
app.post('/api/actions/consume', async (c) => {
  const { userId } = c.get('user');
  const db = c.env.DB;
  const kv = c.env.RATE_LIMIT_KV;
  let body: { action: string };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('INVALID_ACTION', 'Datos inválidos.');
  }
  const action = body.action as RateLimitAction;
  if (!['likes', 'comments', 'proposals'].includes(action)) {
    throw new ValidationError('INVALID_ACTION', 'Acción no válida.');
  }
  const premium = await isUserPremium(db, userId);
  if (premium) {
    return c.json({ ok: true, premium: true });
  }
  if (!kv) {
    return c.json({ ok: true });
  }
  const result = await checkAndIncrement(kv, userId, action);
  if (result.allowed) {
    return c.json({ ok: true });
  }
  return c.json(
    {
      error: 'RATE_LIMIT_EXCEEDED',
      action,
      // reason se añade solo cuando allowed === false; se tipa con any para no propagar el tipo unión aquí.
      reason: (result as any).reason,
    },
    429
  );
});

app.get('/api/premium/status', async (c) => {
  const { userId } = c.get('user');
  const db = c.env.DB;
  const premium = await isUserPremium(db, userId);
  const tickets = await getTicketsByUser(db, userId);
  const alias = getPremiumAlias(c.env);
  return c.json({ isPremium: premium, alias, tickets });
});

app.post('/api/premium/ticket', async (c) => {
  const { userId } = c.get('user');
  const db = c.env.DB;
  let body: { reference?: string; paymentDate?: string; amount?: number };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('INVALID_TICKET_DATA', 'Datos inválidos.');
  }
  const reference = String(body.reference ?? '').trim();
  const paymentDate = String(body.paymentDate ?? '').trim();
  const amount = Number(body.amount);
  if (!reference || !paymentDate || !Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError('INVALID_TICKET_DATA', 'Completa referencia, fecha y monto.', [
      { field: 'reference', message: 'Indica la referencia del pago.' },
      { field: 'paymentDate', message: 'Indica la fecha del pago.' },
      { field: 'amount', message: 'Indica un monto válido.' },
    ]);
  }
  const result = await createPaymentTicket(db, userId, { reference, paymentDate, amount });
  if ('error' in result) {
    throw new ValidationError('INVALID_TICKET_DATA', result.error);
  }
  return c.json({ ok: true, ticketId: result.id });
});

app.get('/api/reports/weekly/positives', (c) => handleGetReport(c, 'positives'));
app.get('/api/reports/weekly/negatives', (c) => handleGetReport(c, 'negatives'));
app.get('/api/reports/weekly/volume', (c) => handleGetReport(c, 'volume'));

/** Cron semanal invocado por HTTP (Pages no tiene scheduled). Solo header X-Cron-Secret (no query, evita logs/Referrer). */
app.all('/api/cron/weekly-reports', async (c) => {
  const secret = c.req.header('X-Cron-Secret');
  const devBypass = isDevBypassAllowed(c.env);
  if (devBypass && secret) {
    try {
      await handleCronReports(c.env);
      return c.json({ ok: true });
    } catch (err) {
      console.error('Cron weekly-reports:', err);
      return c.json({ error: 'Error al ejecutar el cron' }, 500);
    }
  }
  const expected = getCronSecret(c.env);
  if (!secret || secret !== expected) {
    return c.json({ error: 'No autorizado' }, 401);
  }
  try {
    await handleCronReports(c.env);
    return c.json({ ok: true });
  } catch (err) {
    console.error('Cron weekly-reports:', err);
    return c.json({ error: 'Error al ejecutar el cron' }, 500);
  }
});

/** Job de migración: sanea metadatos EXIF de fotos de perfil ya almacenadas en R2.
 *  Controlado por el mismo secreto X-Cron-Secret que weekly-reports y procesado por lotes.
 */
app.all('/api/cron/profile-photos-sanitize', async (c) => {
  const secret = c.req.header('X-Cron-Secret');
  const devBypass = isDevBypassAllowed(c.env);
  if (!devBypass && secret !== getCronSecret(c.env)) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const r2 = c.env.R2_BUCKET;
  const prefix = 'profiles/';
  const cursor = c.req.query('cursor') ?? undefined;

  const list = await r2.list({ prefix, limit: 25, cursor });

  let processed = 0;

  for (const obj of list.objects) {
    try {
      const key = obj.key;
      const existing = await r2.get(key);
      if (!existing || !existing.body) continue;

      const mt = existing.httpMetadata?.contentType || 'image/jpeg';
      const originalBuffer = new Uint8Array(await new Response(existing.body).arrayBuffer());
      const { buffer: cleanBuffer, mimeType } = await sanitizeImage(originalBuffer, mt);

      await r2.put(key, cleanBuffer, {
        httpMetadata: { contentType: mimeType },
      });
      processed += 1;
    } catch (err) {
      console.error('Error al sanear foto de perfil en migración:', err);
    }
  }

  return c.json({
    ok: true,
    processed,
    truncated: list.truncated,
    cursor: 'cursor' in list ? list.cursor : null,
  });
});

app.get('/api/profile/photo', async (c) => {
  const { userId } = c.get('user');
  const r2 = c.env.R2_BUCKET;
  const db = c.env.DB;

  const key = await getPhotoKeyByUserId(db, userId);
  if (!key) {
    throw new NotFoundError('PROFILE_PHOTO_NOT_FOUND', 'No hay foto de perfil.');
  }

  const obj = await getProfilePhotoObject(r2, key);
  if (!obj) {
    throw new NotFoundError('PROFILE_PHOTO_NOT_FOUND', 'Foto no encontrada.');
  }

  const contentType = obj.httpMetadata?.contentType || 'image/jpeg';
  // Tipado flexible: el cuerpo se expone como ReadableStream/ArrayBuffer según el runtime.
  const body: any = (obj as any).body ?? obj;
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
});

/** Manifest PWA con Content-Type correcto (requerido por especificación). */
app.get('/manifest.webmanifest', async (c) => {
  try {
    const res = await c.env.ASSETS.fetch(new Request(new URL('/manifest.webmanifest', c.req.url)));
    if (!res.ok) return res;
    return new Response(res.body, {
      status: res.status,
      headers: {
        ...Object.fromEntries(res.headers),
        'Content-Type': 'application/manifest+json',
      },
    });
  } catch {
    return c.json({ error: 'Manifest no encontrado' }, 404);
  }
});

app.all('*', async (c) => {
  try {
    return await c.env.ASSETS.fetch(c.req.raw);
  } catch (err) {
    console.error('Assets fetch:', err);
    return new Response('Error interno', { status: 500 });
  }
});

/** App Hono para Pages Functions (y compatibilidad Worker si se usa main). */
export { app };
export type { Env } from './types.js';

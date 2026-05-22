/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { handleGetReport, handleCronReports } from './domain/reports/controllers';
import { registerGamificationListener } from './domain/gamification/index.js';
import { checkAndIncrement, type RateLimitAction } from './middlewares/rateLimit.middleware.js';
import { createAuthMiddleware } from './middlewares/auth.middleware.js';
import { createErrorHandler } from './middlewares/errors.middleware.js';
import type { Env, User } from './types.js';
import { ValidationError, ConflictError, NotFoundError } from './errors';
import { getCronSecret, getGoogleClientId, isDevBypassAllowed, getAdminCredentials } from './config';
import { signAdminToken, createAdminMiddleware } from './middlewares/admin.middleware.js';
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
import { emitGamificationEventAsync } from './domain/gamification/integration.js';

registerGamificationListener();

import { USERNAME_MIN, USERNAME_MAX, USERNAME_REGEX } from '@shared/constants.js';

const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Límites contrapropuestas (análisis de seguridad Zero Trust)
const PROPOSAL_TITLE_MAX = 200;
const PROPOSAL_DESC_MAX = 2000;
const TOPIC_ID_MAX_LEN = 64;
const TOPIC_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const TOPIC_TEXT_MAX = 300;
const TOPIC_CATEGORY_MAX = 100;

type AppBindings = { Bindings: Env; Variables: { user: User } };

const app = new Hono<AppBindings>();

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

  const profileBase = {
    displayName: row.display_name ?? '',
    username: row.username ?? '',
    birthDate: row.birth_date ?? '',
    description: row.description ?? '',
    ideologies,
    hasPhoto: !!row.photo_key,
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
  const { userId, email } = c.get('user');
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
    email: email,
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
  if (!kv) {
    return c.json({ ok: true });
  }
  const result = await checkAndIncrement(kv, userId, action);
  if (result.allowed) {
    return c.json({ ok: true });
  }
  const reason = 'reason' in result ? result.reason : 'Límite diario alcanzado.';
  return c.json({ error: 'RATE_LIMIT_EXCEEDED', action, reason }, 429);
});

/** Lista todos los temas con sus propuestas y notas. */
app.get('/api/topics', async (c) => {
  const db = c.env.DB;
  const rows = await db
    .prepare(
      `SELECT t.id, t.category, t.subcategory, t.topic_text,
              p.id as p_id, p.title as p_title, p.description as p_description, p.author as p_author,
              p.upvotes as p_upvotes, p.downvotes as p_downvotes,
              pn.id as n_id, pn.text as n_text, pn.net_score as n_net_score
       FROM topics t
       LEFT JOIN proposals p ON p.topic_id = t.id
       LEFT JOIN proposal_notes pn ON pn.proposal_id = p.id
       ORDER BY t.created_at ASC, p.created_at ASC, pn.created_at ASC`
    )
    .all<{
      id: string; category: string; subcategory: string; topic_text: string;
      p_id: string | null; p_title: string | null; p_description: string | null;
      p_author: string | null; p_upvotes: number | null; p_downvotes: number | null;
      n_id: string | null; n_text: string | null; n_net_score: number | null;
    }>();

  type NoteEntry = { id: string; text: string; netScore: number };
  type ProposalEntry = {
    id: string; title: string; description: string; author: string;
    upvotes: number; downvotes: number; netScore: number; comments: unknown[]; notes: NoteEntry[];
  };
  type ThreadEntry = {
    id: string; category: string; subcategory: string; topic: string;
    proposals: Map<string, ProposalEntry>;
  };

  const topicsMap = new Map<string, ThreadEntry>();
  for (const row of rows.results) {
    if (!topicsMap.has(row.id)) {
      topicsMap.set(row.id, { id: row.id, category: row.category, subcategory: row.subcategory ?? '', topic: row.topic_text, proposals: new Map() });
    }
    const topic = topicsMap.get(row.id)!;
    if (row.p_id) {
      if (!topic.proposals.has(row.p_id)) {
        topic.proposals.set(row.p_id, {
          id: row.p_id, title: row.p_title ?? '', description: row.p_description ?? '',
          author: row.p_author ?? '', upvotes: row.p_upvotes ?? 0, downvotes: row.p_downvotes ?? 0,
          netScore: (row.p_upvotes ?? 0) - (row.p_downvotes ?? 0), comments: [], notes: [],
        });
      }
      if (row.n_id) {
        const proposal = topic.proposals.get(row.p_id)!;
        if (!proposal.notes.some(n => n.id === row.n_id)) {
          proposal.notes.push({ id: row.n_id, text: row.n_text ?? '', netScore: row.n_net_score ?? 0 });
        }
      }
    }
  }

  const threads = Array.from(topicsMap.values()).map(t => ({ ...t, proposals: Array.from(t.proposals.values()) }));
  return c.json({ threads });
});

/** Lista todas las categorías. */
app.get('/api/categories', async (c) => {
  const db = c.env.DB;
  const rows = await db
    .prepare('SELECT id, name, slug, subcategories FROM categories ORDER BY name ASC')
    .all<{ id: number; name: string; slug: string; subcategories: string }>();
  const categories = rows.results.map(r => ({
    ...r,
    subcategories: JSON.parse(r.subcategories || '[]') as string[],
  }));
  return c.json({ categories });
});

/** Crear nuevo tema con propuesta inicial. Zero Trust: autor desde perfil, nunca desde body. */
app.post('/api/topics', async (c) => {
  const { userId, name: jwtName } = c.get('user');
  const db = c.env.DB;
  const kv = c.env.RATE_LIMIT_KV;

  let body: { category?: string; subcategory?: string; topicText?: string; proposalTitle?: string; proposalDescription?: string };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('INVALID_TOPIC_DATA', 'Datos inválidos.');
  }

  const category = String(body?.category ?? '').trim();
  const subcategory = String(body?.subcategory ?? '').trim();
  const topicText = String(body?.topicText ?? '').trim();
  const proposalTitle = String(body?.proposalTitle ?? '').trim();
  const proposalDescription = String(body?.proposalDescription ?? '').trim();

  if (!category || !topicText || !proposalTitle || !proposalDescription) {
    throw new ValidationError('INVALID_TOPIC_DATA', 'Completa todos los campos requeridos.');
  }
  if (category.length > TOPIC_CATEGORY_MAX || subcategory.length > TOPIC_CATEGORY_MAX || topicText.length > TOPIC_TEXT_MAX) {
    throw new ValidationError('INVALID_TOPIC_DATA', 'El texto del tema o categoría excede el límite permitido.');
  }
  if (proposalTitle.length > PROPOSAL_TITLE_MAX || proposalDescription.length > PROPOSAL_DESC_MAX) {
    throw new ValidationError('INVALID_TOPIC_DATA', 'El nombre o descripción de la propuesta excede el límite permitido.');
  }

  const profile = await getProfileByUserId(db, userId);
  const author =
    (profile?.display_name && String(profile.display_name).trim()) ||
    (profile?.username && String(profile.username).trim()) ||
    (jwtName && String(jwtName).trim()) ||
    'Usuario';

  if (kv) {
    const rlResult = await checkAndIncrement(kv, userId, 'proposals');
    if (rlResult.allowed === false) {
      return c.json({ error: 'RATE_LIMIT_EXCEEDED', action: 'proposals', reason: rlResult.reason }, 429);
    }
  }

  const topicId = crypto.randomUUID();
  const proposalId = crypto.randomUUID();
  const categorySafe = category.slice(0, TOPIC_CATEGORY_MAX);
  const subcategorySafe = subcategory.slice(0, TOPIC_CATEGORY_MAX);
  const topicTextSafe = topicText.slice(0, TOPIC_TEXT_MAX);
  const titleSafe = proposalTitle.slice(0, PROPOSAL_TITLE_MAX);
  const descriptionSafe = proposalDescription.slice(0, PROPOSAL_DESC_MAX);
  const authorSafe = author.slice(0, 100);

  await db.batch([
    db.prepare('INSERT INTO topics (id, category, subcategory, topic_text) VALUES (?, ?, ?, ?)').bind(topicId, categorySafe, subcategorySafe, topicTextSafe),
    db.prepare('INSERT INTO proposals (id, topic_id, title, description, author, upvotes, downvotes) VALUES (?, ?, ?, ?, ?, 0, 0)').bind(proposalId, topicId, titleSafe, descriptionSafe, authorSafe),
  ]);

  try {
    emitGamificationEventAsync(c as unknown as Parameters<typeof emitGamificationEventAsync>[0], {
      type: 'CREATE_COUNTER_PROPOSAL',
      payload: { userId, topicId, proposalId },
    });
  } catch (_err) {
    // Ignorar: tema ya guardado
  }

  return c.json({
    thread: {
      id: topicId, category: categorySafe, subcategory: subcategorySafe, topic: topicTextSafe,
      proposals: [{
        id: proposalId, title: titleSafe, description: descriptionSafe, author: authorSafe,
        upvotes: 0, downvotes: 0, netScore: 0, comments: [], notes: [],
      }],
    },
  });
});

/** Crear contrapropuesta. Zero Trust: autor desde perfil, nunca desde body. */
app.post('/api/topics/:topicId/proposals', async (c) => {
  const { userId, name: jwtName } = c.get('user');
  const db = c.env.DB;
  const kv = c.env.RATE_LIMIT_KV;

  // 1) Validar topicId (formato y longitud)
  const topicIdRaw = c.req.param('topicId');
  const topicId = typeof topicIdRaw === 'string' ? topicIdRaw.trim() : '';
  if (!topicId || topicId.length > TOPIC_ID_MAX_LEN || !TOPIC_ID_REGEX.test(topicId)) {
    throw new ValidationError('INVALID_TOPIC_ID', 'Identificador de tema inválido.');
  }

  // 2) Parsear y validar body (solo title y description; author nunca del cliente)
  let body: { title?: string; description?: string };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('INVALID_PROPOSAL_DATA', 'Datos inválidos.');
  }
  const title = String(body?.title ?? '').trim();
  const description = String(body?.description ?? '').trim();
  if (!title || !description) {
    throw new ValidationError('INVALID_PROPOSAL_DATA', 'Completa el nombre y la descripción.');
  }
  if (title.length > PROPOSAL_TITLE_MAX || description.length > PROPOSAL_DESC_MAX) {
    throw new ValidationError('INVALID_PROPOSAL_DATA', 'El nombre o la descripción exceden el límite permitido.');
  }

  // 3) Verificar que el tema existe
  const topicRow = await db
    .prepare('SELECT id FROM topics WHERE id = ?')
    .bind(topicId)
    .first<{ id?: string }>();
  if (!topicRow?.id) {
    throw new NotFoundError('TOPIC_NOT_FOUND', 'El tema no existe.');
  }

  // 4) Obtener autor desde perfil (Zero Trust)
  const profile = await getProfileByUserId(db, userId);
  const author =
    (profile?.display_name && String(profile.display_name).trim()) ||
    (profile?.username && String(profile.username).trim()) ||
    (jwtName && String(jwtName).trim()) ||
    'Usuario';

  // 5) Rate limit (solo tras validaciones exitosas)
  if (kv) {
    const rlResult = await checkAndIncrement(kv, userId, 'proposals');
    if (rlResult.allowed === false) {
      return c.json(
        { error: 'RATE_LIMIT_EXCEEDED', action: 'proposals', reason: rlResult.reason },
        429
      );
    }
  }

  // 6) Insertar propuesta (consultas preparadas)
  const proposalId = crypto.randomUUID();
  const titleSafe = title.slice(0, PROPOSAL_TITLE_MAX);
  const descriptionSafe = description.slice(0, PROPOSAL_DESC_MAX);
  const authorSafe = author.slice(0, 100);

  await db
    .prepare(
      'INSERT INTO proposals (id, topic_id, title, description, author, upvotes, downvotes) VALUES (?, ?, ?, ?, ?, 0, 0)'
    )
    .bind(proposalId, topicId, titleSafe, descriptionSafe, authorSafe)
    .run();

  // 7) Gamificación en background (no debe afectar la respuesta; ya guardado en BD)
  try {
    emitGamificationEventAsync(c as unknown as Parameters<typeof emitGamificationEventAsync>[0], {
      type: 'CREATE_COUNTER_PROPOSAL',
      payload: { userId, topicId, proposalId },
    });
  } catch (_err) {
    // Ignorar: la propuesta ya está guardada; no devolver 500 por gamificación
  }

  return c.json({
    proposal: {
      id: proposalId,
      topicId,
      title: titleSafe,
      description: descriptionSafe,
      author: authorSafe,
      upvotes: 0,
      downvotes: 0,
      netScore: 0,
      comments: [],
      notes: [],
    },
  });
});

// Cast necesario: handleGetReport espera Context con solo DB y R2_BUCKET; AppBindings incluye Variables
app.get('/api/reports/weekly/positives', (c) => handleGetReport(c as any, 'positives'));
app.get('/api/reports/weekly/negatives', (c) => handleGetReport(c as any, 'negatives'));
app.get('/api/reports/weekly/volume', (c) => handleGetReport(c as any, 'volume'));

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
    cursor: ('cursor' in list ? list.cursor : undefined) ?? null,
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
  const body = (obj as { body?: ReadableStream }).body;
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
});

// ─── Admin routes ────────────────────────────────────────────────────────────

app.post('/api/admin/login', async (c) => {
  let body: { email?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Datos inválidos.' }, 400);
  }
  let credentials: { email: string; password: string };
  try {
    credentials = getAdminCredentials(c.env);
  } catch {
    return c.json({ error: 'Panel de administración no configurado.' }, 503);
  }
  const emailMatch = String(body.email ?? '').toLowerCase() === credentials.email.toLowerCase();
  const passMatch = String(body.password ?? '') === credentials.password;
  if (!emailMatch || !passMatch) {
    return c.json({ error: 'Credenciales incorrectas.' }, 401);
  }
  const token = await signAdminToken(credentials.password);
  return c.json({ token });
});

app.use('/api/admin/*', createAdminMiddleware());

app.get('/api/admin/users', async (c) => {
  const db = c.env.DB;
  const rows = await db
    .prepare('SELECT user_id, email, username, role FROM profiles ORDER BY rowid DESC')
    .all<{ user_id: string; email: string; username: string | null; role: string }>();
  return c.json({ users: rows.results });
});

app.delete('/api/admin/users/:userId/ratelimits', async (c) => {
  const kv = c.env.RATE_LIMIT_KV;
  if (!kv) return c.json({ ok: true, note: 'KV no configurado.' });
  const userId = c.req.param('userId');
  const now = new Date();
  const today =
    now.getUTCFullYear() +
    '-' +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getUTCDate()).padStart(2, '0');
  await Promise.all(
    ['likes', 'comments', 'proposals'].map((action) =>
      kv.delete(`rl:${today}:${userId}:${action}`)
    )
  );
  return c.json({ ok: true });
});

app.get('/api/admin/topics', async (c) => {
  const db = c.env.DB;
  const rows = await db
    .prepare('SELECT id, category, subcategory, topic_text, created_at FROM topics ORDER BY created_at DESC')
    .all<{ id: string; category: string; subcategory: string; topic_text: string; created_at: string }>();
  return c.json({ topics: rows.results });
});

app.delete('/api/admin/topics/:topicId', async (c) => {
  const db = c.env.DB;
  const topicId = c.req.param('topicId');
  await db.batch([
    db.prepare('DELETE FROM proposal_notes WHERE proposal_id IN (SELECT id FROM proposals WHERE topic_id = ?)').bind(topicId),
    db.prepare('DELETE FROM proposals WHERE topic_id = ?').bind(topicId),
    db.prepare('DELETE FROM topics WHERE id = ?').bind(topicId),
  ]);
  return c.json({ ok: true });
});

app.get('/api/admin/proposals', async (c) => {
  const db = c.env.DB;
  const rows = await db
    .prepare('SELECT id, topic_id, title, author, created_at FROM proposals ORDER BY created_at DESC LIMIT 200')
    .all<{ id: string; topic_id: string; title: string; author: string; created_at: string }>();
  return c.json({ proposals: rows.results });
});

app.delete('/api/admin/proposals/:proposalId', async (c) => {
  const db = c.env.DB;
  const proposalId = c.req.param('proposalId');
  await db.batch([
    db.prepare('DELETE FROM proposal_notes WHERE proposal_id = ?').bind(proposalId),
    db.prepare('DELETE FROM proposals WHERE id = ?').bind(proposalId),
  ]);
  return c.json({ ok: true });
});

app.get('/api/admin/categories', async (c) => {
  const db = c.env.DB;
  const rows = await db
    .prepare('SELECT id, name, slug, subcategories, created_at FROM categories ORDER BY name ASC')
    .all<{ id: number; name: string; slug: string; subcategories: string; created_at: string }>();
  const categories = rows.results.map(r => ({ ...r, subcategories: JSON.parse(r.subcategories || '[]') as string[] }));
  return c.json({ categories });
});

app.post('/api/admin/categories', async (c) => {
  const db = c.env.DB;
  let body: { name?: string; slug?: string; subcategories?: string[] };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Datos inválidos.' }, 400); }
  const name = String(body?.name ?? '').trim();
  const slug = String(body?.slug ?? '').trim().toLowerCase();
  const subcategories = Array.isArray(body?.subcategories) ? body.subcategories.map(s => String(s).trim()).filter(Boolean) : [];
  if (!name || !slug) return c.json({ error: 'name y slug son requeridos.' }, 400);
  if (!/^[a-z0-9-]+$/.test(slug)) return c.json({ error: 'El slug solo puede contener letras minúsculas, números y guiones.' }, 400);
  try {
    const result = await db.prepare('INSERT INTO categories (name, slug, subcategories) VALUES (?, ?, ?)').bind(name, slug, JSON.stringify(subcategories)).run();
    return c.json({ ok: true, id: result.meta.last_row_id });
  } catch (e: unknown) {
    if (e instanceof Error && e.message?.includes('UNIQUE')) return c.json({ error: 'El slug ya existe.' }, 409);
    throw e;
  }
});

app.put('/api/admin/categories/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  let body: { name?: string; slug?: string; subcategories?: string[] };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Datos inválidos.' }, 400); }
  const name = String(body?.name ?? '').trim();
  const slug = String(body?.slug ?? '').trim().toLowerCase();
  const subcategories = Array.isArray(body?.subcategories) ? body.subcategories.map(s => String(s).trim()).filter(Boolean) : [];
  if (!name || !slug) return c.json({ error: 'name y slug son requeridos.' }, 400);
  if (!/^[a-z0-9-]+$/.test(slug)) return c.json({ error: 'El slug solo puede contener letras minúsculas, números y guiones.' }, 400);
  try {
    await db.prepare('UPDATE categories SET name = ?, slug = ?, subcategories = ? WHERE id = ?').bind(name, slug, JSON.stringify(subcategories), id).run();
    return c.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message?.includes('UNIQUE')) return c.json({ error: 'El slug ya existe.' }, 409);
    throw e;
  }
});

app.delete('/api/admin/categories/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────

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

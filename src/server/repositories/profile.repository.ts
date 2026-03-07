import { ConflictError, DependencyError } from '../errors';

export type ProfileRow = {
  user_id: string;
  email?: string | null;
  display_name?: string | null;
  username?: string | null;
  birth_date?: string | null;
  description?: string | null;
  ideologies?: string | null;
  photo_key?: string | null;
  updated_at?: string | null;
  total_xp?: number | null;
  is_premium?: number | null;
} & Record<string, unknown>;

function isMigrationError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const message = 'message' in err ? String((err as Error).message || '') : '';
  return message.includes('no such table') || message.includes('no such column');
}

export async function getProfileByUserId(db: D1Database, userId: string): Promise<ProfileRow | null> {
  try {
    const row = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(userId).first<ProfileRow>();
    return (row as ProfileRow) ?? null;
  } catch (err) {
    if (isMigrationError(err)) {
      throw new DependencyError('D1_MIGRATION_MISSING', 'La tabla o columnas de profiles no existen en la base de datos D1.');
    }
    throw err;
  }
}

type UpsertProfileInput = {
  userId: string;
  email: string;
  displayName: string;
  username: string | null;
  birthDate: string;
  description: string;
  ideologiesJson: string;
};

export async function upsertProfile(db: D1Database, input: UpsertProfileInput): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO profiles (user_id, email, display_name, username, birth_date, description, ideologies, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           display_name = excluded.display_name,
           username = excluded.username,
           birth_date = excluded.birth_date,
           description = excluded.description,
           ideologies = excluded.ideologies,
           updated_at = excluded.updated_at`
      )
      .bind(
        input.userId,
        input.email,
        input.displayName,
        input.username ?? null,
        input.birthDate,
        input.description,
        input.ideologiesJson
      )
      .run();
  } catch (err) {
    if (err && typeof err === 'object' && 'message' in err && String((err as Error).message).includes('UNIQUE')) {
      throw new ConflictError('USERNAME_TAKEN', 'Ese nombre de usuario ya está en uso.');
    }
    if (isMigrationError(err)) {
      throw new DependencyError('D1_MIGRATION_MISSING', 'La tabla o columnas de profiles no existen en la base de datos D1.');
    }
    throw err;
  }
}

export async function countProfiles(db: D1Database): Promise<number> {
  try {
    const row = await db.prepare('SELECT COUNT(*) as c FROM profiles').first<{ c?: number }>();
    return Number(row?.c ?? 0);
  } catch (err) {
    if (isMigrationError(err)) {
      throw new DependencyError('D1_MIGRATION_MISSING', 'La tabla profiles no existe en la base de datos D1.');
    }
    throw err;
  }
}

export async function getUserIdByUsername(db: D1Database, username: string): Promise<string | null> {
  try {
    const row = await db.prepare('SELECT user_id FROM profiles WHERE username = ?').bind(username).first<{ user_id?: string }>();
    return row?.user_id ?? null;
  } catch (err) {
    if (isMigrationError(err)) {
      throw new DependencyError('D1_MIGRATION_MISSING_USERNAME', 'La columna username o la tabla profiles no existen en la base de datos D1.');
    }
    throw err;
  }
}

export async function getPhotoKeyByUserId(db: D1Database, userId: string): Promise<string | null> {
  try {
    const row = await db.prepare('SELECT photo_key FROM profiles WHERE user_id = ?').bind(userId).first<{ photo_key?: string | null }>();
    return (row?.photo_key as string | null) ?? null;
  } catch (err) {
    if (isMigrationError(err)) {
      throw new DependencyError('D1_MIGRATION_MISSING', 'La columna photo_key o la tabla profiles no existen en la base de datos D1.');
    }
    throw err;
  }
}

export async function upsertPhotoKey(db: D1Database, userId: string, key: string): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO profiles (user_id, photo_key, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET photo_key = excluded.photo_key, updated_at = excluded.updated_at`
      )
      .bind(userId, key)
      .run();
  } catch (err) {
    if (isMigrationError(err)) {
      throw new DependencyError('D1_MIGRATION_MISSING', 'La columna photo_key o la tabla profiles no existen en la base de datos D1.');
    }
    throw err;
  }
}

export async function clearPhotoKey(db: D1Database, userId: string): Promise<void> {
  try {
    await db
      .prepare("UPDATE profiles SET photo_key = NULL, updated_at = datetime('now') WHERE user_id = ?")
      .bind(userId)
      .run();
  } catch (err) {
    if (isMigrationError(err)) {
      throw new DependencyError('D1_MIGRATION_MISSING', 'La columna photo_key o la tabla profiles no existen en la base de datos D1.');
    }
    throw err;
  }
}

export type AchievementRow = {
  id: string;
  name: string;
  description: string;
  earned_at?: string | null;
};

export async function getGamificationForUser(db: D1Database, userId: string): Promise<{
  totalXp: number;
  achievements: Array<{ id: string; name: string; description: string; earnedAt: string }>;
}> {
  let totalXp = 0;
  const achievements: Array<{ id: string; name: string; description: string; earnedAt: string }> = [];

  try {
    const row = await db
      .prepare('SELECT total_xp FROM profiles WHERE user_id = ?')
      .bind(userId)
      .first<{ total_xp?: number | null }>();
    totalXp = Number(row?.total_xp ?? 0);
  } catch (err) {
    if (!isMigrationError(err)) {
      throw err;
    }
    // Si falta la columna/tabla, asumimos 0 XP.
  }

  try {
    const achievementsRows = await db
      .prepare(
        `SELECT a.id, a.name, a.description, ua.earned_at 
         FROM user_achievements ua 
         JOIN achievements a ON a.id = ua.achievement_id 
         WHERE ua.user_id = ? 
         ORDER BY ua.earned_at DESC`
      )
      .bind(userId)
      .all<AchievementRow>();

    const rows = achievementsRows.results ?? [];
    for (const r of rows as AchievementRow[]) {
      achievements.push({
        id: String(r.id),
        name: String(r.name),
        description: String(r.description),
        earnedAt: String(r.earned_at ?? ''),
      });
    }
  } catch (err) {
    if (!isMigrationError(err)) {
      throw err;
    }
    // Si las tablas de gamificación no existen todavía, devolvemos logros vacíos.
  }

  return { totalXp, achievements };
}

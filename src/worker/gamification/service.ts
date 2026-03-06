/**
 * Servicio de gamificación: procesa eventos, asigna XP y desbloquea logros.
 * Usa D1 batch() para transacciones ACID. Degradación elegante en errores.
 */

import { GamificationError } from './errors.js';
import type {
  GamificationEvent,
  GamificationEventType,
  Achievement,
} from './types.js';
import { BASE_XP } from './types.js';

const COUNTER_COLUMN = 'counter_proposals_count';
const LIKES_COLUMN = 'likes_count';
const DISLIKES_COLUMN = 'dislikes_count';
const COMMENTS_COLUMN = 'comments_count';
const NOTES_COLUMN = 'community_notes_count';

const EVENT_TO_COLUMN: Record<GamificationEventType, string> = {
  CREATE_COUNTER_PROPOSAL: COUNTER_COLUMN,
  LIKE_ENTITY: LIKES_COLUMN,
  DISLIKE_ENTITY: DISLIKES_COLUMN,
  CREATE_COMMENT: COMMENTS_COLUMN,
  CREATE_COMMUNITY_NOTE: NOTES_COLUMN,
};

export async function processGamificationEvent(
  db: D1Database,
  event: GamificationEvent
): Promise<void> {
  const { type, payload } = event;
  const { userId } = payload;

  if (!userId) {
    throw new GamificationError('userId requerido en payload', 'MISSING_USER_ID');
  }

  const column = EVENT_TO_COLUMN[type];
  const baseXp = BASE_XP[type];

  try {
    const profileRow = await db
      .prepare(
        `SELECT total_xp, ${COUNTER_COLUMN}, ${LIKES_COLUMN}, ${DISLIKES_COLUMN}, ${COMMENTS_COLUMN}, ${NOTES_COLUMN} FROM profiles WHERE user_id = ?`
      )
      .bind(userId)
      .first<{
        total_xp: number;
        counter_proposals_count: number;
        likes_count: number;
        dislikes_count: number;
        comments_count: number;
        community_notes_count: number;
      }>();

    if (!profileRow) {
      return;
    }

    const currentCount = Number(profileRow[column as keyof typeof profileRow] ?? 0);
    const newCount = currentCount + 1;

    const achievements = await db
      .prepare(
        `SELECT id, event_type, name, description, xp_reward, threshold FROM achievements 
         WHERE event_type = ? AND threshold <= ? ORDER BY threshold DESC`
      )
      .bind(type, newCount)
      .all<Achievement>();

    const existingUserAchievements = await db
      .prepare(
        `SELECT achievement_id FROM user_achievements WHERE user_id = ?`
      )
      .bind(userId)
      .all<{ achievement_id: string }>();

    const existingIds = new Set(
      (existingUserAchievements.results ?? []).map((r) => r.achievement_id)
    );

    const newlyUnlocked = (achievements.results ?? []).filter(
      (a) => !existingIds.has(a.id)
    );

    const achievementXp = newlyUnlocked.reduce((sum, a) => sum + (a.xp_reward ?? 0), 0);
    const totalXpToAdd = baseXp + achievementXp;

    const statements: D1PreparedStatement[] = [];

    statements.push(
      db
        .prepare(
          `UPDATE profiles SET 
          total_xp = total_xp + ?,
          ${column} = ?,
          updated_at = datetime('now')
          WHERE user_id = ?`
        )
        .bind(totalXpToAdd, newCount, userId)
    );

    for (const a of newlyUnlocked) {
      const id = crypto.randomUUID();
      statements.push(
        db
          .prepare(
            `INSERT INTO user_achievements (id, user_id, achievement_id, earned_at, xp_earned)
             VALUES (?, ?, ?, datetime('now'), ?)`
          )
          .bind(id, userId, a.id, a.xp_reward ?? 0)
      );
    }

    const results = await db.batch(statements);

    const failed = results.some((r) => !r.success);
    if (failed) {
      const firstError = results.find((r) => !r.success)?.error;
      throw new GamificationError(
        'Falló el batch de gamificación',
        'BATCH_FAILED',
        firstError
      );
    }
  } catch (err) {
    if (err instanceof GamificationError) throw err;
    throw new GamificationError(
      err instanceof Error ? err.message : 'Error desconocido en gamificación',
      'PROCESS_FAILED',
      err
    );
  }
}

/**
 * Tipos para el sistema de gamificación (eventos, logros, payloads).
 */

export type GamificationEventType =
  | 'CREATE_COUNTER_PROPOSAL'
  | 'LIKE_ENTITY'
  | 'DISLIKE_ENTITY'
  | 'CREATE_COMMENT'
  | 'CREATE_COMMUNITY_NOTE';

export interface GamificationEventPayload {
  userId: string;
  topicId?: string;
  proposalId?: string;
  entityType?: 'proposal' | 'proposal_note' | 'comment';
  entityId?: string;
  commentId?: string;
  noteId?: string;
}

export interface GamificationEvent {
  type: GamificationEventType;
  payload: GamificationEventPayload;
  timestamp?: string;
}

export interface Achievement {
  id: string;
  event_type: string;
  name: string;
  description: string;
  xp_reward: number;
  threshold: number;
  icon_key?: string;
  sort_order: number;
}

export interface UserAchievementRow {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  xp_earned: number;
}

/** XP base por evento (antes de evaluar logros). */
export const BASE_XP: Record<GamificationEventType, number> = {
  CREATE_COUNTER_PROPOSAL: 10,
  LIKE_ENTITY: 2,
  DISLIKE_ENTITY: 1,
  CREATE_COMMENT: 5,
  CREATE_COMMUNITY_NOTE: 15,
};

/**
 * Tipos compartidos para perfil de usuario (contrato client/server).
 */

export interface AchievementItem {
  id: string;
  name: string;
  description: string;
  earnedAt: string;
}

export interface GamificationInfo {
  totalXp: number;
  achievements: AchievementItem[];
}

export interface ProfileResponse {
  displayName: string;
  username: string;
  birthDate: string;
  description: string;
  ideologies: string[];
  hasPhoto: boolean;
  isPremium: boolean;
  gamification: GamificationInfo;
}

-- Relación usuario-logro: hitos desbloqueados con timestamp
CREATE TABLE IF NOT EXISTS user_achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  earned_at TEXT DEFAULT (datetime('now')),
  xp_earned INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id),
  FOREIGN KEY (achievement_id) REFERENCES achievements(id),
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);

-- Métricas transaccionales de gamificación en profiles
-- NOTA: ALTER TABLE ADD COLUMN no es idempotente en SQLite. Si aparece "duplicate column name"
-- al re-ejecutar, la migración ya se aplicó. migrations apply registra cada archivo en d1_migrations
-- y solo ejecuta cada uno una vez.

ALTER TABLE profiles ADD COLUMN total_xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN counter_proposals_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN likes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN dislikes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN comments_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN community_notes_count INTEGER NOT NULL DEFAULT 0;

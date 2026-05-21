-- RESET: Elimina todo en orden inverso a las FK.
-- Ejecutar ANTES de re-aplicar todas las migrations.

DROP TABLE IF EXISTS user_achievements;
DROP TABLE IF EXISTS payment_tickets;
DROP TABLE IF EXISTS proposal_notes;
DROP TABLE IF EXISTS proposals;
DROP TABLE IF EXISTS topics;
DROP TABLE IF EXISTS achievements;
DROP TABLE IF EXISTS profiles;

DROP INDEX IF EXISTS idx_profiles_username;
DROP INDEX IF EXISTS idx_profiles_email;
DROP INDEX IF EXISTS idx_proposals_topic;
DROP INDEX IF EXISTS idx_notes_proposal;
DROP INDEX IF EXISTS idx_achievements_event;
DROP INDEX IF EXISTS idx_user_achievements_user;
DROP INDEX IF EXISTS idx_user_achievements_achievement;
DROP INDEX IF EXISTS idx_payment_tickets_user;
DROP INDEX IF EXISTS idx_payment_tickets_status;
DROP INDEX IF EXISTS idx_payment_tickets_user_reference;

-- Catálogo estático de logros (insignias) para gamificación
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  threshold INTEGER NOT NULL DEFAULT 1,
  icon_key TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_achievements_event ON achievements(event_type);

-- Seed de logros base para cada evento
INSERT OR IGNORE INTO achievements (id, event_type, name, description, xp_reward, threshold, sort_order) VALUES
  -- CREATE_COUNTER_PROPOSAL
  ('first_counter_proposal', 'CREATE_COUNTER_PROPOSAL', 'Primera contrapropuesta', 'Has creado tu primera contrapropuesta.', 10, 1, 1),
  ('debater_5', 'CREATE_COUNTER_PROPOSAL', 'Debatiente novato', '5 contrapropuestas creadas.', 25, 5, 2),
  ('debater_10', 'CREATE_COUNTER_PROPOSAL', 'Debatiente activo', '10 contrapropuestas creadas.', 50, 10, 3),
  -- LIKE_ENTITY
  ('supporter_5', 'LIKE_ENTITY', 'Apoyo comunitario', 'Has dado 5 likes a la comunidad.', 15, 5, 4),
  ('supporter_25', 'LIKE_ENTITY', 'Colaborador positivo', '25 likes otorgados.', 30, 25, 5),
  ('supporter_100', 'LIKE_ENTITY', 'Pilar de la comunidad', '100 likes otorgados.', 75, 100, 6),
  -- DISLIKE_ENTITY
  ('critical_5', 'DISLIKE_ENTITY', 'Participación crítica', 'Has dado 5 dislikes constructivos.', 8, 5, 7),
  ('critical_25', 'DISLIKE_ENTITY', 'Juicio crítico', '25 dislikes otorgados.', 20, 25, 8),
  -- CREATE_COMMENT
  ('commenter_1', 'CREATE_COMMENT', 'Primer comentario', 'Has publicado tu primer comentario.', 10, 1, 9),
  ('commenter_3', 'CREATE_COMMENT', 'Comentarista', '3 comentarios publicados.', 25, 3, 10),
  ('commenter_10', 'CREATE_COMMENT', 'Voceador', '10 comentarios publicados.', 50, 10, 11),
  -- CREATE_COMMUNITY_NOTE
  ('noter_1', 'CREATE_COMMUNITY_NOTE', 'Primera nota', 'Has redactado tu primera nota de comunidad.', 20, 1, 12),
  ('noter_5', 'CREATE_COMMUNITY_NOTE', 'Notero experto', '5 notas de comunidad publicadas.', 60, 5, 13),
  ('noter_10', 'CREATE_COMMUNITY_NOTE', 'Colaborador destacado', '10 notas de comunidad.', 120, 10, 14);

-- Esquema para Temas, Propuestas y Notas de la Comunidad
-- Jerarquía: Categoría > Subcategoría > Tema > Propuestas > Notas

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  subcategory TEXT,
  topic_text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  author TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (topic_id) REFERENCES topics(id)
);

CREATE TABLE IF NOT EXISTS proposal_notes (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  text TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  net_score INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (proposal_id) REFERENCES proposals(id)
);

CREATE INDEX IF NOT EXISTS idx_proposals_topic ON proposals(topic_id);
CREATE INDEX IF NOT EXISTS idx_notes_proposal ON proposal_notes(proposal_id);

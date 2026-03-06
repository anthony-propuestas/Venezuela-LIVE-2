CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  birth_date TEXT,
  description TEXT,
  ideologies TEXT,
  photo_key TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

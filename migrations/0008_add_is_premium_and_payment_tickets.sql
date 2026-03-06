-- Modelo Freemium: is_premium en profiles y tabla de tickets de pago
ALTER TABLE profiles ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payment_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reference TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_tickets_user ON payment_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_tickets_status ON payment_tickets(status);
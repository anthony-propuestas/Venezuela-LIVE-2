CREATE TABLE IF NOT EXISTS user_votes (
  user_id      TEXT NOT NULL,
  proposal_id  TEXT NOT NULL,
  vote_type    TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
  week_start   TEXT NOT NULL,
  voted_at     TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, proposal_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_user_votes_proposal ON user_votes(proposal_id);

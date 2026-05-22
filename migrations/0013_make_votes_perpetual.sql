DROP TABLE IF EXISTS user_votes;
CREATE TABLE user_votes (
  user_id      TEXT NOT NULL,
  proposal_id  TEXT NOT NULL,
  vote_type    TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
  voted_at     TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, proposal_id)
);
CREATE INDEX IF NOT EXISTS idx_user_votes_proposal ON user_votes(proposal_id);

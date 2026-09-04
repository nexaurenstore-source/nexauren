CREATE TABLE IF NOT EXISTS user_integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  auth_type TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, provider, label)
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user
  ON user_integrations(user_id, updated_at DESC);

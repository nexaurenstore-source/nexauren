CREATE TABLE IF NOT EXISTS business_copywriter_generations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reference TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_business_copywriter_generations_user_created
  ON business_copywriter_generations(user_id, created_at DESC);

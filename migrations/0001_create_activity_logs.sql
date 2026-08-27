CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  tool_id TEXT,
  tool_name TEXT,
  url TEXT,
  details TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created
  ON activity_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user
  ON activity_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_tool
  ON activity_logs(tool_id, created_at DESC);

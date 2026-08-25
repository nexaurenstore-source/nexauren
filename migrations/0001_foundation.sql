CREATE TABLE IF NOT EXISTS tool_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_slug TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tool_usage_slug ON tool_usage(tool_slug);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);

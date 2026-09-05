CREATE TABLE IF NOT EXISTS business_tools_daily_usage (
  user_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  free_generations INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, tool_id, usage_date)
);
CREATE INDEX IF NOT EXISTS idx_business_tools_usage_date ON business_tools_daily_usage (usage_date);
CREATE TABLE IF NOT EXISTS business_tools_generations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  reference TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, tool_id, reference)
);
CREATE INDEX IF NOT EXISTS idx_business_tools_generations_user_created ON business_tools_generations(user_id, created_at DESC);
INSERT OR IGNORE INTO tool_billing (tool_id, credit_cost, enabled, updated_at) VALUES
  ('business-invoice', 5, 1, strftime('%s','now')),
  ('business-quote', 5, 1, strftime('%s','now')),
  ('business-receipt', 5, 1, strftime('%s','now')),
  ('business-expense', 5, 1, strftime('%s','now'));

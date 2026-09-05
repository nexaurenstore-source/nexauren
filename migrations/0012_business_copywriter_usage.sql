CREATE TABLE IF NOT EXISTS business_copywriter_daily_usage (
  user_id TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  free_generations INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_business_copywriter_usage_date
  ON business_copywriter_daily_usage (usage_date);

INSERT OR IGNORE INTO tool_billing
  (tool_id, credit_cost, enabled, updated_at)
VALUES
  ('business-copywriter', 5, 1, strftime('%s','now'));

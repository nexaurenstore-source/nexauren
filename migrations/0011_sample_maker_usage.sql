CREATE TABLE IF NOT EXISTS sample_maker_daily_usage (
  user_id TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  generations INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_sample_maker_daily_usage_date
  ON sample_maker_daily_usage (usage_date);

CREATE TABLE IF NOT EXISTS sample_maker_generations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  reference TEXT NOT NULL,
  sample_count INTEGER NOT NULL,
  effects_json TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_sample_maker_generations_user_date
  ON sample_maker_generations (user_id, usage_date);

CREATE TRIGGER IF NOT EXISTS trg_sample_maker_generation_usage
AFTER INSERT ON sample_maker_generations
BEGIN
  UPDATE sample_maker_daily_usage
  SET generations = generations + 1,
      updated_at = NEW.created_at
  WHERE user_id = NEW.user_id
    AND usage_date = NEW.usage_date;
END;

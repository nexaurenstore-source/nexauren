-- Rebuild the Sample Maker usage trigger and reconcile existing daily counters.
-- The generation table remains the audit/source-of-truth for individual generations.
DROP TRIGGER IF EXISTS trg_sample_maker_generation_usage;

INSERT OR REPLACE INTO sample_maker_daily_usage (user_id, usage_date, generations, updated_at)
SELECT user_id, usage_date, COUNT(*) AS generations, COALESCE(MAX(created_at), strftime('%s','now'))
FROM sample_maker_generations
GROUP BY user_id, usage_date;

CREATE TRIGGER IF NOT EXISTS trg_sample_maker_generation_usage
AFTER INSERT ON sample_maker_generations
BEGIN
  INSERT INTO sample_maker_daily_usage (user_id, usage_date, generations, updated_at)
  VALUES (NEW.user_id, NEW.usage_date, 1, NEW.created_at)
  ON CONFLICT(user_id, usage_date) DO UPDATE SET
    generations = sample_maker_daily_usage.generations + 1,
    updated_at = NEW.created_at;
END;

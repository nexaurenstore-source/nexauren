-- Subscription lifecycle support. Provider-specific billing remains disabled.

ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN current_period_start INTEGER;
ALTER TABLE subscriptions ADD COLUMN current_period_end INTEGER;

CREATE TABLE IF NOT EXISTS subscription_cycles (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  cycle_key TEXT NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  credit_transaction_id TEXT,
  created_at INTEGER NOT NULL,
  processed_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_cycles_key
  ON subscription_cycles(subscription_id,cycle_key);
CREATE INDEX IF NOT EXISTS idx_subscription_cycles_user
  ON subscription_cycles(user_id,period_start DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_cycles_due
  ON subscription_cycles(status,period_end);

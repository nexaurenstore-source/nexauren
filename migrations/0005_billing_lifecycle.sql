-- Billing lifecycle hardening: recurring periods, webhook idempotency metadata and refund tracking.

ALTER TABLE subscriptions ADD COLUMN current_period_start INTEGER;
ALTER TABLE subscriptions ADD COLUMN current_period_end INTEGER;
ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0;

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_cycles_subscription_key
  ON subscription_cycles(subscription_id,cycle_key);
CREATE INDEX IF NOT EXISTS idx_subscription_cycles_user_created
  ON subscription_cycles(user_id,created_at DESC);

-- The existing webhook_events table keeps only a bounded payload fingerprint,
-- not the full webhook body, to avoid storing unnecessary provider data.
CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON webhook_events(status,created_at DESC);

-- Refund references are unique through credit_transactions.reference.

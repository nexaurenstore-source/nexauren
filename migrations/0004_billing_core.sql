-- Provider-independent billing foundation.
-- Payment providers are intentionally not configured by this migration.

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_interval TEXT NOT NULL DEFAULT 'none',
  credits_per_cycle INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_accounts (
  user_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL DEFAULT 'free',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  reference TEXT NOT NULL UNIQUE,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  type TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_transaction
  ON payments(provider,provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_user_created
  ON payments(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments(status,created_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_subscription_id TEXT,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  start_date INTEGER,
  next_billing_date INTEGER,
  cancelled_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_provider_id
  ON subscriptions(provider,provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON subscriptions(user_id,status);

CREATE TABLE IF NOT EXISTS credit_balances (
  user_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  payment_id TEXT,
  tool_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created
  ON credit_transactions(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type
  ON credit_transactions(user_id,type,created_at DESC);

CREATE TABLE IF NOT EXISTS tool_billing (
  tool_id TEXT PRIMARY KEY,
  credit_cost INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_usage_user_created
  ON tool_usage(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_usage_tool_created
  ON tool_usage(tool_id,created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT,
  event_type TEXT,
  reference TEXT,
  payload_hash TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  processed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event
  ON webhook_events(provider,event_id)
  WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_reference
  ON webhook_events(provider,reference);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_cycle_credit_reference
  ON credit_transactions(reference)
  WHERE type='subscription';

-- Initial configurable catalog. Prices are stored in minor units.
INSERT OR IGNORE INTO plans
  (id,name,price_minor,currency,billing_interval,credits_per_cycle,enabled,created_at,updated_at)
VALUES
  ('free','Free',0,'USD','none',100,1,strftime('%s','now'),strftime('%s','now')),
  ('pro_monthly','Pro Monthly',1000,'USD','month',1000,1,strftime('%s','now'),strftime('%s','now')),
  ('pro_yearly','Pro Yearly',10000,'USD','year',12000,1,strftime('%s','now'),strftime('%s','now'));

INSERT OR IGNORE INTO credit_packages
  (id,name,credits,price_minor,currency,enabled,created_at,updated_at)
VALUES
  ('credits_100','100 Credits',100,200,'USD',1,strftime('%s','now'),strftime('%s','now')),
  ('credits_500','500 Credits',500,800,'USD',1,strftime('%s','now'),strftime('%s','now')),
  ('credits_1000','1,000 Credits',1000,1500,'USD',1,strftime('%s','now'),strftime('%s','now'));

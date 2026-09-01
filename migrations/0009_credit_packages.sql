-- Nexauren billing credit catalog
-- Seeds the default one-time credit packages used by the Billing page.

CREATE TABLE IF NOT EXISTS credit_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO credit_packages (id, name, credits, price_cents, currency, active)
VALUES
  ('credits_100', '100 Credits', 100, 200, 'USD', 1),
  ('credits_500', '500 Credits', 500, 800, 'USD', 1),
  ('credits_1000', '1,000 Credits', 1000, 1500, 'USD', 1);

-- PayPal catalog linkage for local plans.
-- Existing plans remain valid; these columns are populated only when an admin creates a PayPal plan.
ALTER TABLE plans ADD COLUMN paypal_product_id TEXT;
ALTER TABLE plans ADD COLUMN paypal_plan_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_paypal_plan_id ON plans(paypal_plan_id) WHERE paypal_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plans_paypal_product_id ON plans(paypal_product_id) WHERE paypal_product_id IS NOT NULL;

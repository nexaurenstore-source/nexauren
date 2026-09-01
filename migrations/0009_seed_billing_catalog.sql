-- Ensure the configurable billing catalog exists in remote D1 databases.
-- 0004 creates these rows, but databases migrated before the seed was present
-- may have the tables without the catalog records.

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

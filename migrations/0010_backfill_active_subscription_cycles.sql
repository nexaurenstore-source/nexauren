-- Backfill the first credit cycle for already-active subscriptions that were
-- activated before the initial-cycle grant was wired into backend verification.
-- Idempotent: existing cycle keys are never credited twice.

INSERT OR IGNORE INTO credit_transactions(
  id,user_id,amount,type,description,reference,payment_id,created_at
)
SELECT
  'subscription-cycle-tx:' || s.id || ':' || s.current_period_start || ':' || s.current_period_end,
  s.user_id,
  p.credits_per_cycle,
  'subscription',
  'Subscription cycle: ' || s.plan_id,
  'subscription-cycle:' || s.id || ':' || s.current_period_start || ':' || s.current_period_end,
  pay.id,
  strftime('%s','now')
FROM subscriptions s
JOIN plans p ON p.id=s.plan_id AND p.enabled=1
LEFT JOIN payments pay
  ON pay.provider='paypal'
 AND pay.provider_transaction_id=s.provider_subscription_id
WHERE s.status='active'
  AND s.current_period_start IS NOT NULL
  AND s.current_period_end IS NOT NULL
  AND s.current_period_end > s.current_period_start
  AND p.credits_per_cycle > 0
  AND NOT EXISTS (
    SELECT 1
    FROM subscription_cycles sc
    WHERE sc.subscription_id=s.id
      AND sc.cycle_key=(s.current_period_start || ':' || s.current_period_end)
  );

INSERT OR IGNORE INTO subscription_cycles(
  id,subscription_id,user_id,cycle_key,period_start,period_end,credits,status,credit_transaction_id,created_at,processed_at
)
SELECT
  'subscription-cycle:' || s.id || ':' || s.current_period_start || ':' || s.current_period_end,
  s.id,
  s.user_id,
  s.current_period_start || ':' || s.current_period_end,
  s.current_period_start,
  s.current_period_end,
  p.credits_per_cycle,
  'credited',
  ct.id,
  strftime('%s','now'),
  strftime('%s','now')
FROM subscriptions s
JOIN plans p ON p.id=s.plan_id AND p.enabled=1
JOIN credit_transactions ct
  ON ct.user_id=s.user_id
 AND ct.reference=('subscription-cycle:' || s.id || ':' || s.current_period_start || ':' || s.current_period_end)
WHERE s.status='active'
  AND s.current_period_start IS NOT NULL
  AND s.current_period_end IS NOT NULL
  AND s.current_period_end > s.current_period_start
  AND p.credits_per_cycle > 0;

INSERT OR IGNORE INTO credit_balances(user_id,balance,updated_at)
SELECT DISTINCT user_id,0,strftime('%s','now')
FROM credit_transactions
WHERE reference LIKE 'subscription-cycle:%';

UPDATE credit_balances
SET balance=(SELECT COALESCE(SUM(ct.amount),0) FROM credit_transactions ct WHERE ct.user_id=credit_balances.user_id),
    updated_at=strftime('%s','now')
WHERE user_id IN (
  SELECT DISTINCT user_id
  FROM credit_transactions
  WHERE reference LIKE 'subscription-cycle:%'
);

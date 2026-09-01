import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const billingPath = resolve(root, 'scripts/worker/billing.js');
const source = await readFile(billingPath, 'utf8');

const marker = "  await e.DB.prepare(\"UPDATE payments SET status='successful',provider_transaction_id=?1,metadata=?2,updated_at=?3 WHERE id=?4\").bind(providerSubscriptionId, JSON.stringify({ ...metadata, provider_subscription_id: providerSubscriptionId }), now, payment.id).run();\n  return { processed: true, subscription_pending: true };";

const replacement = `  await e.DB.prepare(\"UPDATE payments SET status='successful',provider_transaction_id=?1,metadata=?2,updated_at=?3 WHERE id=?4\").bind(providerSubscriptionId, JSON.stringify({ ...metadata, provider_subscription_id: providerSubscriptionId }), now, payment.id).run();

  // Grant the first subscription cycle immediately after backend verification of an ACTIVE PayPal subscription.
  // This is idempotent through subscription_cycles(subscription_id, cycle_key) and is safe if the PayPal
  // BILLING.SUBSCRIPTION.ACTIVATED webhook is later delivered for the same period.
  if (provider === 'paypal') {
    const localSubscription = await e.DB.prepare(\"SELECT id,status,current_period_start,current_period_end FROM subscriptions WHERE provider='paypal' AND provider_subscription_id=?1 LIMIT 1\").bind(providerSubscriptionId).first();
    if (localSubscription?.id && localSubscription.status === 'active' && Number(localSubscription.current_period_end) > Number(localSubscription.current_period_start)) {
      await billingProcessSubscriptionCycle(e, {
        provider: 'paypal',
        subscriptionId: localSubscription.id,
        providerTransactionId: providerSubscriptionId,
        periodStart: Number(localSubscription.current_period_start),
        periodEnd: Number(localSubscription.current_period_end),
        amountMinor: Number(amountMinor),
        currency,
        reference: \`subscription:\${localSubscription.id}:\${Number(localSubscription.current_period_start)}:\${Number(localSubscription.current_period_end)}\`,
      });
    }
  }

  return { processed: true, subscription_pending: false };`;

if (source.includes(replacement)) {
  console.log('[subscription-initial-cycle-patch] Already applied.');
} else {
  if (!source.includes(marker)) throw new Error('[subscription-initial-cycle-patch] Target billingFinalizePayment block not found.');
  await writeFile(billingPath, source.replace(marker, replacement), 'utf8');
  console.log('[subscription-initial-cycle-patch] Applied.');
}

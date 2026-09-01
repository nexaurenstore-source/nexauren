import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const routesPath = resolve(root, 'scripts/worker/billing-routes.js');
const source = await readFile(routesPath, 'utf8');

const marker = `      const local = await e.DB.prepare("SELECT id,status FROM subscriptions WHERE provider='paypal' AND provider_subscription_id=?1 LIMIT 1").bind(subscriptionId).first();
      if (local) {
        await e.DB.prepare('UPDATE subscriptions SET plan_id=?1,status=\\'active\\',start_date=?2,next_billing_date=?3,current_period_start=?2,current_period_end=?3,updated_at=?4 WHERE id=?5').bind(planId, start, next, now, local.id).run();
      }`;

const replacement = `      // The return request is authoritative for the first activation. Webhooks are asynchronous,
      // so the local subscription must also be created here if PayPal approved it before a webhook arrived.
      await billingEnsureAccount(e, u.id);
      let local = await e.DB.prepare("SELECT id,status FROM subscriptions WHERE provider='paypal' AND provider_subscription_id=?1 LIMIT 1").bind(subscriptionId).first();
      if (!local) {
        const localId = uuid();
        try {
          await e.DB.prepare("INSERT INTO subscriptions(id,user_id,provider,provider_subscription_id,plan_id,status,start_date,next_billing_date,cancelled_at,created_at,updated_at,current_period_start,current_period_end,cancel_at_period_end) VALUES(?1,?2,'paypal',?3,?4,'active',?5,?6,NULL,?5,?5,?5,?6,0)").bind(localId, u.id, subscriptionId, planId, start, next, now).run();
        } catch (error) {
          const recovered = await e.DB.prepare("SELECT id,status FROM subscriptions WHERE provider='paypal' AND provider_subscription_id=?1 LIMIT 1").bind(subscriptionId).first();
          if (!recovered) throw error;
        }
        local = await e.DB.prepare("SELECT id,status FROM subscriptions WHERE provider='paypal' AND provider_subscription_id=?1 LIMIT 1").bind(subscriptionId).first();
      } else {
        await e.DB.prepare('UPDATE subscriptions SET plan_id=?1,status=\\'active\\',start_date=?2,next_billing_date=?3,current_period_start=?2,current_period_end=?3,updated_at=?4 WHERE id=?5').bind(planId, start, next, now, local.id).run();
      }`;

if (source.includes(replacement)) {
  console.log('[paypal-subscription-return-patch] Already applied.');
} else {
  if (!source.includes(marker)) throw new Error('[paypal-subscription-return-patch] Target subscription return block not found.');
  await writeFile(routesPath, source.replace(marker, replacement), 'utf8');
  console.log('[paypal-subscription-return-patch] Applied.');
}

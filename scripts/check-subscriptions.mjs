import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../migrations/0005_subscription_lifecycle.sql', import.meta.url), 'utf8');
const lifecycle = await readFile(new URL('./worker/subscription-lifecycle.js', import.meta.url), 'utf8');
const routes = await readFile(new URL('./worker/billing-routes.js', import.meta.url), 'utf8');
const build = await readFile(new URL('./build-worker.mjs', import.meta.url), 'utf8');

for (const token of [
  'cancel_at_period_end',
  'current_period_start',
  'current_period_end',
  'CREATE TABLE IF NOT EXISTS subscription_cycles',
  'idx_subscription_cycles_key',
]) {
  if (!migration.includes(token)) throw new Error(`[subscriptions] Missing migration invariant: ${token}`);
}

for (const token of [
  'async function billingProcessSubscriptionCycle',
  'INSERT INTO subscription_cycles',
  'subscription-cycle:',
  'billingCycleSeconds',
  'Recurring payment amount mismatch',
]) {
  if (!lifecycle.includes(token)) throw new Error(`[subscriptions] Missing lifecycle invariant: ${token}`);
}

for (const route of ['/api/billing/subscription/cancel','/api/billing/subscription/resume']) {
  if (!routes.includes(route)) throw new Error(`[subscriptions] Missing route: ${route}`);
}

if (!build.includes('subscriptionModuleUrl')) throw new Error('[subscriptions] Lifecycle module is not loaded by worker build.');
if (lifecycle.includes('SECRET_KEY') || lifecycle.includes('ClientSecret')) throw new Error('[subscriptions] Secrets must not be committed.');

console.log('[subscriptions] Lifecycle checks passed.');

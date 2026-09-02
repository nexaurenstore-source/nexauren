import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const outputUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const source = await readFile(outputUrl, 'utf8');

if (source.includes("const replaceExisting = d?.replace_existing === true;")) {
  console.log('[paypal-live-plan-replacement-generated] Replacement logic already present in deploy artifact.');
  process.exit(0);
}

const from = "  const enabled = d?.enabled === false ? 0 : 1;\n  if (!planId || !productId || !name) return json({ error: 'plan_id, product_id and name are required.' }, 400, cors(r));\n  if (!Number.isSafeInteger(priceMinor) || priceMinor < 0) return json({ error: 'Invalid price.' }, 400, cors(r));\n  if (!/^[A-Z]{3}$/.test(currency)) return json({ error: 'Invalid currency.' }, 400, cors(r));\n  if (!['DAY','WEEK','MONTH','YEAR'].includes(intervalUnit)) return json({ error: 'Invalid interval.' }, 400, cors(r));\n  if (!Number.isInteger(intervalCount) || intervalCount < 1 || intervalCount > 12) return json({ error: 'Invalid interval count.' }, 400, cors(r));\n  if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365) return json({ error: 'Invalid trial days.' }, 400, cors(r));\n  if (!Number.isInteger(credits) || credits < 0) return json({ error: 'Invalid credits per cycle.' }, 400, cors(r));\n  const interval = intervalUnit === 'DAY' ? 'day' : intervalUnit === 'WEEK' ? 'week' : intervalUnit === 'YEAR' ? 'year' : 'month';\n  try {\n    const existing = await e.DB.prepare('SELECT id,paypal_plan_id FROM plans WHERE id=?1 LIMIT 1').bind(planId).first();\n    if (existing?.paypal_plan_id) return json({ error: 'This local plan already has a PayPal plan.', plan_id: planId, paypal_plan_id: existing.paypal_plan_id }, 409, cors(r));\n    const remote = await provider.createPlan({ env: e, productId, name, description, priceMinor, currency, intervalUnit, intervalCount, trialDays, requestId: `nexauren-plan-${crypto.randomUUID()}` });\n    const now = Math.floor(Date.now() / 1000);";

const to = "  const enabled = d?.enabled === false ? 0 : 1;\n  const replaceExisting = d?.replace_existing === true;\n  if (!planId || !productId || !name) return json({ error: 'plan_id, product_id and name are required.' }, 400, cors(r));\n  if (!Number.isSafeInteger(priceMinor) || priceMinor < 0) return json({ error: 'Invalid price.' }, 400, cors(r));\n  if (!/^[A-Z]{3}$/.test(currency)) return json({ error: 'Invalid currency.' }, 400, cors(r));\n  if (!['DAY','WEEK','MONTH','YEAR'].includes(intervalUnit)) return json({ error: 'Invalid interval.' }, 400, cors(r));\n  if (!Number.isInteger(intervalCount) || intervalCount < 1 || intervalCount > 12) return json({ error: 'Invalid interval count.' }, 400, cors(r));\n  if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365) return json({ error: 'Invalid trial days.' }, 400, cors(r));\n  if (!Number.isInteger(credits) || credits < 0) return json({ error: 'Invalid credits per cycle.' }, 400, cors(r));\n  const interval = intervalUnit === 'DAY' ? 'day' : intervalUnit === 'WEEK' ? 'week' : intervalUnit === 'YEAR' ? 'year' : 'month';\n  try {\n    const existing = await e.DB.prepare('SELECT id,paypal_plan_id FROM plans WHERE id=?1 LIMIT 1').bind(planId).first();\n    if (existing?.paypal_plan_id && !replaceExisting) return json({ error: 'This local plan already has a PayPal plan. Enable Live plan replacement to migrate it.', plan_id: planId, paypal_plan_id: existing.paypal_plan_id }, 409, cors(r));\n    if (replaceExisting && clean(e.PAYPAL_ENVIRONMENT).toLowerCase() !== 'live') return json({ error: 'PayPal plan replacement is restricted to the Live environment.' }, 400, cors(r));\n    const remote = await provider.createPlan({ env: e, productId, name, description, priceMinor, currency, intervalUnit, intervalCount, trialDays, requestId: `nexauren-plan-${crypto.randomUUID()}` });\n    const remotePlanId = clean(remote?.id);\n    if (!remotePlanId) throw new Error('PayPal returned no plan ID.');\n    const now = Math.floor(Date.now() / 1000);";

if (!source.includes(from)) {
  throw new Error('[paypal-live-plan-replacement-generated] Expected unpatched PayPal plan route was not found. Deployment stopped.');
}

const patched = source.replace(from, to);
await writeFile(outputUrl, patched, 'utf8');
execFileSync(process.execPath, ['--check', outputUrl.pathname], { stdio: 'inherit' });
console.log('[paypal-live-plan-replacement-generated] Live replacement logic injected into final deploy artifact.');

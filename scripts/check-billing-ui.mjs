import { readFile } from 'node:fs/promises';

const files = ['frontend/billing/index.html','frontend/billing/success/index.html','frontend/billing/failed/index.html'];
for (const path of files) {
  const text = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  if (!text.includes('<!doctype html>')) throw new Error(`[billing-ui] Invalid HTML: ${path}`);
  if (!text.includes('/css/style.css')) throw new Error(`[billing-ui] Missing base CSS: ${path}`);
}

const billing = await readFile(new URL('../frontend/billing/index.html', import.meta.url), 'utf8');
const success = await readFile(new URL('../frontend/billing/success/index.html', import.meta.url), 'utf8');
const failed = await readFile(new URL('../frontend/billing/failed/index.html', import.meta.url), 'utf8');
for (const route of ['/api/billing/account','/api/billing/transactions','/api/billing/catalog','/api/billing/checkout','/api/billing/subscription/cancel','/api/billing/subscription/resume']) if (!billing.includes(route)) throw new Error(`[billing-ui] Missing API integration: ${route}`);
for (const text of ['Current plan','Credits','Subscription','Credit history','Buy credits','Cancel at period end','Resume subscription']) if (!billing.includes(text)) throw new Error(`[billing-ui] Missing surface: ${text}`);
for (const text of ['/api/billing/payment?reference=','Payment pending.','Payment confirmed.','does not grant credits']) if (!success.includes(text)) throw new Error(`[billing-ui] Success page missing backend-driven status behavior: ${text}`);
if (failed.includes('grant') && !failed.includes('No credits')) throw new Error('[billing-ui] Failed page must not grant credits.');

console.log('[billing-ui] Backend-driven billing UI checks passed.');

import { readFile } from 'node:fs/promises';

const files = [
  'frontend/billing/index.html',
  'frontend/billing/success/index.html',
  'frontend/billing/failed/index.html',
];

for (const path of files) {
  const text = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  if (!text.includes('<!doctype html>')) throw new Error(`[billing-ui] Invalid HTML: ${path}`);
  if (!text.includes('/css/style.css')) throw new Error(`[billing-ui] Missing base CSS: ${path}`);
}

const billing = await readFile(new URL('../frontend/billing/index.html', import.meta.url), 'utf8');
for (const route of [
  '/api/billing/account',
  '/api/billing/transactions',
  '/api/billing/catalog',
  '/api/billing/checkout',
]) {
  if (!billing.includes(route)) throw new Error(`[billing-ui] Missing API integration: ${route}`);
}
for (const text of ['Current plan','Credits','Subscription','Credit history','Buy credits']) {
  if (!billing.includes(text)) throw new Error(`[billing-ui] Missing surface: ${text}`);
}

console.log('[billing-ui] UI checks passed.');

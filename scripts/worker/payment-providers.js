/* NEXAUREN PAYMENT PROVIDERS — PAYPAL */

function providerProductEnvKey(prefix, productId) {
  return `${prefix}_${clean(productId).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

function buildPaymentProviderRegistry(env) {
  const configured = clean(env.PAYMENT_PROVIDER).toLowerCase() || 'paypal';
  const registry = {};
  if (configured === 'paypal' && typeof createPayPalProvider === 'function') registry.paypal = createPayPalProvider();
  return Object.freeze(registry);
}

globalThis.__NEXAUREN_PAYMENT_PROVIDERS = Object.freeze(
  typeof createPayPalProvider === 'function' ? { paypal: createPayPalProvider() } : {},
);

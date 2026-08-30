/* NEXAUREN PAYMENT PROVIDER REGISTRY PATCH */
function buildPaymentProviderRegistry(env) {
  if (typeof buildPaymentProviderRegistryPatched === 'function') {
    return buildPaymentProviderRegistryPatched(env);
  }
  const configured = clean(env.PAYMENT_PROVIDER).toLowerCase();
  const registry = { paypal: createPayPalProvider(), flutterwave: createFlutterwaveProvider() };
  return configured && registry[configured] ? Object.freeze({ [configured]: registry[configured] }) : Object.freeze({});
}

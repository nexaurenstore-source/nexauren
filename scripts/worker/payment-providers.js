/* NEXAUREN PAYMENT PROVIDERS v1
 *
 * Provider adapters are deliberately disabled until the owner selects a
 * provider and configures server-side secrets. The billing domain only knows
 * this contract; it never depends on provider-specific APIs.
 */

function billingProviderConfig(env) {
  return Object.freeze({
    name: clean(env.PAYMENT_PROVIDER).toLowerCase(),
    publicKey: clean(env.PAYMENT_PUBLIC_KEY),
    returnUrl: clean(env.PAYMENT_RETURN_URL),
    cancelUrl: clean(env.PAYMENT_CANCEL_URL),
  });
}

function createDisabledPaymentProvider(name) {
  return Object.freeze({
    name,
    async createCheckout() {
      throw new Error(`Payment provider ${name} is not configured.`);
    },
    async handleWebhook() {
      throw new Error(`Payment provider ${name} is not configured.`);
    },
  });
}

function buildPaymentProviderRegistry(env) {
  // Intentionally empty. PayPal and Flutterwave adapters will be added only
  // after the provider is selected and its current API/webhook requirements
  // are verified. No secret is embedded in source code.
  const configured = billingProviderConfig(env).name;
  const registry = Object.create(null);
  if (configured) registry[configured] = createDisabledPaymentProvider(configured);
  return Object.freeze(registry);
}

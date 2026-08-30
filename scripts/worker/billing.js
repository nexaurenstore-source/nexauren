/* NEXAUREN BILLING CORE v1 */

const BILLING_PRODUCT_TYPES = new Set(['credit_purchase', 'subscription']);
const BILLING_SUBSCRIPTION_STATUSES = new Set([
  'pending',
  'active',
  'past_due',
  'cancelled',
  'expired',
  'failed',
]);

// Providers are registered by payment-providers.js. Keep billing provider-agnostic.
// The registry is resolved at request time so the selected provider is actually
// available to checkout/webhook routes after the worker build assembles modules.
function billingProviderRegistry(e) {
  if (typeof buildPaymentProviderRegistry === 'function') {
    return buildPaymentProviderRegistry(e);
  }
  return globalThis.__NEXAUREN_PAYMENT_PROVIDERS || Object.freeze({});
}

async function billingEnsureAccount(e, userId) {
  const now = Math.floor(Date.now() / 1000);
  const freePlan = await e.DB
    .prepare(
      'SELECT id,credits_per_cycle FROM plans WHERE id=\'free\' AND enabled=1 LIMIT 1',
    )
    .first();

  if (!freePlan) {
    throw new Error('Billing catalog is not initialized.');
  }

  const reference = `grant:free:${userId}`;
  const freeCredits = Math.max(0, Number(freePlan.credits_per_cycle || 0));

  await e.DB.batch([
    e.DB
      .prepare(
        'INSERT OR IGNORE INTO billing_accounts(user_id,plan_id,created_at,updated_at) ' +
          'VALUES(?1,?2,?3,?3)',
      )
      .bind(userId, 'free', now),
    e.DB
      .prepare(
        'INSERT OR IGNORE INTO credit_balances(user_id,balance,updated_at) VALUES(?1,0,?2)',
      )
      .bind(userId, now),
    e.DB
      .prepare(
        'INSERT OR IGNORE INTO credit_transactions ' +
          '(id,user_id,amount,type,description,reference,payment_id,tool_id,created_at) ' +
          'VALUES(?1,?2,?3,\'bonus\',\'Free plan credits\',?4,NULL,NULL,?5)',
      )
      .bind(uuid(), userId, freeCredits, reference, now),
    e.DB
      .prepare(
        'UPDATE credit_balances SET balance=' +
          '(SELECT COALESCE(SUM(amount),0) FROM credit_transactions WHERE user_id=?1), ' +
          'updated_at=?2 WHERE user_id=?1',
      )
      .bind(userId, now),
  ]);

  return e.DB
    .prepare(
      'SELECT ba.user_id,ba.plan_id,p.name AS plan_name,p.price_minor,p.currency,' +
        'p.billing_interval,p.credits_per_cycle,p.enabled AS plan_enabled,' +
        'COALESCE(cb.balance,0) AS balance,ba.created_at,ba.updated_at ' +
        'FROM billing_accounts ba JOIN plans p ON p.id=ba.plan_id ' +
        'LEFT JOIN credit_balances cb ON cb.user_id=ba.user_id ' +
        'WHERE ba.user_id=?1 LIMIT 1',
    )
    .bind(userId)
    .first();
}

async function billingCatalog(r, e) {
  const [plans, packages] = await Promise.all([
    e.DB
      .prepare(
        'SELECT id,name,price_minor,currency,billing_interval,credits_per_cycle ' +
          'FROM plans WHERE enabled=1 ORDER BY price_minor ASC',
      )
      .all(),
    e.DB
      .prepare(
        'SELECT id,name,credits,price_minor,currency FROM credit_packages ' +
          'WHERE enabled=1 ORDER BY credits ASC',
      )
      .all(),
  ]);

  const providerName = clean(e.PAYMENT_PROVIDER).toLowerCase();
  const registry = billingProviderRegistry(e);
  return json(
    {
      provider: providerName || null,
      checkout_ready: !!registry[providerName],
      plans: plans?.results || [],
      credit_packages: packages?.results || [],
    },
    200,
    cors(r),
  );
}

async function billingAccount(r, e) {
  const u = await currentUser(r, e);

  if (!u) {
    return json({ error: 'Authentication required.' }, 401, cors(r));
  }

  const account = await billingEnsureAccount(e, u.id);
  const subscription = await e.DB
    .prepare(
      'SELECT id,provider,provider_subscription_id,plan_id,status,start_date,' +
        'next_billing_date,cancelled_at,created_at,updated_at ' +
        'FROM subscriptions WHERE user_id=?1 ORDER BY created_at DESC LIMIT 1',
    )
    .bind(u.id)
    .first();

  return json(
    {
      account,
      subscription: subscription || null,
    },
    200,
    cors(r),
  );
}

async function billingTransactions(r, e) {
  const u = await currentUser(r, e);

  if (!u) {
    return json({ error: 'Authentication required.' }, 401, cors(r));
  }

  const url = new URL(r.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.max(
    1,
    Math.min(50, Number(url.searchParams.get('limit')) || 20),
  );
  const offset = (page - 1) * limit;

  const [count, rows] = await Promise.all([
    e.DB
      .prepare('SELECT COUNT(*) AS total FROM credit_transactions WHERE user_id=?1')
      .bind(u.id)
      .first(),
    e.DB
      .prepare(
        'SELECT id,amount,type,description,reference,payment_id,tool_id,created_at ' +
          'FROM credit_transactions WHERE user_id=?1 ' +
          'ORDER BY created_at DESC LIMIT ?2 OFFSET ?3',
      )
      .bind(u.id, limit, offset)
      .all(),
  ]);

  return json(
    {
      page,
      limit,
      total: Number(count?.total || 0),
      transactions: rows?.results || [],
    },
    200,
    cors(r),
  );
}

async function billingCheckout(r, e) {
  const u = await currentUser(r, e);

  if (!u) {
    return json({ error: 'Authentication required.' }, 401, cors(r));
  }

  const d = await body(r);
  const productType = clean(d?.type);
  const productId = clean(d?.product_id);

  if (!BILLING_PRODUCT_TYPES.has(productType) || !productId) {
    return json({ error: 'Invalid billing product.' }, 400, cors(r));
  }

  const providerName = clean(e.PAYMENT_PROVIDER).toLowerCase();
  const provider = billingProviderRegistry(e)[providerName];

  if (!provider) {
    return json(
      {
        error: 'Payment provider not configured.',
        code: 'provider_required',
        provider: providerName || null,
      },
      503,
      cors(r),
    );
  }

  const table = productType === 'credit_purchase'
    ? 'credit_packages'
    : 'plans';
  const product = await e.DB
    .prepare(
      `SELECT * FROM ${table} WHERE id=?1 AND enabled=1 LIMIT 1`,
    )
    .bind(productId)
    .first();

  if (!product) {
    return json({ error: 'Product not found.' }, 404, cors(r));
  }

  if (productType === 'subscription' && product.billing_interval === 'none') {
    return json({ error: 'Product is not a subscription.' }, 400, cors(r));
  }

  const reference = `order:${uuid()}`;
  const amountMinor = Number(product.price_minor);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    return json({ error: 'Invalid product price.' }, 500, cors(r));
  }

  await e.DB
    .prepare(
      'INSERT INTO payments ' +
        '(id,user_id,provider,provider_transaction_id,reference,amount_minor,currency,status,type,metadata,created_at,updated_at) ' +
        'VALUES(?1,?2,?3,NULL,?4,?5,?6,\'pending\',?7,?8,?9,?9)',
    )
    .bind(
      uuid(),
      u.id,
      providerName,
      reference,
      amountMinor,
      product.currency,
      productType,
      JSON.stringify({ product_id: productId }),
      Math.floor(Date.now() / 1000),
    )
    .run();

  try {
    const checkout = await provider.createCheckout({
      request: r,
      env: e,
      user: u,
      reference,
      product,
      productType,
    });

    return json({
      success: true,
      provider: providerName,
      reference,
      checkout,
    }, 201, cors(r));
  } catch (err) {
    await e.DB
      .prepare(
        'UPDATE payments SET status=\'failed\',metadata=?1,updated_at=?2 WHERE reference=?3',
      )
      .bind(
        JSON.stringify({ product_id: productId, error: String(err).slice(0, 500) }),
        Math.floor(Date.now() / 1000),
        reference,
      )
      .run();

    console.error('Billing checkout failed', String(err).slice(0, 500));
    return json({ error: 'Unable to create checkout.' }, 502, cors(r));
  }
}

// Remaining billing functions are intentionally unchanged from the existing
// implementation. The provider registry above is the only integration point
// changed in this patch.

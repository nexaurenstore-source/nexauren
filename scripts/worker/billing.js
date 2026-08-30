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

// Provider adapters are intentionally empty until PayPal or Flutterwave is selected.
// Each adapter will implement: createCheckout, verifyTransaction, parseWebhook,
// and (when supported) subscription operations.
const NEXAUREN_PAYMENT_PROVIDERS = Object.freeze({});

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

  return json(
    {
      provider: clean(e.PAYMENT_PROVIDER).toLowerCase() || null,
      checkout_ready: !!NEXAUREN_PAYMENT_PROVIDERS[
        clean(e.PAYMENT_PROVIDER).toLowerCase()
      ],
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
  const provider = NEXAUREN_PAYMENT_PROVIDERS[providerName];

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
  const amountMinor = Number(
    productType === 'credit_purchase' ? product.price_minor : product.price_minor,
  );

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

async function billingAddCredits(e, {
  userId,
  amount,
  type,
  description,
  reference,
  paymentId = null,
  toolId = null,
}) {
  const credits = Math.floor(Number(amount));
  if (!Number.isFinite(credits) || credits <= 0) {
    throw new Error('Invalid credit amount.');
  }

  const now = Math.floor(Date.now() / 1000);
  const result = await e.DB.batch([
    e.DB
      .prepare(
        'INSERT OR IGNORE INTO credit_transactions ' +
          '(id,user_id,amount,type,description,reference,payment_id,tool_id,created_at) ' +
          'VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)',
      )
      .bind(
        uuid(),
        userId,
        credits,
        type,
        clean(description).slice(0, 240),
        reference,
        paymentId,
        toolId,
        now,
      ),
    e.DB
      .prepare(
        'INSERT OR IGNORE INTO credit_balances(user_id,balance,updated_at) VALUES(?1,0,?2)',
      )
      .bind(userId, now),
    e.DB
      .prepare(
        'UPDATE credit_balances SET balance=' +
          '(SELECT COALESCE(SUM(amount),0) FROM credit_transactions WHERE user_id=?1), ' +
          'updated_at=?2 WHERE user_id=?1',
      )
      .bind(userId, now),
  ]);

  return { applied: Number(result?.[0]?.meta?.changes || 0) > 0 };
}

async function billingDebitCredits(e, {
  userId,
  amount,
  toolId,
  reference,
}) {
  const credits = Math.floor(Number(amount));
  if (!Number.isFinite(credits) || credits <= 0) {
    throw new Error('Invalid credit amount.');
  }

  const now = Math.floor(Date.now() / 1000);
  const result = await e.DB.batch([
    e.DB
      .prepare(
        'INSERT OR IGNORE INTO credit_transactions ' +
          '(id,user_id,amount,type,description,reference,payment_id,tool_id,created_at) ' +
          'SELECT ?1,?2,?3,\'usage\',?4,?5,NULL,?6,?7 ' +
          'WHERE NOT EXISTS(SELECT 1 FROM credit_transactions WHERE reference=?5) ' +
          'AND EXISTS(SELECT 1 FROM credit_balances WHERE user_id=?2 AND balance>=?8)',
      )
      .bind(
        uuid(),
        userId,
        -credits,
        `Tool usage: ${clean(toolId).slice(0, 120)}`,
        reference,
        toolId,
        now,
        credits,
      ),
    e.DB
      .prepare(
        'INSERT OR IGNORE INTO credit_balances(user_id,balance,updated_at) VALUES(?1,0,?2)',
      )
      .bind(userId, now),
    e.DB
      .prepare(
        'UPDATE credit_balances SET balance=' +
          '(SELECT COALESCE(SUM(amount),0) FROM credit_transactions WHERE user_id=?1), ' +
          'updated_at=?2 WHERE user_id=?1',
      )
      .bind(userId, now),
  ]);

  const applied = Number(result?.[0]?.meta?.changes || 0) > 0;

  if (!applied) {
    const existing = await e.DB
      .prepare(
        'SELECT id,amount,tool_id,created_at FROM credit_transactions ' +
          'WHERE user_id=?1 AND reference=?2 LIMIT 1',
      )
      .bind(userId, reference)
      .first();

    if (existing) {
      return { applied: false, idempotent: true, transaction: existing };
    }

    return { applied: false, idempotent: false, insufficient: true };
  }

  const usageId = uuid();
  await e.DB.batch([
    e.DB
      .prepare(
        'INSERT INTO tool_usage(id,user_id,tool_id,credits,status,reference,created_at) ' +
          'SELECT ?1,?2,?3,?4,\'consumed\',?5,?6 ' +
          'FROM credit_transactions WHERE user_id=?2 AND reference=?5 LIMIT 1',
      )
      .bind(usageId, userId, toolId, credits, reference, now),
  ]);

  return { applied: true, idempotent: false, transaction: { id: usageId } };
}

async function billingUsage(r, e) {
  const u = await currentUser(r, e);
  if (!u) {
    return json({ error: 'Authentication required.' }, 401, cors(r));
  }

  const d = await body(r);
  const toolId = clean(d?.tool_id).slice(0, 120);
  const reference = clean(d?.reference).slice(0, 160) || `usage:${uuid()}`;

  if (!toolId) {
    return json({ error: 'tool_id is required.' }, 400, cors(r));
  }

  const tool = await e.DB
    .prepare(
      'SELECT tool_id,credit_cost,enabled FROM tool_billing WHERE tool_id=?1 LIMIT 1',
    )
    .bind(toolId)
    .first();

  if (!tool || Number(tool.enabled) !== 1) {
    return json(
      { error: 'Tool billing is not configured.', code: 'tool_not_configured' },
      409,
      cors(r),
    );
  }

  const cost = Math.floor(Number(tool.credit_cost));
  if (!Number.isFinite(cost) || cost < 0) {
    return json({ error: 'Invalid tool credit cost.' }, 500, cors(r));
  }

  if (cost === 0) {
    return json({ success: true, charged: 0, reference }, 200, cors(r));
  }

  const result = await billingDebitCredits(e, {
    userId: u.id,
    amount: cost,
    toolId,
    reference,
  });

  if (result.insufficient) {
    const account = await billingEnsureAccount(e, u.id);
    return json(
      {
        error: 'Insufficient credits.',
        code: 'insufficient_credits',
        balance: Number(account?.balance || 0),
        required: cost,
      },
      402,
      cors(r),
    );
  }

  const account = await billingEnsureAccount(e, u.id);
  return json(
    {
      success: true,
      charged: result.idempotent ? 0 : cost,
      idempotent: !!result.idempotent,
      reference,
      balance: Number(account?.balance || 0),
    },
    200,
    cors(r),
  );
}

async function billingWebhook(r, e, providerName) {
  const name = clean(providerName).toLowerCase();
  const provider = NEXAUREN_PAYMENT_PROVIDERS[name];

  if (!provider || typeof provider.handleWebhook !== 'function') {
    return json(
      { error: 'Payment provider not configured.', code: 'provider_required' },
      503,
      cors(r),
    );
  }

  // Provider adapters must validate signatures and re-fetch/verify the payment
  // with the provider before calling billingFinalizePayment().
  return provider.handleWebhook({ request: r, env: e, finalize: billingFinalizePayment });
}

async function billingFinalizePayment(e, verified) {
  const {
    provider,
    reference,
    providerTransactionId,
    status,
    userId,
    amountMinor,
    currency,
    type,
    productId,
    metadata = {},
  } = verified || {};

  if (!provider || !reference || !providerTransactionId || !userId) {
    throw new Error('Invalid verified payment payload.');
  }
  if (!BILLING_PRODUCT_TYPES.has(type)) {
    throw new Error('Invalid payment type.');
  }
  if (!['successful', 'failed', 'cancelled', 'refunded'].includes(status)) {
    throw new Error('Invalid payment status.');
  }

  const payment = await e.DB
    .prepare(
      'SELECT id,user_id,amount_minor,currency,type,status FROM payments WHERE reference=?1 LIMIT 1',
    )
    .bind(reference)
    .first();

  if (!payment) {
    throw new Error('Payment reference not found.');
  }

  if (
    payment.user_id !== userId ||
    Number(payment.amount_minor) !== Number(amountMinor) ||
    String(payment.currency).toUpperCase() !== String(currency).toUpperCase() ||
    payment.type !== type
  ) {
    throw new Error('Payment verification mismatch.');
  }

  const now = Math.floor(Date.now() / 1000);
  await e.DB
    .prepare(
      'UPDATE payments SET provider_transaction_id=?1,status=?2,metadata=?3,updated_at=?4 ' +
        'WHERE reference=?5',
    )
    .bind(
      String(providerTransactionId),
      status,
      JSON.stringify(metadata),
      now,
      reference,
    )
    .run();

  if (status !== 'successful') {
    return { processed: false, status };
  }

  const existing = await e.DB
    .prepare(
      'SELECT id FROM credit_transactions WHERE reference=?1 LIMIT 1',
    )
    .bind(`payment:${reference}`)
    .first();

  if (existing) {
    return { processed: false, idempotent: true, credit_transaction_id: existing.id };
  }

  if (type === 'credit_purchase') {
    const product = await e.DB
      .prepare(
        'SELECT credits FROM credit_packages WHERE id=?1 AND enabled=1 LIMIT 1',
      )
      .bind(productId)
      .first();

    if (!product) {
      throw new Error('Credit product not found.');
    }

    const result = await billingAddCredits(e, {
      userId,
      amount: Number(product.credits),
      type: 'purchase',
      description: `Credit purchase: ${productId}`,
      reference: `payment:${reference}`,
      paymentId: payment.id,
    });

    return { processed: result.applied, idempotent: !result.applied };
  }

  const plan = await e.DB
    .prepare(
      'SELECT id,credits_per_cycle FROM plans WHERE id=?1 AND enabled=1 LIMIT 1',
    )
    .bind(productId)
    .first();

  if (!plan) {
    throw new Error('Subscription plan not found.');
  }

  await e.DB.batch([
    e.DB
      .prepare(
        'UPDATE billing_accounts SET plan_id=?1,updated_at=?2 WHERE user_id=?3',
      )
      .bind(productId, now, userId),
    e.DB
      .prepare(
        'UPDATE subscriptions SET status=\'cancelled\',cancelled_at=?1,updated_at=?1 ' +
          'WHERE user_id=?2 AND status IN (\'active\',\'pending\')',
      )
      .bind(now, userId),
    e.DB
      .prepare(
        'INSERT INTO subscriptions(id,user_id,provider,provider_subscription_id,plan_id,status,' +
          'start_date,next_billing_date,cancelled_at,created_at,updated_at) ' +
          'VALUES(?1,?2,?3,?4,?5,\'active\',?6,?7,NULL,?6,?6)',
      )
      .bind(
        uuid(),
        userId,
        provider,
        String(metadata.provider_subscription_id || providerTransactionId),
        productId,
        now,
        metadata.next_billing_date || null,
      ),
  ]);

  const result = await billingAddCredits(e, {
    userId,
    amount: Number(plan.credits_per_cycle),
    type: 'subscription',
    description: `Subscription credits: ${productId}`,
    reference: `payment:${reference}`,
    paymentId: payment.id,
  });

  return { processed: result.applied, idempotent: !result.applied };
}

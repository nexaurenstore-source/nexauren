/* NEXAUREN BILLING SAFETY PATCH v3 */

async function billingDebitCreditsSafe(e, { userId, amount, toolId, reference }) {
  const credits = Math.floor(Number(amount));
  if (!Number.isSafeInteger(credits) || credits <= 0) throw new Error('Invalid credit amount.');
  const safeReference = clean(reference).slice(0, 160);
  if (!safeReference) throw new Error('Usage reference is required.');
  const safeToolId = clean(toolId).slice(0, 120);
  const now = Math.floor(Date.now() / 1000);

  // D1 batch() is transactional and statements execute sequentially. The
  // balance decrement is conditional on both the reference being unused and
  // the current balance being sufficient, so two concurrent requests cannot
  // both spend the same credits.
  const results = await e.DB.batch([
    e.DB.prepare(
      "UPDATE credit_balances SET balance=balance-?1,updated_at=?2 WHERE user_id=?3 AND balance>=?1 AND NOT EXISTS(SELECT 1 FROM credit_transactions WHERE reference=?4)",
    ).bind(credits, now, userId, safeReference),
    e.DB.prepare(
      "INSERT INTO credit_transactions(id,user_id,amount,type,description,reference,payment_id,tool_id,created_at) SELECT ?1,?2,?3,'usage',?4,?5,NULL,?6,?7 WHERE EXISTS(SELECT 1 FROM credit_balances WHERE user_id=?2) AND NOT EXISTS(SELECT 1 FROM credit_transactions WHERE reference=?5)",
    ).bind(uuid(), userId, -credits, `Experience usage: ${safeToolId}`.slice(0, 240), safeReference, safeToolId, now),
    e.DB.prepare(
      "INSERT INTO tool_usage(id,user_id,tool_id,credits,status,reference,created_at) SELECT ?1,?2,?3,?4,'consumed',?5,?6 WHERE EXISTS(SELECT 1 FROM credit_transactions WHERE user_id=?2 AND reference=?5 AND type='usage') AND NOT EXISTS(SELECT 1 FROM tool_usage WHERE reference=?5)",
    ).bind(uuid(), userId, safeToolId, credits, safeReference, now),
  ]);

  const debited = Number(results?.[0]?.meta?.changes || 0) > 0;
  if (debited) return { applied: true, idempotent: false };

  const existing = await e.DB.prepare(
    'SELECT id,amount,tool_id,created_at FROM credit_transactions WHERE user_id=?1 AND reference=?2 LIMIT 1',
  ).bind(userId, safeReference).first();

  if (existing) return { applied: false, idempotent: true, transaction: existing };
  return { applied: false, idempotent: false, insufficient: true };
}

async function billingUsageSafe(r, e) {
  const u = await currentUser(r, e);
  if (!u) {
    return json({ error: 'Authentication required.' }, 401, cors(r));
  }

  const d = await body(r);
  const toolId = clean(d?.tool_id).slice(0, 120);
  const reference = clean(d?.reference).slice(0, 160) || `usage:${uuid()}`;

  if (!toolId || !/^[A-Za-z0-9._-]{2,120}$/.test(toolId)) {
    return json({ error: 'Invalid experience id.' }, 400, cors(r));
  }

  const tool = await e.DB.prepare(
    'SELECT tool_id,credit_cost,enabled FROM tool_billing WHERE tool_id=?1 LIMIT 1',
  ).bind(toolId).first();

  // Never invent a price for an experience. The authoritative credit cost
  // must exist in D1; an unknown experience is rejected.
  if (!tool) {
    return json({ error: 'This experience is not configured for billing.', code: 'experience_not_configured' }, 409, cors(r));
  }
  if (Number(tool.enabled) !== 1) {
    return json({ error: 'This experience is currently unavailable.', code: 'experience_disabled' }, 409, cors(r));
  }

  const cost = Math.floor(Number(tool.credit_cost));
  if (!Number.isSafeInteger(cost) || cost < 0) {
    return json({ error: 'Invalid experience credit cost.' }, 500, cors(r));
  }

  // Ensure the account and one-time free-plan grant exist before checking
  // balance, but only after the experience itself has been validated.
  const account = await billingEnsureAccount(e, u.id);

  if (cost === 0) {
    return json({ success: true, charged: 0, idempotent: false, reference, balance: Number(account?.balance || 0) }, 200, cors(r));
  }

  const result = await billingDebitCreditsSafe(e, {
    userId: u.id,
    amount: cost,
    toolId,
    reference,
  });

  const updatedAccount = await billingEnsureAccount(e, u.id);

  if (result.insufficient) {
    return json(
      {
        error: 'Insufficient credits.',
        code: 'insufficient_credits',
        balance: Number(updatedAccount?.balance || 0),
        required: cost,
      },
      402,
      cors(r),
    );
  }

  return json(
    {
      success: true,
      charged: result.idempotent ? 0 : cost,
      idempotent: !!result.idempotent,
      reference,
      balance: Number(updatedAccount?.balance || 0),
    },
    200,
    cors(r),
  );
}

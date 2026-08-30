/* NEXAUREN BILLING SAFETY PATCH v1 */

async function billingUsageSafe(r, e) {
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

  // Ensure the account and one-time free-plan grant exist before checking balance.
  await billingEnsureAccount(e, u.id);

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

  const account = await billingEnsureAccount(e, u.id);

  if (result.insufficient) {
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

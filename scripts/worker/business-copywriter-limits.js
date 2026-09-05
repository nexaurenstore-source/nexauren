const NEXAUREN_BUSINESS_COPYWRITER_FREE_DAILY = 5;
const NEXAUREN_BUSINESS_COPYWRITER_TOOL = 'business-copywriter';

function businessCopywriterJson(data, status, request) {
  return json(data, status, cors(request));
}

async function businessCopywriterUsage(r, e) {
  const user = await currentUser(r, e);
  if (!user) return businessCopywriterJson({ error: 'Authentication required' }, 401, r);

  const usageDate = new Date().toISOString().slice(0, 10);
  const row = await e.DB.prepare(
    'SELECT free_generations FROM business_copywriter_daily_usage WHERE user_id=? AND usage_date=? LIMIT 1'
  ).bind(user.id, usageDate).first();
  const used = Number(row?.free_generations || 0);
  const balance = await e.DB.prepare(
    'SELECT balance FROM credit_balances WHERE user_id=? LIMIT 1'
  ).bind(user.id).first();

  return businessCopywriterJson({
    success: true,
    free_generations_used: used,
    free_generations_limit: NEXAUREN_BUSINESS_COPYWRITER_FREE_DAILY,
    free_generations_remaining: Math.max(0, NEXAUREN_BUSINESS_COPYWRITER_FREE_DAILY - used),
    credit_cost: 5,
    balance: Number(balance?.balance || 0),
  }, 200, r);
}

async function businessCopywriterConsume(r, e) {
  const user = await currentUser(r, e);
  if (!user) return businessCopywriterJson({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, 401, r);

  let payload;
  try { payload = await r.json(); } catch { payload = {}; }
  const reference = String(payload?.reference || '').trim();
  if (!reference || reference.length > 160) {
    return businessCopywriterJson({ error: 'A valid generation reference is required.', code: 'INVALID_REFERENCE' }, 400, r);
  }

  const existing = await e.DB.prepare(
    'SELECT id,credits,status FROM business_copywriter_generations WHERE user_id=? AND reference=? LIMIT 1'
  ).bind(user.id, reference).first();
  if (existing) {
    if (String(existing.status) === 'pending') {
      return businessCopywriterJson({ error: 'This generation is already being processed.', code: 'GENERATION_IN_PROGRESS' }, 409, r);
    }
    const usageDate = new Date().toISOString().slice(0, 10);
    const row = await e.DB.prepare(
      'SELECT free_generations FROM business_copywriter_daily_usage WHERE user_id=? AND usage_date=? LIMIT 1'
    ).bind(user.id, usageDate).first();
    const balance = await e.DB.prepare('SELECT balance FROM credit_balances WHERE user_id=? LIMIT 1').bind(user.id).first();
    const used = Number(row?.free_generations || 0);
    return businessCopywriterJson({
      success: true,
      idempotent: true,
      charged: Number(existing.credits || 0) > 0,
      credits_used: Number(existing.credits || 0),
      free_generations_used: used,
      free_generations_remaining: Math.max(0, NEXAUREN_BUSINESS_COPYWRITER_FREE_DAILY - used),
      balance: Number(balance?.balance || 0),
    }, 200, r);
  }

  const now = Math.floor(Date.now() / 1000);
  const usageDate = new Date().toISOString().slice(0, 10);
  const costRow = await e.DB.prepare(
    'SELECT credit_cost,enabled FROM tool_billing WHERE tool_id=? LIMIT 1'
  ).bind(NEXAUREN_BUSINESS_COPYWRITER_TOOL).first();
  const creditCost = Math.max(0, Number(costRow?.credit_cost ?? 5));
  if (Number(costRow?.enabled ?? 1) !== 1) {
    return businessCopywriterJson({ error: 'This tool is temporarily unavailable.', code: 'TOOL_DISABLED' }, 503, r);
  }

  try {
    const reservation = await e.DB.prepare(
      'INSERT OR IGNORE INTO business_copywriter_generations (id,user_id,reference,credits,status,created_at) VALUES (?,?,?,?,?,?)'
    ).bind(uuid(), user.id, reference, 0, 'pending', now).run();
    if (Number(reservation?.meta?.changes || 0) === 0) {
      return businessCopywriterJson({ error: 'This generation is already being processed.', code: 'GENERATION_IN_PROGRESS' }, 409, r);
    }

    await e.DB.prepare(
      'INSERT OR IGNORE INTO business_copywriter_daily_usage (user_id,usage_date,free_generations,updated_at) VALUES (?,?,0,?)'
    ).bind(user.id, usageDate, now).run();

    const freeUpdate = await e.DB.prepare(
      'UPDATE business_copywriter_daily_usage SET free_generations=free_generations+1,updated_at=? WHERE user_id=? AND usage_date=? AND free_generations<?'
    ).bind(now, user.id, usageDate, NEXAUREN_BUSINESS_COPYWRITER_FREE_DAILY).run();

    if (Number(freeUpdate?.meta?.changes || 0) > 0) {
      await e.DB.prepare(
        'UPDATE business_copywriter_generations SET status=?,credits=? WHERE user_id=? AND reference=?'
      ).bind('completed', 0, user.id, reference).run();
      const row = await e.DB.prepare(
        'SELECT free_generations FROM business_copywriter_daily_usage WHERE user_id=? AND usage_date=? LIMIT 1'
      ).bind(user.id, usageDate).first();
      const balance = await e.DB.prepare('SELECT balance FROM credit_balances WHERE user_id=? LIMIT 1').bind(user.id).first();
      const used = Number(row?.free_generations || 0);
      return businessCopywriterJson({
        success: true,
        charged: false,
        credits_used: 0,
        free_generations_used: used,
        free_generations_remaining: Math.max(0, NEXAUREN_BUSINESS_COPYWRITER_FREE_DAILY - used),
        balance: Number(balance?.balance || 0),
      }, 200, r);
    }

    const paidReference = `business-copywriter:${user.id}:${reference}`;
    const paidUpdate = await e.DB.prepare(
      'UPDATE credit_balances SET balance=balance-?,updated_at=? WHERE user_id=? AND balance>=?'
    ).bind(creditCost, now, user.id, creditCost).run();

    if (Number(paidUpdate?.meta?.changes || 0) === 0) {
      await e.DB.prepare('DELETE FROM business_copywriter_generations WHERE user_id=? AND reference=?').bind(user.id, reference).run();
      const balance = await e.DB.prepare('SELECT balance FROM credit_balances WHERE user_id=? LIMIT 1').bind(user.id).first();
      return businessCopywriterJson({
        error: 'Insufficient credits. Buy credits to continue.',
        code: 'INSUFFICIENT_CREDITS',
        required_credits: creditCost,
        balance: Number(balance?.balance || 0),
      }, 402, r);
    }

    await e.DB.batch([
      e.DB.prepare(
        'INSERT INTO credit_transactions (id,user_id,amount,type,description,reference,payment_id,tool_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)'
      ).bind(uuid(), user.id, -creditCost, 'tool', 'Business Copywriter generation', paidReference, null, NEXAUREN_BUSINESS_COPYWRITER_TOOL, now),
      e.DB.prepare(
        'INSERT INTO tool_usage (id,user_id,tool_id,credits,status,reference,created_at) VALUES (?,?,?,?,?,?,?)'
      ).bind(uuid(), user.id, NEXAUREN_BUSINESS_COPYWRITER_TOOL, creditCost, 'completed', reference, now),
      e.DB.prepare(
        'UPDATE business_copywriter_generations SET status=?,credits=? WHERE user_id=? AND reference=?'
      ).bind('completed', creditCost, user.id, reference),
    ]);

    const balance = await e.DB.prepare('SELECT balance FROM credit_balances WHERE user_id=? LIMIT 1').bind(user.id).first();
    return businessCopywriterJson({
      success: true,
      charged: true,
      credits_used: creditCost,
      free_generations_used: NEXAUREN_BUSINESS_COPYWRITER_FREE_DAILY,
      free_generations_remaining: 0,
      balance: Number(balance?.balance || 0),
    }, 200, r);
  } catch (error) {
    console.error('Business Copywriter consumption failed:', error);
    await e.DB.prepare('DELETE FROM business_copywriter_generations WHERE user_id=? AND reference=? AND status=?').bind(user.id, reference, 'pending').run().catch(() => {});
    return businessCopywriterJson({ error: 'Unable to authorize this generation.', code: 'CONSUMPTION_FAILED' }, 500, r);
  }
}

/* NEXAUREN TOOL CREDIT ADMIN ROUTES v8 */
// Centralized Admin control for per-tool credit consumption.
// IMPORTANT: this module only manages tool_billing. Payment, PayPal, plans,
// subscriptions and purchase credits are intentionally outside this module.

const __toolCreditStaticRegistry = [];

const toolBillingError = (message, code, error, request) => {
  console.error(`[tool-credit-admin:${code}] ${message}`, String(error || '').slice(0, 500));
  return json({ error: message, code }, 500, cors(request));
};

async function ensureToolBillingSchema(e) {
  if (!e?.DB) throw new Error('D1 binding is unavailable.');
  await e.DB.prepare(`CREATE TABLE IF NOT EXISTS tool_billing (
    tool_id TEXT PRIMARY KEY,
    credit_cost INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  )`).run();
}

async function loadToolBillingRegistry(r, e) {
  // The build embeds the active tools registry into the Worker. This is the
  // primary source so Admin does not depend on ASSETS routing at runtime.
  if (Array.isArray(__toolCreditStaticRegistry) && __toolCreditStaticRegistry.length) {
    return __toolCreditStaticRegistry;
  }

  // Keep ASSETS as a secondary source for local/development builds.
  try {
    if (e?.ASSETS?.fetch) {
      const response = await e.ASSETS.fetch(
        new Request(new URL('/data/tools.json', r.url)),
      );
      if (response.ok) {
        const data = await response.json();
        const tools = Array.isArray(data?.tools) ? data.tools : [];
        const active = tools.filter(
          (tool) => tool?.id && String(tool.status || 'active') === 'active',
        );
        if (active.length) return active;
      }
    }
  } catch (error) {
    console.warn('Tool registry asset lookup failed; using billing registry fallback.', String(error).slice(0, 300));
  }

  await ensureToolBillingSchema(e);
  const rows = await e.DB.prepare(
    'SELECT tool_id,credit_cost,enabled,updated_at FROM tool_billing ORDER BY tool_id',
  ).all();
  return (rows?.results || []).map((row) => ({
    id: String(row.tool_id), name: String(row.tool_id), studioName: '', url: '', status: 'active',
  }));
}

async function adminToolBilling(r, e) {
  const admin = await isAdmin(r, e);
  if (!admin) return json({ error: 'Admin access required.' }, 403, cors(r));

  try { await ensureToolBillingSchema(e); }
  catch (error) { return toolBillingError('Unable to initialize tool credit settings.', 'tool_billing_schema', error, r); }

  if (r.method === 'GET') {
    let tools;
    try { tools = await loadToolBillingRegistry(r, e); }
    catch (error) { return toolBillingError('Unable to load tool registry.', 'tool_billing_registry', error, r); }

    try {
      const now = Math.floor(Date.now() / 1000);
      const statements = tools.map((tool) => e.DB.prepare(
        'INSERT INTO tool_billing(tool_id,credit_cost,enabled,updated_at) VALUES(?1,0,1,?2) ON CONFLICT(tool_id) DO NOTHING',
      ).bind(String(tool.id), now));
      if (statements.length) await e.DB.batch(statements);
    } catch (error) { return toolBillingError('Unable to initialize tool credit costs.', 'tool_billing_seed', error, r); }

    let rows;
    try { rows = await e.DB.prepare('SELECT tool_id,credit_cost,enabled,updated_at FROM tool_billing').all(); }
    catch (error) { return toolBillingError('Unable to read tool credit settings.', 'tool_billing_query', error, r); }

    const configured = new Map((rows?.results || []).map((row) => [String(row.tool_id), row]));
    const result = tools.map((tool) => {
      const row = configured.get(String(tool.id));
      const rawCost = Number(row?.credit_cost ?? 0);
      const cost = Number.isSafeInteger(rawCost) && rawCost >= 0 ? rawCost : 0;
      return {
        tool_id: String(tool.id), name: String(tool.name || tool.id),
        studio: String(tool.studioName || tool.studio || ''), url: String(tool.url || ''),
        credit_cost: cost, enabled: row ? Number(row.enabled) === 1 : true,
        configured: !!row, updated_at: row?.updated_at || null,
      };
    });
    return json({ tools: result }, 200, cors(r));
  }

  if (r.method === 'PUT' || r.method === 'POST') {
    const d = await body(r);
    const toolId = clean(d?.tool_id).slice(0, 120);
    const cost = Number(d?.credit_cost);
    const enabled = d?.enabled === false ? 0 : 1;
    if (!toolId) return json({ error: 'tool_id is required.' }, 400, cors(r));
    if (!Number.isSafeInteger(cost) || cost < 0 || cost > 1000000000) {
      return json({ error: 'credit_cost must be an integer from 0 to 1000000000.' }, 400, cors(r));
    }

    let tools;
    try { tools = await loadToolBillingRegistry(r, e); }
    catch (error) { return toolBillingError('Unable to validate tool.', 'tool_billing_registry', error, r); }
    if (!tools.some((tool) => String(tool.id) === toolId)) {
      return json({ error: 'Tool not found in the active Nexauren registry.' }, 404, cors(r));
    }

    const now = Math.floor(Date.now() / 1000);
    try {
      await e.DB.prepare(
        'INSERT INTO tool_billing(tool_id,credit_cost,enabled,updated_at) VALUES(?1,?2,?3,?4) ON CONFLICT(tool_id) DO UPDATE SET credit_cost=excluded.credit_cost,enabled=excluded.enabled,updated_at=excluded.updated_at',
      ).bind(toolId, cost, enabled, now).run();
    } catch (error) { return toolBillingError('Unable to save tool credit cost.', 'tool_billing_write', error, r); }

    return json({ success: true, tool_id: toolId, credit_cost: cost, enabled: enabled === 1, updated_at: now }, 200, cors(r));
  }
  return json({ error: 'Method not allowed.' }, 405, cors(r));
}

const __toolBillingUrl = new URL(r.url);
if (__toolBillingUrl.pathname === '/api/admin/tool-billing' && ['GET', 'POST', 'PUT'].includes(r.method)) {
  return adminToolBilling(r, e);
}

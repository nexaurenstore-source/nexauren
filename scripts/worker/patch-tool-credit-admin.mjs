import { readFile, writeFile } from 'node:fs/promises';

const sourceUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let generated = await readFile(sourceUrl, 'utf8');

const usageMarker = "  const tool = await e.DB.prepare('SELECT tool_id,credit_cost,enabled FROM tool_billing WHERE tool_id=?1 LIMIT 1').bind(toolId).first();\n  if (!tool || Number(tool.enabled) !== 1) return json({ error: 'Tool billing is not configured.', code: 'tool_not_configured' }, 409, cors(r));\n  const cost = Math.floor(Number(tool.credit_cost));";
const usageReplacement = "  const tool = await e.DB.prepare('SELECT tool_id,credit_cost,enabled FROM tool_billing WHERE tool_id=?1 LIMIT 1').bind(toolId).first();\n  // Missing configuration intentionally defaults to FREE. Admin can set a positive cost at any time.\n  if (tool && Number(tool.enabled) !== 1) return json({ error: 'This tool is currently disabled.', code: 'tool_disabled' }, 403, cors(r));\n  const cost = Math.floor(Number(tool?.credit_cost || 0));";
if (!generated.includes(usageMarker)) throw new Error('[tool-credit-admin] billingUsage marker not found.');
generated = generated.replace(usageMarker, usageReplacement);

const adminMarker = 'async function adminDashboard(r, e) {';
if (!generated.includes(adminMarker)) throw new Error('[tool-credit-admin] adminDashboard marker not found.');
const adminFunctions = String.raw`async function loadToolBillingRegistry(r, e) {
  const response = await e.ASSETS.fetch(new Request(new URL('/data/tools.json', r.url)));
  if (!response.ok) throw new Error('Unable to load Nexauren tool registry.');
  const data = await response.json();
  const tools = Array.isArray(data?.tools) ? data.tools : [];
  return tools.filter((tool) => tool?.id && String(tool.status || 'active') === 'active');
}

async function adminToolBilling(r, e) {
  const admin = await isAdmin(r, e);
  if (!admin) return json({ error: 'Admin access required.' }, 403, cors(r));

  if (r.method === 'GET') {
    try {
      const tools = await loadToolBillingRegistry(r, e);
      const rows = await e.DB.prepare('SELECT tool_id,credit_cost,enabled,updated_at FROM tool_billing').all();
      const configured = new Map((rows?.results || []).map((row) => [String(row.tool_id), row]));
      const result = tools.map((tool) => {
        const row = configured.get(String(tool.id));
        return {
          tool_id: String(tool.id),
          name: String(tool.name || tool.id),
          studio: String(tool.studioName || tool.studio || ''),
          url: String(tool.url || ''),
          credit_cost: Math.max(0, Math.floor(Number(row?.credit_cost || 0))),
          enabled: row ? Number(row.enabled) === 1 : true,
          configured: !!row,
          updated_at: row?.updated_at || null,
        };
      });
      return json({ tools: result }, 200, cors(r));
    } catch (error) {
      console.error('Admin tool billing load failed', String(error).slice(0, 500));
      return json({ error: 'Unable to load tool credit settings.' }, 500, cors(r));
    }
  }

  if (r.method === 'PUT' || r.method === 'POST') {
    const d = await body(r);
    const toolId = clean(d?.tool_id).slice(0, 120);
    const cost = Number(d?.credit_cost);
    const enabled = d?.enabled === false ? 0 : 1;
    if (!toolId) return json({ error: 'tool_id is required.' }, 400, cors(r));
    if (!Number.isSafeInteger(cost) || cost < 0 || cost > 1000000000) return json({ error: 'credit_cost must be an integer from 0 to 1000000000.' }, 400, cors(r));
    let tools;
    try { tools = await loadToolBillingRegistry(r, e); } catch { return json({ error: 'Unable to validate tool.' }, 500, cors(r)); }
    if (!tools.some((tool) => String(tool.id) === toolId)) return json({ error: 'Tool not found in the active Nexauren registry.' }, 404, cors(r));
    const now = Math.floor(Date.now() / 1000);
    await e.DB.prepare('INSERT INTO tool_billing(tool_id,credit_cost,enabled,updated_at) VALUES(?1,?2,?3,?4) ON CONFLICT(tool_id) DO UPDATE SET credit_cost=excluded.credit_cost,enabled=excluded.enabled,updated_at=excluded.updated_at').bind(toolId, cost, enabled, now).run();
    return json({ success: true, tool_id: toolId, credit_cost: cost, enabled: enabled === 1, updated_at: now }, 200, cors(r));
  }

  return json({ error: 'Method not allowed.' }, 405, cors(r));
}

`;
generated = generated.replace(adminMarker, adminFunctions + adminMarker);

const routeMarker = "if (__billingUrl.pathname === '/api/admin/paypal/products' && r.method === 'POST') {";
if (!generated.includes(routeMarker)) throw new Error('[tool-credit-admin] billing route marker not found.');
const route = "if (__billingUrl.pathname === '/api/admin/tool-billing' && (r.method === 'GET' || r.method === 'POST' || r.method === 'PUT')) return adminToolBilling(r, e);\n\n";
generated = generated.replace(routeMarker, route + routeMarker);

await writeFile(sourceUrl, generated, 'utf8');

if (!generated.includes("'/api/admin/tool-billing'")) throw new Error('[tool-credit-admin] Admin tool billing route missing after patch.');
if (!generated.includes('async function adminToolBilling(')) throw new Error('[tool-credit-admin] Admin tool billing function missing after patch.');
if (!generated.includes('Missing configuration intentionally defaults to FREE.')) throw new Error('[tool-credit-admin] Free-by-default usage policy missing after patch.');

console.log('[tool-credit-admin] Automatic tool credit engine enabled.');
console.log('[tool-credit-admin] Missing tool cost defaults to 0 credits (free).');
console.log('[tool-credit-admin] Admin tool credit settings API added.');
console.log('[tool-credit-admin] Tool registry validation enabled.');
console.log('[tool-credit-admin] Generated Worker updated.');

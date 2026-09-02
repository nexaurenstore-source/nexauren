import { readFile, writeFile } from 'node:fs/promises';

const sourceUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let generated = await readFile(sourceUrl, 'utf8');

const usageMarker = "  const tool = await e.DB.prepare('SELECT tool_id,credit_cost,enabled FROM tool_billing WHERE tool_id=?1 LIMIT 1').bind(toolId).first();\n  if (!tool || Number(tool.enabled) !== 1) return json({ error: 'Tool billing is not configured.', code: 'tool_not_configured' }, 409, cors(r));\n  const cost = Math.floor(Number(tool.credit_cost));";
const usageReplacement = "  const tool = await e.DB.prepare('SELECT tool_id,credit_cost,enabled FROM tool_billing WHERE tool_id=?1 LIMIT 1').bind(toolId).first();\n  // Missing configuration intentionally defaults to FREE. Admin can set a positive cost at any time.\n  if (tool && Number(tool.enabled) !== 1) return json({ error: 'This tool is currently disabled.', code: 'tool_disabled' }, 403, cors(r));\n  const cost = Math.floor(Number(tool?.credit_cost || 0));";
if (!generated.includes(usageMarker)) throw new Error('[tool-credit-admin] billingUsage marker not found.');
generated = generated.replace(usageMarker, usageReplacement);

// The admin route is now part of the normal Worker build via tool-credit-admin.js.
// Keep this script only for the compatibility/free-by-default usage policy patch.
if (!generated.includes("'/api/admin/tool-billing'")) throw new Error('[tool-credit-admin] Admin tool billing route missing from generated Worker.');
if (!generated.includes('async function adminToolBilling(')) throw new Error('[tool-credit-admin] Admin tool billing handler missing from generated Worker.');

await writeFile(sourceUrl, generated, 'utf8');

console.log('[tool-credit-admin] Automatic tool credit engine enabled.');
console.log('[tool-credit-admin] Missing tool cost defaults to 0 credits (free).');
console.log('[tool-credit-admin] Admin tool credit settings API supplied by the permanent Worker build module.');
console.log('[tool-credit-admin] Tool registry validation enabled.');
console.log('[tool-credit-admin] Generated Worker updated.');

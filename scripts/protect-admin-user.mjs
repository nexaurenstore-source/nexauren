import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const output = new URL('../.worker-build/worker.js', import.meta.url);
let source = await readFile(output, 'utf8');

const marker = "if (!id) return json({ error: 'User id required.' }, 400, cors(r));";
const replacement = marker + "\n  if (String(admin.id) === String(id)) return json({ error: 'Your administrator account is protected and cannot be edited.' }, 400, cors(r));";

if (!source.includes("Your administrator account is protected and cannot be edited.")) {
  const editStart = source.indexOf('async function adminUserEdit(');
  const editEnd = source.indexOf('\n}\n\nasync function adminUserBlock(', editStart);
  if (editStart < 0 || editEnd < 0) throw new Error('[worker-check] adminUserEdit function marker missing.');
  const edit = source.slice(editStart, editEnd);
  if (!edit.includes(marker)) throw new Error('[worker-check] adminUserEdit id marker missing.');
  source = source.slice(0, editStart) + edit.replace(marker, replacement) + source.slice(editEnd);
}

const routeMarker = "if (__adminUsersUrl.pathname.endsWith('/delete') && r.method === 'DELETE') return adminUserDelete(r, e);";
const protectedRoutes = routeMarker + "\n          if ((__adminUsersUrl.pathname.endsWith('/revoke-sessions') || __adminUsersUrl.pathname.endsWith('/reset-password')) && r.method === 'POST') {\n            const __selfAdmin = await isAdmin(r, e);\n            const __targetId = clean(__adminUsersUrl.pathname.split('/').slice(-2, -1)[0]);\n            if (__selfAdmin && String(__selfAdmin.id) === String(__targetId)) return json({ error: 'Your administrator account is protected from administrative actions.' }, 400, cors(r));\n          }";
if (!source.includes("protected from administrative actions.")) {
  if (!source.includes(routeMarker)) throw new Error('[worker-check] Admin delete route marker missing.');
  source = source.replace(routeMarker, protectedRoutes, 1);
}

const toolGuard = `

function toolIdFromRequestPath(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  if (parts.length === 1 && parts[0] === 'forms') return 'form-builder';
  if (parts.length === 3 && parts[0] === 'tools') return decodeURIComponent(parts[2]);
  return null;
}

async function enforceToolAvailability(r, e) {
  const url = new URL(r.url);
  if (r.method !== 'GET' && r.method !== 'HEAD') return null;
  const toolId = toolIdFromRequestPath(url.pathname);
  if (!toolId) return null;

  try {
    await ensureAdminSettingsSchema(e);
    const row = await e.DB.prepare('SELECT tool_id,ranking_score,status,available_at,restore_at FROM tool_settings WHERE tool_id=?1').bind(toolId).first();
    if (!row) return null;

    const now = Math.floor(Date.now() / 1000);
    let status = String(row.status || 'available');
    const availableAt = Number(row.available_at || 0);
    const restoreAt = Number(row.restore_at || 0);

    if (status === 'scheduled' && availableAt && now >= availableAt) status = 'available';
    if (status === 'maintenance' && restoreAt && now >= restoreAt) status = 'available';
    if (status === 'available') return null;

    const target = status === 'scheduled' ? availableAt : restoreAt;
    const remaining = target > now ? target - now : 0;
    const title = status === 'blocked' ? '🔒 Ferramenta bloqueada' : status === 'maintenance' ? '🛠️ Ferramenta em manutenção' : '⏳ Ferramenta ainda não disponível';
    const message = status === 'blocked'
      ? 'Esta ferramenta está temporariamente bloqueada.'
      : status === 'maintenance'
        ? 'A ferramenta está em manutenção e será restaurada no horário programado.'
        : 'Esta ferramenta foi programada para ser disponibilizada em um horário específico.';
    const seconds = Math.max(0, remaining);
    const safeTitle = title.replace(/[&<>\"]/g, '');
    const safeMessage = message.replace(/[&<>\"]/g, '');
    const initial = seconds ? String(seconds) : (status === 'blocked' ? 'Bloqueada' : 'Indisponível');
    const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + safeTitle + ' — NEXAUREN</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f14;color:#fff;font-family:system-ui,-apple-system,sans-serif}.card{width:min(560px,calc(100% - 40px));box-sizing:border-box;padding:32px;border:1px solid #29313d;border-radius:18px;background:#121821;text-align:center;box-shadow:0 20px 60px #0008}h1{margin:0 0 12px;font-size:28px}p{color:#b8c1cc;line-height:1.6}.count{font-size:30px;font-weight:800;margin:22px 0;color:#fff}.back{display:inline-block;margin-top:8px;padding:10px 16px;border-radius:10px;background:#fff;color:#111;text-decoration:none;font-weight:700}</style></head><body><main class="card"><h1>' + safeTitle + '</h1><p>' + safeMessage + '</p><div id="count" class="count">' + initial + '</div><a class="back" href="/tools/">← Voltar para ferramentas</a></main><script>let n=' + String(seconds) + ';const el=document.getElementById("count");function tick(){if(!n){el.textContent=' + JSON.stringify(status === 'blocked' ? 'Bloqueada' : 'Disponível agora') + ';return}const d=Math.floor(n/86400),h=Math.floor(n%86400/3600),m=Math.floor(n%3600/60),s=n%60;el.textContent=(d?d+"d ":"")+String(h).padStart(2,"0")+"h "+String(m).padStart(2,"0")+"m "+String(s).padStart(2,"0")+"s";n--;setTimeout(tick,1000)}tick();</script></body></html>';
    return new Response(html, { status: status === 'blocked' ? 403 : 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  } catch (err) {
    console.error('[tool-guard] availability check failed', err);
    return null;
  }
}
`;

if (!source.includes('async function enforceToolAvailability(')) {
  const fetchStart = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{/;
  if (!fetchStart.test(source)) throw new Error('[worker-check] fetch(r, e) marker missing for tool availability guard.');

  // The Worker fetch method is normally inside `export default { ... }`.
  // Insert declarations before the object literal, not before the method,
  // otherwise the generated module becomes invalid JavaScript.
  const exportMarker = 'export default {';
  const exportIndex = source.indexOf(exportMarker);
  if (exportIndex < 0) throw new Error('[worker-check] export default marker missing for tool availability guard.');
  source = source.slice(0, exportIndex) + toolGuard + '\n' + source.slice(exportIndex);

  source = source.replace(fetchStart, '$&\n      const __toolAvailabilityResponse = await enforceToolAvailability(r, e);\n      if (__toolAvailabilityResponse) return __toolAvailabilityResponse;\n', 1);
}

await writeFile(output, source, 'utf8');
execFileSync(process.execPath, ['--check', output.pathname], { stdio: 'inherit' });
console.log('[worker-check] Administrator self-edit/delete/block protection applied.');
console.log('[worker-check] Administrator revoke/reset protection applied.');
console.log('[worker-check] Per-tool maintenance, scheduled and blocked access enforced server-side.');

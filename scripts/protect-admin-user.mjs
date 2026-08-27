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

await writeFile(output, source, 'utf8');
execFileSync(process.execPath, ['--check', output.pathname], { stdio: 'inherit' });
console.log('[worker-check] Administrator self-edit/delete/block protection applied.');
console.log('[worker-check] Administrator revoke/reset protection applied.');

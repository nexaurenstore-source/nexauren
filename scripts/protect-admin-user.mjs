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

await writeFile(output, source, 'utf8');
execFileSync(process.execPath, ['--check', output.pathname], { stdio: 'inherit' });
console.log('[worker-check] Administrator self-edit protection applied.');

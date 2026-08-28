import { readFile, writeFile } from 'node:fs/promises';

const output = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(output, 'utf8');

if (!source.includes('__nexaurenAdminApiGuard')) {
  const fetchStart = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{/;
  if (!fetchStart.test(source)) throw new Error('[admin-guard] fetch(r, e) marker missing. Build stopped.');
  const guard = `\n      const __nexaurenAdminApiGuard = new URL(r.url);\n      if (__nexaurenAdminApiGuard.pathname.startsWith('/api/admin/') && r.method !== 'OPTIONS') {\n        const __nexaurenAdmin = await isAdmin(r, e);\n        if (!__nexaurenAdmin) return json({ error: 'Forbidden' }, 403, cors(r));\n      }\n`;
  source = source.replace(fetchStart, '$&' + guard, 1);
}

await writeFile(output, source, 'utf8');
console.log('[admin-guard] All /api/admin/* endpoints require an authenticated administrator at the Worker perimeter.');

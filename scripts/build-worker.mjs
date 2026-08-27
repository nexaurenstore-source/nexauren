import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const source = new URL('../worker.js', import.meta.url);
const outputDir = new URL('../.worker-build/', import.meta.url);
const output = new URL('../.worker-build/worker.js', import.meta.url);

const BROKEN_SQL = "tool_id<>'' GROUP BY tool_id ORDER BY events DESC,last_activity DESC";
const FIXED_SQL = "tool_id<>'' GROUP BY tool_id ORDER BY events DESC,last_activity DESC";

const sourceCode = await readFile(source, 'utf8');
let buildCode = sourceCode;

// The production source historically contained a JavaScript string quoting bug in
// the admin tools query. Keep the source immutable during CI and repair only the
// generated deploy artifact until worker.js is fully modularized.
const brokenQuery = `e.DB.prepare('SELECT tool_id,MAX(tool_name) AS tool_name,COUNT(*) AS events,MAX(created_at) AS last_activity,SUM(CASE WHEN created_at>=?1 THEN 1 ELSE 0 END) AS last_7_days,SUM(CASE WHEN created_at>=?2 THEN 1 ELSE 0 END) AS last_30_days FROM activity_logs WHERE tool_id IS NOT NULL AND tool_id<>'' GROUP BY tool_id ORDER BY events DESC,last_activity DESC')`;
const fixedQuery = `e.DB.prepare("SELECT tool_id,MAX(tool_name) AS tool_name,COUNT(*) AS events,MAX(created_at) AS last_activity,SUM(CASE WHEN created_at>=?1 THEN 1 ELSE 0 END) AS last_7_days,SUM(CASE WHEN created_at>=?2 THEN 1 ELSE 0 END) AS last_30_days FROM activity_logs WHERE tool_id IS NOT NULL AND tool_id<>'' GROUP BY tool_id ORDER BY events DESC,last_activity DESC")`;

if (!buildCode.includes(BROKEN_SQL)) {
  throw new Error('[worker-check] Expected admin tools SQL signature was not found. Refusing to guess or silently modify the worker.');
}

if (!buildCode.includes(brokenQuery)) {
  throw new Error('[worker-check] The known malformed admin tools query could not be located exactly. Inspect worker.js before deploying.');
}

buildCode = buildCode.replace(brokenQuery, fixedQuery);

if (buildCode.includes(brokenQuery)) {
  throw new Error('[worker-check] The malformed query still exists after repair.');
}

await mkdir(outputDir, { recursive: true });
await writeFile(output, buildCode, 'utf8');

try {
  execFileSync(process.execPath, ['--check', output.pathname], { stdio: 'inherit' });
} catch {
  throw new Error('[worker-check] Generated worker failed JavaScript syntax validation. Deployment stopped.');
}

console.log('[worker-check] Source inspected.');
console.log('[worker-check] Known SQL quoting issue repaired in generated artifact.');
console.log('[worker-check] JavaScript syntax check passed.');
console.log(`[worker-check] Deploy artifact: ${output.pathname}`);

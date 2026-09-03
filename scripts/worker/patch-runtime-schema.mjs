import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('.worker-build/worker.js');
if (!fs.existsSync(file)) {
  throw new Error('Worker build not found: .worker-build/worker.js');
}

let source = fs.readFileSync(file, 'utf8');
const before = source;

// D1 schemas are provisioned by migrations, never during user requests.
for (const name of ['Activity', 'Community', 'Notifications']) {
  source = source.replaceAll(`await ensure${name}Schema(e);`, `/* ${name} schema is managed by D1 migrations. */`);
}

if (source !== before) fs.writeFileSync(file, source);
console.log('Runtime schema guard: removed request-time DDL calls.');

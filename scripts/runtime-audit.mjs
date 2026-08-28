import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workerPath = path.join(root, '.worker-build', 'worker.js');
const statePath = path.join(root, 'frontend', 'js', 'experience-state.js');
const designPath = path.join(root, 'frontend', 'css', 'design-system.css');
const source = fs.existsSync(workerPath) ? fs.readFileSync(workerPath, 'utf8') : '';
const state = fs.existsSync(statePath) ? fs.readFileSync(statePath, 'utf8') : '';
const errors = [];

if (!source.includes('/js/experience-state.js')) errors.push('Worker does not inject the isolated Experience state runtime.');
if (!source.includes('/css/design-system.css')) errors.push('Worker does not inject the canonical Design System.');
for (const token of ['NexaurenExperience', 'localStorage', 'nexauren:experience:', 'reset', 'back']) {
  if (!state.includes(token)) errors.push(`Experience state runtime is missing required capability: ${token}`);
}
if (!fs.existsSync(designPath) || fs.statSync(designPath).size < 500) errors.push('Canonical Design System stylesheet is missing or unexpectedly small.');

if (errors.length) {
  console.error('NEXAUREN RUNTIME AUDIT: FAILED');
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log('NEXAUREN RUNTIME AUDIT: OK');
console.log('- isolated Experience state runtime present');
console.log('- canonical Design System present');
console.log('- Worker injects both shared runtime assets');

import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let worker = await readFile(workerUrl, 'utf8');

if (!worker.includes('async function loadCommunityRegistry(r, e) {')) {
  throw new Error('[community-schema] loadCommunityRegistry marker not found.');
}

if (!worker.includes('async function ensureCommunityDataSchema(e) {')) {
  const marker = 'async function loadCommunityRegistry(r, e) {';
  const schema = `let __communitySchemaPromise = null;\n\nasync function ensureCommunityDataSchema(e) {\n  if (!__communitySchemaPromise) {\n    __communitySchemaPromise = e.DB.batch([\n      e.DB.prepare(\n        \"CREATE TABLE IF NOT EXISTS ratings (id TEXT PRIMARY KEY,target_type TEXT NOT NULL CHECK (target_type IN ('studio','experience')),studio_id TEXT NOT NULL,experience_id TEXT,user_id TEXT NOT NULL,display_name TEXT NOT NULL,rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),review TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,CHECK ((target_type='studio' AND experience_id IS NULL) OR (target_type='experience' AND experience_id IS NOT NULL)),UNIQUE(target_type,studio_id,experience_id,user_id))\"\n      ),\n      e.DB.prepare(\n        \"CREATE INDEX IF NOT EXISTS idx_ratings_target ON ratings(target_type,studio_id,experience_id,created_at DESC)\"\n      ),\n      e.DB.prepare(\n        \"CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(user_id,created_at DESC)\"\n      ),\n      e.DB.prepare(\n        \"CREATE TABLE IF NOT EXISTS favorites (user_id TEXT NOT NULL,target_type TEXT NOT NULL CHECK (target_type IN ('studio','experience')),studio_id TEXT NOT NULL,experience_id TEXT,url TEXT NOT NULL,created_at INTEGER NOT NULL,CHECK ((target_type='studio' AND experience_id IS NULL) OR (target_type='experience' AND experience_id IS NOT NULL)),PRIMARY KEY(user_id,target_type,studio_id,experience_id))\"\n      ),\n      e.DB.prepare(\n        \"CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id,created_at DESC)\"\n      ),\n      e.DB.prepare(\n        \"CREATE INDEX IF NOT EXISTS idx_favorites_target ON favorites(target_type,studio_id,experience_id)\"\n      ),\n    ]).then(() => true);\n  }\n  await __communitySchemaPromise;\n}\n\n`;
  worker = worker.replace(marker, schema + marker);
}

worker = worker.replace(
  'async function loadCommunityRegistry(r, e) {',
  'async function loadCommunityRegistry(r, e) {\n  await ensureCommunityDataSchema(e);',
);

await writeFile(workerUrl, worker, 'utf8');
console.log('[community-schema] Ratings and favorites schema ensured before community API access.');

import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let worker = await readFile(workerUrl, 'utf8');

if (!worker.includes('async function postRating(r, e) {')) {
  throw new Error('[community-hardening] postRating marker not found.');
}

const deleteMarker = 'async function parseFavoriteTarget(r, e) {';
const deleteIndex = worker.indexOf(deleteMarker);

if (deleteIndex < 0) {
  throw new Error('[community-hardening] Favorite target marker not found.');
}

if (!worker.includes('async function deleteRating(r, e) {')) {
  const deleteRating = String.raw`async function deleteRating(r, e) {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));

  const target = await parseCommunityTarget(r, e);
  if (target.error) return target.error;

  await e.DB
    .prepare(
      'DELETE FROM ratings WHERE target_type=?1 AND studio_id=?2 AND ' +
        '(experience_id=?3 OR (?3 IS NULL AND experience_id IS NULL)) AND user_id=?4',
    )
    .bind(target.targetType, target.studioId, target.experienceId, u.id)
    .run();

  return json({ success: true }, 200, cors(r));
}

`;

  worker = worker.slice(0, deleteIndex) + deleteRating + worker.slice(deleteIndex);
}

const routeMarker = "      if (\n        u.pathname.startsWith('/api/favorites/') &&\n        r.method === 'GET'\n      )";
const routeIndex = worker.indexOf(routeMarker);

if (routeIndex < 0) {
  throw new Error('[community-hardening] Favorite route marker not found.');
}

if (!worker.includes("r.method === 'DELETE'\n      ) {\n        return deleteRating(r, e);")) {
  const deleteRoute = String.raw`      if (
        u.pathname.startsWith('/api/ratings/') &&
        r.method === 'DELETE'
      ) {
        return deleteRating(r, e);
      }

`;
  worker = worker.slice(0, routeIndex) + deleteRoute + worker.slice(routeIndex);
}

await writeFile(workerUrl, worker, 'utf8');

console.log('[community-hardening] Added authenticated DELETE for the caller-owned Studio/Experience rating only.');

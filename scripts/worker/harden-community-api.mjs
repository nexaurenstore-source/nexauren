import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let worker = await readFile(workerUrl, 'utf8');

if (!worker.includes('async function postRating(r, e) {')) {
  throw new Error('[community-hardening] postRating marker not found.');
}

const toolResolver = String.raw`async function resolveToolCommunityTarget(r, e, toolInput) {
  const registry = await loadCommunityRegistry(r, e);
  const toolKey = clean(toolInput);
  const tool = registry.experiences.find(
    (item) => String(item?.id || '') === toolKey || String(item?.slug || '') === toolKey,
  );

  if (!tool || !tool.id) {
    return { error: json({ error: 'Tool not found.' }, 404, cors(r)) };
  }

  const studio = registry.studiosByKey.get(clean(tool.studio));
  if (!studio || !studio.id) {
    return { error: json({ error: 'Tool Studio not found.' }, 404, cors(r)) };
  }

  return {
    registry,
    targetType: 'experience',
    studioId: String(studio.id),
    experienceId: String(tool.id),
    studio,
    experience: tool,
    tool,
  };
}

`;

const ratingStart = worker.indexOf('async function parseCommunityTarget(r, e) {');
const ratingEnd = worker.indexOf('async function getRatings(r, e) {', ratingStart);
if (ratingStart < 0 || ratingEnd < 0) {
  throw new Error('[community-hardening] Rating parser markers not found.');
}

const ratingParser = String.raw`async function parseCommunityTarget(r, e) {
  const parts = new URL(r.url).pathname.split('/').filter(Boolean);
  const index = parts.indexOf('ratings');

  if (index < 0) {
    return { error: json({ error: 'Invalid rating target.' }, 400, cors(r)) };
  }

  const targetType = clean(parts[index + 1]);
  const firstId = clean(parts[index + 2]);
  const secondId = clean(parts[index + 3]);

  if (targetType === 'tool' && firstId && !secondId) {
    return resolveToolCommunityTarget(r, e, firstId);
  }

  if (targetType === 'studio' && firstId && !secondId) {
    return resolveCommunityTarget(r, e, 'studio', firstId);
  }

  if (targetType === 'experience' && firstId && secondId) {
    return resolveCommunityTarget(r, e, 'experience', firstId, secondId);
  }

  return { error: json({ error: 'Invalid rating target.' }, 400, cors(r)) };
}

`;

worker = worker.slice(0, ratingStart) + toolResolver + ratingParser + worker.slice(ratingEnd);

const favoriteStart = worker.indexOf('async function parseFavoriteTarget(r, e) {');
const favoriteEnd = worker.indexOf('async function favoriteState(r, e) {', favoriteStart);
if (favoriteStart < 0 || favoriteEnd < 0) {
  throw new Error('[community-hardening] Favorite parser markers not found.');
}

const favoriteParser = String.raw`async function parseFavoriteTarget(r, e) {
  const parts = new URL(r.url).pathname.split('/').filter(Boolean);
  const index = parts.indexOf('favorites');

  if (index < 0) return { error: json({ error: 'Invalid favorite target.' }, 400, cors(r)) };

  const targetType = clean(parts[index + 1]);
  const firstId = clean(parts[index + 2]);
  const secondId = clean(parts[index + 3]);

  if (targetType === 'tool' && firstId && !secondId) {
    return resolveToolCommunityTarget(r, e, firstId);
  }

  if (targetType === 'studio' && firstId && !secondId) {
    return resolveCommunityTarget(r, e, 'studio', firstId);
  }

  if (targetType === 'experience' && firstId && secondId) {
    return resolveCommunityTarget(r, e, 'experience', firstId, secondId);
  }

  return { error: json({ error: 'Invalid favorite target.' }, 400, cors(r)) };
}

`;

worker = worker.slice(0, favoriteStart) + favoriteParser + worker.slice(favoriteEnd);

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

console.log('[community-hardening] Added Tools target support plus authenticated rating deletion.');

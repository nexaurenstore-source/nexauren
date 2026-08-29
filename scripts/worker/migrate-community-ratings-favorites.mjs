import { readFile, writeFile } from 'node:fs/promises';

const sourceUrl = new URL('../../worker.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');

const communityStart = source.indexOf('async function ensureCommunitySchema(e) {');
const communityEnd = source.indexOf('function parseFields(value) {', communityStart);

if (communityStart < 0 || communityEnd < 0) {
  throw new Error('[community-migration] Community function markers not found.');
}

const communityModule = String.raw`async function loadCommunityRegistry(r, e) {
  const [studiosResponse, toolsResponse] = await Promise.all([
    e.ASSETS.fetch(new Request(new URL('/data/studios.json', r.url))),
    e.ASSETS.fetch(new Request(new URL('/data/tools.json', r.url))),
  ]);

  if (!studiosResponse.ok || !toolsResponse.ok) {
    throw new Error('Unable to load Nexauren registry.');
  }

  const [studiosDoc, toolsDoc] = await Promise.all([
    studiosResponse.json(),
    toolsResponse.json(),
  ]);

  const studios = Array.isArray(studiosDoc?.studios) ? studiosDoc.studios : [];
  const experiences = Array.isArray(toolsDoc?.tools) ? toolsDoc.tools : [];
  const studiosByKey = new Map();

  for (const studio of studios) {
    if (studio?.id) studiosByKey.set(String(studio.id), studio);
    if (studio?.slug) studiosByKey.set(String(studio.slug), studio);
  }

  return { studios, experiences, studiosByKey };
}

async function resolveCommunityTarget(r, e, targetType, studioInput, experienceInput = null) {
  const registry = await loadCommunityRegistry(r, e);
  const studio = registry.studiosByKey.get(clean(studioInput));

  if (!studio || !studio.id) {
    return { error: json({ error: 'Studio not found.' }, 404, cors(r)) };
  }

  if (targetType === 'studio') {
    return {
      registry,
      targetType,
      studioId: String(studio.id),
      experienceId: null,
      studio,
      experience: null,
    };
  }

  const experienceId = clean(experienceInput);
  const experience = registry.experiences.find(
    (item) => String(item?.id || '') === experienceId,
  );

  if (!experience || String(experience.studio || '') !== String(studio.id)) {
    return { error: json({ error: 'Experience not found in this Studio.' }, 404, cors(r)) };
  }

  return {
    registry,
    targetType,
    studioId: String(studio.id),
    experienceId,
    studio,
    experience,
  };
}

async function parseCommunityTarget(r, e) {
  const parts = new URL(r.url).pathname.split('/').filter(Boolean);
  const index = parts.indexOf('ratings');

  if (index < 0) {
    return { error: json({ error: 'Invalid rating target.' }, 400, cors(r)) };
  }

  const targetType = clean(parts[index + 1]);
  const studioId = clean(parts[index + 2]);
  const experienceId = clean(parts[index + 3]);

  if (targetType === 'studio' && studioId && !experienceId) {
    return resolveCommunityTarget(r, e, 'studio', studioId);
  }

  if (targetType === 'experience' && studioId && experienceId) {
    return resolveCommunityTarget(r, e, 'experience', studioId, experienceId);
  }

  return { error: json({ error: 'Invalid rating target.' }, 400, cors(r)) };
}

async function getRatings(r, e) {
  const u = new URL(r.url);
  const targetType = clean(u.searchParams.get('target_type'));
  const studioInput = clean(u.searchParams.get('studio_id'));
  const experienceId = clean(u.searchParams.get('experience_id'));
  const sort = clean(u.searchParams.get('sort')) || 'recent';
  const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
  const limit = Math.max(1, Math.min(50, Number(u.searchParams.get('limit')) || 20));
  const offset = (page - 1) * limit;

  if (targetType && !['studio', 'experience'].includes(targetType)) {
    return json({ error: 'Invalid target_type.' }, 400, cors(r));
  }

  const order =
    sort === 'highest' ? 'average DESC, total DESC, latest DESC' :
    sort === 'most' ? 'total DESC, average DESC, latest DESC' :
    'latest DESC';

  const where = [];
  const binds = [];

  if (targetType) {
    where.push('r.target_type=?1');
    binds.push(targetType);
  }

  if (studioInput) {
    const registry = await loadCommunityRegistry(r, e);
    const studio = registry.studiosByKey.get(studioInput);
    if (!studio) return json({ error: 'Studio not found.' }, 404, cors(r));
    where.push(`r.studio_id=?${binds.length + 1}`);
    binds.push(String(studio.id));
  }

  if (experienceId) {
    where.push(`r.experience_id=?${binds.length + 1}`);
    binds.push(experienceId);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const targetRows = await e.DB
    .prepare(
      `SELECT r.target_type,r.studio_id,r.experience_id,
        COUNT(*) AS total,AVG(r.rating) AS average,MAX(r.created_at) AS latest
        FROM ratings r ${whereSql}
        GROUP BY r.target_type,r.studio_id,r.experience_id
        ORDER BY ${order}
        LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}`,
    )
    .bind(...binds, limit, offset)
    .all();

  const countRow = await e.DB
    .prepare(
      `SELECT COUNT(*) AS total FROM (
        SELECT r.target_type,r.studio_id,r.experience_id
        FROM ratings r ${whereSql}
        GROUP BY r.target_type,r.studio_id,r.experience_id
      )`,
    )
    .bind(...binds)
    .first();

  const registry = await loadCommunityRegistry(r, e);
  const studiosById = new Map(registry.studios.map((item) => [String(item.id), item]));
  const experiencesById = new Map(registry.experiences.map((item) => [String(item.id), item]));

  const rows = (targetRows?.results || []).map((row) => {
    const studio = studiosById.get(String(row.studio_id));
    const experience = row.experience_id
      ? experiencesById.get(String(row.experience_id))
      : null;

    return {
      target_type: row.target_type,
      studio_id: row.studio_id,
      experience_id: row.experience_id,
      name: experience?.name || studio?.name || row.experience_id || row.studio_id,
      studio_name: studio?.name || row.studio_id,
      url: experience?.url || (studio?.slug ? `/studios/${studio.slug}/` : ''),
      rating: Number(row.average || 0),
      total: Number(row.total || 0),
      latest: Number(row.latest || 0),
    };
  });

  return json(
    {
      total: Number(countRow?.total || 0),
      page,
      limit,
      sort,
      ratings: rows,
    },
    200,
    cors(r),
  );
}

async function getTargetRatings(r, e) {
  const target = await parseCommunityTarget(r, e);
  if (target.error) return target.error;

  const u = new URL(r.url);
  const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
  const limit = Math.max(1, Math.min(50, Number(u.searchParams.get('limit')) || 20));
  const offset = (page - 1) * limit;

  const [summary, rows] = await Promise.all([
    e.DB
      .prepare(
        'SELECT COUNT(*) AS total,COALESCE(AVG(rating),0) AS average,' +
          'MAX(created_at) AS latest FROM ratings ' +
          'WHERE target_type=?1 AND studio_id=?2 AND ' +
          '(experience_id=?3 OR (?3 IS NULL AND experience_id IS NULL))',
      )
      .bind(target.targetType, target.studioId, target.experienceId)
      .first(),
    e.DB
      .prepare(
        'SELECT id,target_type,studio_id,experience_id,display_name,rating,review,created_at,updated_at ' +
          'FROM ratings WHERE target_type=?1 AND studio_id=?2 AND ' +
          '(experience_id=?3 OR (?3 IS NULL AND experience_id IS NULL)) ' +
          'ORDER BY created_at DESC LIMIT ?4 OFFSET ?5',
      )
      .bind(target.targetType, target.studioId, target.experienceId, limit, offset)
      .all(),
  ]);

  return json(
    {
      target_type: target.targetType,
      studio_id: target.studioId,
      experience_id: target.experienceId,
      name: target.experience?.name || target.studio?.name,
      total: Number(summary?.total || 0),
      average: Number(summary?.average || 0),
      latest: Number(summary?.latest || 0),
      ratings: rows?.results || [],
    },
    200,
    cors(r),
  );
}

async function postRating(r, e) {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));

  const target = await parseCommunityTarget(r, e);
  if (target.error) return target.error;

  const d = await body(r);
  const rating = Math.floor(Number(d?.rating));
  const review = clean(d?.review).slice(0, 1000);
  const displayName = clean(d?.display_name || u.username).slice(0, 50);

  if (rating < 1 || rating > 5) {
    return json({ error: 'Rating must be between 1 and 5.' }, 400, cors(r));
  }

  const now = Math.floor(Date.now() / 1000);

  await e.DB
    .prepare(
      'INSERT INTO ratings ' +
        '(id,target_type,studio_id,experience_id,user_id,display_name,rating,review,created_at,updated_at) ' +
        'VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9) ' +
        'ON CONFLICT(target_type,studio_id,experience_id,user_id) DO UPDATE SET ' +
        'display_name=excluded.display_name,rating=excluded.rating,review=excluded.review,updated_at=excluded.updated_at',
    )
    .bind(
      uuid(),
      target.targetType,
      target.studioId,
      target.experienceId,
      u.id,
      displayName,
      rating,
      review,
      now,
    )
    .run();

  return json(
    {
      success: true,
      target_type: target.targetType,
      studio_id: target.studioId,
      experience_id: target.experienceId,
      rating,
      review,
    },
    201,
    cors(r),
  );
}

async function favoriteState(r, e) {
  const u = await currentUser(r, e);
  if (!u) return json({ favorite: false, authenticated: false }, 200, cors(r));

  const target = await parseFavoriteTarget(r, e);
  if (target.error) return target.error;

  const row = await e.DB
    .prepare(
      'SELECT 1 FROM favorites WHERE user_id=?1 AND target_type=?2 AND studio_id=?3 AND ' +
        '(experience_id=?4 OR (?4 IS NULL AND experience_id IS NULL)) LIMIT 1',
    )
    .bind(u.id, target.targetType, target.studioId, target.experienceId)
    .first();

  return json({ favorite: !!row, authenticated: true }, 200, cors(r));
}

async function parseFavoriteTarget(r, e) {
  const parts = new URL(r.url).pathname.split('/').filter(Boolean);
  const index = parts.indexOf('favorites');

  if (index < 0) return { error: json({ error: 'Invalid favorite target.' }, 400, cors(r)) };

  const targetType = clean(parts[index + 1]);
  const studioId = clean(parts[index + 2]);
  const experienceId = clean(parts[index + 3]);

  if (targetType === 'studio' && studioId && !experienceId) {
    return resolveCommunityTarget(r, e, 'studio', studioId);
  }

  if (targetType === 'experience' && studioId && experienceId) {
    return resolveCommunityTarget(r, e, 'experience', studioId, experienceId);
  }

  return { error: json({ error: 'Invalid favorite target.' }, 400, cors(r)) };
}

async function getFavorites(r, e) {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));

  const rows = await e.DB
    .prepare(
      'SELECT target_type,studio_id,experience_id,url,created_at ' +
        'FROM favorites WHERE user_id=?1 ORDER BY created_at DESC',
    )
    .bind(u.id)
    .all();

  return json({ favorites: rows?.results || [] }, 200, cors(r));
}

async function addFavorite(r, e) {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));

  const target = await parseFavoriteTarget(r, e);
  if (target.error) return target.error;

  const d = await body(r);
  const url = clean(d?.url || target.experience?.url || (target.studio?.slug ? `/studios/${target.studio.slug}/` : '')).slice(0, 500);
  const now = Math.floor(Date.now() / 1000);

  if (!url) return json({ error: 'Invalid favorite URL.' }, 400, cors(r));

  await e.DB
    .prepare(
      'INSERT OR IGNORE INTO favorites ' +
        '(user_id,target_type,studio_id,experience_id,url,created_at) ' +
        'VALUES (?1,?2,?3,?4,?5,?6)',
    )
    .bind(u.id, target.targetType, target.studioId, target.experienceId, url, now)
    .run();

  return json({ favorite: true }, 201, cors(r));
}

async function removeFavorite(r, e) {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));

  const target = await parseFavoriteTarget(r, e);
  if (target.error) return target.error;

  await e.DB
    .prepare(
      'DELETE FROM favorites WHERE user_id=?1 AND target_type=?2 AND studio_id=?3 AND ' +
        '(experience_id=?4 OR (?4 IS NULL AND experience_id IS NULL))',
    )
    .bind(u.id, target.targetType, target.studioId, target.experienceId)
    .run();

  return json({ favorite: false }, 200, cors(r));
}
`;

let generated = source.slice(0, communityStart) + communityModule + '\n' + source.slice(communityEnd);

const adminStart = generated.indexOf('async function adminDashboard(r, e) {');
const adminEnd = generated.indexOf('async function adminUsers(r, e) {', adminStart);

if (adminStart < 0 || adminEnd < 0) {
  throw new Error('[community-migration] Admin dashboard markers not found.');
}

const adminDashboard = String.raw`async function adminDashboard(r, e) {
  const now = Math.floor(Date.now() / 1000);
  const week = now - 604800;

  const [users, newUsers, active, forms, responses, ratings, notifications] =
    await Promise.all([
      e.DB.prepare('SELECT COUNT(*) AS total FROM users').first(),
      e.DB
        .prepare('SELECT COUNT(*) AS total FROM users WHERE created_at>=?1')
        .bind(week)
        .first(),
      e.DB
        .prepare(
          'SELECT COUNT(DISTINCT user_id) AS total FROM sessions ' +
            'WHERE expires_at>?1',
        )
        .bind(now)
        .first(),
      e.DB.prepare('SELECT COUNT(*) AS total FROM forms').first(),
      e.DB.prepare('SELECT COUNT(*) AS total FROM form_responses').first(),
      e.DB.prepare('SELECT COUNT(*) AS total FROM ratings').first(),
      e.DB.prepare('SELECT COUNT(*) AS total FROM notifications').first(),
    ]);

  return json(
    {
      users: Number(users?.total || 0),
      new_users: Number(newUsers?.total || 0),
      active_users: Number(active?.total || 0),
      forms: Number(forms?.total || 0),
      responses: Number(responses?.total || 0),
      ratings: Number(ratings?.total || 0),
      notifications: Number(notifications?.total || 0),
    },
    200,
    cors(r),
  );
}
`;

generated = generated.slice(0, adminStart) + adminDashboard + generated.slice(adminEnd);

const routesStart = generated.indexOf("      if (\n        (u.pathname === '/api/reviews'");
const routesEnd = generated.indexOf("      if (\n        u.pathname === '/api/forms'", routesStart);

if (routesStart < 0 || routesEnd < 0) {
  throw new Error('[community-migration] Community route markers not found.');
}

const routes = String.raw`      if (
        u.pathname === '/api/ratings' &&
        r.method === 'GET'
      ) {
        return getRatings(r, e);
      }

      if (
        u.pathname.startsWith('/api/ratings/') &&
        r.method === 'GET'
      ) {
        return getTargetRatings(r, e);
      }

      if (
        u.pathname.startsWith('/api/ratings/') &&
        r.method === 'POST'
      ) {
        return postRating(r, e);
      }

      if (
        u.pathname === '/api/favorites' &&
        r.method === 'GET'
      ) {
        return getFavorites(r, e);
      }

      if (
        u.pathname.startsWith('/api/favorites/') &&
        r.method === 'GET'
      ) {
        return favoriteState(r, e);
      }

      if (
        u.pathname.startsWith('/api/favorites/') &&
        r.method === 'POST'
      ) {
        return addFavorite(r, e);
      }

      if (
        u.pathname.startsWith('/api/favorites/') &&
        r.method === 'DELETE'
      ) {
        return removeFavorite(r, e);
      }

`;

generated = generated.slice(0, routesStart) + routes + generated.slice(routesEnd);

await writeFile(sourceUrl, generated, 'utf8');

console.log('[community-migration] Replaced legacy Tool review/favorite Worker functions with Studio/Experience API.');
console.log('[community-migration] Replaced legacy review/favorite routes with /api/ratings and /api/favorites.');
console.log('[community-migration] Admin dashboard now counts ratings instead of tool_reviews.');
console.log('[community-migration] Source worker structure preserved; only the community API sections were transformed.');

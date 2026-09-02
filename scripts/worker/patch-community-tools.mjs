import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(workerUrl, 'utf8');

if (source.includes('const __communityToolsPatch = true;')) {
  console.log('[community-tools] Tool community routes already patched.');
  process.exit(0);
}

const marker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
if (!marker.test(source)) throw new Error('[community-tools] Worker fetch marker not found.');

const module = String.raw`
    const __communityToolsPatch = true;
    const __communityToolTarget = async (r, e) => {
      const path = new URL(r.url).pathname.split('/').filter(Boolean);
      const section = path[1];
      const toolInput = clean(path[3]);
      if ((section !== 'ratings' && section !== 'favorites') || clean(path[2]) !== 'tool' || !toolInput) return null;

      const response = await e.ASSETS.fetch(new Request(new URL('/data/tools.json', r.url)));
      if (!response.ok) return json({ error: 'Unable to load tool registry.' }, 500, cors(r));
      const doc = await response.json();
      const tools = Array.isArray(doc?.tools) ? doc.tools : [];
      const tool = tools.find((item) => String(item?.id || '') === toolInput || String(item?.slug || '') === toolInput);
      if (!tool || !tool.id) return json({ error: 'Tool not found.' }, 404, cors(r));

      const toolId = String(tool.id);
      const dbTargetType = 'experience';
      const dbStudioId = '__tools__';
      const dbExperienceId = toolId;
      const toolUrl = clean(tool.url || `/tools/${tool.slug || tool.id}/`).slice(0, 500);

      if (section === 'ratings') {
        if (r.method === 'GET') {
          const u = new URL(r.url);
          const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
          const limit = Math.max(1, Math.min(50, Number(u.searchParams.get('limit')) || 20));
          const offset = (page - 1) * limit;
          const [summary, rows] = await Promise.all([
            e.DB.prepare('SELECT COUNT(*) AS total,COALESCE(AVG(rating),0) AS average,MAX(created_at) AS latest FROM ratings WHERE target_type=?1 AND studio_id=?2 AND experience_id=?3').bind(dbTargetType, dbStudioId, dbExperienceId).first(),
            e.DB.prepare('SELECT id,target_type,studio_id,experience_id,display_name,rating,review,created_at,updated_at FROM ratings WHERE target_type=?1 AND studio_id=?2 AND experience_id=?3 ORDER BY created_at DESC LIMIT ?4 OFFSET ?5').bind(dbTargetType, dbStudioId, dbExperienceId, limit, offset).all(),
          ]);
          return json({ target_type: 'tool', tool_id: toolId, name: String(tool.name || toolId), url: toolUrl, total: Number(summary?.total || 0), average: Number(summary?.average || 0), latest: Number(summary?.latest || 0), ratings: rows?.results || [] }, 200, cors(r));
        }
        if (r.method === 'POST') {
          const u = await currentUser(r, e);
          if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));
          const d = await body(r);
          const rating = Math.floor(Number(d?.rating));
          const review = clean(d?.review).slice(0, 1000);
          const displayName = clean(d?.display_name || u.username).slice(0, 50);
          if (rating < 1 || rating > 5) return json({ error: 'Rating must be between 1 and 5.' }, 400, cors(r));
          const now = Math.floor(Date.now() / 1000);
          await e.DB.prepare('INSERT INTO ratings (id,target_type,studio_id,experience_id,user_id,display_name,rating,review,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9) ON CONFLICT(target_type,studio_id,experience_id,user_id) DO UPDATE SET display_name=excluded.display_name,rating=excluded.rating,review=excluded.review,updated_at=excluded.updated_at').bind(uuid(), dbTargetType, dbStudioId, dbExperienceId, u.id, displayName, rating, review, now).run();
          return json({ success: true, target_type: 'tool', tool_id: toolId, rating, review }, 201, cors(r));
        }
        return json({ error: 'Method not allowed.' }, 405, cors(r));
      }

      if (r.method === 'GET') {
        const u = await currentUser(r, e);
        if (!u) return json({ favorite: false, authenticated: false }, 200, cors(r));
        const row = await e.DB.prepare('SELECT 1 FROM favorites WHERE user_id=?1 AND target_type=?2 AND studio_id=?3 AND experience_id=?4 LIMIT 1').bind(u.id, dbTargetType, dbStudioId, dbExperienceId).first();
        return json({ favorite: !!row, authenticated: true, target_type: 'tool', tool_id: toolId }, 200, cors(r));
      }
      const u = await currentUser(r, e);
      if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));
      if (r.method === 'POST') {
        const now = Math.floor(Date.now() / 1000);
        await e.DB.prepare('INSERT OR IGNORE INTO favorites (user_id,target_type,studio_id,experience_id,url,created_at) VALUES (?1,?2,?3,?4,?5,?6)').bind(u.id, dbTargetType, dbStudioId, dbExperienceId, toolUrl, now).run();
        return json({ favorite: true, target_type: 'tool', tool_id: toolId }, 201, cors(r));
      }
      if (r.method === 'DELETE') {
        await e.DB.prepare('DELETE FROM favorites WHERE user_id=?1 AND target_type=?2 AND studio_id=?3 AND experience_id=?4').bind(u.id, dbTargetType, dbStudioId, dbExperienceId).run();
        return json({ favorite: false, target_type: 'tool', tool_id: toolId }, 200, cors(r));
      }
      return json({ error: 'Method not allowed.' }, 405, cors(r));
    };
    if (new URL(r.url).pathname.startsWith('/api/ratings/tool/') || new URL(r.url).pathname.startsWith('/api/favorites/tool/')) {
      const __communityToolResponse = await __communityToolTarget(r, e);
      if (__communityToolResponse) return __communityToolResponse;
    }
`;

source = source.replace(marker, (match) => match + module, 1);
await writeFile(workerUrl, source, 'utf8');
console.log('[community-tools] Tool rating and favorite routes patched.');

import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(workerUrl, 'utf8');

if (source.includes('const __legacyToolReviewsMigration = true;')) {
  console.log('[legacy-tool-reviews] Migration bridge already installed.');
  process.exit(0);
}

const marker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
if (!marker.test(source)) throw new Error('[legacy-tool-reviews] Worker fetch marker not found.');

const module = String.raw`
    const __legacyToolReviewsMigration = true;
    const __migrateLegacyToolReviews = async (r, e, tool) => {
      try {
        const exists = await e.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tool_reviews' LIMIT 1").first();
        if (!exists) return;
        const columns = await e.DB.prepare('PRAGMA table_info(tool_reviews)').all();
        const names = new Set((columns?.results || []).map((x) => String(x.name || '').toLowerCase()));
        const toolColumn = names.has('tool_id') ? 'tool_id' : names.has('id_tool') ? 'id_tool' : null;
        const userColumn = names.has('user_id') ? 'user_id' : null;
        const ratingColumn = names.has('rating') ? 'rating' : null;
        const reviewColumn = names.has('review') ? 'review' : names.has('comment') ? 'comment' : null;
        const nameColumn = names.has('display_name') ? 'display_name' : names.has('username') ? 'username' : null;
        const createdColumn = names.has('created_at') ? 'created_at' : null;
        if (!toolColumn || !userColumn || !ratingColumn || !reviewColumn) return;
        const q = 'SELECT * FROM tool_reviews WHERE "' + toolColumn + '"=?1 LIMIT 100';
        const rows = await e.DB.prepare(q).bind(String(tool.id)).all();
        for (const row of rows?.results || []) {
          const userId = clean(row[userColumn]);
          const rating = Math.floor(Number(row[ratingColumn]));
          if (!userId || rating < 1 || rating > 5) continue;
          const review = clean(row[reviewColumn]).slice(0, 1000);
          const displayName = clean(nameColumn ? row[nameColumn] : '') .slice(0, 50) || 'Nexauren User';
          const createdAt = Number(createdColumn ? row[createdColumn] : 0) || Math.floor(Date.now() / 1000);
          await e.DB.prepare('INSERT OR IGNORE INTO ratings (id,target_type,studio_id,experience_id,user_id,display_name,rating,review,created_at,updated_at) VALUES (?1,\'experience\',\'__tools__\',?2,?3,?4,?5,?6,?7,?7)').bind(uuid(), String(tool.id), userId, displayName, rating, review, createdAt).run();
        }
      } catch (error) {
        console.error('[legacy-tool-reviews] Migration skipped:', error);
      }
    };
    const __legacyToolReviewPath = new URL(r.url).pathname;
    if (__legacyToolReviewPath.startsWith('/api/ratings/tool/')) {
      const __legacyToolReviewInput = clean(__legacyToolReviewPath.split('/').filter(Boolean)[3]);
      if (__legacyToolReviewInput) {
        const __legacyToolReviewAssets = await e.ASSETS.fetch(new Request(new URL('/data/tools.json', r.url)));
        if (__legacyToolReviewAssets.ok) {
          const __legacyToolReviewDoc = await __legacyToolReviewAssets.json();
          const __legacyToolReviewTools = Array.isArray(__legacyToolReviewDoc?.tools) ? __legacyToolReviewDoc.tools : [];
          const __legacyToolReviewTool = __legacyToolReviewTools.find((item) => String(item?.id || '') === __legacyToolReviewInput || String(item?.slug || '') === __legacyToolReviewInput);
          if (__legacyToolReviewTool?.id) await __migrateLegacyToolReviews(r, e, __legacyToolReviewTool);
        }
      }
    }
`;

source = source.replace(marker, (match) => match + module, 1);
await writeFile(workerUrl, source, 'utf8');
console.log('[legacy-tool-reviews] Legacy tool reviews are migrated into unified ratings on demand.');

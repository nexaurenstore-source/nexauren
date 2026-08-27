# Nexauren debugging guide

## Deployment pipeline

The Worker source is `worker.js`. Cloudflare deploys the generated artifact `.worker-build/worker.js`.

Run locally before deploying:

```bash
npm run check:worker
```

The check:

1. reads `worker.js`;
2. applies only the known compatibility repair;
3. writes `.worker-build/worker.js`;
4. runs Node's JavaScript syntax checker;
5. stops the build with a readable `[worker-check]` error when the expected source pattern changes.

## Where to look first

| Problem | First place |
|---|---|
| Wrangler/build failure | `scripts/build-worker.mjs` + deploy log |
| API routing | `worker.js` → `export default.fetch` |
| Authentication | `worker.js` → auth functions |
| D1/database | `migrations/` + SQL inside `worker.js` |
| Public tools | `frontend/data/tools.json` |
| Categories | `frontend/data/categories.json` |
| Public UI | `frontend/` |
| Admin | `frontend/admin/` (separate project phase) |

## Important rule

Do not hide a new syntax problem with another automatic replacement. If the worker changes enough that the known repair no longer matches exactly, the build intentionally stops and asks for the source to be inspected.

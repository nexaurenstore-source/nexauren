import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('marketplace-worker/src/index.js');
if (!fs.existsSync(file)) throw new Error(`Marketplace Worker source not found: ${file}`);
let source = fs.readFileSync(file, 'utf8');

const oldCors = "const cors = (r) => ({\n  'access-control-allow-origin': r.headers.get('Origin') || 'https://nexaurenstory.com',\n  'access-control-allow-credentials': 'true',";
const newCors = "const cors = () => ({\n  'access-control-allow-origin': 'https://nexaurenstory.com',\n  'access-control-allow-credentials': 'true',";
if (source.includes(oldCors)) source = source.replace(oldCors, newCors);

const oldUser = "  return env.DB.prepare(\n    'SELECT u.id,u.email,u.username,u.created_at,u.updated_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires_at>?2 LIMIT 1',\n  ).bind(await sha256(raw), now()).first();\n}";
const newUser = "  const user = await env.DB.prepare(\n    'SELECT u.id,u.email,u.username,u.created_at,u.updated_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires_at>?2 LIMIT 1',\n  ).bind(await sha256(raw), now()).first();\n  if (user && env.MARKETPLACE_DB) {\n    try {\n      await env.MARKETPLACE_DB.prepare(`INSERT INTO store_users(user_id,email,username,created_at,updated_at) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,username=excluded.username,updated_at=excluded.updated_at`).bind(user.id,user.email,user.username || '',user.created_at || now(),now()).run();\n    } catch (error) {\n      console.error('Marketplace identity sync failed', error);\n    }\n  }\n  return user;\n}";
if (source.includes(oldUser)) source = source.replace(oldUser, newUser);

if (source.includes("r.headers.get('Origin') || 'https://nexaurenstory.com'")) throw new Error('Marketplace CORS hardening failed');
if (!source.includes('store_users')) throw new Error('Marketplace identity sync failed: marker not found');
fs.writeFileSync(file, source);

import fs from 'node:fs';

const workerPath = 'worker.js';
const authPath = 'frontend/auth/auth.js';

let worker = fs.readFileSync(workerPath, 'utf8');
const oldCors = `const cors = (r) => ({\n  'access-control-allow-origin': r.headers.get('Origin') || '*',\n  'access-control-allow-credentials': 'true',\n  'access-control-allow-headers': 'Content-Type, Accept',\n  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',\n});`;
const newCors = `const cors = (r) => {\n  const origin = r.headers.get('Origin');\n  const allowed = new Set([\n    'https://nexaurenstory.com',\n    'https://www.nexaurenstory.com',\n  ]);\n  const allowOrigin = origin && allowed.has(origin)\n    ? origin\n    : 'https://nexaurenstory.com';\n\n  return {\n    'access-control-allow-origin': allowOrigin,\n    'access-control-allow-credentials': 'true',\n    'access-control-allow-headers': 'Content-Type, Accept',\n    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',\n    'access-control-max-age': '86400',\n    'vary': 'Origin',\n  };\n};`;
if (worker.includes(oldCors)) worker = worker.replace(oldCors, newCors);
fs.writeFileSync(workerPath, worker);

let auth = fs.readFileSync(authPath, 'utf8');
const oldRequest = `  async function request(path, options = {}) {\n    const response = await fetch(\`${API}\${path}\`, {\n      credentials: 'include',\n      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },\n      ...options\n    });\n    let data = {};\n    try { data = await response.json(); } catch {}\n    if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');\n    return data;\n  }`;
const newRequest = `  async function request(path, options = {}) {\n    let response;\n    try {\n      response = await fetch(\`${API}\${path}\`, {\n        credentials: 'include',\n        cache: 'no-store',\n        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },\n        ...options\n      });\n    } catch (error) {\n      const message = String(error?.message || error || '');\n      if (/failed to fetch|networkerror|load failed/i.test(message)) {\n        throw new Error('Não foi possível contactar o servidor de autenticação. Verifique a ligação e tente novamente.');\n      }\n      throw error;\n    }\n\n    let data = {};\n    try { data = await response.json(); } catch {}\n    if (!response.ok) {\n      throw new Error(data.error || data.message || `Erro de autenticação (${response.status}).`);\n    }\n    return data;\n  }`;
if (auth.includes(oldRequest)) auth = auth.replace(oldRequest, newRequest);
fs.writeFileSync(authPath, auth);

console.log('Auth fetch/CORS patch applied.');

/* NEXAUREN INTEGRATION CENTER — secure user connections */
// Route fragment injected into Worker fetch(r, e). Secrets are encrypted before D1 storage.
const __integrationUrl = new URL(r.url);

const __integrationProviders = {
  'cloudflare-r2': ['Storage', 'API / Access Keys'],
  'amazon-s3': ['Storage', 'Access Keys'],
  'google-drive': ['Storage', 'OAuth'],
  'dropbox': ['Storage', 'OAuth'],
  'supabase': ['Database', 'URL + API Key'],
  'firebase': ['Database', 'Project Config / OAuth'],
  'paypal': ['Payments', 'OAuth / Client ID + Secret'],
  'stripe': ['Payments', 'API Key / OAuth'],
  'flutterwave': ['Payments', 'API Keys'],
  'google': ['Accounts', 'OAuth'],
  'github': ['Accounts', 'OAuth / Token'],
  'custom-api': ['Custom', 'API Key / Bearer / OAuth'],
};

const __integrationBytes = (value) => {
  const text = String(value || '');
  if (/^[0-9a-f]{64}$/i.test(text)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) out[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  return new TextEncoder().encode(text);
};

const __integrationKey = async (e) => {
  if (!e.INTEGRATION_ENCRYPTION_KEY) throw new Error('INTEGRATION_ENCRYPTION_KEY is not configured');
  const digest = await crypto.subtle.digest('SHA-256', __integrationBytes(e.INTEGRATION_ENCRYPTION_KEY));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
};

const __integrationB64 = (bytes) => {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary);
};

const __integrationFromB64 = (value) => {
  const binary = atob(String(value || ''));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
};

const __integrationEncrypt = async (payload, e) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await __integrationKey(e);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `v1:${__integrationB64(iv)}:${__integrationB64(ciphertext)}`;
};

const __integrationDecrypt = async (value, e) => {
  const parts = String(value || '').split(':');
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('Invalid integration ciphertext');
  const key = await __integrationKey(e);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: __integrationFromB64(parts[1]) },
    key,
    __integrationFromB64(parts[2]),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
};

const __integrationPublic = (row) => ({
  id: row.id,
  provider: row.provider,
  category: row.category,
  label: row.label,
  auth_type: row.auth_type,
  created_at: Number(row.created_at),
  updated_at: Number(row.updated_at),
  connected: true,
});

async function __integrationList(r, e) {
  const user = await currentUser(r, e);
  if (!user) return json({ error: 'Authentication required.' }, 401, cors(r));
  const rows = await e.DB.prepare(
    'SELECT id,provider,category,label,auth_type,created_at,updated_at FROM user_integrations WHERE user_id=?1 ORDER BY updated_at DESC',
  ).bind(user.id).all();
  return json({ integrations: (rows.results || []).map(__integrationPublic) }, 200, cors(r));
}

async function __integrationCreate(r, e) {
  const user = await currentUser(r, e);
  if (!user) return json({ error: 'Authentication required.' }, 401, cors(r));
  const d = await body(r);
  const provider = clean(d?.provider);
  const definition = __integrationProviders[provider];
  const label = clean(d?.label) || provider;
  const authType = clean(d?.auth_type) || (definition ? definition[1] : 'API');
  const credentials = d?.credentials;
  const metadata = d?.metadata && typeof d.metadata === 'object' && !Array.isArray(d.metadata) ? d.metadata : {};

  if (!definition) return json({ error: 'Unsupported integration provider.' }, 400, cors(r));
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    return json({ error: 'Credentials are required.' }, 400, cors(r));
  }
  if (label.length > 80 || authType.length > 80) return json({ error: 'Invalid integration label or authentication type.' }, 400, cors(r));

  const credentialText = JSON.stringify(credentials);
  if (credentialText.length > 20000) return json({ error: 'Integration credentials are too large.' }, 413, cors(r));
  const metadataText = JSON.stringify(metadata);
  if (metadataText.length > 10000) return json({ error: 'Integration metadata is too large.' }, 413, cors(r));

  const id = uuid();
  const now = Math.floor(Date.now() / 1000);
  const ciphertext = await __integrationEncrypt(credentials, e);
  try {
    await e.DB.prepare(
      'INSERT INTO user_integrations (id,user_id,provider,category,label,auth_type,secret_ciphertext,metadata_json,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)',
    ).bind(id, user.id, provider, definition[0], label, authType, ciphertext, metadataText, now).run();
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) {
      return json({ error: 'An integration with this name already exists.' }, 409, cors(r));
    }
    throw error;
  }
  return json({ integration: { id, provider, category: definition[0], label, auth_type: authType, created_at: now, updated_at: now, connected: true } }, 201, cors(r));
}

async function __integrationDelete(r, e, id) {
  const user = await currentUser(r, e);
  if (!user) return json({ error: 'Authentication required.' }, 401, cors(r));
  const result = await e.DB.prepare('DELETE FROM user_integrations WHERE id=?1 AND user_id=?2').bind(id, user.id).run();
  if (!result.meta?.changes) return json({ error: 'Integration not found.' }, 404, cors(r));
  return json({ success: true }, 200, cors(r));
}

if (__integrationUrl.pathname === '/api/integrations' && r.method === 'GET') return __integrationList(r, e);
if (__integrationUrl.pathname === '/api/integrations' && r.method === 'POST') return __integrationCreate(r, e);
if (__integrationUrl.pathname.startsWith('/api/integrations/') && r.method === 'DELETE') {
  const id = decodeURIComponent(__integrationUrl.pathname.slice('/api/integrations/'.length)).trim();
  if (!id || id.includes('/')) return json({ error: 'Invalid integration id.' }, 400, cors(r));
  return __integrationDelete(r, e, id);
}

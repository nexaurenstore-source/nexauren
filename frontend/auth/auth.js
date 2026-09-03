(() => {
  'use strict';
  const API = '/api/account';

  const clearAuthCache = () => {
    try { sessionStorage.removeItem('nexauren_auth_state_v1'); } catch {}
  };

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${API}${path}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options
      });
    } catch (error) {
      const message = String(error?.message || error || '');
      if (/failed to fetch|networkerror|load failed/i.test(message)) {
        throw new Error('Não foi possível contactar o servidor de autenticação. Verifique a ligação e tente novamente.');
      }
      throw error;
    }

    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      throw new Error(data.error || data.message || `Erro de autenticação (${response.status}).`);
    }
    return data;
  }

  window.NexaurenAuth = {
    register: async (data) => { const result = await request('/register', { method: 'POST', body: JSON.stringify(data) }); clearAuthCache(); return result; },
    login: async (data) => { const result = await request('/login', { method: 'POST', body: JSON.stringify(data) }); clearAuthCache(); return result; },
    logout: async () => { const result = await request('/logout', { method: 'POST', body: '{}' }); clearAuthCache(); return result; },
    me() { return request('/me', { method: 'GET', headers: {} }); },
    forgotPassword(email) { return request('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); },
    resetPassword(token, password) { return request('/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }); }
  };
})();

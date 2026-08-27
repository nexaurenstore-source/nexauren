(() => {
  'use strict';
  const API = '/api/auth';

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
    return data;
  }

  window.NexaurenAuth = {
    register(data) { return request('/register', { method: 'POST', body: JSON.stringify(data) }); },
    login(data) { return request('/login', { method: 'POST', body: JSON.stringify(data) }); },
    logout() { return request('/logout', { method: 'POST', body: '{}' }); },
    me() { return request('/me', { method: 'GET', headers: {} }); },
    forgotPassword(email) { return request('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); },
    resetPassword(token, password) { return request('/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }); }
  };
})();

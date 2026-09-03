(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const form = $('#auth-form');
  if (!form) return;

  const API = '/api/account';
  let mode = 'login';
  const loginTab = $('#login-tab');
  const registerTab = $('#register-tab');
  const nameField = $('#name-field');
  const submit = $('#submit');
  const message = $('#message');

  const setMessage = (text, type = '') => {
    if (!message) return;
    message.textContent = text;
    message.className = type;
  };

  const request = async (path, options = {}) => {
    let response;
    try {
      response = await fetch(`${API}${path}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        ...options
      });
    } catch (error) {
      throw new Error('Não foi possível contactar o servidor de autenticação. Verifique a ligação e tente novamente.');
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || data?.message || `Erro de autenticação (${response.status}).`);
    }
    return data || {};
  };

  const setMode = next => {
    mode = next;
    loginTab?.classList.toggle('active', mode === 'login');
    registerTab?.classList.toggle('active', mode === 'register');
    nameField?.classList.toggle('hidden', mode === 'login');
    const name = $('#name');
    if (name) name.required = mode === 'register';
    const password = $('#password');
    if (password) password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    if (submit) submit.textContent = mode === 'login' ? 'Entrar' : 'Criar conta';
    setMessage('');
  };

  loginTab?.addEventListener('click', () => setMode('login'));
  registerTab?.addEventListener('click', () => setMode('register'));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('Processando…');
    if (submit) submit.disabled = true;

    const email = $('#email')?.value.trim().toLowerCase() || '';
    const password = $('#password')?.value || '';

    try {
      if (mode === 'login') {
        const data = await request('/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        setMessage('Login concluído. A abrir o seu painel…', 'success');
        if (data.authenticated) location.href = '/dashboard/';
      } else {
        const name = $('#name')?.value.trim() || '';
        const baseUsername = name.toLowerCase().replace(/[^a-z0-9_.-]+/g, '').slice(0, 24);
        const username = (baseUsername || 'user') + '-' + Math.random().toString(36).slice(2, 7);
        const data = await request('/register', {
          method: 'POST',
          body: JSON.stringify({ email, username, password })
        });
        setMessage('Conta criada. A abrir o seu painel…', 'success');
        if (data.authenticated) location.href = '/dashboard/';
      }
    } catch (error) {
      setMessage(error.message || 'Não foi possível concluir.', 'error');
      if (submit) submit.disabled = false;
    }
  });

  $('#deactivate')?.addEventListener('click', async () => {
    if (!confirm('Desativar sua conta?')) return;
    try {
      const response = await fetch('/api/account/deactivate', { method: 'POST', credentials: 'include' });
      const data = await response.json().catch(() => null);
      setMessage(data?.message || 'Conta desativada.', response.ok ? 'success' : 'error');
      if (response.ok) setTimeout(() => location.href = '/login', 500);
    } catch { setMessage('Não foi possível desativar a conta.', 'error'); }
  });

  $('#delete')?.addEventListener('click', async () => {
    if (!confirm('Eliminar permanentemente sua conta?')) return;
    try {
      const response = await fetch('/api/account/delete', { method: 'POST', credentials: 'include' });
      const data = await response.json().catch(() => null);
      setMessage(data?.message || 'Conta eliminada.', response.ok ? 'success' : 'error');
      if (response.ok) setTimeout(() => location.href = '/register', 500);
    } catch { setMessage('Não foi possível eliminar a conta.', 'error'); }
  });
})();

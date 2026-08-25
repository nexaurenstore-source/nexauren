(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const form = $('#auth-form');
  if (!form) return;

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

    const body = { email: $('#email')?.value.trim().toLowerCase(), password: $('#password')?.value || '' };
    if (mode === 'register') body.name = $('#name')?.value.trim() || '';

    try {
      const response = await fetch(mode === 'login' ? '/api/login' : '/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Não foi possível concluir.');
      setMessage(data.message || 'Concluído.', 'success');
      if (mode === 'login' || mode === 'register') location.href = '/dashboard/';
    } catch (error) {
      setMessage(error.message || 'Não foi possível concluir.', 'error');
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

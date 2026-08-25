(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const message = $('#account-message');

  const show = text => { if (message) message.textContent = text || ''; };

  async function loadAccount() {
    try {
      const response = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.authenticated || !data.user) {
        location.href = `/login?next=${encodeURIComponent('/account')}`;
        return;
      }
      $('#account-status').textContent = `Olá, ${data.user.name || 'Nexauren user'}!`;
      $('#profile-name').value = data.user.name || '';
      $('#profile-email').value = data.user.email || '';
    } catch {
      location.href = `/login?next=${encodeURIComponent('/account')}`;
    }
  }

  async function post(path) {
    const response = await fetch(path, { method: 'POST', credentials: 'include', cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.message || 'Unable to complete this action.');
    return data;
  }

  $('#logout')?.addEventListener('click', async () => {
    try { await post('/api/logout'); } finally { location.href = '/login'; }
  });

  $('#deactivate')?.addEventListener('click', async () => {
    if (!confirm('Desativar sua conta? Você será desconectado.')) return;
    try {
      const data = await post('/api/account/deactivate');
      show(data.message);
      setTimeout(() => { location.href = '/login'; }, 600);
    } catch (error) { show(error.message); }
  });

  $('#delete')?.addEventListener('click', async () => {
    if (!confirm('Eliminar permanentemente sua conta e os dados associados? Esta ação não pode ser desfeita.')) return;
    try {
      const data = await post('/api/account/delete');
      show(data.message);
      setTimeout(() => { location.href = '/register'; }, 600);
    } catch (error) { show(error.message); }
  });

  loadAccount();
})();

(() => {
  'use strict';
  const list = document.querySelector('#activity-list');
  if (!list) return;
  const read = () => { try { const value = JSON.parse(localStorage.getItem('nexauren_activity') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const render = () => {
    const items = read().slice().reverse();
    list.innerHTML = items.length ? items.map(item => `<div class="activity"><span class="activity-dot"></span><div><strong>${escapeHTML(item.title || 'Activity')}</strong><div class="muted">${escapeHTML(item.name || '')}${item.time ? ` · ${escapeHTML(new Date(item.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }))}` : ''}</div></div></div>`).join('') : '<div class="empty"><strong>No activity yet</strong><p>Your tool actions will appear here automatically.</p></div>';
  };
  render();
  window.addEventListener('storage', render);
  window.addEventListener('nexauren:activity', render);
})();

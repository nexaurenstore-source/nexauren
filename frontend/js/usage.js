(() => {
  'use strict';
  const list = document.querySelector('#usage-list');
  if (!list) return;
  const read = () => { try { const value = JSON.parse(localStorage.getItem('nexauren_usage') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const render = () => {
    const items = read().sort((a,b) => Number(b.count || 0) - Number(a.count || 0));
    list.innerHTML = items.length ? items.map(item => `<div class="activity"><span class="activity-dot"></span><div><strong>${escapeHTML(item.name || 'Tool')}</strong><div class="muted">${Number(item.count || 0)} use(s)${item.lastUsed ? ` · Last used ${escapeHTML(new Date(item.lastUsed).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }))}` : ''}</div><a class="card-link" href="${escapeHTML(item.url || '/tools/')}">Open tool →</a></div></div>`).join('') : '<div class="empty"><strong>No usage yet</strong><p>Use a tool and your statistics will appear here.</p></div>';
  };
  render();
  window.addEventListener('storage', render);
  window.addEventListener('nexauren:activity', render);
})();

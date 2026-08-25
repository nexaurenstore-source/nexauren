(() => {
  'use strict';
  const list = document.querySelector('#history-list');
  if (!list) return;
  const read = () => { try { const value = JSON.parse(localStorage.getItem('nexauren_history') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
  const format = value => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const render = () => {
    const items = read().slice().reverse();
    list.innerHTML = items.length ? items.map(item => `<div class="activity"><span class="activity-dot"></span><div><strong>${escapeHTML(item.name || 'Tool used')}</strong><div class="muted">${escapeHTML(format(item.time))}</div><a class="card-link" href="${escapeHTML(item.url || '/tools/')}">Open tool →</a></div></div>`).join('') : '<div class="empty"><strong>No history yet</strong><p>Open a tool and it will appear here automatically.</p></div>';
  };
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  render();
  window.addEventListener('storage', render);
  window.addEventListener('nexauren:activity', render);
})();

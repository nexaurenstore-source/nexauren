(() => {
  'use strict';
  const read = key => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  const render = () => {
    const usage = read('nexauren_usage');
    const history = read('nexauren_history');
    const activity = read('nexauren_activity');
    set('usage-count', usage.reduce((sum, item) => sum + Number(item.count || 0), 0));
    set('history-count', history.length);
    set('activity-count', activity.length);
    const recent = document.querySelector('#dashboard-recent');
    if (recent) {
      const items = history.slice().reverse().slice(0, 5);
      recent.innerHTML = items.length ? items.map(item => `<div class="activity"><span class="activity-dot"></span><div><strong>${escapeHTML(item.name || 'Tool')}</strong><div class="muted">${escapeHTML(item.time ? new Date(item.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '')}</div></div></div>`).join('') : '<div class="empty">No recent tools yet. Open a tool to get started.</div>';
    }
  };
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  render();
  window.addEventListener('storage', render);
  window.addEventListener('nexauren:activity', render);
})();

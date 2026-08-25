(() => {
  const list = document.querySelector('#usage-list'); if (!list) return;
  let items = []; try { items = JSON.parse(localStorage.getItem('nexauren_usage') || '[]'); } catch {}
  if (!items.length) return;
  list.innerHTML = items.slice().reverse().map(item => `<div class="activity"><span class="activity-dot"></span><div><strong>${item.name || 'Tool'}</strong><div class="muted">${item.count || 1} use(s)</div></div></div>`).join('');
})();

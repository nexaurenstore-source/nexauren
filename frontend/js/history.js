(() => {
  const list = document.querySelector('#history-list'); if (!list) return;
  let items = []; try { items = JSON.parse(localStorage.getItem('nexauren_history') || '[]'); } catch {}
  if (!items.length) return;
  list.innerHTML = items.slice().reverse().map(item => `<div class="activity"><span class="activity-dot"></span><div><strong>${item.name || 'Tool used'}</strong><div class="muted">${item.time || ''}</div></div></div>`).join('');
})();

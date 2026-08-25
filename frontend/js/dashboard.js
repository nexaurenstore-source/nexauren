(() => {
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
  const usage = read('nexauren_usage');
  const history = read('nexauren_history');
  const activity = read('nexauren_activity');
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('usage-count', usage.length); set('history-count', history.length); set('activity-count', activity.length);
})();

(()=>{
  'use strict';
  const normalizePath = () => {
    const value = location.pathname.replace(/\/+$/, '') || '/';
    return value;
  };
  const namespace = `nexauren:experience:${encodeURIComponent(normalizePath())}`;
  const key = name => `${namespace}:${String(name || 'state')}`;
  const read = (name, fallback = null) => {
    try {
      const raw = localStorage.getItem(key(name));
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  };
  const write = (name, value) => {
    try { localStorage.setItem(key(name), JSON.stringify(value)); return true; } catch { return false; }
  };
  const remove = name => { try { localStorage.removeItem(key(name)); } catch {} };
  const reset = () => {
    try {
      const prefix = `${namespace}:`;
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) localStorage.removeItem(k);
      }
    } catch {}
    window.dispatchEvent(new CustomEvent('nexauren:experience-reset', { detail: { path: normalizePath() } }));
  };
  const back = fallback => {
    if (history.length > 1 && document.referrer && new URL(document.referrer, location.href).origin === location.origin) history.back();
    else location.href = fallback || '/studios/';
  };

  window.NexaurenExperience = { path: normalizePath(), key, get: read, set: write, remove, reset, back };

  document.addEventListener('click', event => {
    const resetButton = event.target.closest?.('[data-experience-reset]');
    if (resetButton) { event.preventDefault(); reset(); return; }
    const backButton = event.target.closest?.('[data-experience-back]');
    if (backButton) { event.preventDefault(); back(backButton.getAttribute('data-fallback')); }
  });
})();

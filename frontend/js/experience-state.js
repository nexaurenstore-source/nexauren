(()=>{
  'use strict';
  const normalizePath = () => location.pathname.replace(/\/+$/, '') || '/';
  const path = normalizePath();
  const isExperience = /^\/studios\/[^/]+\/[^/]+$/.test(path);
  const namespace = `nexauren:experience:${encodeURIComponent(path)}`;
  const key = name => `${namespace}:${String(name || 'state')}`;
  const globalKeys = new Set(['nexauren_history','nexauren_activity','nexauren_usage','nexauren_theme','nexauren_language']);
  const shouldIsolate = name => isExperience && !globalKeys.has(String(name)) && !String(name).startsWith('nexauren:experience:');
  const rawGet = Storage.prototype.getItem;
  const rawSet = Storage.prototype.setItem;
  const rawRemove = Storage.prototype.removeItem;
  const scopedKey = (storage, name) => storage === localStorage && shouldIsolate(name) ? key(name) : String(name);

  if (!Storage.prototype.__nexaurenExperienceIsolation) {
    Object.defineProperty(Storage.prototype, '__nexaurenExperienceIsolation', { value: true, configurable: false });
    Storage.prototype.getItem = function(name) { return rawGet.call(this, scopedKey(this, name)); };
    Storage.prototype.setItem = function(name, value) { return rawSet.call(this, scopedKey(this, name), value); };
    Storage.prototype.removeItem = function(name) { return rawRemove.call(this, scopedKey(this, name)); };
  }

  const read = (name, fallback = null) => {
    try {
      const raw = rawGet.call(localStorage, key(name));
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  };
  const write = (name, value) => {
    try { rawSet.call(localStorage, key(name), JSON.stringify(value)); return true; } catch { return false; }
  };
  const remove = name => { try { rawRemove.call(localStorage, key(name)); } catch {} };
  const reset = () => {
    try {
      const prefix = `${namespace}:`;
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) rawRemove.call(localStorage, k);
      }
    } catch {}
    window.dispatchEvent(new CustomEvent('nexauren:experience-reset', { detail: { path } }));
  };
  const back = fallback => {
    if (history.length > 1 && document.referrer && new URL(document.referrer, location.href).origin === location.origin) history.back();
    else location.href = fallback || '/studios/';
  };

  window.NexaurenExperience = { path, isolated: isExperience, key, get: read, set: write, remove, reset, back };
  document.addEventListener('click', event => {
    const resetButton = event.target.closest?.('[data-experience-reset]');
    if (resetButton) { event.preventDefault(); reset(); return; }
    const backButton = event.target.closest?.('[data-experience-back]');
    if (backButton) { event.preventDefault(); back(backButton.getAttribute('data-fallback')); }
  });
})();

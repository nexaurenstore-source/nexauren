(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const theme = $('#theme'), language = $('#language'), motion = $('#reduced-motion'), clear = $('#clear-data'), save = $('#save-settings'), message = $('#settings-message');
  if (!theme && !language && !motion) return;

  const KEYS = { language: 'nexauren_language', theme: 'nexauren_theme', motion: 'nexauren_reduce_motion' };
  const languages = ['en', 'zh', 'hi', 'es', 'fr', 'pt'];
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; } };
  const write = (key, value) => {
    try {
      const normalized = String(value);
      localStorage.setItem(key, normalized);
      return localStorage.getItem(key) === normalized;
    } catch { return false; }
  };
  const show = (text, type = 'success') => {
    if (!message) return;
    message.hidden = false;
    message.className = `alert alert-${type}`;
    message.textContent = text;
    clearTimeout(show.timer);
    show.timer = setTimeout(() => { message.hidden = true; }, 3000);
  };
  const applyTheme = value => { document.documentElement.dataset.theme = value; };
  const applyMotion = value => {
    document.documentElement.dataset.reduceMotion = value ? 'true' : 'false';
    document.documentElement.classList.toggle('reduce-motion', !!value);
  };
  const applyLanguage = value => {
    document.documentElement.lang = value;
    if (window.Nexauren?.i18n?.setLanguage) window.Nexauren.i18n.setLanguage(value);
    window.dispatchEvent(new CustomEvent('nexauren:languagechange', { detail: { language: value } }));
  };

  const savedLanguage = read(KEYS.language, 'en');
  const savedTheme = read(KEYS.theme, 'system');
  const savedMotion = read(KEYS.motion, 'false') === 'true';
  if (language) language.value = languages.includes(savedLanguage) ? savedLanguage : 'en';
  if (theme) theme.value = ['system', 'light', 'dark'].includes(savedTheme) ? savedTheme : 'system';
  if (motion) motion.checked = savedMotion;
  applyTheme(theme?.value || 'system');
  applyMotion(!!motion?.checked);
  applyLanguage(language?.value || 'en');

  save?.addEventListener('click', () => {
    const nextLanguage = language?.value || 'en';
    const nextTheme = theme?.value || 'system';
    const nextMotion = !!motion?.checked;
    const saved = [
      write(KEYS.language, nextLanguage),
      write(KEYS.theme, nextTheme),
      write(KEYS.motion, nextMotion ? 'true' : 'false')
    ].every(Boolean);
    if (!saved) {
      show('Não foi possível guardar as definições neste navegador.', 'error');
      return;
    }
    applyTheme(nextTheme);
    applyMotion(nextMotion);
    applyLanguage(nextLanguage);
    show(nextLanguage === 'pt' ? 'Definições guardadas com sucesso.' : 'Settings saved successfully.');
  });

  clear?.addEventListener('click', () => {
    if (!confirm('Clear Nexauren history, usage and activity stored on this device?')) return;
    ['nexauren_history', 'nexauren_usage', 'nexauren_activity'].forEach(key => { try { localStorage.removeItem(key); } catch {} });
    show('Local history, usage and activity were cleared.');
  });
})();
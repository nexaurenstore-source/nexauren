(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const read = (key, fallback = []) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(value) ? value : fallback;
    } catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be unavailable */ }
  };
  const now = () => new Date().toISOString();

  const toolData = () => {
    const path = '/data/tools.json';
    return fetch(path, { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject(new Error('Tool registry unavailable'))).then(data => Array.isArray(data.tools) ? data.tools : []);
  };

  const recordHistory = tool => {
    if (!tool) return;
    const items = read('nexauren_history');
    items.push({ id: tool.id, name: tool.name, url: tool.url, time: now() });
    write('nexauren_history', items.slice(-100));
  };

  const recordActivity = (type, tool, extra = {}) => {
    const items = read('nexauren_activity');
    items.push({ type, title: extra.title || activityTitle(type, tool), toolId: tool?.id || extra.toolId || '', name: tool?.name || extra.name || '', url: tool?.url || extra.url || '', time: now() });
    write('nexauren_activity', items.slice(-200));
  };

  const recordUsage = tool => {
    if (!tool) return;
    const items = read('nexauren_usage');
    const existing = items.find(item => item.id === tool.id);
    if (existing) { existing.count = Number(existing.count || 0) + 1; existing.lastUsed = now(); }
    else items.push({ id: tool.id, name: tool.name, url: tool.url, count: 1, lastUsed: now() });
    write('nexauren_usage', items);
  };

  const activityTitle = (type, tool) => {
    const name = tool?.name || 'Tool';
    return ({
      tool_open: `${name} opened`,
      tool_start: `${name} started`,
      tool_process: `${name} processed a result`,
      tool_download: `${name} downloaded`
    })[type] || `${name}: ${type}`;
  };

  const trackTool = (type, tool, extra = {}) => {
    if (type === 'tool_open') { recordHistory(tool); recordUsage(tool); }
    recordActivity(type, tool, extra);
    window.dispatchEvent(new CustomEvent('nexauren:activity', { detail: { type, tool, extra } }));
  };

  window.Nexauren = window.Nexauren || {};
  window.Nexauren.trackTool = trackTool;
  window.Nexauren.loadTools = toolData;

  const renderHeader = () => `
    <header class="site-header"><div class="container header-inner">
      <a class="brand" href="/"><span class="brand-mark">N</span>Nexauren</a>
      <button class="menu-toggle" data-menu-toggle aria-expanded="false" aria-controls="main-nav"><span class="sr-only">Menu</span>☰</button>
      <nav class="nav" id="main-nav" data-nav aria-label="Main navigation">
        <a href="/">Home</a><a href="/tools/">Tools</a><a href="/categories/">Categories</a><a href="/dashboard/">Dashboard</a><a href="/about.html">About</a><a href="/faq.html">FAQ</a>
      </nav>
    </div></header>`;

  const renderFooter = () => `
    <footer class="site-footer"><div class="container footer-main">
      <div class="footer-brand"><a class="footer-logo" href="/">Nexauren</a><p>Simple tools for everyday creativity and technology.</p></div>
      <div class="footer-col"><h3>Explore</h3><a href="/tools/">Tools</a><a href="/categories/">Categories</a><a href="/dashboard/">Dashboard</a><a href="/history/">History</a><a href="/usage/">Usage</a><a href="/activity/">Activity</a></div>
      <div class="footer-col"><h3>Company</h3><a href="/about.html">About</a><a href="/faq.html">FAQ</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="https://www.facebook.com/nexauren" target="_blank" rel="noopener noreferrer">Facebook</a><a href="https://youtube.com/@nexauren" target="_blank" rel="noopener noreferrer">YouTube</a></div>
    </div><div class="container footer-bottom"><span>© <span data-year></span> Nexauren</span><span>Built to be useful.</span></div></footer>`;

  const headerPlaceholder = $('#site-header');
  const footerPlaceholder = $('#site-footer');
  if (headerPlaceholder) headerPlaceholder.outerHTML = renderHeader();
  if (footerPlaceholder) footerPlaceholder.outerHTML = renderFooter();

  const menuToggle = $('[data-menu-toggle]');
  const nav = $('[data-nav]');
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
    $$('.nav a', nav).forEach(link => link.addEventListener('click', () => nav.classList.remove('open')));
  }

  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  const current = location.pathname.replace(/\/$/, '') || '/';
  $$('.nav a').forEach(link => {
    const target = new URL(link.href, location.href).pathname.replace(/\/$/, '') || '/';
    link.classList.toggle('active', target === current);
  });

  const overlay = $('[data-process-overlay]');
  const states = [
    ['🙂', 'Nexauren is preparing the next page', 'Almost there…'],
    ['😐', 'Nexauren is working', 'Getting things ready…'],
    ['🔎', 'Nexauren is investigating', 'Finding the right place for you…'],
    ['⚽', 'Nexauren is on the move', 'Loading the next page…'],
    ['⏳', 'Nexauren is processing', 'Please wait a moment…'],
    ['✓', 'Nexauren is ready', 'Done.'],
  ];
  let timer;
  const showProcess = () => {
    if (!overlay) return;
    const state = states[Math.floor(Math.random() * states.length)];
    $('.mascot-face', overlay).textContent = state[0];
    $('.mascot-label', overlay).textContent = state[1];
    $('.mascot-sub', overlay).textContent = state[2];
    overlay.classList.add('is-visible');
    clearTimeout(timer);
    timer = setTimeout(() => overlay.classList.remove('is-visible'), 1200);
  };

  $$('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || link.target === '_blank') return;
    const target = new URL(href, location.href);
    if (target.origin !== location.origin) return;
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (target.pathname === location.pathname && target.search === location.search) return;
      showProcess();
    });
  });

  window.Nexauren.showPageProcess = showProcess;
})();

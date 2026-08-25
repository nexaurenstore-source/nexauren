(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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

  const overlay = $('[data-process-overlay]');
  const states = [
    ['🙂', 'Nexauren is preparing the next page', 'Almost there…'],
    ['🔎', 'Nexauren is investigating', 'Finding the right place for you…'],
    ['⚽', 'Nexauren is on the move', 'Loading the next page…'],
    ['😄', 'Nexauren is ready', 'Just a moment…'],
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
    timer = setTimeout(() => overlay.classList.remove('is-visible'), 1600);
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

  window.Nexauren = { showPageProcess: showProcess };
})();

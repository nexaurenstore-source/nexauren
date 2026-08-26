(function () {
  'use strict';
  if (window.__nexaurenAdsLoaded) return;

  function loadAd(src, zone, target) {
    if (!src || !zone || document.querySelector(`script[data-zone="${zone}"]`)) return;
    const script = document.createElement('script');
    script.dataset.zone = zone;
    script.src = src;
    script.async = true;
    (target || document.body).appendChild(script);
  }

  function isToolPage() {
    return /^\/tools\//.test(window.location.pathname) || document.body.classList.contains('tool-page');
  }

  function ensureSlots() {
    if (!document.body || !isToolPage()) return;
    window.__nexaurenAdsLoaded = true;
    const main = document.querySelector('main') || document.body;
    if (!document.getElementById('ad-top')) {
      const top = document.createElement('div');
      top.id = 'ad-top';
      top.className = 'tool-ad ad-slot ad-top';
      top.setAttribute('aria-label', 'Advertisement');
      main.insertBefore(top, main.firstChild);
    }
    if (!document.getElementById('ad-bottom')) {
      const bottom = document.createElement('div');
      bottom.id = 'ad-bottom';
      bottom.className = 'tool-ad ad-slot ad-bottom';
      bottom.setAttribute('aria-label', 'Advertisement');
      main.appendChild(bottom);
    }
    loadAd('https://n6wxm.com/vignette.min.js', '11177602', document.getElementById('ad-top'));
    loadAd('https://nap5k.com/tag.min.js', '11215522', document.getElementById('ad-bottom'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureSlots, { once: true });
  else ensureSlots();
})();

(function () {
  'use strict';
  if (window.__nexaurenAdsLoaded) return;
  window.__nexaurenAdsLoaded = true;

  function loadAd(src, zone, target) {
    if (!src || !zone || document.querySelector(`script[data-zone="${zone}"]`)) return;
    const script = document.createElement('script');
    script.dataset.zone = zone;
    script.src = src;
    script.async = true;
    (target || document.body).appendChild(script);
  }

  function ensureSlots() {
    if (!document.body) return;
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
    const top = document.getElementById('ad-top');
    const bottom = document.getElementById('ad-bottom');
    loadAd('https://n6wxm.com/vignette.min.js', '11177602', top);
    loadAd('https://nap5k.com/tag.min.js', '11215522', bottom);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureSlots, { once: true });
  else ensureSlots();
})();

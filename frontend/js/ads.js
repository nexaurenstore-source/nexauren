(function () {
  function loadAd(src, zone, target) {
    if (!src || !zone) return;
    const script = document.createElement('script');
    script.dataset.zone = zone;
    script.src = src;
    script.async = true;
    if (target) target.appendChild(script);
    else document.body.appendChild(script);
  }

  const top = document.getElementById('ad-top');
  const bottom = document.getElementById('ad-bottom');
  const target = top || bottom || document.body;

  loadAd('https://n6wxm.com/vignette.min.js', '11177602', target);
  loadAd('https://nap5k.com/tag.min.js', '11215522', bottom && bottom !== target ? bottom : null);
})();

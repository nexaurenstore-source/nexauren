(function () {
    if (window.__nexaurenAdsLoaded) return;
    window.__nexaurenAdsLoaded = true;

    function loadAd(src, zone) {
        const script = document.createElement("script");
        script.src = src;
        script.dataset.zone = zone;
        script.async = true;
        document.head.appendChild(script);
    }

    function start() {
        loadAd("https://n6wxm.com/vignette.min.js", "11177602");
        loadAd("https://nap5k.com/tag.min.js", "11215522");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();

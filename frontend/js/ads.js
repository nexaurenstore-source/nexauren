(function () {
    function loadAd(src, zone) {
        const script = document.createElement("script");

        script.dataset.zone = zone;
        script.src = src;
        script.async = true;

        document.body.appendChild(script);
    }

    function isExperiencePage() {
        return /^\/studios\/[^/]+\/[^/]+\/?$/.test(window.location.pathname);
    }

    function loadExperienceAds() {
        if (!document.body || !isExperiencePage()) return;
        if (window.__nexaurenExperienceAdsLoaded) return;

        window.__nexaurenExperienceAdsLoaded = true;
        loadAd("https://n6wxm.com/vignette.min.js", "11177602");
        loadAd("https://nap5k.com/tag.min.js", "11215522");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadExperienceAds, { once: true });
    } else {
        loadExperienceAds();
    }
})();

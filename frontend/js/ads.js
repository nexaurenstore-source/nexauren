(function () {
    if (window.__nexaurenAdsLoaded) return;
    window.__nexaurenAdsLoaded = true;
    const scripts = [
        { src: "https://nap5k.com/tag.min.js", zone: "11183778" },
        { src: "https://n6wxm.com/vignette.min.js", zone: "11177602" },
    ];
    const root = document.documentElement || document.body;
    if (!root) return;
    for (const ad of scripts) {
        const script = document.createElement("script");
        script.dataset.zone = ad.zone;
        script.src = ad.src;
        root.appendChild(script);
    }
    if (location.pathname === '/studios/document/templates/' && !document.querySelector('script[data-document-template-expansion]')) {
        const templateScript = document.createElement('script');
        templateScript.src = '/studios/document/templates/templates-extra.js';
        templateScript.defer = true;
        templateScript.dataset.documentTemplateExpansion = 'true';
        root.appendChild(templateScript);
    }
})();

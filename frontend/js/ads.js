(function () {
    const EXPERIENCE_REGISTRY = "/data/tools.json";
    const loaded = new Set();
    let registryPromise = null;

    function loadAd(src, zone) {
        const script = document.createElement("script");

        script.dataset.zone = zone;
        script.src = src;
        script.async = true;

        document.body.appendChild(script);
    }

    function normalizePath(pathname) {
        const path = String(pathname || "/").replace(/\/{2,}/g, "/");
        if (path === "/") return "/";
        return path.endsWith("/") ? path : `${path}/`;
    }

    function getExperienceUrls(data) {
        if (!Array.isArray(data?.tools)) return new Set();

        return new Set(
            data.tools
                .filter((tool) => String(tool?.status || "active") === "active")
                .map((tool) => normalizePath(tool?.url))
                .filter((url) => /^\/studios\/[^/]+\/[^/]+\/$/.test(url)),
        );
    }

    function getRegistry() {
        if (!registryPromise) {
            registryPromise = fetch(`${EXPERIENCE_REGISTRY}?v=7`, {
                cache: "no-store",
                credentials: "same-origin",
            })
                .then((response) => {
                    if (!response.ok) throw new Error(`Registry request failed: ${response.status}`);
                    return response.json();
                })
                .then(getExperienceUrls)
                .catch(() => new Set());
        }

        return registryPromise;
    }

    async function loadExperienceAds() {
        if (!document.body) return;

        const path = normalizePath(window.location.pathname);
        const experiences = await getRegistry();

        if (!experiences.has(path)) return;
        if (loaded.has(path)) return;

        loaded.add(path);

        loadAd("https://n6wxm.com/vignette.min.js", "11177602");
        loadAd("https://nap5k.com/tag.min.js", "11215522");
    }

    function scheduleLoad() {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", loadExperienceAds, { once: true });
        } else {
            loadExperienceAds();
        }
    }

    function watchNavigation() {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function () {
            const result = originalPushState.apply(this, arguments);
            scheduleLoad();
            return result;
        };

        history.replaceState = function () {
            const result = originalReplaceState.apply(this, arguments);
            scheduleLoad();
            return result;
        };

        window.addEventListener("popstate", scheduleLoad);
    }

    watchNavigation();
    scheduleLoad();
})();

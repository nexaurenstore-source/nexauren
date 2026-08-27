(() => {
  'use strict';

  const cache = new Map();

  const fetchJSON = async (path) => {
    const response = await fetch(`${path}?v=20260827`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Registry request failed: ${response.status}`);
    }

    return response.json();
  };

  const load = (key, path, selector) => {
    if (!cache.has(key)) {
      cache.set(key, fetchJSON(path).then(selector));
    }
    return cache.get(key);
  };

  window.NexaurenRegistry = Object.freeze({
    loadTools: () => load('tools', '/data/tools.json', data =>
      Array.isArray(data?.tools) ? data.tools.filter(Boolean) : []
    ),

    loadCategories: () => load('categories', '/data/categories.json', data =>
      Array.isArray(data?.categories) ? data.categories.filter(Boolean) : []
    )
  });
})();

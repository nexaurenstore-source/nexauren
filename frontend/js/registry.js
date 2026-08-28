(() => {
  'use strict';

  const cache = new Map();

  const fetchJSON = async path => {
    const response = await fetch(path, {
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

    loadStudios: () => load('studios', '/data/studios.json', data =>
      Array.isArray(data?.studios) ? data.studios.filter(Boolean) : []
    ),

    // Compatibility only. Categories are no longer part of the product architecture.
    loadCategories: () => Promise.resolve([])
  });
})();

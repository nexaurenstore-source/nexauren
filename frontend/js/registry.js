(() => {
  'use strict';

  const cache = new Map();
  const sampleMaker = {
    id: 'sample-maker', name: 'Sample Maker', slug: 'sample-maker', studio: 'audio-studio', studioName: 'Audio Studio',
    description: 'Turn one sample into a collection of fresh sound variations with effects, pitch and character controls.',
    url: '/tools/sample-maker/', icon: 'music', image: '', socialImage: '', status: 'active', featured: true, popular: true, rankScore: 101,
    tags: ['audio','sample','sampler','sample-pack','effects','music-production','kick','clap','hihat']
  };
  const fetchJSON = async path => {
    const response = await fetch(path, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Registry request failed: ${response.status}`);
    return response.json();
  };
  const load = (key, path, selector) => {
    if (!cache.has(key)) cache.set(key, fetchJSON(path).then(selector));
    return cache.get(key);
  };

  window.NexaurenRegistry = Object.freeze({
    loadTools: () => load('tools', '/data/tools.json', data => {
      const tools = Array.isArray(data?.tools) ? data.tools.filter(Boolean) : [];
      return [sampleMaker, ...tools.filter(t => t?.id !== sampleMaker.id)];
    }),
    loadStudios: () => load('studios', '/data/studios.json', data => Array.isArray(data?.studios) ? data.studios.filter(Boolean) : []),
    loadStudio: async slug => {
      const [studios, tools] = await Promise.all([window.NexaurenRegistry.loadStudios(), window.NexaurenRegistry.loadTools()]);
      const studio = studios.find(s => s.slug === slug && String(s.status || 'active') === 'active');
      if (!studio) return null;
      const byId = new Map(tools.map(t => [t.id, t]));
      return { ...studio, experiences: (studio.tools || []).map(id => byId.get(id)).filter(t => t && String(t.status || 'active') === 'active') };
    }
  });
})();

(() => {
  'use strict';

  const cache = new Map();
  const sampleMaker = {
    id: 'sample-maker', name: 'Sample Maker', slug: 'sample-maker', studio: 'audio-studio', studioName: 'Audio Studio',
    description: 'Turn one sample into a collection of fresh sound variations with effects, pitch and character controls.',
    url: '/tools/sample-maker/', icon: 'music', image: '', socialImage: '', status: 'active', featured: true, popular: true, rankScore: 101,
    tags: ['audio','sample','sampler','sample-pack','effects','music-production','kick','clap','hihat']
  };
  const aiTools = [
    {
      id: 'ai-image-generator', name: 'AI Image Generator', slug: 'ai-image-generator', studio: 'ai', studioName: 'AI Tools',
      description: 'Generate images from text prompts with Nexauren AI.', url: '/ai/image-generator/', icon: 'image', image: '', socialImage: '', status: 'active', featured: true, popular: true, rankScore: 110,
      tags: ['ai','image','generator','generation','art','design','prompt']
    },
    {
      id: 'ai-pdf-summarizer', name: 'AI PDF Summarizer', slug: 'ai-pdf-summarizer', studio: 'ai', studioName: 'AI Tools',
      description: 'Summarize PDF documents, extract key points and analyze content with Nexauren AI.', url: '/ai/pdf-summarizer/', icon: 'pdf', image: '', socialImage: '', status: 'active', featured: true, popular: true, rankScore: 108,
      tags: ['ai','pdf','summarizer','summary','document','analysis','key-points']
    },
    {
      id: 'ai_video_generator', name: 'AI Video Generator', slug: 'ai-video-generator', studio: 'ai', studioName: 'AI Tools',
      description: 'Create short AI videos from text prompts or animate a reference image with Nexauren AI.', url: '/ai/video-generator/', icon: 'video', image: '', socialImage: '', status: 'active', featured: true, popular: true, rankScore: 112,
      tags: ['ai','video','generator','text-to-video','image-to-video','pixverse','generation']
    }
  ];
  const fetchJSON = async path => {
    const response = await fetch(`${path}${path.includes('?') ? '&' : '?'}v=9`, { cache: 'no-store', headers: { Accept: 'application/json' } });
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
      const merged = [sampleMaker, ...aiTools, ...tools];
      const seen = new Set();
      return merged.filter(t => {
        if (!t?.id || seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
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

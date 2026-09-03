import { readFile, writeFile } from 'node:fs/promises';

const toolsPage = new URL('../frontend/tools/index.html', import.meta.url);
let source = await readFile(toolsPage, 'utf8');

const categoryNeedle = "['all','All'],['image','Image']";
if (!source.includes("['ai','AI']")) {
  if (!source.includes(categoryNeedle)) throw new Error('[tools-ai-category] Category list marker not found.');
  source = source.replace(categoryNeedle, "['all','All'],['ai','AI'],['image','Image']");
}

const categoryLoop = "for(const c of ['image','audio','video','pdf','text','productivity','business','document'])if(studio.includes(c)||tag===c)return c;";
if (!source.includes("studio==='ai'")) {
  if (!source.includes(categoryLoop)) throw new Error('[tools-ai-category] Category resolver marker not found.');
  source = source.replace(categoryLoop, "if(studio==='ai'||tag==='ai')return 'ai';" + categoryLoop);
}

const aiHeading = '<span class="nx-kicker">Available</span><h2>Ready to use</h2>';
if (source.includes(aiHeading) && !source.includes('AI tools are grouped')) {
  source = source.replace(aiHeading, '<span class="nx-kicker">Available</span><h2>Ready to use</h2><p class="nx-ai-category-note">AI tools are grouped here automatically, including new AI tools registered in the catalog.</p>');
}

if (!source.includes('.nx-ai-category-note')) {
  source = source.replace('</style>', '.nx-ai-category-note{margin:.35rem 0 0;color:var(--muted,#667085);font-size:.82rem}.nx-tool-filter[data-category="ai"]{background:linear-gradient(100deg,rgba(114,87,255,.14),rgba(0,184,217,.14));border-color:rgba(114,87,255,.35)}\n</style>');
}

await writeFile(toolsPage, source, 'utf8');

// Keep the build-time static registry in sync with the D1 registration so
// admin/tool billing views also know about the new AI video tool.
const registryFile = new URL('../frontend/data/tools.json', import.meta.url);
const registry = JSON.parse(await readFile(registryFile, 'utf8'));
registry.tools = Array.isArray(registry.tools) ? registry.tools : [];
if (!registry.tools.some((tool) => tool?.id === 'ai_video_generator')) {
  registry.tools.push({
    id: 'ai_video_generator',
    name: 'AI Video Generator',
    slug: 'ai-video-generator',
    studio: 'ai',
    studioName: 'AI Tools',
    description: 'Create short AI videos from text prompts or reference images with Nexauren AI.',
    url: '/ai/video-generator/',
    icon: 'video',
    image: '',
    socialImage: '',
    status: 'active',
    featured: true,
    popular: true,
    rankScore: 112,
    tags: ['ai','video','generator','text-to-video','image-to-video','pixverse','generation'],
  });
  registry.version = Math.max(Number(registry.version) || 0, 8);
  await writeFile(registryFile, JSON.stringify(registry, null, 2) + '\n', 'utf8');
}

console.log('[tools-ai-category] AI category enabled in Tools directory.');
console.log('[tools-ai-category] AI video generator synced into static tool registry.');

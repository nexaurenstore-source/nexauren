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
console.log('[tools-ai-category] AI category enabled in Tools directory.');

import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('../frontend/tools/index.html', import.meta.url);
let source = await readFile(file, 'utf8');

const categoryNeedle = "['all','All'],['image','Image']";
if (!source.includes("['ai','AI']")) {
  if (!source.includes(categoryNeedle)) throw new Error('[tools-ai-category] Category list marker not found.');
  source = source.replace(categoryNeedle, "['all','All'],['ai','AI'],['image','Image']");
}

const categoryLoop = "for(const c of ['image','audio','video','pdf','text','productivity','business','document'])if(studio.includes(c)||tag===c)return c;";
if (!source.includes("studio==='ai'")) {
  if (!source.includes(categoryLoop)) throw new Error('[tools-ai-category] Category resolver marker not found.');
  source = source.replace(
    categoryLoop,
    "if(studio==='ai'||tag==='ai')return 'ai';" + categoryLoop,
  );
}

const aiHeading = '<span class="nx-kicker">Available</span><h2>Ready to use</h2>';
if (source.includes(aiHeading) && !source.includes('AI tools are grouped')) {
  source = source.replace(
    aiHeading,
    '<span class="nx-kicker">Available</span><h2>Ready to use</h2><p class="nx-ai-category-note">AI tools are grouped here automatically, including new AI tools registered in the catalog.</p>',
  );
}

await writeFile(file, source, 'utf8');
console.log('[tools-ai-category] AI category enabled in Tools directory.');

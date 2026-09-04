(() => {
  'use strict';

  const sectionTypes = {
    hero: { label: 'Hero', icon: 'H', desc: 'Headline, description and call to action' },
    text: { label: 'Text', icon: 'T', desc: 'A simple text/content section' },
    imageText: { label: 'Image + Text', icon: 'I', desc: 'Image beside a content block' },
    features: { label: 'Features', icon: '✦', desc: 'Three feature highlights' },
    products: { label: 'Products', icon: '$', desc: 'Simple product cards' },
    testimonials: { label: 'Testimonials', icon: '“', desc: 'Customer quote and author' },
    faq: { label: 'FAQ', icon: '?', desc: 'Frequently asked questions' },
    newsletter: { label: 'Newsletter', icon: '✉', desc: 'Email signup call to action' },
    contact: { label: 'Contact', icon: '↗', desc: 'Contact details and call to action' },
    footer: { label: 'Footer', icon: 'F', desc: 'Simple site footer' },
  };

  const defaults = {
    hero: { title: 'Build something amazing', body: 'Create a beautiful website with simple sections and no complicated editor.', button: 'Get Started' },
    text: { title: 'Tell your story', body: 'Add your message here. Explain what you do, why it matters, or what visitors should know.' },
    imageText: { title: 'A simple way to stand out', body: 'Put your most important message next to an image. Keep it clear and easy to understand.', image: 'Image placeholder' },
    features: { title: 'Everything you need', items: ['Simple', 'Beautiful', 'Flexible'] },
    products: { title: 'Featured products', items: ['Product One', 'Product Two', 'Product Three'], prices: ['$10', '$20', '$30'] },
    testimonials: { quote: 'This made creating my website incredibly easy.', author: 'Happy customer' },
    faq: { title: 'Frequently asked questions', items: ['How does it work?', 'Can I customize my site?', 'Can I export my website?'] },
    newsletter: { title: 'Stay in the loop', body: 'Get updates and useful resources delivered to your inbox.', button: 'Subscribe' },
    contact: { title: 'Let’s talk', body: 'Have a question? Get in touch and we’ll be happy to hear from you.', email: 'hello@example.com' },
    footer: { text: '© 2026 My Website. All rights reserved.' },
  };

  const state = {
    siteName: 'My Website',
    selected: null,
    sections: [
      makeSection('hero'),
      makeSection('features'),
      makeSection('text'),
      makeSection('footer'),
    ],
  };

  function makeSection(type) {
    return { id: crypto.randomUUID(), type, data: structuredClone(defaults[type]) };
  }

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const getSelected = () => state.sections.find((s) => s.id === state.selected) || null;

  function render() {
    $('sectionList').innerHTML = state.sections.map((s, i) => `
      <div class="section-row ${s.id === state.selected ? 'selected' : ''}">
        <button class="section-main" data-select="${s.id}" type="button"><span class="section-icon">${esc(sectionTypes[s.type].icon)}</span><span class="section-title">${esc(sectionTypes[s.type].label)}</span></button>
        <div class="section-actions">
          <button class="mini" data-up="${s.id}" ${i === 0 ? 'disabled' : ''} title="Move up">↑</button>
          <button class="mini" data-down="${s.id}" ${i === state.sections.length - 1 ? 'disabled' : ''} title="Move down">↓</button>
          <button class="mini" data-delete="${s.id}" title="Delete">×</button>
        </div>
      </div>`).join('');

    $('canvas').innerHTML = state.sections.length ? state.sections.map(renderSection).join('') : '<div class="empty-canvas"><div><strong>Your website is empty</strong>Click “Add section” to start building.</div></div>';
    document.querySelectorAll('.site-section').forEach((el) => el.classList.toggle('active', el.dataset.id === state.selected));
    renderProperties();
  }

  function renderSection(s) {
    const d = s.data;
    const common = `class="site-section ${s.id === state.selected ? 'active' : ''}" data-id="${s.id}" data-canvas-select="${s.id}"`;
    switch (s.type) {
      case 'hero': return `<section ${common} class="site-section hero"><h1>${esc(d.title)}</h1><p>${esc(d.body)}</p><span class="site-button">${esc(d.button)}</span></section>`;
      case 'text': return `<section ${common} class="site-section text-block"><h2>${esc(d.title)}</h2><p>${esc(d.body)}</p></section>`;
      case 'imageText': return `<section ${common} class="site-section image-text"><div class="fake-image">${esc(d.image)}</div><div><h2>${esc(d.title)}</h2><p>${esc(d.body)}</p></div></section>`;
      case 'features': return `<section ${common} class="site-section"><h2>${esc(d.title)}</h2><div class="features">${d.items.map((x) => `<div class="feature"><b>${esc(x)}</b><span>Describe this feature in a few words.</span></div>`).join('')}</div></section>`;
      case 'products': return `<section ${common} class="site-section"><h2>${esc(d.title)}</h2><div class="products">${d.items.map((x,i) => `<div class="product"><b>${esc(x)}</b><div class="price">${esc(d.prices[i])}</div><span class="site-button">View product</span></div>`).join('')}</div></section>`;
      case 'testimonials': return `<section ${common} class="site-section quote"><blockquote>“${esc(d.quote)}”</blockquote><div>${esc(d.author)}</div></section>`;
      case 'faq': return `<section ${common} class="site-section"><h2>${esc(d.title)}</h2>${d.items.map((x) => `<div class="faq-item"><span>${esc(x)}</span><span>+</span></div>`).join('')}</section>`;
      case 'newsletter': return `<section ${common} class="site-section newsletter"><h2>${esc(d.title)}</h2><p>${esc(d.body)}</p><div class="input-row"><input placeholder="Your email" disabled><span class="site-button">${esc(d.button)}</span></div></section>`;
      case 'contact': return `<section ${common} class="site-section text-block"><h2>${esc(d.title)}</h2><p>${esc(d.body)}</p><p><strong>${esc(d.email)}</strong></p></section>`;
      case 'footer': return `<footer ${common} class="site-footer"><span>${esc(d.text)}</span><span>Made with Nexauren</span></footer>`;
      default: return '';
    }
  }

  function field(label, key, value, multiline = false) {
    return `<div class="field"><label>${esc(label)}</label>${multiline ? `<textarea data-field="${esc(key)}">${esc(value)}</textarea>` : `<input data-field="${esc(key)}" value="${esc(value)}">`}</div>`;
  }

  function renderProperties() {
    const s = getSelected();
    if (!s) {
      $('properties').innerHTML = `<h2>Properties</h2><p class="wb-help">Select a section to edit it. Everything stays in this browser session.</p><div class="notice">Nothing from this builder is saved to Nexauren servers.</div>`;
      return;
    }
    const d = s.data;
    let html = `<h2>Editing</h2><p class="property-title">${esc(sectionTypes[s.type].label)}</p><p class="property-sub">${esc(sectionTypes[s.type].desc)}</p>`;
    if (s.type === 'hero') html += field('Title','title',d.title)+field('Description','body',d.body,true)+field('Button text','button',d.button);
    if (s.type === 'text') html += field('Title','title',d.title)+field('Content','body',d.body,true);
    if (s.type === 'imageText') html += field('Title','title',d.title)+field('Content','body',d.body,true)+field('Image label','image',d.image);
    if (s.type === 'features') html += field('Section title','title',d.title)+d.items.map((x,i)=>field(`Feature ${i+1}`,`items.${i}`,x)).join('');
    if (s.type === 'products') html += field('Section title','title',d.title)+d.items.map((x,i)=>field(`Product ${i+1}`,`items.${i}`,x)+field(`Price ${i+1}`,`prices.${i}`,d.prices[i])).join('');
    if (s.type === 'testimonials') html += field('Quote','quote',d.quote,true)+field('Author','author',d.author);
    if (s.type === 'faq') html += field('Section title','title',d.title)+d.items.map((x,i)=>field(`Question ${i+1}`,`items.${i}`,x)).join('');
    if (s.type === 'newsletter') html += field('Title','title',d.title)+field('Description','body',d.body,true)+field('Button text','button',d.button);
    if (s.type === 'contact') html += field('Title','title',d.title)+field('Description','body',d.body,true)+field('Email','email',d.email);
    if (s.type === 'footer') html += field('Footer text','text',d.text);
    html += `<div class="notice">Changes are kept only in this page session. Export your site when you are ready.</div>`;
    $('properties').innerHTML = html;
  }

  function updateField(target, value) {
    const s = getSelected(); if (!s) return;
    const [root, index] = target.split('.');
    if (index !== undefined) s.data[root][Number(index)] = value;
    else s.data[root] = value;
    render();
  }

  function openModal() {
    $('sectionOptions').innerHTML = Object.entries(sectionTypes).map(([type, meta]) => `<button class="section-option" data-add="${type}" type="button"><b>${esc(meta.icon)} &nbsp; ${esc(meta.label)}</b><span>${esc(meta.desc)}</span></button>`).join('');
    $('sectionModal').classList.add('open');
  }
  function closeModal() { $('sectionModal').classList.remove('open'); }

  function addSection(type) {
    const s = makeSection(type);
    const footerIndex = state.sections.findIndex((x) => x.type === 'footer');
    const index = footerIndex >= 0 ? footerIndex : state.sections.length;
    state.sections.splice(index, 0, s); state.selected = s.id; closeModal(); render(); toast(`${sectionTypes[type].label} added`);
  }

  function move(id, direction) {
    const i = state.sections.findIndex((s) => s.id === id); const j = i + direction;
    if (i < 0 || j < 0 || j >= state.sections.length) return;
    [state.sections[i], state.sections[j]] = [state.sections[j], state.sections[i]]; render();
  }

  function remove(id) {
    state.sections = state.sections.filter((s) => s.id !== id);
    if (state.selected === id) state.selected = state.sections[0]?.id || null;
    render(); toast('Section removed');
  }

  function toast(message) { const t=$('toast'); t.textContent=message; t.classList.add('show'); clearTimeout(window.__wbToast); window.__wbToast=setTimeout(()=>t.classList.remove('show'),1800); }

  function download(filename, content, type) {
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function exportSite() {
    const sections = state.sections.map(renderExportSection).join('\n');
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(state.siteName)}</title><style>body{margin:0;font-family:Inter,system-ui,sans-serif;color:#171923}section,footer{padding:64px 8%;border-bottom:1px solid #eee}h1{font-size:clamp(38px,6vw,70px);max-width:800px;margin:0 auto 18px;text-align:center}h2{text-align:center;font-size:32px}p{line-height:1.7;color:#656b78;max-width:700px;margin:0 auto 22px}.hero{text-align:center}.button{display:inline-block;background:#171923;color:#fff;padding:12px 18px;border-radius:10px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{padding:20px;border:1px solid #e5e7ed;border-radius:14px}.card b{display:block;margin-bottom:8px}.quote{text-align:center;background:#fafaff}.quote blockquote{font-size:25px;max-width:700px;margin:0 auto 12px}.newsletter{background:#171923;color:#fff;text-align:center}.newsletter p{color:#c7cad2}@media(max-width:700px){.cards{grid-template-columns:1fr}}</style></head><body>${sections}</body></html>`;
    download(`${slugify(state.siteName)||'website'}.html`, html, 'text/html;charset=utf-8'); toast('Website exported');
  }

  function renderExportSection(s) {
    const d=s.data;
    switch(s.type){
      case 'hero': return `<section class="hero"><h1>${esc(d.title)}</h1><p>${esc(d.body)}</p><span class="button">${esc(d.button)}</span></section>`;
      case 'text': return `<section><h2>${esc(d.title)}</h2><p>${esc(d.body)}</p></section>`;
      case 'imageText': return `<section><h2>${esc(d.title)}</h2><p>${esc(d.body)}</p><p><em>${esc(d.image)}</em></p></section>`;
      case 'features': return `<section><h2>${esc(d.title)}</h2><div class="cards">${d.items.map(x=>`<div class="card"><b>${esc(x)}</b><span>Describe this feature here.</span></div>`).join('')}</div></section>`;
      case 'products': return `<section><h2>${esc(d.title)}</h2><div class="cards">${d.items.map((x,i)=>`<div class="card"><b>${esc(x)}</b><p>${esc(d.prices[i])}</p><span class="button">View product</span></div>`).join('')}</div></section>`;
      case 'testimonials': return `<section class="quote"><blockquote>“${esc(d.quote)}”</blockquote><div>${esc(d.author)}</div></section>`;
      case 'faq': return `<section><h2>${esc(d.title)}</h2>${d.items.map(x=>`<p><strong>${esc(x)}</strong></p>`).join('')}</section>`;
      case 'newsletter': return `<section class="newsletter"><h2>${esc(d.title)}</h2><p>${esc(d.body)}</p><span class="button">${esc(d.button)}</span></section>`;
      case 'contact': return `<section><h2>${esc(d.title)}</h2><p>${esc(d.body)}</p><p><strong>${esc(d.email)}</strong></p></section>`;
      case 'footer': return `<footer><span>${esc(d.text)}</span></footer>`;
      default:return '';
    }
  }

  function slugify(v){return String(v).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}

  document.addEventListener('click',(e)=>{
    const select=e.target.closest('[data-select],[data-canvas-select]'); if(select){state.selected=select.dataset.select||select.dataset.canvasSelect;render();return;}
    const add=e.target.closest('[data-add]'); if(add){addSection(add.dataset.add);return;}
    const up=e.target.closest('[data-up]'); if(up){move(up.dataset.up,-1);return;}
    const down=e.target.closest('[data-down]'); if(down){move(down.dataset.down,1);return;}
    const del=e.target.closest('[data-delete]'); if(del){remove(del.dataset.delete);return;}
  });
  document.addEventListener('input',(e)=>{if(e.target.matches('[data-field]')) updateField(e.target.dataset.field,e.target.value);});
  $('addSectionBtn').addEventListener('click',openModal); $('closeModal').addEventListener('click',closeModal); $('sectionModal').addEventListener('click',(e)=>{if(e.target===$('sectionModal'))closeModal();});
  $('exportBtn').addEventListener('click',exportSite);
  $('siteName').addEventListener('input',(e)=>{state.siteName=e.target.value||'My Website';});
  document.querySelectorAll('[data-device]').forEach((btn)=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-device]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$('canvas').classList.remove('tablet','mobile');if(btn.dataset.device!=='desktop')$('canvas').classList.add(btn.dataset.device);}));
  $('previewBtn').addEventListener('click',()=>{const sections=state.sections.map(renderExportSection).join('');const w=window.open();if(!w){toast('Allow pop-ups to preview');return;}w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(state.siteName)}</title><style>body{margin:0;font-family:Inter,system-ui,sans-serif;color:#171923}section,footer{padding:64px 8%;border-bottom:1px solid #eee}h1{font-size:60px;text-align:center}h2{text-align:center}p{line-height:1.7;color:#656b78;max-width:700px;margin:0 auto 22px}.hero{text-align:center}.button{display:inline-block;background:#171923;color:#fff;padding:12px 18px;border-radius:10px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{padding:20px;border:1px solid #e5e7ed;border-radius:14px}.quote{text-align:center;background:#fafaff}.newsletter{background:#171923;color:#fff;text-align:center}@media(max-width:700px){.cards{grid-template-columns:1fr}h1{font-size:40px}}</style></head><body>${sections}</body></html>`);w.document.close();});
  state.selected=state.sections[0].id; render();
})();

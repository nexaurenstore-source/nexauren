(() => {
  const stage = document.getElementById('stage') || document.querySelector('.dc-stage');
  const legacyEditor = document.getElementById('editor');
  const status = document.getElementById('status');
  if (!stage || !legacyEditor) return;

  const KEY = 'nexauren-document-creator-v2';
  const DEFAULT = '<h1>Your document title</h1><p>Start writing here. Add pages, blocks, tables, images, links and more.</p><h2>A more flexible document editor</h2><p>Build professional documents freely, then export the complete document to PDF.</p>';

  function makePage(content = DEFAULT) {
    const page = document.createElement('article');
    page.className = 'dc-page';
    page.dataset.page = String(stage.querySelectorAll('.dc-page').length + 1);
    page.innerHTML = '<header class="dc-header" contenteditable="true" hidden>Document header</header><div class="dc-editor" contenteditable="true" spellcheck="true"></div><footer class="dc-footer" contenteditable="true" hidden>Page footer</footer>';
    page.querySelector('.dc-editor').innerHTML = content;
    return page;
  }

  // Upgrade the original single-page markup into a real page system.
  if (!stage.querySelector('.dc-page')) {
    stage.innerHTML = '';
    stage.appendChild(makePage(legacyEditor.innerHTML || DEFAULT));
  } else {
    const old = stage.querySelector('#editor');
    if (old && !old.classList.contains('dc-editor')) {
      const wrap = document.createElement('div');
      wrap.className = 'dc-editor'; wrap.contentEditable = 'true'; wrap.spellcheck = true; wrap.innerHTML = old.innerHTML;
      old.replaceWith(wrap);
    }
  }

  const save = () => {
    const pages = [...stage.querySelectorAll('.dc-page')].map(p => ({
      html: p.querySelector('.dc-editor')?.innerHTML || '',
      header: p.querySelector('.dc-header')?.innerHTML || '',
      footer: p.querySelector('.dc-footer')?.innerHTML || '',
      margin: p.dataset.margin || 'normal'
    }));
    localStorage.setItem(KEY, JSON.stringify(pages));
    if (status) status.textContent = 'Saved locally · Just now';
  };

  const restore = () => {
    try {
      const pages = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!Array.isArray(pages) || !pages.length) return;
      stage.innerHTML = '';
      pages.forEach(item => {
        const page = makePage(item.html || DEFAULT);
        page.dataset.margin = item.margin || 'normal';
        page.querySelector('.dc-header').innerHTML = item.header || 'Document header';
        page.querySelector('.dc-footer').innerHTML = item.footer || 'Page footer';
        if (item.header) page.querySelector('.dc-header').hidden = false;
        if (item.footer) page.querySelector('.dc-footer').hidden = false;
        stage.appendChild(page);
      });
      renumber();
    } catch (_) {}
  };

  const focusEditor = () => document.activeElement?.closest('.dc-page')?.querySelector('.dc-editor') || stage.querySelector('.dc-editor');
  const exec = (cmd, value = null) => { const ed = focusEditor(); if (!ed) return; ed.focus(); document.execCommand(cmd, false, value); save(); };
  const renumber = () => [...stage.querySelectorAll('.dc-page')].forEach((p, i) => p.dataset.page = String(i + 1));

  restore();

  document.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => e.preventDefault());
    btn.addEventListener('click', () => exec(btn.dataset.cmd));
  });
  document.getElementById('blockFormat')?.addEventListener('change', e => exec('formatBlock', e.target.value));
  document.getElementById('fontSize')?.addEventListener('change', e => exec('fontSize', e.target.value));
  document.getElementById('undoBtn')?.addEventListener('click', () => exec('undo'));
  document.getElementById('redoBtn')?.addEventListener('click', () => exec('redo'));

  document.getElementById('linkBtn')?.addEventListener('click', () => {
    const url = prompt('Enter the link URL:');
    if (url) exec('createLink', /^https?:\/\//i.test(url) ? url : `https://${url}`);
  });
  document.getElementById('hrBtn')?.addEventListener('click', () => exec('insertHorizontalRule'));

  document.getElementById('imageBtn')?.addEventListener('click', () => document.getElementById('imageInput')?.click());
  document.getElementById('imageInput')?.addEventListener('change', e => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { exec('insertImage', reader.result); const img = focusEditor()?.querySelector('img:last-of-type'); if (img) img.classList.add('dc-image'); save(); };
    reader.readAsDataURL(file); e.target.value = '';
  });

  document.getElementById('tableBtn')?.addEventListener('click', () => {
    const rows = Math.max(1, Math.min(12, Number(prompt('Rows?', '3')) || 3));
    const cols = Math.max(1, Math.min(8, Number(prompt('Columns?', '3')) || 3));
    let html = '<table class="dc-table"><tbody>';
    for (let r = 0; r < rows; r++) { html += '<tr>'; for (let c = 0; c < cols; c++) html += `<td>${r === 0 ? 'Header' : 'Cell'}</td>`; html += '</tr>'; }
    html += '</tbody></table><p><br></p>';
    exec('insertHTML', html);
  });

  document.getElementById('addPageBtn')?.addEventListener('click', () => { stage.appendChild(makePage('<h2>New page</h2><p>Continue writing here...</p>')); renumber(); save(); stage.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' }); stage.lastElementChild.querySelector('.dc-editor').focus(); });
  document.getElementById('removePageBtn')?.addEventListener('click', () => { const pages = stage.querySelectorAll('.dc-page'); if (pages.length === 1) return; pages[pages.length - 1].remove(); renumber(); save(); });

  document.getElementById('marginSelect')?.addEventListener('change', e => { const page = document.activeElement?.closest('.dc-page') || stage.querySelector('.dc-page'); page.dataset.margin = e.target.value; page.style.setProperty('--dc-margin', e.target.value === 'small' ? '42px' : e.target.value === 'large' ? '104px' : '76px'); save(); });
  const togglePart = (selector, label) => { const page = document.activeElement?.closest('.dc-page') || stage.querySelector('.dc-page'); const el = page.querySelector(selector); el.hidden = !el.hidden; if (!el.hidden) el.focus(); save(); };
  document.getElementById('headerBtn')?.addEventListener('click', () => togglePart('.dc-header', 'Header'));
  document.getElementById('footerBtn')?.addEventListener('click', () => togglePart('.dc-footer', 'Footer'));

  document.getElementById('templatesBtn')?.addEventListener('click', () => { location.href = '/studios/document/templates/'; });
  document.querySelectorAll('.dc-editor,.dc-header,.dc-footer').forEach(el => el.addEventListener('input', save));
  stage.addEventListener('click', e => { const img = e.target.closest('.dc-image'); if (!img) return; document.querySelectorAll('.dc-image.selected').forEach(x => x.classList.remove('selected')); img.classList.add('selected'); });

  document.getElementById('newBtn')?.addEventListener('click', () => {
    if (!confirm('Start a new document? Your current local document will be replaced.')) return;
    localStorage.removeItem(KEY); stage.innerHTML = ''; stage.appendChild(makePage(DEFAULT)); renumber(); save();
  });

  document.getElementById('exportBtn')?.addEventListener('click', () => {
    save();
    const pages = [...stage.querySelectorAll('.dc-page')].map(p => p.outerHTML).join('');
    const title = (stage.querySelector('h1')?.textContent || 'Nexauren Document').trim().replace(/[<>]/g, '').slice(0, 100) || 'Nexauren Document';
    const win = window.open('', '_blank');
    if (!win) { if (status) status.textContent = 'Allow pop-ups to export the document.'; return; }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Georgia,"Times New Roman",serif;color:#172033;background:#fff}.dc-page{width:210mm;min-height:297mm;padding:76px;margin:0 auto;page-break-after:always}.dc-page:last-child{page-break-after:auto}.dc-header,.dc-footer{font:12px Arial,sans-serif;color:#667085;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:24px}.dc-footer{border-top:1px solid #ddd;border-bottom:0;padding-top:10px;margin:24px 0 0}.dc-editor{min-height:900px;outline:none;font-size:12pt;line-height:1.7}.dc-editor h1,.dc-editor h2,.dc-editor h3{font-family:Arial,sans-serif;line-height:1.2;color:#151b2b}.dc-editor img{max-width:100%;height:auto}.dc-table{width:100%;border-collapse:collapse;margin:18px 0}.dc-table td{border:1px solid #cfd5df;padding:9px}.dc-table tr:first-child td{font-weight:700;background:#f2f4f8}</style></head><body>${pages}</body></html>`);
    win.document.close(); win.focus(); setTimeout(() => win.print(), 350);
  });
})();
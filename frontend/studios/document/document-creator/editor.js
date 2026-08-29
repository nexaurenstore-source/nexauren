(() => {
  const editor = document.getElementById('editor');
  const status = document.getElementById('status');
  const imageInput = document.getElementById('imageInput');
  const imageBtn = document.getElementById('imageBtn');
  const exportBtn = document.getElementById('exportBtn');
  const newBtn = document.getElementById('newBtn');
  const key = 'nexauren-document-creator-v1';
  if (!editor) return;

  const save = () => {
    localStorage.setItem(key, editor.innerHTML);
    status.textContent = 'Saved locally · Just now';
  };
  const saved = localStorage.getItem(key);
  if (saved) editor.innerHTML = saved;

  document.querySelectorAll('[data-cmd]').forEach(button => {
    button.addEventListener('mousedown', e => e.preventDefault());
    button.addEventListener('click', () => {
      editor.focus();
      document.execCommand(button.dataset.cmd, false);
      save();
    });
  });

  document.getElementById('blockFormat')?.addEventListener('change', e => {
    editor.focus();
    document.execCommand('formatBlock', false, e.target.value);
    save();
  });

  document.getElementById('fontSize')?.addEventListener('change', e => {
    editor.focus();
    document.execCommand('fontSize', false, e.target.value);
    save();
  });

  imageBtn?.addEventListener('click', () => imageInput?.click());
  imageInput?.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor.focus();
      document.execCommand('insertImage', false, reader.result);
      save();
    };
    reader.readAsDataURL(file);
    imageInput.value = '';
  });

  editor.addEventListener('input', save);
  editor.addEventListener('paste', () => setTimeout(save, 0));

  newBtn?.addEventListener('click', () => {
    if (!confirm('Start a new document? Your current local document will be replaced.')) return;
    localStorage.removeItem(key);
    editor.innerHTML = '<h1>Untitled document</h1><p>Start writing here...</p>';
    save();
    editor.focus();
  });

  exportBtn?.addEventListener('click', () => {
    save();
    const title = (editor.querySelector('h1')?.textContent || 'Nexauren Document').trim();
    const win = window.open('', '_blank');
    if (!win) {
      status.textContent = 'Allow pop-ups to export the document.';
      return;
    }
    const safeTitle = title.replace(/[<>]/g, '').slice(0, 100) || 'Nexauren Document';
    win.document.write(`<!doctype html><html><head><title>${safeTitle}</title><style>@page{size:A4;margin:20mm}body{font-family:Georgia,"Times New Roman",serif;color:#171a21;font-size:12pt;line-height:1.7}h1,h2,h3{font-family:Arial,sans-serif;line-height:1.2}img{max-width:100%;height:auto}ul,ol{padding-left:28px}</style></head><body>${editor.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  });
})();
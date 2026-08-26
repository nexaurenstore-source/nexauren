(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const table = $('sheet'), thead = table?.querySelector('thead'), tbody = table?.querySelector('tbody');
  if (!table || !thead || !tbody) return;

  const STORE = 'nexauren-spreadsheet-v3';
  let rows = 20, cols = 8, activeSheet = 0, history = [], future = [], selected = null, sortColumn = 0, filterText = '';
  let project = loadStored() || { sheets: [{ name: 'Sheet 1', data: [] }] };
  if (!Array.isArray(project.sheets) || !project.sheets.length) project.sheets = [{ name: 'Sheet 1', data: [] }];
  let sheets = project.sheets;

  function loadStored() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; } }
  function snapshot() { return JSON.stringify({ sheets, rows, cols, activeSheet }); }
  function save() { localStorage.setItem(STORE, snapshot()); if ($('status')) $('status').textContent = 'Saved locally'; }
  function remember() { history.push(snapshot()); if (history.length > 50) history.shift(); future = []; }
  function restore(serialized, saveAfter = true) {
    try { const p = JSON.parse(serialized); sheets = p.sheets; rows = p.rows; cols = p.cols; activeSheet = Math.max(0, Math.min(p.activeSheet || 0, sheets.length - 1)); render(); if (saveAfter) save(); } catch {}
  }
  function colName(n) { let s = ''; do { s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; }
  function current() { return sheets[activeSheet]; }
  function ensureData() { const d = current().data || (current().data = []); while (d.length < rows) d.push([]); for (const r of d) while (r.length < cols) r.push(''); return d; }
  function cell(r, c) { return tbody.rows[r]?.cells[c + 1]; }
  function rawData() { return ensureData().slice(0, rows).map(r => r.slice(0, cols)); }
  function renderTabs() {
    const tabs = $('tabs'); if (!tabs) return;
    tabs.innerHTML = '';
    sheets.forEach((s, i) => { const b = document.createElement('button'); b.className = i === activeSheet ? 'active' : ''; b.textContent = s.name; b.title = 'Double-click to rename'; b.onclick = () => { current().data = rawData(); activeSheet = i; render(); save(); }; b.ondblclick = () => { const n = prompt('Rename sheet', s.name); if (n?.trim()) { remember(); s.name = n.trim(); renderTabs(); save(); } }; tabs.appendChild(b); });
    const add = document.createElement('button'); add.textContent = '+ Sheet'; add.onclick = () => { remember(); current().data = rawData(); sheets.push({ name: `Sheet ${sheets.length + 1}`, data: [] }); activeSheet = sheets.length - 1; render(); save(); }; tabs.appendChild(add);
  }
  function render() {
    const d = ensureData();
    thead.innerHTML = '<tr><th>#</th>' + Array.from({ length: cols }, (_, c) => `<th data-c="${c}">${colName(c)}</th>`).join('') + '</tr>';
    tbody.innerHTML = '';
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement('tr'); const n = document.createElement('td'); n.textContent = r + 1; tr.appendChild(n);
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td'); td.contentEditable = 'true'; td.spellcheck = false; td.dataset.r = r; td.dataset.c = c;
        td.textContent = d[r][c] ?? '';
        td.addEventListener('focus', () => { selected = td; updateFormula(); });
        td.addEventListener('input', () => { d[r][c] = td.textContent; save(); recalc(); });
        td.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const ntd = cell(r + 1, c); if (ntd) ntd.focus(); } });
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    renderTabs(); recalc(); applyFilter(); updateFormula();
  }
  function updateFormula() { const name = $('cellName'), input = $('formulaInput'); if (!selected) return; const r = +selected.dataset.r, c = +selected.dataset.c; if (name) name.textContent = `${colName(c)}${r + 1}`; if (input) input.value = current().data?.[r]?.[c] ?? ''; }
  function focusCell(r, c) { const td = cell(r, c); if (td) { td.focus(); selected = td; updateFormula(); } }
  function parseRef(s) { const m = String(s).trim().toUpperCase().match(/^([A-Z]+)(\d+)$/); if (!m) return null; let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; return { r: +m[2] - 1, c: c - 1 }; }
  function valueAt(r, c, seen = new Set()) { const v = current().data?.[r]?.[c] ?? ''; if (typeof v !== 'string' || !v.startsWith('=')) return Number(v) || 0; const id = `${r}:${c}`; if (seen.has(id)) return NaN; seen.add(id); return formula(v.slice(1), seen); }
  function values(expr, seen) {
    return expr.split(',').flatMap(part => { const p = part.trim(), range = p.match(/^([A-Z]+\d+):([A-Z]+\d+)$/); if (range) { const a = parseRef(range[1]), b = parseRef(range[2]); if (!a || !b) return []; const out = []; for (let r = Math.min(a.r,b.r); r <= Math.max(a.r,b.r); r++) for (let c = Math.min(a.c,b.c); c <= Math.max(a.c,b.c); c++) out.push(valueAt(r,c, new Set(seen))); return out; } const ref = parseRef(p); return ref ? [valueAt(ref.r, ref.c, new Set(seen))] : [Number(p)]; });
  }
  function formula(expr, seen = new Set()) {
    const f = expr.trim();
    const fn = f.match(/^([A-Z]+)\((.*)\)$/i);
    if (fn) {
      const name = fn[1].toUpperCase(), args = values(fn[2], seen).filter(Number.isFinite);
      if (name === 'SUM') return args.reduce((a,b)=>a+b,0);
      if (name === 'AVERAGE') return args.length ? args.reduce((a,b)=>a+b,0)/args.length : 0;
      if (name === 'MIN') return args.length ? Math.min(...args) : 0;
      if (name === 'MAX') return args.length ? Math.max(...args) : 0;
      if (name === 'COUNT') return args.length;
      if (name === 'IF') { const parts = fn[2].split(','); return Number(formula(parts[0], seen) || 0) ? (parts[1] || '') : (parts[2] || ''); }
    }
    const replaced = f.replace(/([A-Z]+\d+)/gi, ref => { const p = parseRef(ref); return p ? String(valueAt(p.r,p.c,seen)) : '0'; });
    if (!/^[0-9+\-*/().%\s]+$/.test(replaced)) return '#ERROR!';
    try { return Function(`"use strict";return (${replaced})`)(); } catch { return '#ERROR!'; }
  }
  function recalc() {
    tbody.querySelectorAll('td[contenteditable="true"]').forEach(td => { const v = td.textContent.trim(); if (v.startsWith('=')) td.title = `Result: ${formula(v.slice(1))}`; });
  }
  function format(command, value) { if (!selected) return; selected.focus(); document.execCommand(command, false, value); current().data[+selected.dataset.r][+selected.dataset.c] = selected.innerHTML; save(); }
  function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function exportCSV() { const data = rawData(); const csv = data.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'); download(`${current().name}.csv`, new Blob([csv], { type:'text/csv;charset=utf-8' })); }
  function importCSV(file) { const reader = new FileReader(); reader.onload = () => { remember(); const lines = String(reader.result).split(/\r?\n/).filter(Boolean); const data = lines.map(line => { const out=[]; let cur='', q=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"' && line[i+1]==='"'){cur+='"';i++;} else if(ch==='"') q=!q; else if(ch===','&&!q){out.push(cur);cur='';} else cur+=ch;} out.push(cur); return out; }); cols = Math.max(1, ...data.map(r=>r.length)); rows = Math.max(20, data.length); current().data = data; render(); save(); }; reader.readAsText(file); }
  function exportProject() { download('nexauren-spreadsheet.nexa', new Blob([snapshot()], { type:'application/json' })); }
  function importProject(file) { const reader = new FileReader(); reader.onload = () => { remember(); restore(reader.result); }; reader.readAsText(file); }
  function applyFilter() { const q = filterText.toLowerCase(); [...tbody.rows].forEach(tr => { tr.style.display = !q || [...tr.cells].slice(1).some(td => td.textContent.toLowerCase().includes(q)) ? '' : 'none'; }); }
  function sortData() { remember(); const d = rawData(); d.sort((a,b) => String(a[sortColumn]??'').localeCompare(String(b[sortColumn]??''), undefined, {numeric:true,sensitivity:'base'})); current().data = d; render(); save(); }
  function reset() { if (!confirm('Reset this spreadsheet?')) return; remember(); sheets=[{name:'Sheet 1',data:[]}]; rows=20; cols=8; activeSheet=0; render(); save(); }
  function removeRow() { if (!selected || rows <= 1) return; remember(); const r=+selected.dataset.r; current().data.splice(r,1); rows--; render(); save(); }
  function removeCol() { if (!selected || cols <= 1) return; remember(); const c=+selected.dataset.c; current().data.forEach(r=>r.splice(c,1)); cols--; render(); save(); }
  function merge() { if (!selected) return; const r=+selected.dataset.r,c=+selected.dataset.c; const right=cell(r,c+1); if (!right) return; remember(); selected.colSpan = 2; selected.textContent = `${selected.textContent} ${right.textContent}`.trim(); right.remove(); save(); }

  $('newBtn')?.addEventListener('click',()=>{remember();sheets=[{name:'Sheet 1',data:[]}];rows=20;cols=8;activeSheet=0;render();save();});
  $('undoBtn')?.addEventListener('click',()=>{if(history.length){future.push(snapshot());restore(history.pop());}});
  $('redoBtn')?.addEventListener('click',()=>{if(future.length){history.push(snapshot());restore(future.pop());}});
  $('addRowBtn')?.addEventListener('click',()=>{remember();rows++;ensureData().push(Array(cols).fill(''));render();save();});
  $('addColBtn')?.addEventListener('click',()=>{remember();cols++;ensureData().forEach(r=>r.push(''));render();save();});
  $('delRowBtn')?.addEventListener('click',removeRow); $('delColBtn')?.addEventListener('click',removeCol); $('mergeBtn')?.addEventListener('click',merge);
  $('downloadBtn')?.addEventListener('click',exportCSV); $('exportCsvBtn')?.addEventListener('click',exportCSV);
  $('importCsvBtn')?.addEventListener('click',()=>$('csvInput')?.click()); $('csvInput')?.addEventListener('change',e=>{if(e.target.files[0])importCSV(e.target.files[0]);e.target.value='';});
  $('saveProjectBtn')?.addEventListener('click',exportProject); $('loadProjectBtn')?.addEventListener('click',()=>$('projectInput')?.click()); $('projectInput')?.addEventListener('change',e=>{if(e.target.files[0])importProject(e.target.files[0]);e.target.value='';});
  $('resetBtn')?.addEventListener('click',reset); $('sortBtn')?.addEventListener('click',sortData); $('filterBtn')?.addEventListener('click',()=>{filterText=$('search')?.value||'';applyFilter();}); $('search')?.addEventListener('input',()=>{filterText=$('search').value;applyFilter();});
  $('formulaInput')?.addEventListener('change',()=>{if(!selected)return;remember();const r=+selected.dataset.r,c=+selected.dataset.c;current().data[r][c]=$('formulaInput').value;render();save();focusCell(r,c);});
  $('align')?.addEventListener('change',e=>{if(selected){selected.style.textAlign=e.target.value;save();}}); $('bgColor')?.addEventListener('input',e=>{if(selected){selected.style.background=e.target.value;save();}}); $('borderBtn')?.addEventListener('click',()=>{if(selected){selected.style.border='1px solid #888';save();}});
  $('numberFormat')?.addEventListener('change',e=>{if(!selected)return;const v=Number(selected.textContent);if(!Number.isFinite(v))return;if(e.target.value==='currency')selected.textContent=new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(v);else if(e.target.value==='percent')selected.textContent=(v*100).toFixed(2)+'%';else if(e.target.value==='number')selected.textContent=v.toLocaleString();current().data[+selected.dataset.r][+selected.dataset.c]=selected.textContent;save();});
  document.querySelectorAll('[data-format]').forEach(b=>b.addEventListener('click',()=>format(b.dataset.format)));
  $('chartBtn')?.addEventListener('click',()=>{const w=window.open('','_blank','width=700,height=500');if(!w)return;const d=rawData().filter(r=>r[0]!==''||r[1]!=='').slice(0,20);w.document.write(`<title>Spreadsheet Chart</title><canvas id="c" width="650" height="420"></canvas><script>const d=${JSON.stringify(d)};const c=document.getElementById('c'),x=c.getContext('2d');const max=Math.max(1,...d.map(r=>Number(r[1])||0));d.forEach((r,i)=>{const h=((Number(r[1])||0)/max)*330;x.fillRect(40+i*30,370-h,20,h);x.fillText(String(r[0]).slice(0,8),35+i*30,395);});x.beginPath();x.moveTo(30,370);x.lineTo(640,370);x.stroke();<\/script>`);w.document.close();});
  window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$('undoBtn')?.click();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();$('redoBtn')?.click();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();$('search')?.focus();}});
  window.addEventListener('beforeunload',()=>{current().data=rawData();save();});
  render(); save();
})();

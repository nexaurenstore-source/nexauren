(()=>{
const T={
 text:['Text','T','Content'],image:['Image','I','Content'],imageText:['Image + Text','I','Content'],list:['Basic List','☷','Content'],slider:['Slider List','↔','Content'],slideshow:['Slideshow','▣','Media'],gallery:['Gallery','▦','Media'],video:['Video','▶','Media'],product:['Featured Product','$','Commerce'],products:['Products','P','Commerce'],testimonial:['Testimonial','“','Social'],newsletter:['Newsletter','✉','Marketing'],contact:['Contact','@','Contact'],faq:['FAQ','?','Content'],footer:['Footer','F','Layout']
};
const D={
 text:{title:'Your title',body:'Add your content here.',button:'',link:''},
 image:{image:'',alt:'Image',caption:''},
 imageText:{title:'Your title',body:'Add your content here.',image:'',button:'',link:''},
 list:{title:'Features',items:['First item','Second item','Third item'],layout:'three'},
 slider:{title:'Highlights',items:['First item','Second item','Third item']},
 slideshow:{title:'Gallery',items:['Slide 1','Slide 2','Slide 3']},
 gallery:{title:'Gallery',items:['Photo 1','Photo 2','Photo 3']},
 video:{title:'Video',url:''},
 product:{title:'Featured product',name:'Your product',price:'$10',image:'',button:'View product',link:''},
 products:{title:'Products',items:['Product One','Product Two','Product Three'],prices:['$10','$20','$30'],links:['#','#','#']},
 testimonial:{quote:'A great experience.',author:'Customer'},
 newsletter:{title:'Join our newsletter',body:'Get updates from us.',button:'Subscribe',action:'#'},
 contact:{title:'Contact us',body:'We would love to hear from you.',email:'hello@example.com'},
 faq:{title:'FAQ',items:['Question one?','Question two?','Question three?']},
 footer:{text:'© 2026 My Website'}
};
const cp=x=>JSON.parse(JSON.stringify(x));
const mk=t=>({id:crypto.randomUUID(),type:t,data:cp(D[t])});
const S={pages:[{id:crypto.randomUUID(),name:'Home',slug:'/',sections:[mk('text'),mk('imageText'),mk('list'),mk('footer')]}],page:0,sel:null,device:'desktop'};
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
function cur(){return S.pages[S.page]}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),1800)}
function setDevice(d){S.device=d;document.querySelectorAll('[data-device]').forEach(x=>x.classList.toggle('active',x.dataset.device===d));$('canvas').className='canvas '+d}
function render(){
 const p=cur();
 $('pagePicker').innerHTML=S.pages.map((x,i)=>`<option value="${i}">${esc(x.name)}</option>`).join('');$('pagePicker').value=S.page;
 $('pageList').innerHTML=S.pages.map((x,i)=>`<div class="page-item ${i===S.page?'active':''}"><button data-p="${i}">${esc(x.name)}</button><button class="page-more" data-page-menu="${i}" aria-label="Page options">⋯</button></div>`).join('');
 $('sectionList').innerHTML=p.sections.length?p.sections.map((s,i)=>`<div class="section-row ${s.id===S.sel?'selected':''}"><button class="section-main" data-s="${s.id}"><span class="section-icon">${T[s.type][1]}</span><span class="section-title">${T[s.type][0]}</span></button><div class="section-actions"><button class="mini" data-u="${s.id}" ${i===0?'disabled':''}>↑</button><button class="mini" data-d="${s.id}" ${i===p.sections.length-1?'disabled':''}>↓</button><button class="mini danger" data-x="${s.id}">×</button></div></div>`).join(''):'<div class="empty">No sections yet.<br>Add your first section.</div>';
 $('canvas').innerHTML=p.sections.length?p.sections.map(section).join(''):'<div class="empty">This page is empty. Click “Add section” to start.</div>';
 setDevice(S.device);properties();
}
function imageOrPlaceholder(src,label='Image'){return src?`<img src="${attr(src)}" alt="${attr(label)}">`:`<div class="fake-image">${esc(label)}</div>`}
function btn(text,link){return text?`<a class="button" href="${attr(link||'#')}" target="_blank" rel="noopener">${esc(text)}</a>`:''}
function section(s){
 const d=s.data, c=`site-section ${s.id===S.sel?'active':''}`;
 if(s.type==='text')return`<section class="${c}" data-s="${s.id}"><h2>${esc(d.title)}</h2><p>${esc(d.body)}</p>${btn(d.button,d.link)}</section>`;
 if(s.type==='image')return`<section class="${c} image-only" data-s="${s.id}">${imageOrPlaceholder(d.image,d.alt||'Image')}${d.caption?`<p class="caption">${esc(d.caption)}</p>`:''}</section>`;
 if(s.type==='imageText')return`<section class="${c} image-text" data-s="${s.id}">${imageOrPlaceholder(d.image,'Image')}<div><h2>${esc(d.title)}</h2><p>${esc(d.body)}</p>${btn(d.button,d.link)}</div></section>`;
 if(['list','slider'].includes(s.type))return`<section class="${c}" data-s="${s.id}"><h2>${esc(d.title)}</h2><div class="cards ${d.layout==='two'?'two':''}">${d.items.map(x=>`<div class="card"><b>${esc(x)}</b><span>Describe this item.</span></div>`).join('')}</div></section>`;
 if(['gallery','slideshow'].includes(s.type))return`<section class="${c}" data-s="${s.id}"><h2>${esc(d.title)}</h2><div class="gallery">${d.items.map(x=>`<div class="gallery-item">${esc(x)}</div>`).join('')}</div></section>`;
 if(s.type==='video')return`<section class="${c}" data-s="${s.id}"><h2>${esc(d.title)}</h2>${videoEmbed(d.url)}</section>`;
 if(s.type==='product')return`<section class="${c}" data-s="${s.id}"><h2>${esc(d.title)}</h2><div class="product">${imageOrPlaceholder(d.image,d.name)}<div><b>${esc(d.name)}</b><p>${esc(d.price)}</p>${btn(d.button,d.link)}</div></div></section>`;
 if(s.type==='products')return`<section class="${c}" data-s="${s.id}"><h2>${esc(d.title)}</h2><div class="products">${d.items.map((x,i)=>`<div class="product"><b>${esc(x)}</b><p>${esc(d.prices[i]||'')}</p>${btn('View product',d.links[i])}</div>`).join('')}</div></section>`;
 if(s.type==='testimonial')return`<section class="${c} quote" data-s="${s.id}"><blockquote>“${esc(d.quote)}”</blockquote><b>${esc(d.author)}</b></section>`;
 if(s.type==='newsletter')return`<section class="${c} newsletter" data-s="${s.id}"><h2>${esc(d.title)}</h2><p>${esc(d.body)}</p>${btn(d.button,d.action)}</section>`;
 if(s.type==='contact')return`<section class="${c}" data-s="${s.id}"><h2>${esc(d.title)}</h2><p>${esc(d.body)}</p><a href="mailto:${attr(d.email)}"><b>${esc(d.email)}</b></a></section>`;
 if(s.type==='faq')return`<section class="${c}" data-s="${s.id}"><h2>${esc(d.title)}</h2>${d.items.map(x=>`<details class="faq-item"><summary>${esc(x)} <span>+</span></summary><p>Add your answer here.</p></details>`).join('')}</section>`;
 return`<footer class="${c} site-footer" data-s="${s.id}">${esc(d.text)}</footer>`;
}
function videoEmbed(url){const u=String(url||'').trim();if(!u)return'<div class="fake-image">Paste a YouTube or Vimeo URL</div>';let id='';const yt=u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/);const vm=u.match(/vimeo\.com\/(\d+)/);if(yt)id=`https://www.youtube.com/embed/${yt[1]}`;else if(vm)id=`https://player.vimeo.com/video/${vm[1]}`;return id?`<div class="video-frame"><iframe src="${attr(id)}" title="Video" loading="lazy" allowfullscreen></iframe></div>`:`<div class="fake-image">Use a valid YouTube or Vimeo URL</div>`}
function field(label,key,value,type='text'){if(type==='textarea')return`<div class="field"><label>${esc(label)}</label><textarea data-f="${esc(key)}">${esc(value)}</textarea></div>`;if(type==='select')return`<div class="field"><label>${esc(label)}</label><select data-f="${esc(key)}"><option value="three" ${value==='three'?'selected':''}>Three in a row</option><option value="two" ${value==='two'?'selected':''}>Two in a row</option><option value="text" ${value==='text'?'selected':''}>Text list</option></select></div>`;if(type==='file')return`<div class="field"><label>${esc(label)}</label><input type="file" accept="image/*" data-file="${esc(key)}">${value?'<small class="file-note">Image loaded in this browser session.</small>':''}</div>`;return`<div class="field"><label>${esc(label)}</label><input data-f="${esc(key)}" value="${esc(value)}"></div>`}
function arrayFields(label,key,arr){let h=`<div class="array-head"><label>${esc(label)}</label><button class="small-add" data-array-add="${esc(key)}">＋ Add item</button></div>`;return h+arr.map((v,i)=>`<div class="array-row"><input data-f="${esc(key)}.${i}" value="${esc(v)}"><button class="mini danger" data-array-del="${esc(key)}.${i}">×</button></div>`).join('')}
function properties(){
 const s=cur().sections.find(x=>x.id===S.sel);if(!s){$('properties').innerHTML='<h2>Properties</h2><div class="notice">Select a section to edit it. Your builder data is only held in memory and is not saved to Nexauren servers.</div>';return}
 const d=s.data;let h=`<h2>Editing</h2><p class="property-title">${esc(T[s.type][0])}</p><p class="property-sub">Edit the section fields. Changes appear instantly in the preview.</p>`;
 if(s.type==='image')h+=field('Image file','image',d.image,'file')+field('Image URL (optional)','image',d.image)+field('Alt text','alt',d.alt)+field('Caption','caption',d.caption);
 else if(s.type==='imageText')h+=field('Title','title',d.title)+field('Text','body',d.body,'textarea')+field('Image file','image',d.image,'file')+field('Image URL','image',d.image)+field('Button text','button',d.button)+field('Button link','link',d.link);
 else if(s.type==='text')h+=field('Heading','title',d.title)+field('Text','body',d.body,'textarea')+field('Button text','button',d.button)+field('Button link','link',d.link);
 else if(s.type==='video')h+=field('Title','title',d.title)+field('YouTube or Vimeo URL','url',d.url);
 else if(s.type==='product')h+=field('Heading','title',d.title)+field('Product name','name',d.name)+field('Price','price',d.price)+field('Image file','image',d.image,'file')+field('Image URL','image',d.image)+field('Button text','button',d.button)+field('Product link','link',d.link);
 else if(s.type==='products')h+=field('Heading','title',d.title)+arrayFields('Product names','items',d.items)+arrayFields('Prices','prices',d.prices)+arrayFields('Links','links',d.links);
 else if(s.type==='newsletter')h+=field('Heading','title',d.title)+field('Text','body',d.body,'textarea')+field('Button','button',d.button)+field('Form/action URL','action',d.action);
 else if(s.type==='contact')h+=field('Heading','title',d.title)+field('Text','body',d.body,'textarea')+field('Email','email',d.email);
 else if(s.type==='testimonial')h+=field('Quote','quote',d.quote,'textarea')+field('Author','author',d.author);
 else if(s.type==='faq')h+=field('Heading','title',d.title)+arrayFields('Questions','items',d.items);
 else if(s.type==='footer')h+=field('Footer text','text',d.text,'textarea');
 else {h+=field('Heading','title',d.title);if(d.layout)h+=field('Layout','layout',d.layout,'select');h+=arrayFields('Items','items',d.items)}
 h+=`<hr><button class="delete-section" data-delete-selected>Delete section</button>`;$('properties').innerHTML=h;
}
function modal(){
 const groups={Content:[],Media:[],Commerce:[],Marketing:[],Social:[],Contact:[],Layout:[]};Object.keys(T).forEach(k=>groups[T[k][2]].push(k));
 $('sectionOptions').innerHTML=Object.entries(groups).map(([g,items])=>`<div class="option-group"><h4>${g}</h4><div class="options-grid">${items.map(k=>`<button class="option" data-add="${k}"><b>${T[k][1]} · ${T[k][0]}</b><span>Click to add</span></button>`).join('')}</div></div>`).join('');$('sectionModal').classList.add('open')
}
function close(id){$(id).classList.remove('open')}
function pageSettings(i){const p=S.pages[i];$('pageName').value=p.name;$('pageSlug').value=p.slug||'/';$('pageSettingsModal').dataset.page=i;$('pageSettingsModal').classList.add('open')}
function pageDuplicate(i){const p=cp(S.pages[i]);p.id=crypto.randomUUID();p.name=p.name+' Copy';p.slug=(p.slug||'/')==='/'?'/copy':(p.slug||'/')+'-copy';p.sections.forEach(s=>s.id=crypto.randomUUID());S.pages.splice(i+1,0,p);S.page=i+1;S.sel=null;render();toast('Page duplicated')}
function pageDelete(i){if(S.pages.length===1){toast('Keep at least one page');return}if(!confirm(`Delete “${S.pages[i].name}”?`))return;S.pages.splice(i,1);S.page=Math.max(0,Math.min(S.page,S.pages.length-1));S.sel=null;render();toast('Page deleted')}
function exportHtml(){const p=cur();const body=p.sections.map(section).join('');const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.name)}</title><style>${exportCss()}</style></head><body><main class="site">${body}</main></body></html>`;const blob=new Blob([html],{type:'text/html'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(p.slug||p.name||'page').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'')+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('HTML exported')}
function exportCss(){return`*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:#171923;background:#fff}.site{max-width:1100px;margin:auto}.site-section{padding:58px 8%;border-bottom:1px solid #edf0f4}.site-section h2{font-size:32px;margin:0 0 14px}.site-section p{line-height:1.65;color:#656b78}.image-only img,.image-text img{width:100%;max-height:520px;object-fit:cover;border-radius:15px}.image-text{display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:center}.fake-image{min-height:190px;border-radius:15px;background:#eef0f5;display:grid;place-items:center;color:#777}.button{display:inline-flex;background:#171923;color:#fff;padding:11px 17px;border-radius:9px;font-weight:750;text-decoration:none}.cards,.products,.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card,.product{padding:19px;border:1px solid #e3e6ed;border-radius:13px}.card span{display:block;color:#656b78;margin-top:6px}.product img{width:100%;max-height:260px;object-fit:cover;border-radius:10px;margin-bottom:12px}.gallery-item{min-height:190px;border-radius:15px;background:#eef0f5;display:grid;place-items:center;color:#777}.quote{text-align:center;background:#fafaff}.quote blockquote{font-size:25px;line-height:1.4;max-width:700px;margin:0 auto 12px}.newsletter{background:#171923;color:#fff;margin:28px 8%;border-radius:18px}.newsletter p{color:#c7cad2}.faq-item{padding:15px 0;border-bottom:1px solid #e3e6ed}.faq-item summary{font-weight:700;cursor:pointer}.site-footer{padding:34px 8%;color:#737887}@media(max-width:700px){.image-text,.cards,.products,.gallery{grid-template-columns:1fr}.newsletter{margin:15px}}`}

document.addEventListener('click',e=>{
 let b=e.target.closest('[data-p]');if(b){S.page=+b.dataset.p;S.sel=null;render();return}
 b=e.target.closest('[data-page-menu]');if(b){pageSettings(+b.dataset.pageMenu);return}
 b=e.target.closest('[data-s]');if(b){S.sel=b.dataset.s;render();return}
 b=e.target.closest('[data-add]');if(b){const p=cur(),s=mk(b.dataset.add),i=p.sections.findIndex(x=>x.type==='footer');p.sections.splice(i<0?p.sections.length:i,0,s);S.sel=s.id;close('sectionModal');render();return}
 b=e.target.closest('[data-u]');if(b&&!b.disabled){const p=cur(),i=p.sections.findIndex(x=>x.id===b.dataset.u);if(i>0)[p.sections[i-1],p.sections[i]]=[p.sections[i],p.sections[i-1]];render();return}
 b=e.target.closest('[data-d]');if(b&&!b.disabled){const p=cur(),i=p.sections.findIndex(x=>x.id===b.dataset.d);if(i<p.sections.length-1)[p.sections[i+1],p.sections[i]]=[p.sections[i],p.sections[i+1]];render();return}
 b=e.target.closest('[data-x]');if(b){cur().sections=cur().sections.filter(x=>x.id!==b.dataset.x);S.sel=null;render();return}
 b=e.target.closest('[data-array-add]');if(b){const [r]=b.dataset.arrayAdd.split('.'),s=cur().sections.find(x=>x.id===S.sel);if(Array.isArray(s.data[r]))s.data[r].push('New item');render();return}
 b=e.target.closest('[data-array-del]');if(b){const [r,i]=b.dataset.arrayDel.split('.'),s=cur().sections.find(x=>x.id===S.sel);if(s.data[r]?.length>1)s.data[r].splice(+i,1);render();return}
 if(e.target.closest('#addSectionBtn'))modal();
 if(e.target.closest('#closeSectionModal'))close('sectionModal');
 if(e.target.closest('#addPageBtn')){$('pageModal').classList.add('open');$('newPageName').focus()}
 if(e.target.closest('#closePageModal'))close('pageModal');
 if(e.target.closest('#createPage')){const n=$('newPageName').value.trim()||'New Page';S.pages.push({id:crypto.randomUUID(),name:n,slug:'/'+n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),sections:[mk('text'),mk('footer')]});S.page=S.pages.length-1;S.sel=null;$('newPageName').value='';close('pageModal');render();toast('Page created');return}
 if(e.target.closest('#closePageSettings'))close('pageSettingsModal');
 if(e.target.closest('#savePageSettings')){const i=+$('pageSettingsModal').dataset.page;S.pages[i].name=$('pageName').value.trim()||'Untitled page';S.pages[i].slug=$('pageSlug').value.trim()||'/';close('pageSettingsModal');render();toast('Page settings updated');return}
 if(e.target.closest('#duplicatePage')){pageDuplicate(+$('pageSettingsModal').dataset.page);close('pageSettingsModal');return}
 if(e.target.closest('#deletePage')){const i=+$('pageSettingsModal').dataset.page;close('pageSettingsModal');pageDelete(i);return}
 if(e.target.closest('[data-device]')){setDevice(e.target.closest('[data-device]').dataset.device);return}
 if(e.target.closest('#previewBtn')){const p=cur();const w=window.open('','_blank');if(w){w.document.write(`<!doctype html><html><head><title>${esc(p.name)} — Preview</title><style>${exportCss()}</style></head><body><main class="site">${p.sections.map(section).join('')}</main></body></html>`);w.document.close()}else toast('Allow pop-ups to preview');return}
 if(e.target.closest('#exportBtn')){exportHtml();return}
 if(e.target.closest('[data-delete-selected]')){const id=S.sel;cur().sections=cur().sections.filter(x=>x.id!==id);S.sel=null;render();toast('Section deleted');return}
});
document.addEventListener('input',e=>{if(!e.target.matches('[data-f]'))return;const s=cur().sections.find(x=>x.id===S.sel);if(!s)return;const parts=e.target.dataset.f.split('.'),r=parts[0],i=parts[1];if(i===undefined)s.data[r]=e.target.value;else if(Array.isArray(s.data[r]))s.data[r][+i]=e.target.value;render()});
document.addEventListener('change',e=>{if(e.target.matches('[data-f]')){const s=cur().sections.find(x=>x.id===S.sel);if(!s)return;const parts=e.target.dataset.f.split('.');if(parts[1]===undefined)s.data[parts[0]]=e.target.value;else s.data[parts[0]][+parts[1]]=e.target.value;render();return}if(e.target.matches('[data-file]')){const s=cur().sections.find(x=>x.id===S.sel);const key=e.target.dataset.file, file=e.target.files?.[0];if(!s||!file)return;const r=new FileReader();r.onload=()=>{s.data[key]=r.result;render();toast('Image added for this session')};r.readAsDataURL(file)}});
$('pagePicker').addEventListener('change',e=>{S.page=+e.target.value;S.sel=null;render()});
$('backBtn').addEventListener('click',()=>history.back());
render();
})();
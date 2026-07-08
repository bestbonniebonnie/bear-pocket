const STORE_KEY = 'bearPocket.v2.items';
const CATEGORY_KEY = 'bearPocket.v2.categories';
const DEFAULT_CATEGORIES = ['旅遊','美食','咖啡廳','住宿','購物','育兒','優惠券','靈感／文案'];
const $ = (id)=>document.getElementById(id);
let items = loadItems();
let savedCategories = loadCategories();
let activeCategory = '全部';
let tempImages = [];

const els = {
  list:$('list'), empty:$('emptyState'), tabs:$('categoryTabs'), search:$('searchInput'),
  add:$('addBtn'), settings:$('settingsBtn'), backdrop:$('sheetBackdrop'), sheet:$('editorSheet'), settingsSheet:$('settingsSheet'),
  close:$('closeSheet'), closeSettings:$('closeSettings'), form:$('itemForm'), delete:$('deleteBtn'),
  title:$('titleInput'), url:$('urlInput'), category:$('categoryInput'), place:$('placeInput'), note:$('noteInput'),
  visited:$('visitedInput'), revisit:$('revisitInput'), favorite:$('favoriteInput'), imageInput:$('imageInput'), imagePreview:$('imagePreview'),
  editing:$('editingId'), viewer:$('viewer'), viewerImg:$('viewerImg'), closeViewer:$('closeViewer'),
  export:$('exportBtn'), import:$('importInput'), clear:$('clearDemoBtn'), categoryList:$('categoryList'), placeList:$('placeList'), manageCategories:$('manageCategories'), newCategory:$('newCategoryInput'), addCategory:$('addCategoryBtn')
};

function loadItems(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}
function loadCategories(){
  try {
    const saved = JSON.parse(localStorage.getItem(CATEGORY_KEY));
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_CATEGORIES;
  } catch { return DEFAULT_CATEGORIES; }
}
function saveCategories(){ localStorage.setItem(CATEGORY_KEY, JSON.stringify(savedCategories)); }
function saveItems(){ localStorage.setItem(STORE_KEY, JSON.stringify(items)); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function domainIcon(url=''){
  const u = url.toLowerCase();
  if(u.includes('maps') || u.includes('goo.gl/maps')) return '📍';
  if(u.includes('instagram')) return '📷';
  if(u.includes('youtube') || u.includes('youtu.be')) return '▶';
  if(u.includes('threads')) return '@';
  if(u.includes('shopee')) return '🛍';
  return '🔗';
}
function safeUrl(url){ if(!url) return ''; return /^https?:\/\//i.test(url) ? url : `https://${url}`; }
function categories(){
  const fromItems = items.map(i=>i.category).filter(Boolean);
  return ['全部','🤎 最愛',...Array.from(new Set([...savedCategories, ...fromItems]))];
}
function places(){ return Array.from(new Set(items.map(i=>i.place).filter(Boolean))); }
function render(){ renderTabs(); renderDatalists(); renderCategoryManager(); renderList(); }
function renderTabs(){
  els.tabs.innerHTML = categories().map(c=>`<button class="tab ${c===activeCategory?'active':''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)} <small>${countCat(c)}</small></button>`).join('');
  els.tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;render();});
}
function countCat(c){ if(c==='全部') return items.length; if(c==='🤎 最愛') return items.filter(i=>i.favorite).length; return items.filter(i=>i.category===c).length; }
function renderDatalists(){
  els.categoryList.innerHTML = Array.from(new Set([...savedCategories, ...items.map(i=>i.category).filter(Boolean)])).map(x=>`<option value="${escapeHtml(x)}"></option>`).join('');
  els.placeList.innerHTML = places().map(x=>`<option value="${escapeHtml(x)}"></option>`).join('');
}

function renderCategoryManager(){
  if(!els.manageCategories) return;
  els.manageCategories.innerHTML = savedCategories.map((cat, idx)=>`
    <div class="manage-row">
      <input value="${escapeHtml(cat)}" data-cat-edit="${idx}" />
      <button type="button" data-cat-del="${idx}">刪除</button>
    </div>`).join('');
  els.manageCategories.querySelectorAll('[data-cat-edit]').forEach(input=>{
    input.onchange=()=>{
      const idx=Number(input.dataset.catEdit);
      const old=savedCategories[idx];
      const val=input.value.trim();
      if(!val) { input.value=old; return; }
      savedCategories[idx]=val;
      items.forEach(i=>{ if(i.category===old) i.category=val; });
      saveCategories(); saveItems(); render();
    };
  });
  els.manageCategories.querySelectorAll('[data-cat-del]').forEach(btn=>{
    btn.onclick=()=>{
      const idx=Number(btn.dataset.catDel);
      const cat=savedCategories[idx];
      if(confirm(`刪除分類「${cat}」嗎？已使用這個分類的收藏會保留，只是不會再出現在預設分類裡。`)){
        savedCategories.splice(idx,1);
        saveCategories(); render();
      }
    };
  });
}

function renderList(){
  const q = els.search.value.trim().toLowerCase();
  let data = items.slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  if(activeCategory==='🤎 最愛') data = data.filter(i=>i.favorite);
  else if(activeCategory!=='全部') data = data.filter(i=>i.category===activeCategory);
  if(q) data = data.filter(i => [i.title,i.url,i.category,i.place,i.note].join(' ').toLowerCase().includes(q));
  els.empty.classList.toggle('hidden', data.length>0);
  els.list.innerHTML = data.map(cardHtml).join('');
  els.list.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>openEditor(el.dataset.edit));
  els.list.querySelectorAll('[data-heart]').forEach(el=>el.onclick=(e)=>{e.stopPropagation(); toggleFav(el.dataset.heart);});
  els.list.querySelectorAll('[data-open]').forEach(el=>el.onclick=(e)=>{e.stopPropagation(); window.open(safeUrl(el.dataset.open),'_blank');});
  els.list.querySelectorAll('[data-copy]').forEach(el=>el.onclick=async(e)=>{e.stopPropagation(); await navigator.clipboard.writeText(el.dataset.copy); toast('已複製網址');});
  els.list.querySelectorAll('[data-view]').forEach(el=>el.onclick=(e)=>{e.stopPropagation(); openViewer(el.dataset.view);});
}
function cardHtml(i){
  const img = i.images?.[0];
  const thumb = img ? `<img data-view="${img}" class="thumb" src="${img}" alt="${escapeHtml(i.title)}">` : `<div class="thumb">${domainIcon(i.url)}</div>`;
  return `<article class="card">
    ${thumb}
    <div class="card-content">
      <button class="heart ${i.favorite?'on':''}" data-heart="${i.id}">♡</button>
      <h3>${escapeHtml(i.title||'未命名收藏')}</h3>
      <div class="meta">${i.category?`<span class="pill">${escapeHtml(i.category)}</span>`:''}${i.place?`<span class="pill">${escapeHtml(i.place)}</span>`:''}${i.visited?`<span class="pill">已去過</span>`:''}${i.revisit?`<span class="pill">值得再訪</span>`:''}</div>
      ${i.note?`<div class="note">${escapeHtml(i.note)}</div>`:''}
      <div class="card-actions">${i.url?`<button class="mini-btn" data-open="${escapeHtml(i.url)}">${domainIcon(i.url)} 開啟</button><button class="mini-btn" data-copy="${escapeHtml(i.url)}">複製</button>`:''}<button class="mini-btn" data-edit="${i.id}">編輯</button></div>
    </div>
  </article>`;
}
function openEditor(id){
  const item = id ? items.find(x=>x.id===id) : null;
  els.editing.value = item?.id || '';
  els.title.value = item?.title || '';
  els.url.value = item?.url || '';
  els.category.value = item?.category || '';
  els.place.value = item?.place || '';
  els.note.value = item?.note || '';
  els.visited.checked = !!item?.visited;
  els.revisit.checked = !!item?.revisit;
  els.favorite.checked = !!item?.favorite;
  tempImages = item?.images ? [...item.images] : [];
  els.delete.classList.toggle('hidden', !item);
  $('sheetTitle').textContent = item ? '編輯收藏' : '新增收藏';
  renderImagePreview(); showSheet(els.sheet);
}
function showSheet(sheet){ els.backdrop.classList.remove('hidden'); sheet.classList.remove('hidden'); sheet.setAttribute('aria-hidden','false'); }
function hideSheets(){ [els.sheet,els.settingsSheet].forEach(s=>{s.classList.add('hidden');s.setAttribute('aria-hidden','true')}); els.backdrop.classList.add('hidden'); }
function renderImagePreview(){
  els.imagePreview.innerHTML = tempImages.map((src,idx)=>`<div class="preview-wrap"><img src="${src}" data-view="${src}" alt="圖片${idx+1}"><button type="button" class="remove-img" data-remove-img="${idx}">×</button></div>`).join('');
  els.imagePreview.querySelectorAll('[data-remove-img]').forEach(b=>b.onclick=()=>{tempImages.splice(Number(b.dataset.removeImg),1);renderImagePreview();});
  els.imagePreview.querySelectorAll('[data-view]').forEach(img=>img.onclick=()=>openViewer(img.dataset.view));
}
function toggleFav(id){ const i=items.find(x=>x.id===id); if(!i) return; i.favorite=!i.favorite; i.updatedAt=Date.now(); saveItems(); render(); }
function openViewer(src){ els.viewerImg.src=src; els.viewer.classList.remove('hidden'); }
function escapeHtml(str=''){ return String(str).replace(/[&<>'"]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s])); }
function toast(msg){
  const t=document.createElement('div'); t.textContent=msg; t.style.cssText='position:fixed;left:50%;bottom:110px;transform:translateX(-50%);background:#ead7bf;color:#3a251b;padding:10px 16px;border-radius:99px;z-index:99;box-shadow:0 8px 24px rgba(0,0,0,.25)';
  document.body.appendChild(t); setTimeout(()=>t.remove(),1500);
}

els.add.onclick=()=>openEditor();
if(els.addCategory){ els.addCategory.onclick=()=>{ const v=els.newCategory.value.trim(); if(!v) return; if(!savedCategories.includes(v)) savedCategories.push(v); els.newCategory.value=''; saveCategories(); render(); toast('已新增分類'); }; }
els.close.onclick=hideSheets; els.backdrop.onclick=hideSheets; els.settings.onclick=()=>showSheet(els.settingsSheet); els.closeSettings.onclick=hideSheets; els.search.oninput=render;
els.closeViewer.onclick=()=>els.viewer.classList.add('hidden'); els.viewer.onclick=(e)=>{if(e.target===els.viewer) els.viewer.classList.add('hidden')};
els.imageInput.onchange=async(e)=>{
  const files=[...e.target.files];
  for(const file of files){
    const data=await fileToDataUrl(file);
    tempImages.push(data);
  }
  e.target.value=''; renderImagePreview();
};
function fileToDataUrl(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
els.form.onsubmit=(e)=>{
  e.preventDefault();
  const id=els.editing.value;
  const payload={
    title:els.title.value.trim(), url:els.url.value.trim(), category:els.category.value.trim(), place:els.place.value.trim(), note:els.note.value.trim(),
    visited:els.visited.checked, revisit:els.revisit.checked, favorite:els.favorite.checked, images:tempImages, updatedAt:Date.now()
  };
  if(id){ const idx=items.findIndex(x=>x.id===id); items[idx]={...items[idx],...payload}; }
  else items.push({id:uid(), createdAt:Date.now(), ...payload});
  saveItems(); hideSheets(); render(); toast('已儲存');
};
els.delete.onclick=()=>{ const id=els.editing.value; if(confirm('確定刪除這筆收藏嗎？')){items=items.filter(i=>i.id!==id); saveItems(); hideSheets(); render();}};
els.export.onclick=()=>{
  const blob=new Blob([JSON.stringify({version:2, exportedAt:new Date().toISOString(), categories:savedCategories, items},null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`bear-pocket-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
};
els.import.onchange=async(e)=>{
  const file=e.target.files[0]; if(!file) return;
  const text=await file.text(); const data=JSON.parse(text);
  if(Array.isArray(data.items)){ items=data.items; if(Array.isArray(data.categories)) savedCategories=data.categories; saveItems(); saveCategories(); render(); toast('已匯入備份'); hideSheets(); }
};
els.clear.onclick=()=>{ if(confirm('真的要清除全部資料嗎？')){items=[]; saveItems(); render(); hideSheets();} };
document.querySelector('.file-row').onclick=()=>els.import.click();

if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
render();

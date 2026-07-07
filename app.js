const DB_NAME = 'bear-pocket-db-v1';
const STORE = 'state';
const moods = ['想去','已收藏','已去過','值得再訪','猶豫中'];
let state = {
  categories: [
    { id: uid(), name: '旅遊', places: ['福岡','京都','沖繩','東京'] },
    { id: uid(), name: '美食', places: ['台南','台北','台中'] },
    { id: uid(), name: '咖啡廳', places: ['台南','台北'] },
    { id: uid(), name: '住宿', places: ['日本','台灣'] },
    { id: uid(), name: '購物', places: ['衣服','包包','育兒'] },
    { id: uid(), name: '靈感／文案', places: [] }
  ],
  items: [
    {id:uid(),title:'Little Cloud 小雲咖啡',url:'https://example.com',category:'咖啡廳',place:'台北',moods:['想去','已收藏'],note:'甜點看起來好可愛，適合下午茶放空。',image:'',createdAt:Date.now()-1000000,updatedAt:Date.now()-1000000},
    {id:uid(),title:'門司港懷舊街區',url:'https://example.com',category:'旅遊',place:'福岡',moods:['想去'],note:'福岡行程可以搭唐戶市場，長輩小孩也輕鬆。',image:'',createdAt:Date.now()-500000,updatedAt:Date.now()-500000}
  ]
};
let activeMood = '全部';
let editingId = null;
let tempImage = '';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function uid(){return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36)}

function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME,1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveState(){
  localStorage.setItem('bear-pocket-backup', JSON.stringify(state));
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(state,'main');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function loadState(){
  try{
    const db = await openDB();
    const data = await new Promise((resolve,reject)=>{
      const tx = db.transaction(STORE,'readonly');
      const req = tx.objectStore(STORE).get('main');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if(data) state = data;
    else {
      const backup = localStorage.getItem('bear-pocket-backup');
      if(backup) state = JSON.parse(backup);
      await saveState();
    }
  }catch(e){
    const backup = localStorage.getItem('bear-pocket-backup');
    if(backup) state = JSON.parse(backup);
  }
}

function render(){
  renderMoods();
  renderCards();
  renderCategories();
  fillSelects();
}
function renderMoods(){
  $('#moodFilters').innerHTML = ['全部',...moods].map(m=>`<button class="chip ${activeMood===m?'active':''}" data-mood="${m}">${m}</button>`).join('');
  $('#moodFilters').onclick = e=>{
    const b=e.target.closest('.chip'); if(!b) return;
    activeMood=b.dataset.mood; render();
  };
  $('#moodChecks').innerHTML = moods.map(m=>`<label class="checkItem"><input type="checkbox" value="${m}"> ${m}</label>`).join('');
}
function renderCards(){
  const q = $('#searchInput').value.trim().toLowerCase();
  let list = [...state.items].sort((a,b)=>b.createdAt-a.createdAt);
  if(activeMood!=='全部') list = list.filter(i=>(i.moods||[]).includes(activeMood));
  if(q) list = list.filter(i=>[i.title,i.url,i.category,i.place,i.note,(i.moods||[]).join(' ')].join(' ').toLowerCase().includes(q));
  $('#countText').textContent = `目前 ${state.items.length} 筆收藏`;
  $('#emptyState').classList.toggle('hidden', list.length!==0);
  const wrap = $('#cardList'); wrap.innerHTML='';
  const tpl = $('#cardTemplate');
  list.forEach(item=>{
    const node = tpl.content.cloneNode(true);
    const card = node.querySelector('.itemCard');
    const thumb = node.querySelector('.thumb');
    if(item.image) thumb.style.backgroundImage = `url(${item.image})`; else thumb.classList.add('empty');
    node.querySelector('h3').textContent = item.title;
    node.querySelector('.meta').textContent = `${item.category||'未分類'}${item.place?'・'+item.place:''}`;
    node.querySelector('.note').textContent = item.note || '沒有備註';
    node.querySelector('.moodLine').innerHTML = (item.moods||[]).map(m=>`<span class="tag">${m}</span>`).join('');
    const link = node.querySelector('.linkBtn');
    link.href = normalizeUrl(item.url);
    link.classList.toggle('hidden', !item.url);
    node.querySelector('.editBtn').onclick = ()=>openItem(item.id);
    node.querySelector('.starBtn').textContent = (item.moods||[]).includes('已收藏') ? '♥' : '♡';
    node.querySelector('.starBtn').onclick = async()=>{
      item.moods = item.moods || [];
      item.moods = item.moods.includes('已收藏') ? item.moods.filter(x=>x!=='已收藏') : [...item.moods,'已收藏'];
      item.updatedAt=Date.now(); await saveState(); render();
    };
    card.ondblclick=()=>openItem(item.id);
    wrap.appendChild(node);
  });
}
function normalizeUrl(url){
  if(!url) return '#';
  return /^https?:\/\//i.test(url) ? url : 'https://' + url;
}
function renderCategories(){
  $('#categoryList').innerHTML = state.categories.map(cat=>`
    <div class="catCard" data-id="${cat.id}">
      <div class="catHead">
        <h3>${escapeHtml(cat.name)}</h3>
        <div class="catActions">
          <button class="tinyBtn addPlace">＋地方</button>
          <button class="tinyBtn editCat">編輯</button>
          <button class="tinyBtn delCat">刪除</button>
        </div>
      </div>
      <div class="placeList">
        ${(cat.places||[]).map(p=>`<div class="placeRow"><span>${escapeHtml(p)}</span><span><button class="tinyBtn editPlace" data-place="${escapeHtml(p)}">改</button> <button class="tinyBtn delPlace" data-place="${escapeHtml(p)}">刪</button></span></div>`).join('') || '<div class="placeRow"><span>尚未新增地方</span></div>'}
      </div>
    </div>`).join('');
}
function fillSelects(){
  const catSel = $('#categorySelect');
  catSel.innerHTML = state.categories.map(c=>`<option>${escapeHtml(c.name)}</option>`).join('');
  updatePlaceSelect();
}
function updatePlaceSelect(){
  const cat = state.categories.find(c=>c.name===$('#categorySelect').value);
  const places = cat?.places || [];
  $('#placeSelect').innerHTML = '<option value="">不指定</option>' + places.map(p=>`<option>${escapeHtml(p)}</option>`).join('');
}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}

function openItem(id=null){
  editingId=id; tempImage='';
  $('#itemForm').reset();
  $('#previewImg').classList.add('hidden');
  $('#deleteItem').classList.toggle('hidden', !id);
  $('#modalTitle').textContent = id ? '編輯收藏' : '新增收藏';
  fillSelects(); renderMoods();
  if(id){
    const item = state.items.find(i=>i.id===id);
    $('#urlInput').value=item.url||''; $('#titleInput').value=item.title||''; $('#categorySelect').value=item.category||state.categories[0]?.name||''; updatePlaceSelect(); $('#placeSelect').value=item.place||''; $('#noteInput').value=item.note||'';
    tempImage=item.image||'';
    if(tempImage){$('#previewImg').src=tempImage; $('#previewImg').classList.remove('hidden');}
    $$('#moodChecks input').forEach(inp=>inp.checked=(item.moods||[]).includes(inp.value));
  }
  $('#itemDialog').showModal();
}
async function compressImage(file){
  const dataUrl = await new Promise(res=>{const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file);});
  const img = await new Promise(res=>{const im=new Image(); im.onload=()=>res(im); im.src=dataUrl;});
  const canvas=document.createElement('canvas');
  const max=900; let {width:w,height:h}=img;
  if(w>h && w>max){h=h*max/w; w=max;} else if(h>=w && h>max){w=w*max/h; h=max;}
  canvas.width=w; canvas.height=h; canvas.getContext('2d').drawImage(img,0,0,w,h);
  return canvas.toDataURL('image/jpeg',.78);
}

function bindEvents(){
  $('#openAdd').onclick=$('#navAdd').onclick=$('#emptyAdd').onclick=()=>openItem();
  $('#searchInput').oninput=renderCards;
  $('#clearFilters').onclick=()=>{activeMood='全部'; $('#searchInput').value=''; render();};
  $('#categorySelect').onchange=updatePlaceSelect;
  $$('.closeDialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $$('.navBtn[data-view]').forEach(btn=>btn.onclick=()=>{
    $$('.navBtn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    $$('.view').forEach(v=>v.classList.remove('active')); $('#'+btn.dataset.view).classList.add('active');
  });
  $('#installHint').onclick=()=>alert('可以用 Safari 分享按鈕 → 加入主畫面，就會像 App 一樣打開。');
  $('#imageInput').onchange=async e=>{
    const file=e.target.files[0]; if(!file) return;
    tempImage=await compressImage(file); $('#previewImg').src=tempImage; $('#previewImg').classList.remove('hidden');
  };
  $('#fetchTitle').onclick=()=>{
    const u=$('#urlInput').value.trim();
    if(u && !$('#titleInput').value.trim()) $('#titleInput').value = new URL(normalizeUrl(u)).hostname.replace('www.','');
  };
  $('#itemForm').onsubmit=async e=>{
    e.preventDefault();
    const item = editingId ? state.items.find(i=>i.id===editingId) : {id:uid(),createdAt:Date.now()};
    item.url=$('#urlInput').value.trim(); item.title=$('#titleInput').value.trim(); item.category=$('#categorySelect').value; item.place=$('#placeSelect').value; item.note=$('#noteInput').value.trim(); item.image=tempImage; item.moods=$$('#moodChecks input:checked').map(i=>i.value); item.updatedAt=Date.now();
    if(!editingId) state.items.push(item);
    await saveState(); $('#itemDialog').close(); render();
  };
  $('#deleteItem').onclick=async()=>{
    if(!confirm('確定要刪除這筆收藏嗎？')) return;
    state.items = state.items.filter(i=>i.id!==editingId); await saveState(); $('#itemDialog').close(); render();
  };
  $('#addCategory').onclick=()=>openCategory();
  $('#categoryList').onclick=async e=>{
    const card=e.target.closest('.catCard'); if(!card) return;
    const cat=state.categories.find(c=>c.id===card.dataset.id);
    if(e.target.closest('.editCat')) return openCategory(cat.id);
    if(e.target.closest('.delCat')){ if(confirm('刪除分類不會刪收藏，但收藏會保留舊分類名稱。確定？')){state.categories=state.categories.filter(c=>c.id!==cat.id); await saveState(); render();} }
    if(e.target.closest('.addPlace')){ const name=prompt('新增地方 / 子分類名稱'); if(name){cat.places=[...(cat.places||[]),name.trim()]; await saveState(); render();} }
    if(e.target.closest('.editPlace')){ const old=e.target.dataset.place; const name=prompt('修改地方名稱',old); if(name){cat.places=cat.places.map(p=>p===old?name.trim():p); state.items.forEach(i=>{if(i.category===cat.name && i.place===old)i.place=name.trim()}); await saveState(); render();} }
    if(e.target.closest('.delPlace')){ const old=e.target.dataset.place; if(confirm('確定刪除這個地方？')){cat.places=cat.places.filter(p=>p!==old); await saveState(); render();} }
  };
  $('#categoryForm').onsubmit=async e=>{
    e.preventDefault(); const name=$('#categoryNameInput').value.trim(); if(!name) return;
    const id=$('#categoryForm').dataset.id;
    if(id){ const cat=state.categories.find(c=>c.id===id); const old=cat.name; cat.name=name; state.items.forEach(i=>{if(i.category===old)i.category=name}); }
    else state.categories.push({id:uid(),name,places:[]});
    await saveState(); $('#categoryDialog').close(); render();
  };
  $('#exportBtn').onclick=()=>{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=`bear-pocket-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#importBtn').onclick=()=>$('#importInput').click();
  $('#importInput').onchange=e=>{
    const file=e.target.files[0]; if(!file) return; const r=new FileReader();
    r.onload=async()=>{ try{ const data=JSON.parse(r.result); if(!data.categories||!data.items) throw new Error(); if(confirm('匯入會覆蓋目前資料，確定嗎？')){state=data; await saveState(); render(); alert('匯入完成');}}catch{alert('檔案格式不正確');} };
    r.readAsText(file);
  };
}
function openCategory(id=null){
  $('#categoryForm').reset(); $('#categoryForm').dataset.id=id||''; $('#categoryModalTitle').textContent=id?'編輯分類':'新增分類';
  if(id) $('#categoryNameInput').value=state.categories.find(c=>c.id===id).name;
  $('#categoryDialog').showModal();
}

(async function init(){ await loadState(); bindEvents(); render(); })();

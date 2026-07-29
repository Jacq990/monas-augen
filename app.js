
const app=document.querySelector('#app');
let works=[], filter='Alle', query='', current=null;
let favorites=new Set(JSON.parse(localStorage.getItem('mona-favs')||'[]'));
let readSet=new Set(JSON.parse(localStorage.getItem('mona-read')||'[]'));
let imageCache=JSON.parse(localStorage.getItem('mona-image-cache')||'{}');
let scale=1,tx=0,ty=0,drag=null,pinch=null;

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const imageKey=id=>`mona-image-${id}`;
const noteKey=id=>`mona-note-${id}`;

async function init(){
  works=await fetch('artworks.json').then(r=>r.json());
  home();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}
function persist(){
  localStorage.setItem('mona-favs',JSON.stringify([...favorites]));
  localStorage.setItem('mona-read',JSON.stringify([...readSet]));
  localStorage.setItem('mona-image-cache',JSON.stringify(imageCache));
}
function officialSearch(w){
  return `https://www.google.com/search?q=${encodeURIComponent(`${w.artist} ${w.title} ${w.museum}`)}`;
}
function home(){
  const pct=Math.round(readSet.size/works.length*100)||0;
  const list=works.filter(w=>{
    if(filter==='Favoriten'&&!favorites.has(w.id))return false;
    if(filter==='Gelesen'&&!readSet.has(w.id))return false;
    if(!['Alle','Favoriten','Gelesen'].includes(filter)&&w.museum!==filter)return false;
    return `${w.artist} ${w.title} ${w.motto} ${w.page}`.toLowerCase().includes(query.toLowerCase());
  });
  app.innerHTML=`<div class="shell"><header class="hero"><div class="eyebrow">Persönlicher Kunstbegleiter</div><h1>Monas Augen</h1><p>52 Werke – zum Lesen, Betrachten und Wiederentdecken</p>
  <div class="progressbox"><div class="progressrow"><span>Lesefortschritt</span><strong>${readSet.size} von ${works.length}</strong></div><div class="progress"><i style="width:${pct}%"></i></div></div></header></div>
  <div class="toolbar"><div class="shell"><input id="search" class="search" placeholder="Künstler, Werk, Motto oder Seite suchen" value="${esc(query)}">
  <div class="filters">${['Alle','Louvre','Musée d’Orsay','Centre Pompidou','Favoriten','Gelesen'].map(x=>`<button data-filter="${x}" class="${x===filter?'active':''}">${x}</button>`).join('')}</div></div></div>
  <main class="shell grid">${list.length?list.map(card).join(''):'<div class="emptylist">Keine passenden Werke gefunden.</div>'}</main>`;
  document.querySelector('#search').oninput=e=>{query=e.target.value;home()};
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;home()});
  document.querySelectorAll('[data-id]').forEach(c=>c.onclick=()=>{current=works.find(w=>w.id==c.dataset.id);detail()});
  hydrateCards(list);
}
function card(w){
  const local=localStorage.getItem(imageKey(w.id));
  const known=local||imageCache[w.id];
  return `<article class="card" data-id="${w.id}">
    <div class="cover" id="cover-${w.id}">${known?`<img src="${known}" alt="">`:`<span class="num">${w.id}</span>`}
    <span class="badge">${esc(w.museum)}</span><button class="heart" data-heart="${w.id}" aria-label="Favorit">${favorites.has(w.id)?'♥':'♡'}</button></div>
    <div class="cardbody"><div class="meta">Buchseite ${w.page}${readSet.has(w.id)?' · gelesen':''}</div><h2>${esc(w.artist)}</h2><h3>${esc(w.title)}</h3><div class="motto">„${esc(w.motto)}“</div></div>
  </article>`;
}
async function hydrateCards(list){
  document.querySelectorAll('[data-heart]').forEach(btn=>btn.onclick=e=>{
    e.stopPropagation(); const id=+btn.dataset.heart;
    favorites.has(id)?favorites.delete(id):favorites.add(id);persist();home();
  });
  const queue=list.filter(w=>!localStorage.getItem(imageKey(w.id))&&!imageCache[w.id]).slice(0,10);
  for(const w of queue){
    const url=await findCommonsImage(w);
    if(url){
      imageCache[w.id]=url;persist();
      const el=document.querySelector(`#cover-${w.id}`); if(el) el.querySelector('.num')?.replaceWith(Object.assign(document.createElement('img'),{src:url,alt:''}));
    }
  }
}
async function detail(){
  resetZoom(); const w=current;
  app.innerHTML=`<main class="shell detail"><div class="topline"><button class="back">← Zurück</button><button class="iconbtn" id="fav">${favorites.has(w.id)?'♥':'♡'}</button></div>
  <div class="viewer" id="viewer"><div class="skeleton"></div></div>
  <div class="controls"><button id="minus">−</button><button id="plus">+</button><button id="reset">Zurücksetzen</button><label class="action">Eigenes Bild<input id="file" type="file" accept="image/*" hidden></label><button id="remove">Eigenes Bild löschen</button></div>
  <div class="detailhead"><div class="meta">${esc(w.museum)} · Buchseite ${w.page}</div><h1>${esc(w.artist)}</h1><h2>${esc(w.title)}</h2><blockquote>„${esc(w.motto)}“</blockquote>
  <label class="readcheck"><input id="read" type="checkbox" ${readSet.has(w.id)?'checked':''}> Dieses Werk habe ich gelesen</label>
  <p>Betrachte zuerst die Gesamtwirkung. Vergrößere danach einzelne Details und achte auf Komposition, Blickführung, Licht, Farbe und Material.</p>
  <div class="actions"><a class="primary" href="${officialSearch(w)}" target="_blank" rel="noopener">Werk im Internet suchen ↗</a><button class="secondary" id="share">Teilen</button></div>
  <h3>Meine Notizen</h3><textarea id="note" placeholder="Was fällt dir beim Lesen und Betrachten auf?">${esc(localStorage.getItem(noteKey(w.id))||'')}</textarea><div class="status" id="status"></div>
  <p class="note">Bei modernen Werken kann aus Urheberrechtsgründen kein frei nutzbares Bild verfügbar sein. Ein eigenes Bild bleibt ausschließlich auf deinem Gerät gespeichert.</p></div></main>`;
  document.querySelector('.back').onclick=home;
  document.querySelector('#fav').onclick=()=>{favorites.has(w.id)?favorites.delete(w.id):favorites.add(w.id);persist();detail()};
  document.querySelector('#read').onchange=e=>{e.target.checked?readSet.add(w.id):readSet.delete(w.id);persist()};
  document.querySelector('#note').oninput=e=>{localStorage.setItem(noteKey(w.id),e.target.value);document.querySelector('#status').textContent='Gespeichert'};
  document.querySelector('#file').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{localStorage.setItem(imageKey(w.id),r.result);showImage(r.result)};r.readAsDataURL(f)};
  document.querySelector('#remove').onclick=()=>{localStorage.removeItem(imageKey(w.id));loadImage(w)};
  document.querySelector('#share').onclick=async()=>{const data={title:`${w.artist} – ${w.title}`,text:`${w.artist}: ${w.title} – „${w.motto}“`,url:location.href};if(navigator.share)await navigator.share(data);else navigator.clipboard?.writeText(data.text)};
  ['plus','minus','reset'].forEach(id=>document.querySelector('#'+id).onclick=()=>zoomButton(id));
  await loadImage(w);
}
async function loadImage(w){
  const local=localStorage.getItem(imageKey(w.id));
  if(local)return showImage(local);
  if(imageCache[w.id])return showImage(imageCache[w.id]);
  const url=await findCommonsImage(w);
  if(url){imageCache[w.id]=url;persist();showImage(url)}
  else document.querySelector('#viewer').innerHTML='<div class="empty">Kein frei verfügbares Bild gefunden.<br>Nutze „Eigenes Bild“ oder die Internetsuche.</div>';
}
async function findCommonsImage(w){
  try{
    const term=encodeURIComponent(`"${w.artist}" "${w.title}"`);
    const api=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${term}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=1400&format=json&origin=*`;
    const data=await fetch(api).then(r=>r.json());
    const pages=Object.values(data.query?.pages||{});
    const hit=pages.find(p=>p.imageinfo?.[0]?.thumburl||p.imageinfo?.[0]?.url);
    return hit?(hit.imageinfo[0].thumburl||hit.imageinfo[0].url):null;
  }catch{return null}
}
function showImage(src){
  const viewer=document.querySelector('#viewer'); if(!viewer)return;
  viewer.innerHTML=`<img id="zoomimg" src="${src}" alt="">`;setupZoom();
}
function zoomButton(id){
  if(id==='plus')scale=Math.min(6,scale+.25);
  if(id==='minus'){scale=Math.max(1,scale-.25);if(scale===1)tx=ty=0}
  if(id==='reset')resetZoom(); applyZoom();
}
function resetZoom(){scale=1;tx=0;ty=0;drag=null;pinch=null}
function applyZoom(){const img=document.querySelector('#zoomimg');if(img)img.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`}
function setupZoom(){
  const v=document.querySelector('#viewer');if(!v)return;applyZoom();
  const pointers=new Map();
  v.onpointerdown=e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});v.setPointerCapture(e.pointerId);if(pointers.size===1)drag={x:e.clientX,y:e.clientY};if(pointers.size===2){const p=[...pointers.values()];pinch={d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),s:scale}}};
  v.onpointermove=e=>{
    if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const p=[...pointers.values()];const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);scale=Math.max(1,Math.min(6,pinch.s*d/pinch.d));applyZoom();return}
    if(drag&&scale>1){tx+=e.clientX-drag.x;ty+=e.clientY-drag.y;drag={x:e.clientX,y:e.clientY};applyZoom()}
  };
  const end=e=>{pointers.delete(e.pointerId);drag=null;if(pointers.size<2)pinch=null};
  v.onpointerup=v.onpointercancel=end;
  v.ondblclick=()=>{scale=scale===1?2:1;if(scale===1)tx=ty=0;applyZoom()};
}
init();

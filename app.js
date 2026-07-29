
const app=document.querySelector('#app');
let works=[], filter='Alle', query='', current=null, favorites=new Set(JSON.parse(localStorage.getItem('mona-favs')||'[]'));
let scale=1, tx=0, ty=0, drag=null;

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const imageKey=id=>`mona-image-${id}`;
const noteKey=id=>`mona-note-${id}`;

async function init(){
  works=await fetch('artworks.json').then(r=>r.json());
  home();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}
function saveFavs(){localStorage.setItem('mona-favs',JSON.stringify([...favorites]))}
function officialSearch(w){
  const q=encodeURIComponent(`${w.artist} ${w.title} ${w.museum}`);
  return `https://www.google.com/search?q=${q}`;
}
function home(){
  const list=works.filter(w=>(filter==='Alle'||w.museum===filter)&&(`${w.artist} ${w.title} ${w.motto} ${w.page}`.toLowerCase().includes(query.toLowerCase())));
  app.innerHTML=`<div class="wrap"><header class="hero"><h1>Monas Augen</h1><p>52 Kunstwerke als mobile Begleitung zum Buch</p></header></div>
  <div class="toolbar"><div class="wrap"><input id="search" class="search" placeholder="Künstler, Werk, Motto oder Seite suchen" value="${esc(query)}">
  <div class="filters">${['Alle','Louvre','Musée d’Orsay','Centre Pompidou','Favoriten'].map(x=>`<button data-filter="${x}" class="${x===filter?'active':''}">${x}</button>`).join('')}</div></div></div>
  <main class="wrap grid">${list.map(card).join('')}</main>`;
  document.querySelector('#search').oninput=e=>{query=e.target.value;home()};
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;home()});
  document.querySelectorAll('[data-id]').forEach(c=>c.onclick=()=>{current=works.find(w=>w.id==c.dataset.id);detail()});
}
function card(w){
  if(filter==='Favoriten'&&!favorites.has(w.id))return '';
  const local=localStorage.getItem(imageKey(w.id));
  return `<article class="card" data-id="${w.id}">
    <div class="thumb">${local?`<img src="${local}" alt="">`:w.id}</div>
    <div><div class="meta">${esc(w.museum)} · Buchseite ${w.page}${favorites.has(w.id)?' · ♥':''}</div>
    <h2>${esc(w.artist)}</h2><h3>${esc(w.title)}</h3><div class="motto">„${esc(w.motto)}“</div></div>
  </article>`;
}
async function detail(){
  resetZoom();
  const w=current;
  app.innerHTML=`<main class="wrap detail"><div class="topline"><button class="back">← Zurück</button><button class="iconbtn" id="fav">${favorites.has(w.id)?'♥':'♡'}</button></div>
  <div class="viewer" id="viewer"><div class="empty loader">Bild wird gesucht …</div></div>
  <div class="controls"><button id="minus">−</button><button id="plus">+</button><button id="reset">Zurücksetzen</button><label class="action">Eigenes Bild<input id="file" type="file" accept="image/*" hidden></label><button id="remove">Bild löschen</button></div>
  <div class="meta">${esc(w.museum)} · Buchseite ${w.page}</div><h1>${esc(w.artist)}</h1><h2>${esc(w.title)}</h2><blockquote>„${esc(w.motto)}“</blockquote>
  <p>Betrachte zuerst die Gesamtwirkung und vergrößere anschließend einzelne Details. Achte besonders auf Komposition, Blickführung, Licht, Farbe und Material.</p>
  <a class="official" href="${officialSearch(w)}" target="_blank" rel="noopener">Werk im Internet suchen ↗</a>
  <h3>Meine Notizen</h3><textarea id="note" placeholder="Was fällt dir beim Lesen und Betrachten auf?">${esc(localStorage.getItem(noteKey(w.id))||'')}</textarea><div class="status" id="status"></div>
  <p class="note">Bei manchen modernen Werken ist wegen des Urheberrechts kein freies Bild verfügbar. Dann kannst du ein eigenes Foto oder einen Screenshot nur auf deinem Gerät hinterlegen.</p></main>`;
  document.querySelector('.back').onclick=home;
  document.querySelector('#fav').onclick=()=>{favorites.has(w.id)?favorites.delete(w.id):favorites.add(w.id);saveFavs();detail()};
  document.querySelector('#note').oninput=e=>{localStorage.setItem(noteKey(w.id),e.target.value);document.querySelector('#status').textContent='Gespeichert'};
  document.querySelector('#file').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{localStorage.setItem(imageKey(w.id),r.result);showImage(r.result)};r.readAsDataURL(f)};
  document.querySelector('#remove').onclick=()=>{localStorage.removeItem(imageKey(w.id));loadImage(w)};
  ['plus','minus','reset'].forEach(id=>document.querySelector('#'+id).onclick=()=>zoomButton(id));
  await loadImage(w);
}
async function loadImage(w){
  const local=localStorage.getItem(imageKey(w.id));
  if(local){showImage(local);return}
  const viewer=document.querySelector('#viewer'); if(!viewer)return;
  viewer.innerHTML='<div class="empty loader">Freies Bild wird gesucht …</div>';
  try{
    const term=encodeURIComponent(`${w.artist} ${w.title}`);
    const url=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${term}&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json&origin=*`;
    const data=await fetch(url).then(r=>r.json());
    const pages=Object.values(data.query?.pages||{});
    const hit=pages.find(p=>p.imageinfo?.[0]?.thumburl||p.imageinfo?.[0]?.url);
    if(hit) showImage(hit.imageinfo[0].thumburl||hit.imageinfo[0].url);
    else viewer.innerHTML='<div class="empty">Kein frei verfügbares Bild gefunden.<br>Nutze „Eigenes Bild“.</div>';
  }catch(e){viewer.innerHTML='<div class="empty">Bildsuche momentan nicht möglich.<br>Nutze „Eigenes Bild“.</div>'}
}
function showImage(src){
  const viewer=document.querySelector('#viewer'); if(!viewer)return;
  viewer.innerHTML=`<img id="zoomimg" src="${src}" alt="">`; setupZoom();
}
function zoomButton(id){
  if(id==='plus')scale=Math.min(6,scale+.25);
  if(id==='minus'){scale=Math.max(1,scale-.25);if(scale===1)tx=ty=0}
  if(id==='reset')resetZoom();
  applyZoom();
}
function resetZoom(){scale=1;tx=0;ty=0;drag=null}
function applyZoom(){const img=document.querySelector('#zoomimg');if(img)img.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`}
function setupZoom(){
  const v=document.querySelector('#viewer'); if(!v)return; applyZoom();
  v.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};v.setPointerCapture(e.pointerId)};
  v.onpointermove=e=>{if(!drag||scale<=1)return;tx+=e.clientX-drag.x;ty+=e.clientY-drag.y;drag={x:e.clientX,y:e.clientY};applyZoom()};
  v.onpointerup=v.onpointercancel=()=>drag=null;
  v.ondblclick=()=>{scale=scale===1?2:1;if(scale===1)tx=ty=0;applyZoom()};
}
init();

// v17 — Console: conteggio per lato (Sx/Ct/Dx) per ogni TIPO + preset condivisi con "Dati"
let ROWS = [];
const $ = (id) => document.getElementById(id);

/* ======= UI: DATI ======= */
const tbody = $('tbody'), q = $('q'), selCampo = $('campo'), clearBtn = $('clear'),
      exportBtn = $('export'), fileInput = $('file'), count = $('count'),
      themeBtn = $('theme'), resetBtn = $('reset');
const fRip = $('f_rip'), fTip = $('f_tip'), fPos = $('f_pos');
const presetNameInput = $('presetName'), savePresetBtn = $('savePreset'), presetList = $('presetList');

/* ======= Tema ======= */
(function(){
  const saved = localStorage.getItem('kardex-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
  themeBtn?.addEventListener('click', ()=>{
    const cur=document.documentElement.getAttribute('data-theme')||'auto';
    const next=cur==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',next);
    localStorage.setItem('kardex-theme',next);
    themeBtn.textContent = (next==='dark')?'🌙 Tema':'☀️ Tema';
    saveState();
  });
  const cur=document.documentElement.getAttribute('data-theme')||'auto';
  themeBtn && (themeBtn.textContent=(cur==='dark')?'🌙 Tema':'☀️ Tema');
})();

/* ======= State ======= */
const STATE_KEY='kardex-state-v17';
function saveState(){
  const s={ q:q?.value??'', campo:selCampo?.value??'ALL',
            fRip:fRip?.value??'', fTip:fTip?.value??'', fPos:fPos?.value??'',
            sort:sortOrder, theme:document.documentElement.getAttribute('data-theme')||'auto' };
  try{ localStorage.setItem(STATE_KEY, JSON.stringify(s)); }catch{}
}
function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(STATE_KEY)||'{}');
    if(q) q.value=s.q||''; if(selCampo) selCampo.value=s.campo||'ALL';
    if(fRip) fRip.value=s.fRip||''; if(fTip) fTip.value=s.fTip||''; if(fPos) fPos.value=s.fPos||'';
    if(Array.isArray(s.sort)){ sortOrder=s.sort; updateSortIndicators(); }
    if(s.theme==='light'||s.theme==='dark'){ document.documentElement.setAttribute('data-theme',s.theme); themeBtn&&(themeBtn.textContent=(s.theme==='dark')?'🌙 Tema':'☀️ Tema'); }
  }catch{}
}

/* ======= Dati ======= */
async function loadData(){
  try{
    const resp = await fetch('./data/kardex.json', { cache:'no-store' });
    ROWS = await resp.json();
  }catch{ ROWS=[]; }
  loadState();
  render();
  buildConsolePresetSelect();  // popula anche la console
}

/* ======= Ricerca / Filtri ======= */
const norm = s => String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function quickMatch(r,campo,txtRaw){
  const txt = norm(txtRaw); if(!txt) return true;
  const onlyDigits=/^\d+$/.test(txtRaw);
  const rip=norm(r.RIPIANO), tip=norm(r.TIPO), pos=norm(r.POSIZIONE);
  if(campo==='RIPIANO'){
    if(onlyDigits){ const head=String(r.RIPIANO??'').match(/^\d+/)?.[0]||''; return head===txtRaw; }
    return rip.includes(txt);
  }
  if(campo==='TIPO') return tip.includes(txt);
  if(campo==='POSIZIONE') return pos.includes(txt);
  return rip.includes(txt)||tip.includes(txt)||pos.includes(txt);
}
function matchText(v,qv){
  const V=norm(v); let Q=String(qv||'').trim(); if(!Q) return true;
  if(Q.startsWith('!')){ Q=Q.slice(1).trim(); return !V.includes(norm(Q)); }
  if(Q.startsWith('=')){ Q=Q.slice(1).trim(); return V===norm(Q); }
  if(Q.endsWith('*')){ Q=Q.slice(0,-1).trim(); return V.startsWith(norm(Q)); }
  return V.includes(norm(Q));
}
function advancedMatch(r){
  const fr=fRip?.value?.trim()??'', ft=fTip?.value?.trim()??'', fp=fPos?.value?.trim()??'';
  let okRip=true;
  if(fr){
    if(/^\d+$/.test(fr)){ const head=String(r.RIPIANO??'').match(/^\d+/)?.[0]||''; okRip=head===fr; }
    else okRip=matchText(r.RIPIANO,fr);
  }
  return okRip && matchText(r.TIPO,ft) && matchText(r.POSIZIONE,fp);
}
function filtered(){ const campo=selCampo?.value??'ALL'; const txt=q?.value?.trim()??''; return ROWS.filter(r=>quickMatch(r,campo,txt)&&advancedMatch(r)); }

/* ======= Multi-sort ======= */
let sortOrder=[];
const ths=[...document.querySelectorAll('th.sortable')];
ths.forEach(th=>th.addEventListener('click',e=>toggleSort(th.dataset.key,e.shiftKey)));
function toggleSort(key,add){
  if(!add){ const cur=sortOrder[0]; sortOrder=(cur&&cur.key===key)?[{key,dir:cur.dir==='asc'?'desc':'asc'}]:[{key,'dir':'asc'}]; }
  else{ const i=sortOrder.findIndex(s=>s.key===key); if(i===-1) sortOrder.push({key,dir:'asc'}); else sortOrder[i].dir=sortOrder[i].dir==='asc'?'desc':'asc'; sortOrder=sortOrder.slice(0,3); }
  updateSortIndicators(); render(); saveState();
}
function updateSortIndicators(){
  ths.forEach(th=>{ const s=th.querySelector('.sort'); if(!s) return;
    const i=sortOrder.findIndex(x=>x.key===th.dataset.key);
    s.textContent = i===-1 ? '' : (sortOrder[i].dir==='asc'?'▲':'▼')+(i+1);
  });
}
function sortRows(rows){
  if(!sortOrder.length) return rows;
  return rows.slice().sort((a,b)=>{
    for(const {key,dir} of sortOrder){
      const mul=dir==='asc'?1:-1;
      const av=String(a[key]??'').toLowerCase(), bv=String(b[key]??'').toLowerCase();
      const an=av.match(/^\d+/), bn=bv.match(/^\d+/);
      let cmp=(an&&bn)?(parseInt(an[0],10)-parseInt(bn[0],10)):av.localeCompare(bv,'it',{numeric:true,sensitivity:'base'});
      if(cmp!==0) return mul*cmp;
    } return 0;
  });
}

/* ======= Render tabella ======= */
function escapeHtml(x){return String(x).replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]))}
function render(){
  let rows=sortRows(filtered());
  count && (count.textContent=rows.length+' risultati');
  if(!tbody) return;
  tbody.innerHTML = rows.map(r=>`
    <tr>
      <td data-label="RIPIANO">${escapeHtml(r.RIPIANO??'')}</td>
      <td data-label="TIPO">${escapeHtml(r.TIPO??'')}</td>
      <td data-label="POSIZIONE"><span class="chip">${escapeHtml(r.POSIZIONE??'')}</span></td>
    </tr>`).join('');
}

/* ======= Export / Import ======= */
exportBtn?.addEventListener('click',()=>{
  const headers=['RIPIANO','TIPO','POSIZIONE'], lines=[headers.join(',')];
  for(const r of sortRows(filtered())){
    const vals=headers.map(h=>String(r[h]??'').replaceAll('"','""'));
    lines.push(vals.map(v=> /[,\"\n]/.test(v) ? `"${v}"` : v).join(','));
  }
  const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'}), url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='kardex_export.csv'; a.click(); URL.revokeObjectURL(url);
});
fileInput?.addEventListener('change', async (ev)=>{
  const f=ev.target.files?.[0]; if(!f) return;
  const ext=(f.name.split('.').pop()||'').toLowerCase();
  if(ext==='csv'){
    const text=await f.text(); const [head,...rows]=text.split(/\r?\n/).filter(Boolean);
    const headers=head.split(',').map(h=>h.trim().toUpperCase());
    const iR=headers.findIndex(h=>h.includes('RIPIANO')), iT=headers.findIndex(h=>h.includes('TIPO')), iP=headers.findIndex(h=>h.includes('POSIZIONE'));
    ROWS = rows.map(line=>{
      const parts=(line.match(/("[^"]*"|[^,]+)/g)||[]).map(s=>s.replace(/^"|"$/g,''));
      return {RIPIANO:parts[iR]||'', TIPO:parts[iT]||'', POSIZIONE:parts[iP]||''};
    });
  }else{
    const buf=await f.arrayBuffer(), wb=XLSX.read(buf,{type:'array'}), ws=wb.Sheets[wb.SheetNames[0]];
    const arr=XLSX.utils.sheet_to_json(ws,{defval:''});
    ROWS = arr.map(r=>{
      const keys=Object.keys(r), get=(pred)=>{const k=keys.find(k=>pred(k.toUpperCase())); return k?r[k]:'';};
      return {RIPIANO:get(k=>k.includes('RIPIANO')), TIPO:get(k=>k.includes('TIPO')), POSIZIONE:get(k=>k.includes('POSIZIONE'))};
    });
  }
  ev.target.value=''; render();
});

/* ======= Preset condivisi ======= */
const PRESETS_KEY='kardex-presets-v16'; // usiamo lo stesso storage della v16
function loadPresets(){ try{return JSON.parse(localStorage.getItem(PRESETS_KEY))||[]}catch{return[]} }
function savePresets(list){ localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); }
function enforceExactType(s){ if(!s) return s; const t=String(s).trim(); if(/^=|^!|.*\*$/.test(t)) return t; return '=' + t; }
function getCurrentConfig(){ return { q:q?.value??'', campo:selCampo?.value??'ALL', fRip:fRip?.value??'', fTip:fTip?.value??'', fPos:fPos?.value??'', sort:sortOrder }; }
function applyConfig(cfg){ if(!cfg) return; q.value=cfg.q||''; selCampo.value=cfg.campo||'ALL'; fRip.value=cfg.fRip||''; fTip.value=cfg.fTip||''; fPos.value=cfg.fPos||''; sortOrder=cfg.sort||[]; updateSortIndicators(); render(); saveState(); }
function renderPresets(){
  const list=loadPresets(); presetList.innerHTML='';
  list.forEach((p,i)=>{
    const b=document.createElement('button'); b.textContent=p.name; b.className='secondary'; b.onclick=()=>applyConfig(p.cfg);
    const d=document.createElement('button'); d.textContent='❌'; d.className='secondary'; d.style.padding='0 6px'; d.onclick=()=>{ savePresets(list.filter((_,k)=>k!==i)); renderPresets(); };
    const w=document.createElement('span'); w.style.display='inline-flex'; w.style.gap='4px'; w.append(b,d); presetList.append(w);
  });
}
savePresetBtn?.addEventListener('click',()=>{
  const name=(presetNameInput?.value||'').trim(); if(!name) return alert('Nome preset?');
  const cfg=getCurrentConfig(); cfg.q=''; cfg.campo='ALL'; cfg.fTip=enforceExactType(cfg.fTip);
  const list=loadPresets(); list.push({name,cfg}); savePresets(list); presetNameInput.value=''; renderPresets(); buildConsolePresetSelect();
});
renderPresets();

/* ======= TABS ======= */
const dataCard=$('dataView'), consoleView=$('consoleView'), tabData=$('tabData'), tabConsole=$('tabConsole');
function showData(){ dataCard.classList.remove('hidden'); consoleView.classList.add('hidden'); localStorage.setItem('kardex-tab','data'); }
function showConsole(){ dataCard.classList.add('hidden'); consoleView.classList.remove('hidden'); localStorage.setItem('kardex-tab','console'); }
tabData?.addEventListener('click',showData); tabConsole?.addEventListener('click',showConsole);
(function(){ (localStorage.getItem('kardex-tab')==='console')?showConsole():showData(); })();

/* ======= CONSOLE ======= */
const c = {
  target: $('c_vassoio_target'),
  preleva: $('c_preleva'),
  svuota:  $('c_svuota'),
  home:    $('c_home'),
  list:    $('c_cont_list'),
  title:   $('c_title'),
  hint:    $('c_rows_hint'),
  posSx:   $('pos_sx'),
  posCt:   $('pos_ct'),
  posDx:   $('pos_dx'),
  pSel:    $('c_preset_select'),
  pApply:  $('c_preset_apply'),
  pClear:  $('c_preset_clear'),
  pDesc:   $('c_preset_desc'),
};

function headNumber(s){ return String(s||'').match(/^\d+/)?.[0] || ''; }
function deriveSide(posText){
  const t=norm(posText);
  if (t.includes('sinist') || t.includes(' sx')) return 'Sx';
  if (t.includes('destr')  || t.includes(' dx')) return 'Dx';
  if (t.includes('centr')  || t.includes(' centro')) return 'Ct';
  return null;
}

/* Preset attivo in Console (solo filtri, NON ordini) */
let consolePreset = null; // {name,cfg}
function buildConsolePresetSelect(){
  if(!c.pSel) return;
  const presets = loadPresets();
  c.pSel.innerHTML = `<option value="">— Seleziona preset —</option>` +
    presets.map((p,i)=>`<option value="${i}">${escapeHtml(p.name)}</option>`).join('');
  // ripristina descrizione
  if (consolePreset) {
    c.pSel.value = presets.findIndex(p=>p.name===consolePreset.name);
    updateConsolePresetDesc();
  }
}
function updateConsolePresetDesc(){
  if(!c.pDesc){return;}
  if(!consolePreset){ c.pDesc.textContent='Nessun preset attivo'; return; }
  const cfg = consolePreset.cfg || {};
  const parts = [];
  if (cfg.fRip) parts.push(`Ripiano: ${cfg.fRip}`);
  if (cfg.fTip) parts.push(`Tipo: ${cfg.fTip}`);
  if (cfg.fPos) parts.push(`Posizione: ${cfg.fPos}`);
  c.pDesc.textContent = parts.length ? parts.join(' • ') : 'Preset senza filtri';
}
c.pApply?.addEventListener('click',()=>{
  const presets=loadPresets();
  const idx = parseInt(c.pSel.value,10);
  if(isNaN(idx)){ consolePreset=null; updateConsolePresetDesc(); analyzeTray(+c.target.value||0); return; }
  consolePreset = presets[idx] || null;
  updateConsolePresetDesc();
  analyzeTray(+c.target.value||0);
});
c.pClear?.addEventListener('click',()=>{
  consolePreset=null; c.pSel.value=''; updateConsolePresetDesc(); analyzeTray(+c.target.value||0);
});

/* Applica eventuale preset-console a una riga */
function matchConsolePreset(r){
  if(!consolePreset) return true;
  const cfg = consolePreset.cfg || {};
  // ripiano: se numero, match sull'HEAD numerico; altrimenti operatore come in Dati
  let okRip=true;
  if (cfg.fRip) {
    const fr = cfg.fRip.trim();
    if (/^\d+$/.test(fr)) okRip = headNumber(r.RIPIANO) === fr;
    else okRip = matchText(String(r.RIPIANO||''), fr);
  }
  const okTip = cfg.fTip ? matchText(String(r.TIPO||''), cfg.fTip) : true;
  const okPos = cfg.fPos ? matchText(String(r.POSIZIONE||''), cfg.fPos) : true;
  return okRip && okTip && okPos;
}

/* Analisi vassoio: TIPO -> {tot,sx,ct,dx} */
function analyzeTray(tray){
  const T = String(tray||'');
  c.title.textContent = T ? `Contenuto vassoio ${T}` : 'Contenuto vassoio —';
  if(!T){ c.list.innerHTML=''; c.hint.textContent='0 righe'; setSides('—','—','—'); return; }

  const rows = ROWS.filter(r => headNumber(r.RIPIANO) === T).filter(matchConsolePreset);
  c.hint.textContent = `${rows.length} righe`;

  const byType = new Map();
  let sx=0, ct=0, dx=0;

  for(const r of rows){
    const t = (String(r.TIPO||'').trim() || '(Senza tipo)');
    const side = deriveSide(r.POSIZIONE);
    const obj = byType.get(t) || {tot:0,sx:0,ct:0,dx:0};
    obj.tot++;
    if(side==='Sx'){ obj.sx++; sx++; }
    else if(side==='Ct'){ obj.ct++; ct++; }
    else if(side==='Dx'){ obj.dx++; dx++; }
    byType.set(t,obj);
  }

  const items = [...byType.entries()]
    .sort((a,b)=> b[1].tot - a[1].tot)
    .map(([label,o]) =>
      `<li class="item">
         <span>${escapeHtml(label)}</span>
         <span class="badges">
           <span class="badge">Sx ${o.sx}</span>
           <span class="badge">Ct ${o.ct}</span>
           <span class="badge">Dx ${o.dx}</span>
           <span class="badge">Tot ${o.tot}</span>
         </span>
       </li>`
    );

  c.list.innerHTML = items.length ? items.join('') : `<li class="item"><span class="muted">Nessun dato</span></li>`;
  setSides(sx||'—', ct||'—', dx||'—');
}
function setSides(sx,ct,dx){ c.posSx.textContent=String(sx); c.posCt.textContent=String(ct); c.posDx.textContent=String(dx); }

c.preleva?.addEventListener('click', ()=> analyzeTray(+c.target.value || 0));
c.svuota?.addEventListener('click', ()=>{ c.target.value=0; analyzeTray(0); });
c.home?.addEventListener('click', ()=> showData());
c.target?.addEventListener('keydown', e=>{ if(e.key==='Enter') c.preleva.click(); });

/* ===== Start ===== */
[q, selCampo, fRip, fTip, fPos].forEach(el=> el&&el.addEventListener('input',()=>{render();saveState();}));
clearBtn?.addEventListener('click',()=>{ if(q) q.value=''; if(selCampo) selCampo.value='ALL'; if(fRip) fRip.value=''; if(fTip) fTip.value=''; if(fPos) fPos.value=''; render(); saveState(); });
resetBtn?.addEventListener('click',()=>{ localStorage.removeItem(STATE_KEY); sortOrder=[]; updateSortIndicators(); if(q) q.value=''; if(selCampo) selCampo.value='ALL'; if(fRip) fRip.value=''; if(fTip) fTip.value=''; if(fPos) fPos.value=''; render(); saveState(); });

loadData();

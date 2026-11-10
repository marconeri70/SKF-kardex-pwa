// v21 — Console: schede grandi per lato con elenco tipi; export/import preset JSON
let ROWS = [];
const $ = (id) => document.getElementById(id);

/* ======= UI: DATI ======= */
const tbody = $('tbody'), q = $('q'), selCampo = $('campo'), clearBtn = $('clear'),
      exportBtn = $('export'), fileInput = $('file'), count = $('count'),
      themeBtn = $('theme'), resetBtn = $('reset');
const fRip = $('f_rip'), fTip = $('f_tip'), fPos = $('f_pos');
const presetNameInput = $('presetName'), savePresetBtn = $('savePreset'), presetList = $('presetList');
const exportPresetsBtn = $('exportPresets'), importPresetsBtn = $('importPresetsBtn'), importPresetsInput = $('importPresets');

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
const STATE_KEY='kardex-state-v19';
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
    const resp = await fetch('https://skf-kardex-api.vocidicassino.workers.dev/api/componenti', { cache:'no-store' });
    if(!resp.ok) throw new Error('Cloud HTTP '+resp.status);
    const data = await resp.json();
    if(!Array.isArray(data.componenti)) throw new Error('Risposta Cloud non valida');
    ROWS = data.componenti.map(x=>({id:x.id,RIPIANO:String(x.ripiano??''),TIPO:String(x.tipo??''),POSIZIONE:String(x.posizione??'')}));
    window.KARDEX_CLOUD_ONLINE = true;
  }catch{
    window.KARDEX_CLOUD_ONLINE = false;
    try{ const local=await fetch('./data/kardex.json',{cache:'no-store'}); ROWS=await local.json(); }
    catch{ ROWS=[]; }
  }
  loadState();
  render();
  buildConsolePresetSelect();
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
  renderQuickLocation(rows);
  renderTrayMap();
  updateUndefinedCounter();
  window.dispatchEvent(new Event('kardex:stats'));
  if(!tbody) return;
  tbody.innerHTML = rows.map(r=>`
    <tr>
      <td data-label="RIPIANO">${escapeHtml(r.RIPIANO??'')}</td>
      <td data-label="TIPO">${escapeHtml(r.TIPO??'')}</td>
      <td data-label="POSIZIONE"><span class="chip">${escapeHtml(r.POSIZIONE??'')}</span><span class="cloudActions" data-id="${escapeHtml(r.id??'')}"></span></td>
    </tr>`).join('');
  window.dispatchEvent(new Event('kardex:render'));
}


/* Ricerca immediata della posizione: sola lettura, usa i risultati filtrati. */
function renderQuickLocation(rows){
  const panel=document.getElementById('quickLocation');
  if(!panel)return;
  const term=(q?.value||'').trim();
  panel.replaceChildren();
  panel.hidden=!term;
  if(!term)return;
  const heading=document.createElement('div');
  heading.className='quick-location-title';
  heading.textContent=rows.length?'📍 Posizione dei componenti trovati':'📍 Nessun componente trovato';
  panel.append(heading);
  if(!rows.length){
    const empty=document.createElement('div');
    empty.className='quick-location-empty';
    empty.textContent='Controlla il codice oppure modifica i filtri.';
    panel.append(empty);
    return;
  }
  const max=8;
  for(const r of rows.slice(0,max)){
    const item=document.createElement('div');item.className='quick-location-item';
    const type=document.createElement('div');type.className='quick-location-type';
    type.textContent=r.TIPO||'Componente senza tipo';
    const meta=document.createElement('div');meta.className='quick-location-meta';
    const tray=document.createElement('div');tray.className='quick-location-tray';
    tray.textContent='Ripiano '+(r.RIPIANO||'—');
    const side=document.createElement('span');side.className='quick-location-side';
    side.textContent=r.POSIZIONE||'Posizione non indicata';
    meta.append(tray,side);item.append(type,meta,buildTrayVisual(r.POSIZIONE));
    const actions=document.createElement('div');actions.className='v32-quick';
    const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='✏️ Modifica posizione';
    edit.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('kardex:quick-edit',{detail:{id:r.id}})));
    actions.append(edit);item.append(actions);panel.append(item);
  }
  if(rows.length>max){
    const more=document.createElement('p');more.className='muted';
    more.textContent='Altri '+(rows.length-max)+' risultati nella tabella sottostante.';
    panel.append(more);
  }
}


/* v26: mappa e indicazione visiva, senza modificare dati o assegnare posizioni. */
function buildTrayVisual(position){
  const wrap=document.createElement('div');wrap.className='tray-visual';
  const selected=norm(position);
  const sides=(window.KARDEX_POSITIONS||['Sinistra','Centrale','Destra']).filter(x=>norm(x)!=='da definire');
  const known=sides.some(x=>norm(x)===selected);
  wrap.style.gridTemplateColumns='repeat('+Math.min(sides.length||1,3)+',minmax(0,1fr))';
  for(const side of sides){
    const cell=document.createElement('div');
    cell.className='tray-slot '+(known?(selected===norm(side)?'active':'inactive'):'unknown');
    cell.textContent=side;
    const small=document.createElement('small');
    small.textContent=known?(selected===norm(side)?'● POSIZIONE':'—'):'?';
    cell.append(small);wrap.append(cell);
  }
  if(!known){
    const note=document.createElement('div');note.className='muted';note.style.cssText='grid-column:1/-1;text-align:center;margin-top:2px';
    note.textContent='Posizione da definire: nessun lato evidenziato';wrap.append(note);
  }
  return wrap;
}
let selectedTray='';
let undefinedOnly=false;
function updateUndefinedCounter(){
  const el=document.getElementById('undefinedCount');
  if(!el)return;
  const n=ROWS.filter(r=>norm(r.POSIZIONE)==='da definire').length;
  el.textContent=n+' posizioni da definire';
}
let trayAdmin=false, trayLogged=false, selectedPosition='';
const trayDialog=$('trayDialog');
$('trayDialogClose')?.addEventListener('click',()=>trayDialog.close());
window.addEventListener('kardex:auth',e=>{trayAdmin=!!e.detail?.admin;trayLogged=!!e.detail?.logged;if(trayDialog?.open)showTrayDialog();if($('positionDialog')?.open)showPositionDialog();if($('groupDialog')?.open)renderGroupDialog();});
window.addEventListener('kardex:tray-result',e=>{const m=$('trayDialogMessage');if(m)m.textContent=e.detail?.error||e.detail?.message||'';if(e.detail?.ok){if($('positionDialog')?.open)showPositionDialog();else showTrayDialog();}});

const positionDialog=$('positionDialog');
$('positionDialogClose')?.addEventListener('click',()=>{positionDialog.close();showTrayDialog();trayDialog.showModal();});
let kardexGroups=[];let currentGroup=null;
window.addEventListener('kardex:groups',e=>{kardexGroups=Array.isArray(e.detail?.gruppi)?e.detail.gruppi:[];if(positionDialog?.open)showPositionDialog();});
function openGroup(g){currentGroup=g;positionDialog.close();renderGroupDialog();$('groupDialog').showModal();}
function groupAction(action,g,item,tipo){window.dispatchEvent(new CustomEvent('kardex:group-action',{detail:{action,groupId:g.id,itemId:item?.id,tipo,ripiano:g.ripiano,posizione:g.posizione,nome:g.nome}}));}
async function renderGroupDialog(){
 const g=currentGroup,root=$('groupDialogRows');if(!g||!root)return;
 $('groupDialogTitle').textContent=g.nome;$('groupDialogSummary').textContent='Ripiano '+g.ripiano+' · '+g.posizione;
 root.replaceChildren();$('groupDialogMessage').textContent='Caricamento componenti…';
 let data;try{const res=await fetch('https://skf-kardex-api.vocidicassino.workers.dev/api/gruppi/'+encodeURIComponent(g.id)+'/componenti',{cache:'no-store'});data=await res.json();if(!res.ok)throw Error(data.error||'Errore lettura');}catch(e){$('groupDialogMessage').textContent=e.message;return;}
 const items=data.componenti||[];$('groupDialogMessage').textContent=items.length+' component'+(items.length===1?'e':'i');
 const makeForm=(item)=>{const f=document.createElement('form');f.className='tray-dialog-form';const label=document.createElement('label');label.textContent='Codice / tipologia';const input=document.createElement('input');input.required=true;input.maxLength=150;input.value=item?.tipo||'';input.placeholder='Codice del componente';label.append(input);const btn=document.createElement('button');btn.type='submit';btn.textContent=item?'Salva modifica':'Aggiungi componente';f.append(label,btn);f.onsubmit=e=>{e.preventDefault();const tipo=input.value.trim();if(!tipo)return;btn.disabled=true;groupAction(item?'edit-item':'add-item',g,item,tipo);};return f;};
 for(const item of items){const card=document.createElement('section');card.className='tray-dialog-entry position-component-card';const title=document.createElement('strong');title.textContent=item.tipo;card.append(title);if(trayLogged){const actions=document.createElement('div');actions.className='tray-dialog-actions';const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='Modifica';const del=document.createElement('button');del.type='button';del.className='secondary';del.textContent='Elimina';const f=makeForm(item);f.hidden=true;edit.onclick=()=>{f.hidden=!f.hidden;};del.onclick=()=>{if(confirm('Eliminare «'+item.tipo+'» dal gruppo '+g.nome+'?'))groupAction('delete-item',g,item);};actions.append(edit,del);card.append(actions,f);}root.append(card);}
 if(!items.length){const p=document.createElement('p');p.className='muted';p.textContent='Questo gruppo non contiene ancora componenti.';root.append(p);}
 if(trayLogged){const section=document.createElement('section');section.className='tray-dialog-entry position-add-card';const h=document.createElement('strong');h.textContent='＋ Nuovo componente';section.append(h,makeForm(null));root.append(section);}
}
$('groupDialogBack')?.addEventListener('click',()=>{$('groupDialog').close();showPositionDialog();positionDialog.showModal();});
window.addEventListener('kardex:group-result',e=>{const d=e.detail||{};if(d.ok){renderGroupDialog();window.dispatchEvent(new Event('kardex:groups-refresh'));}else $('groupDialogMessage').textContent=d.error||'Errore';});
function showPositionDialog(){
 if(!positionDialog||!selectedTray||!selectedPosition)return;
 const matches=ROWS.filter(r=>String(r.RIPIANO||'').trim()===selectedTray&&String(r.POSIZIONE||'Da definire')===selectedPosition);
 const groups=kardexGroups.filter(g=>String(g.ripiano)===selectedTray&&g.posizione===selectedPosition);
 $('positionDialogTitle').textContent='Ripiano '+selectedTray+' · '+selectedPosition;
 $('positionDialogSummary').textContent=matches.length+' voci generali · '+groups.length+' gruppi';
 const root=$('positionDialogRows');root.replaceChildren();
 const header=document.createElement('h3');header.textContent='Gruppi / Zone';root.append(header);
 for(const g of groups){const card=document.createElement('section');card.className='tray-dialog-entry position-group-card';const open=document.createElement('button');open.type='button';open.className='secondary position-group-open';open.textContent='📦 '+g.nome+' · '+g.numero_componenti+' componenti ›';open.onclick=()=>openGroup(g);card.append(open);if(trayLogged){const actions=document.createElement('div');actions.className='tray-dialog-actions';const rename=document.createElement('button');rename.type='button';rename.className='secondary';rename.textContent='Rinomina gruppo';rename.onclick=()=>{const name=prompt('Nuovo nome del gruppo',g.nome);if(name&&name.trim()&&name.trim()!==g.nome)groupAction('rename-group',g,null,name.trim());};const del=document.createElement('button');del.type='button';del.className='secondary';del.textContent='Elimina gruppo';del.disabled=Number(g.numero_componenti)>0;del.title=del.disabled?'Svuota prima il gruppo':'';del.onclick=()=>{if(confirm('Eliminare il gruppo '+g.nome+'?'))groupAction('delete-group',g);};actions.append(rename,del);card.append(actions);}root.append(card);}
 if(!groups.length){const p=document.createElement('p');p.className='muted';p.textContent='Nessun gruppo in questa posizione.';root.append(p);}
 if(trayLogged){const f=document.createElement('form');f.className='tray-dialog-form position-add-card';const input=document.createElement('input');input.placeholder='Nome nuovo gruppo / zona';input.required=true;input.maxLength=150;const btn=document.createElement('button');btn.type='submit';btn.textContent='＋ Crea gruppo';f.append(input,btn);f.onsubmit=e=>{e.preventDefault();groupAction('add-group',{ripiano:selectedTray,posizione:selectedPosition},null,input.value.trim());};root.append(f);}
 const h=document.createElement('h3');h.textContent='Componenti dell’indice generale';root.append(h);
 for(const r of matches){const entry=document.createElement('section');entry.className='tray-dialog-entry';const name=document.createElement('strong');name.textContent=r.TIPO;entry.append(name);root.append(entry);}
 if(!matches.length){const p=document.createElement('p');p.className='muted';p.textContent='Nessuna voce generale in questa posizione.';root.append(p);}
 $('positionDialogMessage').textContent='';
}
window.addEventListener('kardex:position-result',e=>{const m=$('positionDialogMessage');if(m)m.textContent=e.detail?.error||e.detail?.message||'';if(e.detail?.ok)showPositionDialog();});
function showTrayDialog(){
 if(!trayDialog||!selectedTray)return;
 const matches=ROWS.filter(r=>String(r.RIPIANO||'').trim()===selectedTray);
 const groups=kardexGroups.filter(g=>String(g.ripiano)===selectedTray);
 $('trayDialogTitle').textContent='Ripiano '+selectedTray;
 $('trayDialogSummary').textContent='Seleziona una posizione per consultare i componenti e le zone';
 const root=$('trayDialogRows');root.replaceChildren();
 const section=document.createElement('section');section.className='position-nav';
 const heading=document.createElement('h3');heading.textContent='Posizioni del ripiano';section.append(heading);
 const positions=[...new Set([...(window.KARDEX_POSITIONS||['Sinistra','Centrale','Destra','Da definire']),...matches.map(r=>r.POSIZIONE),...groups.map(g=>g.posizione)].filter(Boolean))];
 for(const p of positions){
  const items=matches.filter(r=>r.POSIZIONE===p).length;
  const zoneCount=groups.filter(g=>g.posizione===p).length;
  const btn=document.createElement('button');btn.type='button';btn.className='secondary position-group-open';
  btn.textContent='📍 '+p+' · '+items+' componenti'+(zoneCount?' · '+zoneCount+' zone':'')+' ›';
  btn.onclick=()=>{selectedPosition=p;trayDialog.close();showPositionDialog();positionDialog.showModal();};section.append(btn);
 }
 root.append(section);
 const summary=document.createElement('section');summary.className='position-nav';
 const summaryTitle=document.createElement('h3');summaryTitle.textContent='Tipologie presenti nel ripiano';summary.append(summaryTitle);
 const addLine=(title,description,action)=>{const wrap=document.createElement('div');wrap.className='tray-dialog-entry';const strong=document.createElement('strong');strong.textContent=title;wrap.append(strong);if(description){const p=document.createElement('p');p.className='muted';p.textContent=description;wrap.append(p);}if(action){wrap.style.cursor='pointer';wrap.setAttribute('role','button');wrap.tabIndex=0;wrap.onclick=action;wrap.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action();}};}summary.append(wrap);};
 for(const p of positions){
  const entries=matches.filter(r=>r.POSIZIONE===p);
  const localGroups=groups.filter(g=>g.posizione===p);
  if(!entries.length&&!localGroups.length)continue;
  const h=document.createElement('h4');h.textContent=p;summary.append(h);
  for(const item of entries)addLine(item.TIPO,'Componente generale');
  for(const g of localGroups){
   const groupRow=document.createElement('div');groupRow.className='tray-dialog-entry';
   const name=document.createElement('strong');name.textContent='📦 '+g.nome;groupRow.append(name);
   const list=document.createElement('p');list.className='muted';list.textContent='Caricamento tipologie…';groupRow.append(list);
   const open=document.createElement('button');open.type='button';open.className='secondary';open.textContent='Apri zona ›';open.onclick=()=>{selectedPosition=g.posizione;trayDialog.close();openGroup(g);};groupRow.append(open);summary.append(groupRow);
   fetch('https://skf-kardex-api.vocidicassino.workers.dev/api/gruppi/'+encodeURIComponent(g.id)+'/componenti',{cache:'no-store'})
    .then(async res=>{if(!res.ok)throw Error('HTTP '+res.status);return res.json();})
    .then(data=>{if(!groupRow.isConnected)return;const items=Array.isArray(data.componenti)?data.componenti:[];list.textContent=items.length?items.map(x=>x.tipo).join(' · '):'Nessun componente nella zona';})
    .catch(()=>{if(groupRow.isConnected)list.textContent='Tipologie non disponibili: apri la zona';});
  }
 }
 if(!matches.length&&!groups.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Nessuna tipologia presente.';summary.append(empty);}
 root.append(summary);
 $('trayDialogMessage').textContent='';
}
function renderTrayMap(){
 const buttons=$('trayMapButtons'),content=$('trayMapContent');
 if(!buttons||!content)return;
 const trays=[...new Set(ROWS.map(r=>String(r.RIPIANO||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it',{numeric:true}));
 if(selectedTray&&!trays.includes(selectedTray))selectedTray='';
 buttons.replaceChildren();content.replaceChildren();
 for(const tray of trays){
  const b=document.createElement('button');b.type='button';b.className=selectedTray===tray?'selected':'secondary';
  const items=ROWS.filter(r=>String(r.RIPIANO||'').trim()===tray);const heading=document.createElement('span');heading.className='tray-map-card-top';const number=document.createElement('strong');number.textContent=tray;const arrow=document.createElement('span');arrow.className='tray-map-card-arrow';arrow.textContent='›';heading.append(number,arrow);const types=document.createElement('span');types.className='tray-map-card-types';for(const type of [...new Set(items.map(r=>String(r.TIPO||'').trim()).filter(Boolean))]){const line=document.createElement('span');line.textContent=type;types.append(line);}const count=document.createElement('span');count.className='tray-map-card-count';count.textContent=items.length+' component'+(items.length===1?'e':'i')+' · Apri ripiano';b.append(heading,types,count);b.setAttribute('aria-label','Apri ripiano '+tray+', '+items.length+' componenti');b.setAttribute('aria-pressed',String(selectedTray===tray));
  b.onclick=()=>{selectedTray=tray;renderTrayMap();$('trayDialogMessage').textContent='';showTrayDialog();if(!trayDialog.open)trayDialog.showModal();};
  buttons.append(b);
 }
 const p=document.createElement('p');p.className='muted';p.textContent='Tocca un ripiano per aprire la scheda dedicata.';content.append(p);
 if(trayDialog?.open){if(selectedTray)showTrayDialog();else trayDialog.close();}
}
document.getElementById('showUndefined')?.addEventListener('click',()=>{
  undefinedOnly=true;
  if(q)q.value='';
  if(selCampo)selCampo.value='ALL';
  if(fRip)fRip.value='';
  if(fTip)fTip.value='';
  if(fPos)fPos.value='=Da definire';
  document.querySelector('.filters')?.setAttribute('open','');
  document.getElementById('clearUndefined')?.classList.remove('hidden');
  render();saveState();
});
document.getElementById('clearUndefined')?.addEventListener('click',()=>{
  undefinedOnly=false;
  if(fPos)fPos.value='';
  document.getElementById('clearUndefined')?.classList.add('hidden');
  render();saveState();
});

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

/* Preset JSON */
const PRESETS_KEY='kardex-presets-v16'; // manteniamo compatibilità
function loadPresets(){ try{return JSON.parse(localStorage.getItem(PRESETS_KEY))||[]}catch{return[]} }
function savePresets(list){ localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); }

exportPresetsBtn?.addEventListener('click',()=>{
  const data = JSON.stringify(loadPresets(), null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='kardex_presets.json'; a.click();
});

importPresetsBtn?.addEventListener('click',()=>importPresetsInput.click());
importPresetsInput?.addEventListener('change', async (e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  try{
    const txt=await f.text(); const list=JSON.parse(txt);
    if(Array.isArray(list)){ savePresets(list); renderPresets(); buildConsolePresetSelect(); alert('Preset importati.'); }
    else alert('File preset non valido.');
  }catch{ alert('Errore durante l\'import dei preset.'); }
  e.target.value='';
});

/* Import sheet */
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

/* ======= Preset UI in Dati ======= */
function enforceExactType(s){ if(!s) return s; const t=String(s).trim(); if(/^=|^!|.*\*$/.test(t)) return t; return '=' + t; }
function getCurrentConfig(){ return { q:q?.value??'', campo:selCampo?.value??'ALL', fRip:fRip?.value??'', fTip:fTip?.value??'', fPos:fPos?.value??'', sort:sortOrder }; }
function applyConfig(cfg){ if(!cfg) return; q.value=cfg.q||''; selCampo.value=cfg.campo||'ALL'; fRip.value=cfg.fRip||''; fTip.value=cfg.fTip||''; fPos.value=cfg.fPos||''; sortOrder=cfg.sort||[]; updateSortIndicators(); render(); saveState(); }
function renderPresets(){
  const list=loadPresets(); if(!presetList) return; presetList.innerHTML='';
  list.forEach((p,i)=>{
    const b=document.createElement('button'); b.textContent=p.name; b.className='secondary'; b.onclick=()=>applyConfig(p.cfg);
    const d=document.createElement('button'); d.textContent='❌'; d.className='secondary'; d.style.padding='0 6px'; d.onclick=()=>{ savePresets(list.filter((_,k)=>k!==i)); renderPresets(); buildConsolePresetSelect(); };
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
$('openConsoleAdvanced')?.addEventListener('click',showConsole);
$('returnToInventory')?.addEventListener('click',showData);
(function(){ showData(); })();

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
  posSxList: $('pos_sx_list'),
  posCtList: $('pos_ct_list'),
  posDxList: $('pos_dx_list'),
  pSel:    $('c_preset_select'),
  pApply:  $('c_preset_apply'),
  pClear:  $('c_preset_clear'),
  pDesc:   $('c_preset_desc'),
};

function headNumber(s){ return String(s||'').match(/^\d+/)?.[0] || ''; }
function deriveSide(posText){
  const t=norm(posText);
  if (t.includes('sinist') || t.includes(' sx')) return 'Sx';   // 1
  if (t.includes('centr')  || t.includes(' centro')) return 'Ct'; // 2
  if (t.includes('destr')  || t.includes(' dx')) return 'Dx';   // 3
  return null;
}
const sideIndex = { Sx:1, Ct:2, Dx:3 };

/* Preset Console */
let consolePreset = null;
function buildConsolePresetSelect(){
  if(!c.pSel) return;
  const presets = loadPresets();
  c.pSel.innerHTML = `<option value="">— Seleziona preset —</option>` +
    presets.map((p,i)=>`<option value="${i}">${escapeHtml(p.name)}</option>`).join('');
  if (consolePreset) {
    c.pSel.value = String(presets.findIndex(p=>p.name===consolePreset.name));
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
  consolePreset = isNaN(idx) ? null : presets[idx] || null;
  updateConsolePresetDesc();
  analyzeTray(+c.target.value||0);
});
c.pClear?.addEventListener('click',()=>{
  consolePreset=null; c.pSel.value=''; updateConsolePresetDesc(); analyzeTray(+c.target.value||0);
});
function matchConsolePreset(r){
  if(!consolePreset) return true;
  const cfg = consolePreset.cfg || {};
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

/* Analisi vassoio + riempimento carte laterali */
function analyzeTray(tray){
  const T = String(tray||'');
  c.title.textContent = T ? `Contenuto vassoio ${T}` : 'Contenuto vassoio —';
  if(!T){
    c.list.innerHTML=''; c.hint.textContent='0 righe';
    setSides('—','—','—'); fillSideLists([],[],[]); return;
  }

  const rows = ROWS.filter(r => headNumber(r.RIPIANO) === T).filter(matchConsolePreset);
  c.hint.textContent = `${rows.length} righe`;

  const byType = new Map(); // TIPO -> {sx,ct,dx,tot}
  const sxList=[], ctList=[], dxList=[];
  let sx=0, ct=0, dx=0;

  for(const r of rows){
    const t = (String(r.TIPO||'').trim() || '(Senza tipo)');
    const side = deriveSide(r.POSIZIONE);
    const o = byType.get(t) || {sx:0,ct:0,dx:0,tot:0};
    o.tot++;
    if(side==='Sx'){ o.sx++; sx++; sxList.push(t); }
    else if(side==='Ct'){ o.ct++; ct++; ctList.push(t); }
    else if(side==='Dx'){ o.dx++; dx++; dxList.push(t); }
    byType.set(t,o);
  }

  // Lista principale con posizioni numeriche tra parentesi
  const items = [...byType.entries()]
    .sort((a,b)=> b[1].tot - a[1].tot)
    .map(([label,o])=>{
      const nums=[]; if(o.sx) nums.push(1); if(o.ct) nums.push(2); if(o.dx) nums.push(3);
      const posTag = nums.length ? ` <span class="muted">(${nums.join(', ')})</span>` : '';
      return `<li class="item">
        <span>${escapeHtml(label)}${posTag}</span>
        <span class="badges"><span class="badge">Tot ${o.tot}</span></span>
      </li>`;
    });
  c.list.innerHTML = items.length ? items.join('') : `<li class="item"><span class="muted">Nessun dato</span></li>`;

  // Schede grandi per lato (elenco tipi × count)
  const toCountList = (arr) => {
    const m=new Map(); arr.forEach(t=>m.set(t,(m.get(t)||0)+1));
    return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([t,n])=>`<li><span>${escapeHtml(t)}</span><span class="badge">×${n}</span></li>`).join('') || `<li class="muted" style="border:none">—</li>`;
  };
  fillSideLists(
    toCountList(sxList),
    toCountList(ctList),
    toCountList(dxList)
  );

  setSides(sx||'—', ct||'—', dx||'—');
}
function setSides(sx,ct,dx){ c.posSx.textContent=String(sx); c.posCt.textContent=String(ct); c.posDx.textContent=String(dx); }
function fillSideLists(htmlSx,htmlCt,htmlDx){
  if (Array.isArray(htmlSx)) { // compat
    $('pos_sx_list').innerHTML=htmlSx.join('');
    $('pos_ct_list').innerHTML=htmlCt.join('');
    $('pos_dx_list').innerHTML=htmlDx.join('');
  } else {
    $('pos_sx_list').innerHTML=htmlSx;
    $('pos_ct_list').innerHTML=htmlCt;
    $('pos_dx_list').innerHTML=htmlDx;
  }
}

c.preleva?.addEventListener('click', ()=> analyzeTray(+c.target.value || 0));
c.svuota?.addEventListener('click', ()=>{ c.target.value=0; analyzeTray(0); });
c.home?.addEventListener('click', ()=> showData());
c.target?.addEventListener('keydown', e=>{ if(e.key==='Enter') c.preleva.click(); });

/* ===== Start ===== */
[q, selCampo, fRip, fTip, fPos].forEach(el=> el&&el.addEventListener('input',()=>{render();saveState();}));
clearBtn?.addEventListener('click',()=>{ if(q) q.value=''; if(selCampo) selCampo.value='ALL'; if(fRip) fRip.value=''; if(fTip) fTip.value=''; if(fPos) fPos.value=''; render(); saveState(); });
resetBtn?.addEventListener('click',()=>{ localStorage.removeItem(STATE_KEY); sortOrder=[]; updateSortIndicators(); if(q) q.value=''; if(selCampo) selCampo.value='ALL'; if(fRip) fRip.value=''; if(fTip) fTip.value=''; if(fPos) fPos.value=''; render(); saveState(); });

loadData();

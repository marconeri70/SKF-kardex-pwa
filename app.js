// v15 – Console: contenuto per vassoio + posizioni testuali; preset, filtri operatori, multi-sort, memoria
let ROWS = [];
const $ = (id) => document.getElementById(id);

// ===== RIFERIMENTI UI DATI =====
const tbody = $('tbody');
const q = $('q');
const selCampo = $('campo');
const clearBtn = $('clear');
const exportBtn = $('export');
const fileInput = $('file');
const count = $('count');
const themeBtn = $('theme');
const resetBtn = $('reset');

// Filtri avanzati
const fRip = $('f_rip');
const fTip = $('f_tip');
const fPos = $('f_pos');

// Preset
const presetNameInput = $('presetName');
const savePresetBtn = $('savePreset');
const presetList = $('presetList');

// ===== Tema =====
(function initTheme(){
  const saved = localStorage.getItem('kardex-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
  themeBtn?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'auto';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('kardex-theme', next);
    themeBtn.textContent = (next === 'dark') ? '🌙 Tema' : '☀️ Tema';
    saveState();
  });
  const cur = document.documentElement.getAttribute('data-theme') || 'auto';
  themeBtn && (themeBtn.textContent = (cur === 'dark') ? '🌙 Tema' : '☀️ Tema');
})();

// ===== Stato persistente =====
const STATE_KEY = 'kardex-state-v15';
function saveState() {
  const state = {
    q: q?.value ?? '',
    campo: selCampo?.value ?? 'ALL',
    fRip: fRip?.value ?? '',
    fTip: fTip?.value ?? '',
    fPos: fPos?.value ?? '',
    sort: sortOrder,
    theme: document.documentElement.getAttribute('data-theme') || 'auto'
  };
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {}
}
function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (q) q.value = s.q ?? '';
    if (selCampo) selCampo.value = s.campo ?? 'ALL';
    if (fRip) fRip.value = s.fRip ?? '';
    if (fTip) fTip.value = s.fTip ?? '';
    if (fPos) fPos.value = s.fPos ?? '';
    if (Array.isArray(s.sort)) {
      sortOrder = s.sort.filter(x => x && x.key);
      updateSortIndicators();
    }
    if (s.theme === 'light' || s.theme === 'dark') {
      document.documentElement.setAttribute('data-theme', s.theme);
      themeBtn && (themeBtn.textContent = (s.theme === 'dark') ? '🌙 Tema' : '☀️ Tema');
    }
  } catch {}
}

// ===== Ricerca & Filtri =====
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

async function loadData() {
  try {
    const resp = await fetch('./data/kardex.json', { cache: 'no-store' });
    ROWS = await resp.json();
  } catch { ROWS = []; }
  loadState();
  render();
}

function quickMatch(r, campo, txtRaw) {
  const txt = norm(txtRaw);
  if (!txt) return true;
  const onlyDigits = /^\d+$/.test(txtRaw);
  const rip = norm(r.RIPIANO), tip = norm(r.TIPO), pos = norm(r.POSIZIONE);
  if (campo === 'RIPIANO') {
    if (onlyDigits) {
      const raw = String(r.RIPIANO ?? '');
      if (/^\d+/.test(raw)) return (raw.match(/^\d+/)?.[0] || '') === txtRaw;
      return rip === txt;
    }
    return rip.includes(txt);
  }
  if (campo === 'TIPO') return tip.includes(txt);
  if (campo === 'POSIZIONE') return pos.includes(txt);
  return rip.includes(txt) || tip.includes(txt) || pos.includes(txt);
}

// Operatori testo: =esatto, !escludi, prefisso*, altrimenti contiene
function matchText(fieldValue, query) {
  const v = norm(fieldValue);
  let qv = String(query || '').trim();
  if (!qv) return true;
  if (qv.startsWith('!')) { qv = qv.slice(1).trim(); if (!qv) return true; return !v.includes(norm(qv)); }
  if (qv.startsWith('=')) { qv = qv.slice(1).trim(); return v === norm(qv); }
  if (qv.endsWith('*')) { qv = qv.slice(0, -1).trim(); return v.startsWith(norm(qv)); }
  return v.includes(norm(qv));
}

function advancedMatch(r) {
  const fr = fRip?.value?.trim() ?? '';
  const ft = fTip?.value?.trim() ?? '';
  const fp = fPos?.value?.trim() ?? '';
  if (!fr && !ft && !fp) return true;

  const ripRaw = String(r.RIPIANO ?? '');
  const tipRaw = String(r.TIPO ?? '');
  const posRaw = String(r.POSIZIONE ?? '');

  let okRip = true;
  if (fr) {
    if (/^\d+$/.test(fr)) {
      const head = ripRaw.match(/^\d+/)?.[0] || '';
      okRip = head === fr;
    } else {
      okRip = matchText(ripRaw, fr);
    }
  }
  const okTip = matchText(tipRaw, ft);
  const okPos = matchText(posRaw, fp);
  return okRip && okTip && okPos;
}

function filtered() {
  const campo = selCampo?.value ?? 'ALL';
  const txtRaw = q?.value?.trim() ?? '';
  return ROWS.filter(r => quickMatch(r, campo, txtRaw) && advancedMatch(r));
}

// ===== Multi-sort =====
let sortOrder = [];
const ths = Array.from(document.querySelectorAll('th.sortable'));
function toggleSort(key, additive) {
  if (!additive) {
    const current = sortOrder[0];
    if (current && current.key === key) current.dir = current.dir === 'asc' ? 'desc' : 'asc';
    else sortOrder = [{ key, dir: 'asc' }];
  } else {
    const idx = sortOrder.findIndex(s => s.key === key);
    if (idx === -1) sortOrder.push({ key, dir: 'asc' });
    else sortOrder[idx].dir = sortOrder[idx].dir === 'asc' ? 'desc' : 'asc';
    sortOrder = sortOrder.slice(0, 3);
  }
  updateSortIndicators(); render(); saveState();
}
ths.forEach(th => th.addEventListener('click', (ev) => toggleSort(th.dataset.key, ev.shiftKey === true)));
function updateSortIndicators() {
  ths.forEach(th => {
    const s = th.querySelector('.sort');
    if (!s) return;
    const idx = sortOrder.findIndex(x => x.key === th.dataset.key);
    if (idx === -1) { s.textContent = ''; return; }
    const item = sortOrder[idx]; const rank = (idx + 1);
    s.textContent = (item.dir === 'asc' ? '▲' : '▼') + rank;
  });
}

function render() {
  let rows = filtered();
  rows = sortRows(rows);
  count && (count.textContent = rows.length + ' risultati');
  if (!tbody) return;
  tbody.innerHTML = rows.map(r =>
    `<tr>
      <td data-label="RIPIANO">${escapeHtml(r.RIPIANO ?? '')}</td>
      <td data-label="TIPO">${escapeHtml(r.TIPO ?? '')}</td>
      <td data-label="POSIZIONE"><span class="chip">${escapeHtml(r.POSIZIONE ?? '')}</span></td>
    </tr>`
  ).join('');
}
function escapeHtml(x){return String(x).replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]))}
function sortRows(rows) {
  if (!sortOrder.length) return rows;
  return rows.slice().sort((a, b) => {
    for (const { key, dir } of sortOrder) {
      const mul = dir === 'asc' ? 1 : -1;
      const av = String(a[key] ?? '').toLowerCase();
      const bv = String(b[key] ?? '').toLowerCase();
      const an = av.match(/^\d+/), bn = bv.match(/^\d+/);
      let cmp;
      if (an && bn) cmp = parseInt(an[0],10) - parseInt(bn[0],10);
      else cmp = av.localeCompare(bv, 'it', { numeric:true, sensitivity:'base' });
      if (cmp !== 0) return mul * cmp;
    }
    return 0;
  });
}

// ===== Export / Clear / Reset =====
exportBtn?.addEventListener('click', () => {
  const csv = toCSV(sortRows(filtered()));
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'kardex_export.csv'; a.click(); URL.revokeObjectURL(url);
});
function toCSV(rows) {
  const headers = ['RIPIANO','TIPO','POSIZIONE'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const vals = headers.map(h => String(r[h] ?? '').replaceAll('"','""'));
    lines.push(vals.map(v => /[,\"\n]/.test(v) ? `"${v}"` : v).join(','));
  }
  return lines.join('\n');
}

clearBtn?.addEventListener('click', () => {
  if (q) q.value=''; if (selCampo) selCampo.value='ALL';
  if (fRip) fRip.value=''; if (fTip) fTip.value=''; if (fPos) fPos.value='';
  render(); saveState();
});
resetBtn?.addEventListener('click', () => {
  localStorage.removeItem(STATE_KEY);
  if (q) q.value=''; if (selCampo) selCampo.value='ALL';
  if (fRip) fRip.value=''; if (fTip) fTip.value=''; if (fPos) fPos.value='';
  sortOrder = []; updateSortIndicators(); render(); saveState();
});
[q, selCampo, fRip, fTip, fPos].forEach(el => { el && el.addEventListener('input', () => { render(); saveState(); }); });
selCampo?.addEventListener('change', () => { render(); saveState(); });
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'campo') { render(); saveState(); }});

// ===== Import =====
fileInput?.addEventListener('change', async (ev) => {
  const f = ev.target.files?.[0]; if (!f) return;
  const ext = (f.name.split('.').pop()||'').toLowerCase();
  if (ext === 'csv') {
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter(x=>x.length);
    const [head, ...rest] = lines;
    const headers = head.split(',').map(h => h.trim().toUpperCase());
    const idxR = headers.findIndex(h => h.includes('RIPIANO'));
    const idxT = headers.findIndex(h => h.includes('TIPO'));
    const idxP = headers.findIndex(h => h.includes('POSIZIONE'));
    const parseLine = (line) => {
      const parts = (line.match(/("[^"]*"|[^,]+)/g) || []).map(s=>s.replace(/^"|"$/g,''));
      return { RIPIANO: parts[idxR]||'', TIPO: parts[idxT]||'', POSIZIONE: parts[idxP]||'' };
    };
    ROWS = rest.map(parseLine).filter(r=>r.RIPIANO||r.TIPO||r.POSIZIONE);
  } else {
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type:'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const arr = XLSX.utils.sheet_to_json(ws, { defval:'' });
    const mapRow = (r) => {
      const keys = Object.keys(r);
      const get = (pred) => { const k = keys.find(k => pred(k.toUpperCase())); return k ? r[k] : ''; };
      return { RIPIANO: get(k=>k.includes('RIPIANO')), TIPO: get(k=>k.includes('TIPO')), POSIZIONE: get(k=>k.includes('POSIZIONE')) };
    };
    ROWS = arr.map(mapRow).filter(r=>r.RIPIANO||r.TIPO||r.POSIZIONE);
  }
  fileInput.value = '';
  render(); saveState();
});

// ===== Preset =====
const PRESETS_KEY = 'kardex-presets-v15';
function enforceExactType(s){ if(!s) return s; const t=String(s).trim(); if(/^=|^!|.*\*$/.test(t)) return t; return '=' + t; }
function getCurrentConfig(){ return { q:q?.value??'', campo:selCampo?.value??'ALL', fRip:fRip?.value??'', fTip:fTip?.value??'', fPos:fPos?.value??'', sort:sortOrder }; }
function applyConfig(cfg){
  if(!cfg) return;
  if(q) q.value = cfg.q ?? ''; if(selCampo) selCampo.value = cfg.campo ?? 'ALL';
  if(fRip) fRip.value = cfg.fRip ?? ''; if(fTip) fTip.value = cfg.fTip ?? ''; if(fPos) fPos.value = cfg.fPos ?? '';
  if(Array.isArray(cfg.sort)){ sortOrder = cfg.sort; updateSortIndicators(); }
  render(); saveState();
}
function loadPresets(){ try{return JSON.parse(localStorage.getItem(PRESETS_KEY))||[]}catch{return[]} }
function savePresets(list){ localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); }
function renderPresets(){
  if(!presetList) return;
  const presets = loadPresets(); presetList.innerHTML='';
  presets.forEach((p,idx)=>{
    const btn=document.createElement('button'); btn.textContent=p.name; btn.className='secondary'; btn.addEventListener('click',()=>applyConfig(p.cfg));
    const del=document.createElement('button'); del.textContent='❌'; del.className='secondary'; del.style.padding='0 6px';
    del.addEventListener('click',()=>{ const n=presets.filter((_,i)=>i!==idx); savePresets(n); renderPresets(); });
    const wrap=document.createElement('div'); wrap.style.display='flex'; wrap.style.alignItems='center'; wrap.style.gap='4px'; wrap.appendChild(btn); wrap.appendChild(del);
    presetList.appendChild(wrap);
  });
}
savePresetBtn?.addEventListener('click',()=>{
  const name=presetNameInput?.value?.trim(); if(!name){alert('Inserisci un nome per il preset');return;}
  const cfg=getCurrentConfig(); cfg.q=''; cfg.campo='ALL'; cfg.fTip=enforceExactType(cfg.fTip);
  const presets=loadPresets(); presets.push({name,cfg}); savePresets(presets); if(presetNameInput) presetNameInput.value=''; renderPresets();
});
renderPresets();

// ===== Avvio dati =====
loadData();

/* ===== TAB: Dati / Console ===== */
const dataCard = document.getElementById('dataView');
const consoleView = document.getElementById('consoleView');
const tabData = document.getElementById('tabData');
const tabConsole = document.getElementById('tabConsole');
function showData(){ dataCard?.classList.remove('hidden'); consoleView?.classList.add('hidden'); localStorage.setItem('kardex-tab','data'); }
function showConsole(){ dataCard?.classList.add('hidden'); consoleView?.classList.remove('hidden'); localStorage.setItem('kardex-tab','console'); }
tabData?.addEventListener('click', showData);
tabConsole?.addEventListener('click', showConsole);
(function restoreTab(){ (localStorage.getItem('kardex-tab') === 'console') ? showConsole() : showData(); })();

/* ===== Console: contenuto/posizioni ===== */
const CKEY = 'kardex-console-state';
const c = {
  alt: $('c_alt_val'), peso: $('c_peso_val'), carico: $('c_carico_val'), att: $('c_vassoio_att'),
  target: $('c_vassoio_target'),
  list: $('c_cont_list'),
  posA: $('c_pos_a'), posB: $('c_pos_b'),
  home: $('c_home'), mod: $('c_modifica'), svuota: $('c_svuota'),
  sblocca: $('c_sblocca'), preleva: $('c_preleva'),
};
(function loadConsoleState(){
  try{
    const s=JSON.parse(localStorage.getItem(CKEY)||'{}');
    if(s.att) c.att.textContent=s.att;
    if(typeof s.target!=='undefined') c.target.value=s.target;
    if(s.posA) c.posA.value=s.posA;
    if(s.posB) c.posB.value=s.posB;
    if(Array.isArray(s.content)) renderContentList(s.content);
  }catch{}
})();
function saveConsoleState(extra={}){
  const content = getCurrentContentCache();
  const s={ att:c.att?.textContent||'-', target:+c.target?.value||0, posA:c.posA?.value||'-', posB:c.posB?.value||'-', content };
  localStorage.setItem(CKEY, JSON.stringify({ ...s, ...extra }));
}
let _contentCache = null;
function getCurrentContentCache(){ return _contentCache ? _contentCache.slice() : []; }
function renderContentList(items){
  c.list.innerHTML = items.map(it => `<li>${escapeHtml(it.label)} <span class="muted">(${it.count})</span></li>`).join('');
}

function headNumber(str){ const m=String(str||'').match(/^\d+/); return m?m[0]:''; }
function deriveSide(posText){
  const t = norm(posText);
  if (t.includes('sinist')) return 'Sinistra';
  if (t.includes('destr')) return 'Destra';
  if (t.includes('centr')) return 'Centrale';
  return null;
}
function analyzeTray(trayNum){
  if(!trayNum) { _contentCache=[]; c.list.innerHTML=''; c.posA.value='-'; c.posB.value='-'; return; }
  const matches = ROWS.filter(r => headNumber(r.RIPIANO) === String(trayNum));
  // contenuto per TIPO
  const byTipo = new Map();
  for (const r of matches){
    const t = String(r.TIPO||'').trim() || '(Senza tipo)';
    byTipo.set(t, (byTipo.get(t)||0)+1);
  }
  const content = Array.from(byTipo.entries()).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count);
  _contentCache = content;
  renderContentList(content);
  // posizioni
  const sideCounts = { 'Sinistra':0, 'Centrale':0, 'Destra':0 };
  for (const r of matches){
    const s = deriveSide(r.POSIZIONE);
    if (s) sideCounts[s] = (sideCounts[s]||0)+1;
  }
  const ranked = Object.entries(sideCounts).sort((a,b)=>b[1]-a[1]).filter(([,v])=>v>0).map(([k])=>k);
  c.posA.value = ranked[0] || '-';
  c.posB.value = ranked[1] || '-';
}
function gotoTray(n){
  // filtra in Dati e passa alla tab Dati
  if (fRip) fRip.value = String(n);
  if (q) q.value = ''; if (selCampo) selCampo.value = 'ALL';
  render(); saveState(); showData();
}

c.preleva?.addEventListener('click', ()=>{
  const t = +c.target.value || 0;
  c.att.textContent = t;
  analyzeTray(t);
  saveConsoleState();
  gotoTray(t);
});
c.target?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ c.preleva.click(); } });

c.home?.addEventListener('click', ()=>{ showData(); });
c.mod?.addEventListener('click', ()=>{ alert('Modalità modifica parametri abilitata'); });
c.svuota?.addEventListener('click', ()=>{ c.target.value=0; c.posA.value='-'; c.posB.value='-'; _contentCache=[]; c.list.innerHTML=''; saveConsoleState(); });
c.sblocca?.addEventListener('click', ()=>{ alert('Sblocco eseguito'); });

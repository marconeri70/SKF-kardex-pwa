// ===============================================================
// Kardex Viewer - app.js (V5: IndexedDB + LocalStorage fallback)
// - Persistenza dataset: IndexedDB ("kardex-db" / store "rows"), fallback LS
// - Import JSON/CSV -> salva nel DB e resta dopo refresh/offline
// - Export JSON: TUTTO il dataset (ROWS) + preset + filtri
// - Filtri (TIPO esclusivo) + ricerca
// - Preset: salva/applica/gestisci (export/import preset)
// ===============================================================
(() => {
  'use strict';

  // -------------------- Costanti / Stato --------------------
  const PRESETS_KEY       = 'kardex-presets';
  const ACTIVE_PRESET_KEY = 'kardex-active-preset-name';
  const STATE_KEY         = 'kardex-state-v5';
  const DATA_KEY_LS       = 'kardex-imported-data-v1';   // fallback LS

  const IDB_DB_NAME   = 'kardex-db';
  const IDB_STORE     = 'rows';
  const IDB_VERSION   = 1;

  let ROWS = [];          // dataset corrente (persistito)
  let FILTERED_ROWS = [];
  let HEADERS = [];

  // -------------------- Helpers DOM --------------------
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const lower = (x) => (x ?? '').toString().toLowerCase();

  const UI = {
    q:null, campo:null, ripiano:null, tipologia:null, posizione:null,
    presetName:null, btnSave:null, exportCsv:null, exportJson:null,
    fileInput:null, resultsBadge:null, tableHead:null, tableBody:null,
    btnReset:null, btnClear:null
  };

  function hookUI() {
    UI.q         = $('#q');         UI.campo     = $('#selCampo');
    UI.ripiano   = $('#fRip');      UI.tipologia = $('#fTip');      UI.posizione = $('#fPos');
    UI.presetName= $('#presetNameInput');  UI.btnSave = $('#btnSavePreset');
    UI.exportCsv = $('#exportCsvBtn');     UI.exportJson = $('#exportJsonBtn') || null;
    UI.fileInput = $('#fileInput');
    UI.resultsBadge = $('#resultsBadge') || null;
    UI.tableHead = document.querySelector('table thead');
    UI.tableBody = document.querySelector('table tbody');
    UI.btnReset  = $('#btnReset') || null; UI.btnClear = $('#btnClear') || null;

    if (UI.exportCsv && !UI.exportJson) {
      const btn = document.createElement('button');
      btn.id = 'exportJsonBtn'; btn.type = 'button';
      btn.className = UI.exportCsv.className || 'btn';
      btn.style.marginLeft = '8px'; btn.textContent = 'Export JSON';
      UI.exportCsv.after(btn); UI.exportJson = btn;
    }
  }

  // -------------------- IndexedDB (con fallback LS) --------------------
  const hasIDB = !!(window.indexedDB);

  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async function idbPutAll(arr) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const st = tx.objectStore(IDB_STORE);
      st.clear(); // sovrascrivo dataset
      arr.forEach(obj => st.add({ value: obj }));
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
    });
  }

  async function idbGetAll() {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const st = tx.objectStore(IDB_STORE);
      const out = [];
      const req = st.openCursor();
      req.onsuccess = (e) => {
        const cur = e.target.result;
        if (cur) { out.push(cur.value.value); cur.continue(); }
        else resolve(out);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function idbClear() {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Fallback LS
  function lsSave(rows){ try{ localStorage.setItem(DATA_KEY_LS, JSON.stringify(rows||[])); }catch{} }
  function lsLoad(){ try{ return JSON.parse(localStorage.getItem(DATA_KEY_LS)||'[]'); }catch{ return []; } }
  function lsClear(){ localStorage.removeItem(DATA_KEY_LS); }

  async function saveDataset(rows) {
    if (hasIDB) { try { await idbPutAll(rows); return; } catch {} }
    lsSave(rows);
  }
  async function loadDataset() {
    if (hasIDB) { try { const a = await idbGetAll(); return a; } catch {} }
    return lsLoad();
  }
  async function clearDataset() {
    if (hasIDB) { try { await idbClear(); } catch {} }
    lsClear();
  }

  // -------------------- Preset/State --------------------
  function loadPresets(){ try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; } catch { return []; } }
  function savePresets(p){ localStorage.setItem(PRESETS_KEY, JSON.stringify(p ?? [])); }

  function getActivePresetName(){
    const fromInput = UI.presetName && UI.presetName.value.trim();
    return fromInput || localStorage.getItem(ACTIVE_PRESET_KEY) || '';
  }
  function setActivePresetName(name){
    localStorage.setItem(ACTIVE_PRESET_KEY, name || '');
    if (UI.presetName) UI.presetName.value = name || '';
  }

  function saveState(){ localStorage.setItem(STATE_KEY, JSON.stringify({filters:getFiltersFromUI(), activePreset:getActivePresetName()})); }
  function loadState(){
    try {
      const s = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      if (s.filters) setFiltersToUI(s.filters);
      if (s.activePreset) setActivePresetName(s.activePreset);
    } catch {}
  }

  // -------------------- Filtri / Render --------------------
  function normalizeRow(row) {
    if (Array.isArray(row)) {
      const keys = HEADERS.length ? HEADERS : ['RIPIANO','TIPO','POSIZIONE'];
      const obj = {}; keys.forEach((k,i) => obj[k] = row[i] ?? '');
      return obj;
    }
    return row;
  }

  function getFiltersFromUI(){
    return {
      quick:     UI.q ? UI.q.value.trim() : '',
      campo:     UI.campo ? (UI.campo.value || '') : '',
      ripiano:   UI.ripiano ? UI.ripiano.value.trim() : '',
      tipologia: UI.tipologia ? UI.tipologia.value.trim() : '',
      posizione: UI.posizione ? UI.posizione.value.trim() : ''
    };
  }
  function setFiltersToUI(f){
    if (!f) return;
    if (UI.q) UI.q.value = f.quick || '';
    if (UI.campo) UI.campo.value = f.campo || (UI.campo.options?.[0]?.value ?? '');
    if (UI.ripiano) UI.ripiano.value = f.ripiano || '';
    if (UI.tipologia) UI.tipologia.value = f.tipologia || '';
    if (UI.posizione) UI.posizione.value = f.posizione || '';
  }

  function filterRows(){
    const f = getFiltersFromUI();
    const q = lower(f.quick), campo = f.campo;

    FILTERED_ROWS = ROWS.filter(r0 => {
      const r = normalizeRow(r0);
      // TIPO esclusivo
      if (f.tipologia && lower(r.TIPO || r.tipologia) !== lower(f.tipologia)) return false;
      if (f.ripiano && lower(String(r.RIPIANO ?? r.ripiano)) !== lower(f.ripiano)) return false;
      if (f.posizione && lower(r.POSIZIONE || r.posizione) !== lower(f.posizione)) return false;

      if (q){
        if (campo && !/tutti/i.test(campo)){
          const v = r[campo] ?? r[campo?.toUpperCase?.()] ?? '';
          return lower(v).includes(q);
        }
        return Object.keys(r).some(k => lower(r[k]).includes(q));
      }
      return true;
    });
  }

  function renderTable(){
    if (!UI.tableBody) return;
    UI.tableBody.innerHTML = '';
    const rows = FILTERED_ROWS.length ? FILTERED_ROWS : ROWS;

    rows.forEach(r0 => {
      const r = normalizeRow(r0);
      const tr = document.createElement('tr');
      const keys = ['RIPIANO','TIPO','POSIZIONE', ...Object.keys(r).filter(k => !['RIPIANO','TIPO','POSIZIONE'].includes(k))];
      keys.forEach(k => { const td=document.createElement('td'); td.textContent = r[k] ?? ''; tr.appendChild(td); });
      UI.tableBody.appendChild(tr);
    });

    if (UI.resultsBadge){
      const n = (FILTERED_ROWS.length ? FILTERED_ROWS : ROWS).length;
      UI.resultsBadge.textContent = `${n} risultati`;
    }
  }

  function render(){ filterRows(); renderTable(); saveState(); }
  window.render = render;

  // -------------------- Export / Import --------------------
  function toCSV(rows){
    if (!rows || !rows.length) return '';
    const isObj = typeof rows[0] === 'object' && !Array.isArray(rows[0]);
    if (isObj){
      const headers = Object.keys(normalizeRow(rows[0]));
      const head = headers.join(',');
      const body = rows.map(r0 => {
        const r = normalizeRow(r0);
        return headers.map(h => String(r[h] ?? '').replaceAll('"','""')).map(v => `"${v}"`).join(',');
      }).join('\n');
      return head + '\n' + body;
    } else {
      return rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    }
  }

  function exportAsJSON(){
    const payload = {
      version: 5,
      exportedAt: new Date().toISOString(),
      activePreset: getActivePresetName(),
      filters: getFiltersFromUI(),
      presets: loadPresets(),
      rows: ROWS   // <— TUTTO il dataset
    };
    const name = `kardex_${payload.activePreset || 'no-preset'}_${Date.now()}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  }

  function exportAsCSV(){
    const csv = toCSV(ROWS); // <— tutto il dataset
    const name = `kardex_${getActivePresetName() || 'no-preset'}_${Date.now()}.csv`;
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  }

  async function importFileAuto(file, {append=false} = {}){
    if (!file) return;
    const text = await file.text();

    // JSON
    try {
      const obj = JSON.parse(text);
      if (obj && (Array.isArray(obj.rows) || Array.isArray(obj.dati_visibili))){
        const rows = obj.rows || obj.dati_visibili || [];
        if (Array.isArray(obj.presets)) savePresets(obj.presets);
        if (obj.activePreset || obj.preset_attivo) setActivePresetName(obj.activePreset || obj.preset_attivo);
        ROWS = append && Array.isArray(ROWS) ? ROWS.concat(rows) : rows;
        await saveDataset(ROWS);
        render();
        alert('✅ Import JSON completato');
        return;
      }
    } catch {}

    // CSV
    const lines = text.replace(/\r/g,'').split('\n').filter(x => x.trim() !== '');
    if (lines.length){
      const first = lines[0];
      const looksHeader = /[A-Za-z]/.test(first);
      let headers = []; const rows = [];

      const splitCsvLine = (line) => {
        const out=[]; let cur=''; let inQ=false;
        for (let i=0;i<line.length;i++){
          const ch=line[i];
          if (ch === '"'){ if (inQ && line[i+1] === '"'){ cur+='"'; i++; } else inQ=!inQ; }
          else if (ch===',' && !inQ){ out.push(cur); cur=''; }
          else cur+=ch;
        }
        out.push(cur);
        return out.map(s=>s.trim());
      };

      lines.forEach((ln, idx) => {
        const cols = splitCsvLine(ln);
        if (idx===0 && looksHeader) headers = cols;
        else if (looksHeader) { const obj={}; headers.forEach((h,i)=>obj[h]=cols[i]??''); rows.push(obj); }
        else rows.push(cols);
      });

      ROWS = rows;
      await saveDataset(ROWS);
      render();
      alert('✅ Import CSV completato');
      return;
    }

    alert('❌ File non riconosciuto. Usa JSON esportato dall’app o un CSV valido.');
  }

  // -------------------- Preset: Salva / Gestisci --------------------
  function saveCurrentAsPreset(){
    const name = (UI.presetName && UI.presetName.value.trim()) || '';
    if (!name) { alert('Inserisci un nome preset.'); return; }
    const presets = loadPresets();
    const payload = { name, filters: getFiltersFromUI(), savedAt: new Date().toISOString() };
    const idx = presets.findIndex(p => (p.name || '').toLowerCase() === name.toLowerCase());
    if (idx>=0) presets[idx] = payload; else presets.push(payload);
    savePresets(presets); setActivePresetName(name);
    alert('✅ Preset salvato');
  }

  function ensurePresetModal(){
    let modal = $('#presetModal'); if (modal) return modal;
    modal = document.createElement('div'); modal.id='presetModal';
    Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,.35)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'9999'});
    modal.innerHTML = `
      <div style="background:#fff;color:#111;max-width:520px;width:92%;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25)">
        <div style="padding:14px 16px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between">
          <strong>Preset salvati</strong>
          <button id="pmClose" style="border:0;background:transparent;font-size:18px;cursor:pointer">✖</button>
        </div>
        <div id="pmBody" style="padding:12px 16px;max-height:60vh;overflow:auto"></div>
        <div style="padding:12px 16px;border-top:1px solid #eee;display:flex;gap:8px;justify-content:flex-end">
          <button id="pmExport" class="btn">Esporta preset</button>
          <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">
            <input id="pmImport" type="file" style="display:none"/>
            <span class="btn" style="padding:.6rem .9rem;background:#eee;border-radius:8px;">Importa preset</span>
          </label>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',(e)=>{ if(e.target===modal) modal.remove(); });
    modal.querySelector('#pmClose').addEventListener('click', ()=> modal.remove());
    modal.querySelector('#pmExport').addEventListener('click', exportPresetsOnly);
    modal.querySelector('#pmImport').addEventListener('change', importPresetsOnly);
    return modal;
  }

  function renderPresetList(){
    const modal = ensurePresetModal();
    const body = modal.querySelector('#pmBody');
    const presets = loadPresets();
    if (!presets.length){ body.innerHTML = `<div style="color:#666">Nessun preset salvato.</div>`; return; }
    const active = getActivePresetName();
    body.innerHTML = presets.map(p => `
      <div style="border:1px solid #eee;border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div>
          <div><strong>${p.name}</strong> ${p.name===active?'<span style="color:#0a7cff">• attivo</span>':''}</div>
          <div style="font-size:.9rem;color:#666">ripiano: <code>${p.filters?.ripiano||''}</code> · tipologia: <code>${p.filters?.tipologia||''}</code> · posizione: <code>${p.filters?.posizione||''}</code> · campo: <code>${p.filters?.campo||''}</code> · cerca: <code>${p.filters?.quick||''}</code></div>
        </div>
        <div style="display:flex;gap:6px">
          <button data-act="apply"  data-name="${p.name}">Applica</button>
          <button data-act="rename" data-name="${p.name}">Rinomina</button>
          <button data-act="delete" data-name="${p.name}" style="color:#b91c1c">Elimina</button>
        </div>
      </div>`).join('');

    body.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click',(e)=>{
        const name=e.currentTarget.getAttribute('data-name');
        const act =e.currentTarget.getAttribute('data-act');
        if (act==='apply')  applyPreset(name);
        if (act==='rename') renamePreset(name);
        if (act==='delete') deletePreset(name);
      });
    });
  }

  function applyPreset(name){
    const p = loadPresets().find(x => (x.name||'') === name);
    if (!p){ alert('Preset non trovato'); return; }
    setActivePresetName(name);
    setFiltersToUI(p.filters);
    render();
    $('#presetModal')?.remove();
  }

  function renamePreset(name){
    const presets = loadPresets(); const idx = presets.findIndex(x => (x.name||'') === name);
    if (idx<0) return;
    const nuovo = prompt('Nuovo nome preset:', name); if (!nuovo) return;
    presets[idx].name = nuovo; savePresets(presets);
    if (getActivePresetName() === name) setActivePresetName(nuovo);
    renderPresetList();
  }

  function deletePreset(name){
    if (!confirm(`Eliminare il preset "${name}"?`)) return;
    let presets = loadPresets().filter(p => (p.name||'') !== name);
    savePresets(presets);
    if (getActivePresetName() === name) setActivePresetName('');
    renderPresetList();
  }

  function exportPresetsOnly(){
    const payload = { version:1, exportedAt:new Date().toISOString(), activePreset:getActivePresetName(), presets:loadPresets() };
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='kardex_presets.json'; a.click();
  }
  async function importPresetsOnly(e){
    const file = e.target.files[0]; if (!file) return;
    try{
      const text = await file.text(); const obj = JSON.parse(text);
      if (!Array.isArray(obj?.presets)) { alert('File preset non valido'); return; }
      savePresets(obj.presets); if (obj.activePreset) setActivePresetName(obj.activePreset);
      renderPresetList(); alert('✅ Preset importati');
    }catch{ alert('❌ Errore import preset'); }
  }

  // -------------------- Event wiring --------------------
  function wireEvents(){
    const onChange = () => render();
    ['input','change'].forEach(ev=>{
      UI.q?.addEventListener(ev,onChange);
      UI.campo?.addEventListener(ev,onChange);
      UI.ripiano?.addEventListener(ev,onChange);
      UI.tipologia?.addEventListener(ev,onChange);
      UI.posizione?.addEventListener(ev,onChange);
    });

    UI.btnClear?.addEventListener('click',(e)=>{ e.preventDefault?.();
      setFiltersToUI({quick:'',campo:UI.campo?.options?.[0]?.value||'Tutti',ripiano:'',tipologia:'',posizione:''});
      render();
    });

    UI.btnReset?.addEventListener('click', async (e)=>{ e.preventDefault?.();
      localStorage.removeItem(STATE_KEY);
      await clearDataset();  // <— pulisco persistenza
      setFiltersToUI({quick:'',campo:UI.campo?.options?.[0]?.value||'Tutti',ripiano:'',tipologia:'',posizione:''});
      await fetchInitialData(true); render();
    });

    UI.btnSave?.addEventListener('click',(e)=>{ e.preventDefault?.(); saveCurrentAsPreset(); });

    UI.exportCsv?.addEventListener('click',(e)=>{ e.preventDefault?.(); exportAsCSV(); });
    UI.exportJson?.addEventListener('click',(e)=>{ e.preventDefault?.(); exportAsJSON(); });

    UI.fileInput?.addEventListener('change',(e)=> importFileAuto(e.target.files[0], {append:false}));

    // Bottone Gestisci Preset
    let manageBtn = $$('button').find(b => /gestisci\s*preset/i.test(b.textContent||''));
    if (!manageBtn && UI.exportJson) {
      manageBtn = document.createElement('button');
      manageBtn.type='button'; manageBtn.textContent='Gestisci Preset';
      manageBtn.className = UI.exportJson.className || 'btn';
      manageBtn.style.marginLeft='8px';
      UI.exportJson.after(manageBtn);
    }
    manageBtn?.addEventListener('click', () => renderPresetList());
  }

  // -------------------- Caricamento iniziale --------------------
  async function fetchInitialData(forceFile=false){
    // 1) dataset da persistenza (IDB/LS)
    if (!forceFile){
      const saved = await loadDataset();
      if (Array.isArray(saved) && saved.length){ ROWS = saved; return; }
    }
    // 2) fallback: file statico
    try{
      const res = await fetch('data/kardex.json', {cache:'no-store'});
      if (res.ok){
        const json = await res.json();
        ROWS = Array.isArray(json) ? json : (json.rows || json.data || []);
      }
    }catch{}
  }

  async function bootstrap(){
    hookUI();
    if (document.querySelector('table thead')){
      HEADERS = Array.from(document.querySelectorAll('table thead th')).map(th => th.textContent.trim()).filter(Boolean);
    }
    loadState();
    await fetchInitialData(false);
    render();
    wireEvents();
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();

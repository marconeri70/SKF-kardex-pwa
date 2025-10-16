
// ========================= app.js (FINAL) =========================
// - Filtri corretti (TIPO esclusivo, match su token esatto: '/', ',', ';')
// - Nessuna UI dei preset nella prima pagina
// - Applica preset salvato e, se richiesto, mostra subito la/e POSIZIONE trovata/e
// - Export JSON/CSV + Import auto (opzionale, invariato se già presente)
// ==================================================================
(() => {
  'use strict';

  const PRESETS_KEY = 'kardex-presets';
  const ACTIVE_PRESET_KEY = 'kardex-active-preset-name';
  const STATE_KEY = 'kardex-state-v5';
  const PRESET_PENDING_FLAG = 'kardex-preset-pending'; // '1' => alla prossima load mostra posizioni

  let ROWS = [];
  let FILTERED = [];
  let HEADERS = [];

  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const lower = (x) => (x ?? '').toString().toLowerCase().trim();

  // --- UI refs by IDs (assicurati che esistano) ---
  const UI = {
    q: $('#q'),
    campo: $('#selCampo'),
    ripiano: $('#fRip'),
    tipologia: $('#fTip'),
    posizione: $('#fPos'),
    resultsBadge: $('#resultsBadge'),
    tableHead: document.querySelector('table thead'),
    tableBody: document.querySelector('table tbody'),
    btnClear: $('#btnClear'),
    btnReset: $('#btnReset'),
    exportCsv: $('#exportCsvBtn'),
    exportJson: $('#exportJsonBtn'),
    fileInput: $('#fileInput')
  };

  // --- helpers ---
  function loadPresets() { try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; } catch { return []; } }
  function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify({ filters:getFilters(), activePreset: localStorage.getItem(ACTIVE_PRESET_KEY) || '' }));
  }
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      if (s.filters) setFilters(s.filters);
    } catch {}
  }
  function setActivePresetName(name) { localStorage.setItem(ACTIVE_PRESET_KEY, name || ''); }

  function normalize(r){
    if (Array.isArray(r)){
      const keys = HEADERS.length ? HEADERS : ['RIPIANO','TIPO','POSIZIONE'];
      const o={}; keys.forEach((k,i)=>o[k]=r[i]??''); return o;
    }
    return r;
  }

  // match esatto del tipo: divide TIPO su separatori comuni e confronta esattamente
  function matchesTypeExclusive(rowType, selectedType){
    if (!selectedType) return true;
    const s = lower(selectedType);
    const tokens = String(rowType||'').split(/[/,;|]/).map(t => lower(t));
    return tokens.some(t => t === s);
  }

  function getFilters(){
    return {
      quick: UI.q?.value.trim() || '',
      campo: UI.campo?.value || 'Tutti',
      ripiano: UI.ripiano?.value.trim() || '',
      tipologia: UI.tipologia?.value.trim() || '',
      posizione: UI.posizione?.value.trim() || ''
    };
  }
  function setFilters(f){
    if (UI.q) UI.q.value = f.quick || '';
    if (UI.campo) UI.campo.value = f.campo || 'Tutti';
    if (UI.ripiano) UI.ripiano.value = f.ripiano || '';
    if (UI.tipologia) UI.tipologia.value = f.tipologia || '';
    if (UI.posizione) UI.posizione.value = f.posizione || '';
  }

  function applyFilters(){
    const f = getFilters();
    const q = lower(f.quick);
    const campo = f.campo;

    FILTERED = ROWS.filter(r0 => {
      const r = normalize(r0);

      // TIPOLGIA ESCLUSIVA (token esatto)
      if (f.tipologia && !matchesTypeExclusive(r.TIPO || r.tipologia, f.tipologia)) return false;
      if (f.ripiano   && lower(String(r.RIPIANO ?? r.ripiano)) !== lower(f.ripiano)) return false;
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
    const rows = FILTERED.length ? FILTERED : ROWS;
    rows.forEach(r0 => {
      const r = normalize(r0);
      const tr = document.createElement('tr');
      ['RIPIANO','TIPO','POSIZIONE'].forEach(k => {
        const td = document.createElement('td');
        td.textContent = r[k] ?? '';
        tr.appendChild(td);
      });
      UI.tableBody.appendChild(tr);
    });
    if (UI.resultsBadge) UI.resultsBadge.textContent = (FILTERED.length?FILTERED:ROWS).length + ' risultati';
  }

  function render(){ applyFilters(); renderTable(); saveState(); }

  // --- Export/Import (opzionali: manteniamo se presenti i bottoni) ---
  function toCSV(rows){
    if (!rows || !rows.length) return '';
    const headers = ['RIPIANO','TIPO','POSIZIONE'];
    const head = headers.join(',');
    const body = rows.map(r0=>{
      const r = normalize(r0);
      return headers.map(h => String(r[h]??'').replaceAll('"','""')).map(v => `"${v}"`).join(',');
    }).join('\n');
    return head + '\n' + body;
  }
  function exportJSON(){
    const payload = {
      version: 5,
      exportedAt: new Date().toISOString(),
      activePreset: localStorage.getItem(ACTIVE_PRESET_KEY) || '',
      filters: getFilters(),
      presets: loadPresets(),
      rows: FILTERED.length?FILTERED:ROWS
    };
    const name = `kardex_${payload.activePreset || 'no-preset'}_${Date.now()}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  }
  function exportCSV(){
    const csv = toCSV(FILTERED.length?FILTERED:ROWS);
    const name = `kardex_${(localStorage.getItem(ACTIVE_PRESET_KEY) || 'no-preset')}_${Date.now()}.csv`;
    const blob = new Blob([csv], { type:'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  }
  async function importAuto(file){
    if (!file) return;
    const text = await file.text();
    try{
      const obj = JSON.parse(text);
      const rows = obj.rows || obj.dati_visibili;
      if (Array.isArray(rows)){ ROWS = rows; render(); alert('✅ Import JSON'); return; }
    }catch{}
    const lines = text.replace(/\r/g,'').split('\n').filter(x=>x.trim()!=='');
    if (lines.length){
      const headers = lines[0].split(',').map(s=>s.replace(/^"|"$/g,'').trim());
      const out=[];
      for (let i=1;i<lines.length;i++){
        const cols = lines[i].split(',').map(s=>s.replace(/^"|"$/g,'').trim());
        const o={}; headers.forEach((h,idx)=>o[h]=cols[idx]||''); out.push(o);
      }
      ROWS = out; render(); alert('✅ Import CSV'); return;
    }
    alert('❌ File non riconosciuto');
  }

  // --- Preset integration on index: apply and show positions ---
  function applyPendingPresetPositionsIfAny(){
    if (localStorage.getItem(PRESET_PENDING_FLAG) !== '1') return;
    localStorage.removeItem(PRESET_PENDING_FLAG);

    // dopo render -> prendi posizioni uniche
    const data = FILTERED.length ? FILTERED : ROWS;
    const positions = Array.from(new Set(data.map(r0 => (normalize(r0).POSIZIONE || '').toString().trim()).filter(Boolean)));
    if (!positions.length){
      alert('Nessuna posizione trovata per il preset selezionato.');
      return;
    }
    if (positions.length === 1){
      alert('📍 Posizione: ' + positions[0]);
    } else {
      alert('📍 Posizioni trovate:\n- ' + positions.join('\n- '));
    }
    // opzionale: scroll to first row
    const firstRow = document.querySelector('tbody tr');
    firstRow?.scrollIntoView({behavior:'smooth', block:'center'});
  }

  function wire(){
    const on = (el,ev,fn)=> el && el.addEventListener(ev,fn);
    ['input','change'].forEach(ev=>{
      on(UI.q,ev,render); on(UI.campo,ev,render);
      on(UI.ripiano,ev,render); on(UI.tipologia,ev,render); on(UI.posizione,ev,render);
    });
    on(UI.btnClear,'click',e=>{e.preventDefault(); setFilters({quick:'',campo:'Tutti',ripiano:'',tipologia:'',posizione:''}); render();});
    on(UI.btnReset,'click',e=>{e.preventDefault(); localStorage.removeItem(STATE_KEY); setFilters({quick:'',campo:'Tutti',ripiano:'',tipologia:'',posizione:''}); render();});
    on(UI.exportCsv,'click',e=>{e.preventDefault(); exportCSV();});
    on(UI.exportJson,'click',e=>{e.preventDefault(); exportJSON();});
    on(UI.fileInput,'change',e=> importAuto(e.target.files[0]));
  }

  async function boot(){
    // headers
    if (UI.tableHead){
      HEADERS = Array.from(UI.tableHead.querySelectorAll('th')).map(th=>th.textContent.trim()).filter(Boolean);
    }
    loadState();
    // dati
    try {
      const res = await fetch('data/kardex.json', {cache:'no-store'});
      if (res.ok) {
        const j = await res.json();
        ROWS = Array.isArray(j) ? j : (j.rows || j.data || []);
      }
    } catch {}

    render();
    wire();
    // se arrivo da preset.html con "pending", mostra subito posizioni
    applyPendingPresetPositionsIfAny();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

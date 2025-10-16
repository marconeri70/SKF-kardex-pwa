
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

  // ===== Preset Manager FIX (drop-in) =====
(function(){
  'use strict';

  const PRESETS_KEY = 'kardex-presets';
  const ACTIVE_PRESET_KEY = 'kardex-active-preset-name';

  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function loadPresets(){ try{return JSON.parse(localStorage.getItem(PRESETS_KEY))||[]}catch{return[]} }
  function savePresets(p){ localStorage.setItem(PRESETS_KEY, JSON.stringify(p??[])); }
  function getActivePresetName(){ return localStorage.getItem(ACTIVE_PRESET_KEY) || ''; }
  function setActivePresetName(n){ localStorage.setItem(ACTIVE_PRESET_KEY, n||''); }

  function getFiltersFromUI(){
    const q   = $('#q')?.value.trim() || '';
    const cam = $('#selCampo')?.value || '';
    const rip = $('#fRip')?.value.trim() || '';
    const tip = $('#fTip')?.value.trim() || '';
    const pos = $('#fPos')?.value.trim() || '';
    return {quick:q, campo:cam, ripiano:rip, tipologia:tip, posizione:pos};
  }
  function setFiltersToUI(f){
    if (!f) return;
    if ($('#q'))       $('#q').value = f.quick || '';
    if ($('#selCampo'))$('#selCampo').value = f.campo || ($('#selCampo').options?.[0]?.value ?? '');
    if ($('#fRip'))    $('#fRip').value = f.ripiano || '';
    if ($('#fTip'))    $('#fTip').value = f.tipologia || '';
    if ($('#fPos'))    $('#fPos').value = f.posizione || '';
    if (typeof window.render === 'function') window.render();
  }

  const saveBtn = $('#btnSavePreset') || $$('button').find(b => /salva/i.test(b.textContent||''));
  const nameInput = $('#presetNameInput') || $$('input').find(i => /nome preset/i.test(i.placeholder||''));

  function saveCurrentPreset(){
    const name = (nameInput?.value || '').trim();
    if (!name) { alert('Inserisci un nome preset'); return; }
    const presets = loadPresets();
    const payload = { name, filters: getFiltersFromUI(), savedAt: new Date().toISOString() };
    const idx = presets.findIndex(p => (p.name||'').toLowerCase() === name.toLowerCase());
    if (idx>=0) presets[idx] = payload; else presets.push(payload);
    savePresets(presets);
    setActivePresetName(name);
    alert('✅ Preset salvato');
  }
  if (saveBtn) saveBtn.addEventListener('click', e => { e.preventDefault?.(); saveCurrentPreset(); });

  let manageBtn = $$('button').find(b => /gestisci\s*preset/i.test(b.textContent||''));
  if (!manageBtn) {
    const exportCsv = $('#exportCsvBtn') || $$('button').find(b => /export\s*csv/i.test(b.textContent||''));
    if (exportCsv) {
      manageBtn = document.createElement('button');
      manageBtn.type = 'button';
      manageBtn.textContent = 'Gestisci Preset';
      manageBtn.className = exportCsv.className || 'btn';
      manageBtn.style.marginLeft = '8px';
      exportCsv.after(manageBtn);
    }
  }

  function ensureModal(){
    let modal = $('#presetModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'presetModal';
    Object.assign(modal.style, {
      position:'fixed', inset:'0', background:'rgba(0,0,0,.35)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:'9999'
    });
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
    modal.addEventListener('click', (e)=>{ if (e.target===modal) modal.remove(); });
    modal.querySelector('#pmClose').addEventListener('click', ()=> modal.remove());
    modal.querySelector('#pmExport').addEventListener('click', exportPresetsOnly);
    modal.querySelector('#pmImport').addEventListener('change', importPresetsOnly);
    return modal;
  }

  function renderModalList(){
    const modal = ensureModal();
    const body = modal.querySelector('#pmBody');
    const presets = loadPresets();
    if (!presets.length) {
      body.innerHTML = `<div style="color:#666">Nessun preset salvato.</div>`;
      return;
    }
    const active = getActivePresetName();
    body.innerHTML = presets.map(p => `
      <div style="border:1px solid #eee;border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div>
          <div><strong>${p.name}</strong> ${p.name===active?'<span style="color:#0a7cff">• attivo</span>':''}</div>
          <div style="font-size:.9rem;color:#666">ripiano: <code>${p.filters?.ripiano||''}</code> · tipologia: <code>${p.filters?.tipologia||''}</code> · posizione: <code>${p.filters?.posizione||''}</code> · campo: <code>${p.filters?.campo||''}</code> · cerca: <code>${p.filters?.quick||''}</code></div>
        </div>
        <div style="display:flex;gap:6px">
          <button data-act="apply" data-name="${p.name}">Applica</button>
          <button data-act="rename" data-name="${p.name}">Rinomina</button>
          <button data-act="delete" data-name="${p.name}" style="color:#b91c1c">Elimina</button>
        </div>
      </div>
    `).join('');

    body.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.currentTarget.getAttribute('data-name');
        const act  = e.currentTarget.getAttribute('data-act');
        if (act === 'apply') applyPreset(name);
        if (act === 'rename') renamePreset(name);
        if (act === 'delete') deletePreset(name);
      });
    });
  }

  function applyPreset(name){
    const presets = loadPresets();
    const p = presets.find(x => (x.name||'') === name);
    if (!p) { alert('Preset non trovato'); return; }
    setActivePresetName(name);
    setFiltersToUI(p.filters);
    $('#presetModal')?.remove();
  }

  function renamePreset(name){
    const presets = loadPresets();
    const idx = presets.findIndex(x => (x.name||'') === name);
    if (idx<0) return;
    const nuovo = prompt('Nuovo nome preset:', name);
    if (!nuovo) return;
    presets[idx].name = nuovo;
    savePresets(presets);
    if (getActivePresetName() === name) setActivePresetName(nuovo);
    renderModalList();
  }

  function deletePreset(name){
    if (!confirm(`Eliminare il preset "${name}"?`)) return;
    let presets = loadPresets().filter(p => (p.name||'') !== name);
    savePresets(presets);
    if (getActivePresetName() === name) setActivePresetName('');
    renderModalList();
  }

  function exportPresetsOnly(){
    const payload = { version:1, exportedAt:new Date().toISOString(), activePreset:getActivePresetName(), presets:loadPresets() };
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download='kardex_presets.json'; a.click();
  }
  async function importPresetsOnly(e){
    const file = e.target.files[0]; if (!file) return;
    try{
      const text = await file.text();
      const obj = JSON.parse(text);
      if (!Array.isArray(obj?.presets)) { alert('File preset non valido'); return; }
      savePresets(obj.presets);
      if (obj.activePreset) setActivePresetName(obj.activePreset);
      renderModalList();
      alert('✅ Preset importati');
    }catch{ alert('❌ Errore import preset'); }
  }

  if (manageBtn) manageBtn.addEventListener('click', () => { renderModalList(); });

})();

  document.addEventListener('DOMContentLoaded', boot);
})();


(() => {
  'use strict';

  const PRESETS_KEY = 'kardex-presets';
  const ACTIVE_PRESET_KEY = 'kardex-active-preset-name';
  const STATE_KEY = 'kardex-state-v4';

  let ROWS = [];
  let FILTERED = [];
  let HEADERS = [];

  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const lower = x => (x ?? '').toString().toLowerCase();

  // UI refs
  const UI = {
    q: $('#q'), campo: $('#selCampo'),
    ripiano: $('#fRip'), tipologia: $('#fTip'), posizione: $('#fPos'),
    presetName: $('#presetNameInput'), btnSave: $('#btnSavePreset'),
    fileInput: $('#fileInput'),
    exportCsv: $('#exportCsvBtn'), exportJson: $('#exportJsonBtn'),
    tableHead: document.querySelector('table thead'),
    tableBody: document.querySelector('table tbody'),
    resultsBadge: $('#resultsBadge'),
    btnClear: $('#btnClear'),
    btnReset: $('#btnReset'),
    presetList: $('#presetList')
  };

  // storage helpers
  const loadPresets  = () => { try{return JSON.parse(localStorage.getItem(PRESETS_KEY))||[]}catch{return[]} };
  const savePresets  = p  => localStorage.setItem(PRESETS_KEY, JSON.stringify(p??[]));
  const getActivePresetName = () => (UI.presetName?.value.trim()) || localStorage.getItem(ACTIVE_PRESET_KEY) || '';
  const setActivePresetName = n => { localStorage.setItem(ACTIVE_PRESET_KEY, n||''); if(UI.presetName) UI.presetName.value=n||''; };

  const saveState = () => localStorage.setItem(STATE_KEY, JSON.stringify({filters:getFilters(), active:getActivePresetName()}));
  const loadState = () => { try{ const s=JSON.parse(localStorage.getItem(STATE_KEY)||'{}'); if(s.filters) setFilters(s.filters); if(s.active) setActivePresetName(s.active); }catch{} };

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
    if (UI.q) UI.q.value = f.quick||'';
    if (UI.campo) UI.campo.value = f.campo||'Tutti';
    if (UI.ripiano) UI.ripiano.value = f.ripiano||'';
    if (UI.tipologia) UI.tipologia.value = f.tipologia||'';
    if (UI.posizione) UI.posizione.value = f.posizione||'';
  }

  function normalize(r){
    if (Array.isArray(r)){
      const keys = HEADERS.length?HEADERS:['RIPIANO','TIPO','POSIZIONE'];
      const o={}; keys.forEach((k,i)=>o[k]=r[i]??''); return o;
    } return r;
  }

  function applyFilters(){
    const f = getFilters();
    const q = lower(f.quick);
    const campo = f.campo;

    FILTERED = ROWS.filter(r0=>{
      const r = normalize(r0);
      if (f.tipologia && lower(r.TIPO||r.tipologia)!==lower(f.tipologia)) return false;
      if (f.ripiano   && lower(String(r.RIPIANO??r.ripiano))!==lower(f.ripiano)) return false;
      if (f.posizione && lower(r.POSIZIONE||r.posizione)!==lower(f.posizione)) return false;

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
    UI.tableBody.innerHTML='';
    const rows = FILTERED.length?FILTERED:ROWS;
    rows.forEach(r0=>{
      const r = normalize(r0);
      const tr = document.createElement('tr');
      ['RIPIANO','TIPO','POSIZIONE'].forEach(k=>{
        const td=document.createElement('td'); td.textContent=r[k]??''; tr.appendChild(td);
      });
      UI.tableBody.appendChild(tr);
    });
    if (UI.resultsBadge){
      UI.resultsBadge.textContent = (FILTERED.length?FILTERED:ROWS).length + " risultati";
    }
  }
  function render(){ applyFilters(); renderTable(); saveState(); }

  // ---- presets UI ----
  function renderPresetList(){
    if (!UI.presetList) return;
    const presets = loadPresets();
    UI.presetList.innerHTML = '';
    if (!presets.length){
      const ghost = document.createElement('div');
      ghost.className='preset-row';
      ghost.innerHTML = '<div class="preset-name ghost">Nessun preset salvato</div>';
      UI.presetList.appendChild(ghost);
      return;
    }
    presets.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
    presets.forEach(p=>{
      const row = document.createElement('div');
      row.className='preset-row';
      const name = document.createElement('div');
      name.className='preset-name';
      name.textContent = p.name;
      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Carica';
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Elimina';
      row.appendChild(name); row.appendChild(loadBtn); row.appendChild(delBtn);
      UI.presetList.appendChild(row);

      loadBtn.addEventListener('click',()=>{
        setActivePresetName(p.name);
        setFilters(p.filters||{});
        render();
      });
      delBtn.addEventListener('click',()=>{
        const all = loadPresets().filter(x => (x.name||'') !== p.name);
        savePresets(all);
        if (getActivePresetName()===p.name) setActivePresetName('');
        renderPresetList();
      });
    });
  }

  // ---- import/export ----
  function toCSV(rows){
    if (!rows||!rows.length) return '';
    const headers = ['RIPIANO','TIPO','POSIZIONE'];
    const head = headers.join(',');
    const body = rows.map(r0=>{
      const r = normalize(r0);
      return headers.map(h=>String(r[h]??'').replaceAll('"','""')).map(v=>`"${v}"`).join(',');
    }).join('\\n');
    return head + '\\n' + body;
  }
  function exportJSON(){
    const payload = {
      version:4, exportedAt:new Date().toISOString(),
      activePreset:getActivePresetName(),
      filters:getFilters(),
      presets:loadPresets(),
      rows: FILTERED.length?FILTERED:ROWS
    };
    const name = `kardex_${payload.activePreset||'no-preset'}_${Date.now()}.json`;
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click();
  }
  function exportCSV(){
    const csv = toCSV(FILTERED.length?FILTERED:ROWS);
    const name = `kardex_${getActivePresetName()||'no-preset'}_${Date.now()}.csv`;
    const blob = new Blob([csv],{type:'text/csv'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click();
  }
  async function importAuto(file){
    if (!file) return;
    const text = await file.text();
    try{
      const obj = JSON.parse(text);
      const rows = obj.rows || obj.dati_visibili;
      if (Array.isArray(obj.presets)) savePresets(obj.presets);
      if (obj.activePreset || obj.preset_attivo) setActivePresetName(obj.activePreset || obj.preset_attivo);
      if (Array.isArray(rows)){ ROWS = rows; render(); renderPresetList(); alert('✅ Import JSON'); return; }
    }catch{}
    // CSV naive
    const lines = text.replace(/\\r/g,'').split('\\n').filter(x=>x.trim()!=='');
    if (lines.length){
      const headers = lines[0].split(',').map(s=>s.replace(/^"|"$/g,'').trim());
      const out = [];
      for (let i=1;i<lines.length;i++){
        const cols = lines[i].split(',').map(s=>s.replace(/^"|"$/g,'').trim());
        const o={};
        headers.forEach((h,idx)=>o[h]=cols[idx]||'');
        out.push(o);
      }
      ROWS = out; render(); alert('✅ Import CSV'); return;
    }
    alert('❌ File non riconosciuto');
  }

  // ---- events ----
  function wire(){
    const on = (el,ev,fn)=> el&&el.addEventListener(ev,fn);
    ['input','change'].forEach(ev=>{
      on(UI.q,ev,render); on(UI.campo,ev,render); on(UI.ripiano,ev,render);
      on(UI.tipologia,ev,render); on(UI.posizione,ev,render);
    });
    on(UI.btnClear,'click',e=>{e.preventDefault(); setFilters({quick:'',campo:'Tutti',ripiano:'',tipologia:'',posizione:''}); render();});
    on(UI.btnReset,'click',e=>{e.preventDefault(); localStorage.removeItem(STATE_KEY); setFilters({quick:'',campo:'Tutti',ripiano:'',tipologia:'',posizione:''}); render();});

    on(UI.btnSave,'click',e=>{
      e.preventDefault();
      const name = UI.presetName?.value.trim();
      if (!name) return alert('Inserisci un nome preset');
      const presets = loadPresets();
      const payload = { name, filters:getFilters(), savedAt:new Date().toISOString() };
      const idx = presets.findIndex(p => (p.name||'').toLowerCase()===name.toLowerCase());
      if (idx>=0) presets[idx]=payload; else presets.push(payload);
      savePresets(presets);
      setActivePresetName(name);
      renderPresetList();
      alert('✅ Preset salvato');
    });

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
    // data
    try{
      const res = await fetch('data/kardex.json',{cache:'no-store'});
      if (res.ok){
        const j = await res.json();
        ROWS = Array.isArray(j) ? j : (j.rows || j.data || []);
      }
    }catch{}
    render();
    renderPresetList();
    wire();
  }
  document.addEventListener('DOMContentLoaded', boot);
})();

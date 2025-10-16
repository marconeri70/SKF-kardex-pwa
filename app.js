
// ===============================================================
// Kardex Viewer - app.js (FIX V2 robusto per filtri & preset)
// - Rilevamento campi via placeholder/testo (no dipendenza da ID)
// - Filtri funzionanti (tipologia esclusiva)
// - Preset salva/carica con localStorage
// - Export JSON/CSV + Import auto (come versione precedente)
// ===============================================================

(() => {
  'use strict';

  // -------------------- Stato --------------------
  const PRESETS_KEY = 'kardex-presets';
  const ACTIVE_PRESET_KEY = 'kardex-active-preset-name';
  const STATE_KEY = 'kardex-state-v2';

  let ROWS = [];          // Dati originali
  let FILTERED_ROWS = []; // Dati filtrati correnti
  let HEADERS = [];       // Intestazioni tabella

  // -------------------- Utilità --------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const lower = (s) => (s ?? '').toString().toLowerCase();

  function includesAny(hay, needles) {
    hay = lower(hay);
    return needles.some(n => hay.includes(lower(n)));
  }

  function getInputByPlaceholder(needles) {
    const els = $$('input');
    return els.find(el => includesAny(el.placeholder || '', needles)) || null;
  }

  function getButtonByText(needles) {
    const els = $$('button');
    return els.find(el => includesAny(el.textContent || '', needles)) || null;
  }

  function getSelectNearText(needles) {
    // prova: select con label che contiene "Campo", altrimenti il primo select
    const labels = $$('label');
    for (const lab of labels) {
      if (includesAny(lab.textContent || '', needles)) {
        const forId = lab.getAttribute('for');
        if (forId) {
          const el = document.getElementById(forId);
          if (el && el.tagName === 'SELECT') return el;
        }
        const siblingSelect = lab.parentElement?.querySelector('select');
        if (siblingSelect) return siblingSelect;
      }
    }
    return $('select') || null;
  }

  // Mappa campi UI (rilevati dinamicamente)
  const UI = {
    q: null, campo: null, ripiano: null, tipologia: null, posizione: null,
    presetName: null, btnSave: null, exportCsv: null, exportJson: null,
    fileInput: null, resultsBadge: null, tableHead: null, tableBody: null
  };

  function detectUI() {
    UI.q         = getInputByPlaceholder(['cerca', 'search']);
    UI.campo     = getSelectNearText(['campo']);
    UI.ripiano   = getInputByPlaceholder(['ripiano', 'es. 10']);
    UI.tipologia = getInputByPlaceholder(['tipo', 'tipologia', 'montaggio']);
    UI.posizione = getInputByPlaceholder(['posizion', 'destra', 'sinistra', 'centrale']);

    UI.presetName = getInputByPlaceholder(['nome preset']);
    UI.btnSave    = getButtonByText(['salva']);

    // export: prova a trovare pulsanti per CSV/JSON o quello con testo "Export CSV"
    UI.exportCsv  = getButtonByText(['export csv', 'csv']);
    UI.exportJson = getButtonByText(['export json', 'json']) || null;

    UI.fileInput  = $('#fileInput') || $('input[type="file"]');
    UI.resultsBadge = $$('span,div').find(n => includesAny(n.textContent || '', ['risultati'])) || null;
    UI.tableHead  = $('table thead');
    UI.tableBody  = $('table tbody');
  }

  // -------------------- Persistenza --------------------
  function loadPresets() {
    try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; }
    catch { return []; }
  }
  function savePresets(presets) {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets ?? []));
  }
  function getActivePresetName() {
    const fromInput = UI.presetName && UI.presetName.value.trim();
    return fromInput || localStorage.getItem(ACTIVE_PRESET_KEY) || '';
  }
  function setActivePresetName(name) {
    localStorage.setItem(ACTIVE_PRESET_KEY, name || '');
    if (UI.presetName) UI.presetName.value = name || '';
  }

  function saveState() {
    const state = { filters: getFiltersFromUI(), activePreset: getActivePresetName() };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      if (s.filters) setFiltersToUI(s.filters);
      if (s.activePreset) setActivePresetName(s.activePreset);
    } catch {}
  }

  // -------------------- Dati / Rendering --------------------
  function normalizeRow(row) {
    if (Array.isArray(row)) {
      const keys = HEADERS.length ? HEADERS : ['RIPIANO','TIPO','POSIZIONE'];
      const obj = {};
      keys.forEach((k, i) => obj[k] = row[i] ?? '');
      return obj;
    }
    return row;
  }

  function getFiltersFromUI() {
    return {
      quick:     UI.q ? UI.q.value.trim() : '',
      campo:     UI.campo ? (UI.campo.value || '') : '',
      ripiano:   UI.ripiano ? UI.ripiano.value.trim() : '',
      tipologia: UI.tipologia ? UI.tipologia.value.trim() : '',
      posizione: UI.posizione ? UI.posizione.value.trim() : ''
    };
  }
  function setFiltersToUI(f) {
    if (!f) return;
    if (UI.q)        UI.q.value        = f.quick || '';
    if (UI.campo)    UI.campo.value    = f.campo || (UI.campo.options?.[0]?.value ?? '');
    if (UI.ripiano)  UI.ripiano.value  = f.ripiano || '';
    if (UI.tipologia)UI.tipologia.value= f.tipologia || '';
    if (UI.posizione)UI.posizione.value= f.posizione || '';
  }

  function filterRows() {
    const f = getFiltersFromUI();
    const q = lower(f.quick);
    const campo = f.campo;

    FILTERED_ROWS = ROWS.filter(r0 => {
      const r = normalizeRow(r0);

      // FILTRO ESCLUSIVO TIPOLGIA
      if (f.tipologia && lower(r.TIPO || r.tipologia) !== lower(f.tipologia)) return false;
      if (f.ripiano && lower(String(r.RIPIANO ?? r.ripiano)) !== lower(f.ripiano)) return false;
      if (f.posizione && lower(r.POSIZIONE || r.posizione) !== lower(f.posizione)) return false;

      if (q) {
        if (campo && !/tutti/i.test(campo)) {
          const v = r[campo] ?? r[campo?.toUpperCase?.()] ?? '';
          return lower(v).includes(q);
        } else {
          return Object.keys(r).some(k => lower(r[k]).includes(q));
        }
      }
      return true;
    });
  }

  function renderTable() {
    if (!UI.tableBody) return;
    UI.tableBody.innerHTML = '';
    const rows = FILTERED_ROWS.length ? FILTERED_ROWS : ROWS;

    rows.forEach(r0 => {
      const r = normalizeRow(r0);
      const tr = document.createElement('tr');
      const keys = ['RIPIANO','TIPO','POSIZIONE', ...Object.keys(r).filter(k => !['RIPIANO','TIPO','POSIZIONE'].includes(k))];
      keys.forEach(k => {
        const td = document.createElement('td');
        td.textContent = r[k] ?? '';
        tr.appendChild(td);
      });
      UI.tableBody.appendChild(tr);
    });

    if (UI.resultsBadge) {
      const n = (FILTERED_ROWS.length ? FILTERED_ROWS : ROWS).length;
      UI.resultsBadge.textContent = `${n} risultati`;
    }
  }

  function render() {
    filterRows();
    renderTable();
    saveState();
  }

  // -------------------- Import/Export --------------------
  function toCSV(rows) {
    if (!rows || !rows.length) return '';
    const isObj = typeof rows[0] === 'object' && !Array.isArray(rows[0]);
    if (isObj) {
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

  function getVisibleData() { return FILTERED_ROWS.length ? FILTERED_ROWS : ROWS; }

  function exportAsJSON() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      activePreset: getActivePresetName(),
      filters: getFiltersFromUI(),
      presets: loadPresets(),
      rows: getVisibleData()
    };
    const name = `kardex_${payload.activePreset || 'no-preset'}_${Date.now()}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  }

  function exportAsCSV() {
    const csv = toCSV(getVisibleData());
    const name = `kardex_${getActivePresetName() || 'no-preset'}_${Date.now()}.csv`;
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  }

  async function importFileAuto(file, {append=false} = {}) {
    if (!file) return;
    const text = await file.text();

    // JSON
    try {
      const obj = JSON.parse(text);
      if (obj && (Array.isArray(obj.rows) || Array.isArray(obj.dati_visibili))) {
        const rows = obj.rows || obj.dati_visibili || [];
        if (Array.isArray(obj.presets)) savePresets(obj.presets);
        if (obj.activePreset || obj.preset_attivo) setActivePresetName(obj.activePreset || obj.preset_attivo);

        if (Array.isArray(rows)) {
          if (append && Array.isArray(ROWS)) ROWS = ROWS.concat(rows);
          else ROWS = rows;
          render();
          alert('✅ Import JSON completato');
          return;
        }
      }
    } catch {}

    // CSV
    const lines = text.replace(/\r/g,'').split('\n').filter(x => x.trim() !== '');
    if (lines.length) {
      const first = lines[0];
      const looksHeader = /[A-Za-z]/.test(first);
      let headers = [];
      const rows = [];

      const splitCsvLine = (line) => {
        const out = []; let cur=''; let inQ=false;
        for (let i=0;i<line.length;i++){
          const ch=line[i];
          if (ch === '"'){
            if (inQ && line[i+1] === '"'){ cur+='"'; i++; }
            else inQ = !inQ;
          } else if (ch===',' && !inQ){ out.push(cur); cur=''; }
          else cur += ch;
        }
        out.push(cur);
        return out.map(s=>s.trim());
      };

      lines.forEach((ln, idx) => {
        const cols = splitCsvLine(ln);
        if (idx===0 && looksHeader) {
          headers = cols;
        } else if (looksHeader) {
          const obj = {};
          headers.forEach((h,i) => obj[h] = cols[i] ?? '');
          rows.push(obj);
        } else {
          rows.push(cols);
        }
      });

      ROWS = rows;
      render();
      alert('✅ Import CSV completato');
      return;
    }

    alert('❌ File non riconosciuto. Usa JSON esportato dall’app o un CSV valido.');
  }

  // -------------------- Preset --------------------
  function saveCurrentAsPreset() {
    const name = (UI.presetName && UI.presetName.value.trim()) || '';
    if (!name) { alert('Inserisci un nome preset.'); return; }
    const presets = loadPresets();
    const payload = { name, filters: getFiltersFromUI(), savedAt: new Date().toISOString() };
    const idx = presets.findIndex(p => (p.name || '').toLowerCase() === name.toLowerCase());
    if (idx >= 0) presets[idx] = payload; else presets.push(payload);
    savePresets(presets);
    setActivePresetName(name);
    alert('✅ Preset salvato');
  }

  // -------------------- Eventi --------------------
  function wireEvents() {
    const onChange = () => render();
    ['input','change'].forEach(ev => {
      if (UI.q)        UI.q.addEventListener(ev, onChange);
      if (UI.campo)    UI.campo.addEventListener(ev, onChange);
      if (UI.ripiano)  UI.ripiano.addEventListener(ev, onChange);
      if (UI.tipologia)UI.tipologia.addEventListener(ev, onChange);
      if (UI.posizione)UI.posizione.addEventListener(ev, onChange);
    });

    if (UI.btnSave) UI.btnSave.addEventListener('click', (e) => { e.preventDefault?.(); saveCurrentAsPreset(); });

    // Export
    if (UI.exportCsv) {
      UI.exportCsv.addEventListener('click', (e) => { e.preventDefault?.(); exportAsCSV(); });
      // crea un pulsante accanto per JSON se non c'è
      if (!UI.exportJson) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = UI.exportCsv.className || 'btn';
        btn.style.marginLeft = '8px';
        btn.textContent = 'Export JSON';
        UI.exportCsv.after(btn);
        UI.exportJson = btn;
      }
    }
    if (UI.exportJson) UI.exportJson.addEventListener('click', (e) => { e.preventDefault?.(); exportAsJSON(); });

    if (UI.fileInput) UI.fileInput.addEventListener('change', (e) => importFileAuto(e.target.files[0], {append:false}));
  }

  // -------------------- Bootstrap --------------------
  async function bootstrap() {
    detectUI();

    // Headers (se presenti)
    if (UI.tableHead) {
      HEADERS = Array.from(UI.tableHead.querySelectorAll('th')).map(th => th.textContent.trim()).filter(Boolean);
    }

    loadState();

    // Carica dati iniziali (kardex.json) se la tabella è vuota
    if (!ROWS.length) {
      try {
        const res = await fetch('data/kardex.json', {cache:'no-store'});
        if (res.ok) {
          const json = await res.json();
          ROWS = Array.isArray(json) ? json : (json.rows || json.data || []);
        }
      } catch {}
    }

    render();
    wireEvents();
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();

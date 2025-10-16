
// ===============================================================
// Kardex Viewer - app.js (COMPLETO e AGGIORNATO)
// - Filtri + ricerca
// - Preset: salvataggio / ripristino
// - Export JSON/CSV (JSON include preset, filtri e righe visibili)
// - Import auto (JSON/CSV) con controlli di sicurezza
// - Filtro tipologia ESCLUSIVO (mostra solo la tipologia selezionata)
// - Selettori DOM difensivi per compatibilità con HTML esistente
// ===============================================================

(() => {
  'use strict';

  // -------------------- Stato --------------------
  const PRESETS_KEY = 'kardex-presets';
  const ACTIVE_PRESET_KEY = 'kardex-active-preset-name';
  const STATE_KEY = 'kardex-state-v1';

  let ROWS = [];          // Dati originali
  let FILTERED_ROWS = []; // Dati filtrati correnti
  let HEADERS = [];       // Intestazioni tabella, se presenti

  // -------------------- Utilità DOM sicure --------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Prova più selettori per compatibilità con markup esistente
  const el = {
    quickSearch: $('#q') || $('input[placeholder*="Cerca"]') || $('input[type="search"]'),
    selCampo:   $('#selCampo') || $('#campo') || $('#field') || $('select'),
    btnClear:   $('#btnClear') || $$('button').find(b => /pulisci/i.test(b.textContent || '')),
    btnReset:   $('#btnReset') || $$('button').find(b => /reset/i.test(b.textContent || '')),
    exportCsv:  $('#exportCsvBtn') || $$('button').find(b => /export\s*csv/i.test(b.textContent || '')),
    exportJson: $('#exportJsonBtn') || null, // lo creeremo se non c'è
    fRip:       $('#fRip') || $('input[placeholder*="Ripiano"]'),
    fTip:       $('#fTip') || $('input[placeholder*="Tipo"]') || $('input[placeholder*="tipologia"]'),
    fPos:       $('#fPos') || $('input[placeholder*="Posizione"]'),
    presetName: $('#presetNameInput') || $('input[placeholder*="Nome preset"]'),
    btnSavePreset: $('#btnSavePreset') || $$('button').find(b => /salva/i.test(b.textContent || '')),
    fileInput:  $('#fileInput') || $('input[type="file"]'),
    resultsBadge: $('#resultsBadge') || $$('span').find(s => /risultat/i.test(s.textContent || '')),
    tableHead:  $('table thead'),
    tableBody:  $('table tbody')
  };

  // -------------------- Persistenza --------------------
  function loadPresets() {
    try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; }
    catch { return []; }
  }
  function savePresets(presets) {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets ?? []));
  }
  function getActivePresetName() {
    const fromInput = el.presetName && el.presetName.value.trim();
    return fromInput || localStorage.getItem(ACTIVE_PRESET_KEY) || '';
  }
  function setActivePresetName(name) {
    localStorage.setItem(ACTIVE_PRESET_KEY, name || '');
    if (el.presetName) el.presetName.value = name || '';
  }

  function saveState() {
    const state = {
      filters: getFiltersFromUI(),
      activePreset: getActivePresetName()
    };
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
    // Accetta sia oggetti con chiavi note sia array di colonne
    if (Array.isArray(row)) {
      const keys = HEADERS.length ? HEADERS : ['RIPIANO','TIPO','POSIZIONE'];
      const obj = {};
      keys.forEach((k, i) => obj[k] = row[i] ?? '');
      return obj;
    }
    return row;
  }

  function text(val) { return (val ?? '').toString().toLowerCase(); }

  function getFiltersFromUI() {
    return {
      quick:     el.quickSearch ? el.quickSearch.value.trim() : '',
      campo:     el.selCampo ? el.selCampo.value : '',
      ripiano:   el.fRip ? el.fRip.value.trim() : '',
      tipologia: el.fTip ? el.fTip.value.trim() : '',
      posizione: el.fPos ? el.fPos.value.trim() : ''
    };
  }

  function setFiltersToUI(f) {
    if (!f) return;
    if (el.quickSearch) el.quickSearch.value = f.quick || '';
    if (el.selCampo)    el.selCampo.value    = f.campo || (el.selCampo.options?.[0]?.value ?? '');
    if (el.fRip)        el.fRip.value        = f.ripiano || '';
    if (el.fTip)        el.fTip.value        = f.tipologia || '';
    if (el.fPos)        el.fPos.value        = f.posizione || '';
  }

  function filterRows() {
    const f = getFiltersFromUI();
    const q = text(f.quick);
    const campo = (f.campo || '').toString();

    FILTERED_ROWS = ROWS.filter(r0 => {
      const r = normalizeRow(r0);
      // Filtro tipologia ESCLUSIVO
      if (f.tipologia && text(r.TIPO || r.tipologia) !== text(f.tipologia)) return false;
      if (f.ripiano && text(r.RIPIANO || r.ripiano) !== text(f.ripiano)) return false;
      if (f.posizione && text(r.POSIZIONE || r.posizione) !== text(f.posizione)) return false;

      if (q) {
        if (campo && campo !== 'Tutti') {
          const v = r[campo] ?? r[campo.toUpperCase()] ?? '';
          return text(v).includes(q);
        } else {
          // cerca su tutte le proprietà principali
          const fields = Object.keys(r);
          return fields.some(k => text(r[k]).includes(q));
        }
      }
      return true;
    });
  }

  function renderTable() {
    if (!el.tableBody) return;
    el.tableBody.innerHTML = '';
    const rows = FILTERED_ROWS.length ? FILTERED_ROWS : ROWS;

    rows.forEach(r0 => {
      const r = normalizeRow(r0);
      const tr = document.createElement('tr');

      // Ordine colonne: RIPIANO | TIPO | POSIZIONE | (altre)
      const keys = ['RIPIANO','TIPO','POSIZIONE', ...Object.keys(r).filter(k => !['RIPIANO','TIPO','POSIZIONE'].includes(k))];
      keys.forEach(k => {
        const td = document.createElement('td');
        td.textContent = r[k] ?? '';
        tr.appendChild(td);
      });

      el.tableBody.appendChild(tr);
    });

    if (el.resultsBadge) {
      const n = (FILTERED_ROWS.length ? FILTERED_ROWS : ROWS).length;
      el.resultsBadge.textContent = `${n} risultati`;
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
        return headers
          .map(h => String(r[h] ?? '').replaceAll('"','""'))
          .map(v => `"${v}"`)
          .join(',');
      }).join('\n');
      return head + '\n' + body;
    } else {
      return rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    }
  }

  function getVisibleData() {
    return FILTERED_ROWS.length ? FILTERED_ROWS : ROWS;
  }

  function exportAsJSON() {
    const payload = {
      version: 1,
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

    // prova JSON
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
    } catch { /* non è JSON valido */ }

    // fallback CSV semplice
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
    const name = (el.presetName && el.presetName.value.trim()) || '';
    if (!name) {
      alert('Inserisci un nome preset.');
      return;
    }
    const presets = loadPresets();
    const payload = {
      name,
      filters: getFiltersFromUI(),
      savedAt: new Date().toISOString()
    };
    const idx = presets.findIndex(p => (p.name || '').toLowerCase() === name.toLowerCase());
    if (idx >= 0) presets[idx] = payload;
    else presets.push(payload);
    savePresets(presets);
    setActivePresetName(name);
    alert('✅ Preset salvato');
  }

  // -------------------- Event wiring sicuro --------------------
  function ensureExportJsonButton() {
    if (el.exportJson) return el.exportJson;
    if (!el.exportCsv) return null;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = el.exportCsv.className || 'btn';
    btn.style.marginLeft = '8px';
    btn.textContent = 'Export JSON';
    el.exportCsv.after(btn);
    el.exportJson = btn;
    return btn;
  }

  function wireEvents() {
    if (el.quickSearch) el.quickSearch.addEventListener('input', () => render());
    if (el.selCampo)    el.selCampo.addEventListener('change', () => render());
    if (el.fRip)        el.fRip.addEventListener('input', () => render());
    if (el.fTip)        el.fTip.addEventListener('input', () => render());
    if (el.fPos)        el.fPos.addEventListener('input', () => render());

    if (el.btnClear) el.btnClear.addEventListener('click', (e) => {
      e.preventDefault?.();
      setFiltersToUI({quick:'', campo: el.selCampo?.options?.[0]?.value ?? 'Tutti', ripiano:'', tipologia:'', posizione:''});
      render();
    });

    if (el.btnReset) el.btnReset.addEventListener('click', (e) => {
      e.preventDefault?.();
      localStorage.removeItem(STATE_KEY);
      setFiltersToUI({quick:'', campo: el.selCampo?.options?.[0]?.value ?? 'Tutti', ripiano:'', tipologia:'', posizione:''});
      render();
    });

    const jsonBtn = ensureExportJsonButton();
    if (jsonBtn) jsonBtn.addEventListener('click', (e) => { e.preventDefault?.(); exportAsJSON(); });
    if (el.exportCsv) el.exportCsv.addEventListener('click', (e) => { e.preventDefault?.(); exportAsCSV(); });

    if (el.btnSavePreset) el.btnSavePreset.addEventListener('click', (e) => { e.preventDefault?.(); saveCurrentAsPreset(); });
    if (el.presetName) el.presetName.addEventListener('change', () => setActivePresetName(el.presetName.value.trim()));

    if (el.fileInput) el.fileInput.addEventListener('change', (e) => importFileAuto(e.target.files[0], {append:false}));
  }

  // -------------------- Bootstrap --------------------
  async function bootstrap() {
    try {
      // prova a leggere le intestazioni dal thead (se presenti)
      if (el.tableHead) {
        HEADERS = Array.from(el.tableHead.querySelectorAll('th')).map(th => th.textContent.trim()).filter(Boolean);
      }

      // Carica stato UI
      loadState();

      // Carica dati base (se definiti lato HTML: data/kardex.json)
      if (!ROWS.length) {
        const url = 'data/kardex.json';
        try {
          const res = await fetch(url, {cache:'no-store'});
          if (res.ok) {
            const json = await res.json();
            // accetta sia {rows:[...]} che un array semplice
            ROWS = Array.isArray(json) ? json : (json.rows || json.data || []);
          }
        } catch {}
      }

      render();
      wireEvents();
    } catch (err) {
      console.error('Errore inizializzazione app:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();

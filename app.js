// app.js – versione completa per GitHub Pages (PWA e percorsi relativi)
(() => {
  'use strict';

  const PRESETS_KEY = 'kardex-presets';
  const ACTIVE_PRESET_KEY = 'kardex-active-preset-name';
  const STATE_KEY = 'kardex-state-pages';

  let ROWS = [];
  let FILTERED_ROWS = [];
  let HEADERS = [];

  const $  = s => document.querySelector(s);

  const UI = {
    q: $('#q'),
    campo: $('#selCampo'),
    ripiano: $('#fRip'),
    tipologia: $('#fTip'),
    posizione: $('#fPos'),

    presetName: $('#presetNameInput'),
    btnSave: $('#btnSavePreset'),
    btnManage: $('#btnManage'),

    exportCsv: $('#exportCsvBtn'),
    exportJson: $('#exportJsonBtn'),

    fileInput: $('#fileInput'),
    resultsBadge: $('#resultsBadge'),

    tableHead: document.querySelector('table thead'),
    tableBody: document.querySelector('table tbody'),

    btnClear: $('#btnClear'),
    btnReset: $('#btnReset'),
  };

  // ---------- Storage preset + stato ----------
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

  function getFiltersFromUI() {
    return {
      quick:     UI.q?.value.trim() || '',
      campo:     UI.campo?.value || '',
      ripiano:   UI.ripiano?.value.trim() || '',
      tipologia: UI.tipologia?.value.trim() || '',
      posizione: UI.posizione?.value.trim() || '',
    };
  }
  function setFiltersToUI(f) {
    if (UI.q)        UI.q.value        = f.quick || '';
    if (UI.campo)    UI.campo.value    = f.campo || (UI.campo.options?.[0]?.value ?? 'Tutti');
    if (UI.ripiano)  UI.ripiano.value  = f.ripiano || '';
    if (UI.tipologia)UI.tipologia.value= f.tipologia || '';
    if (UI.posizione)UI.posizione.value= f.posizione || '';
    window.render?.();
  }

  function saveState() {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ filters: getFiltersFromUI(), activePreset: getActivePresetName() })
    );
  }
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      if (s.filters) setFiltersToUI(s.filters);
      if (s.activePreset) setActivePresetName(s.activePreset);
    } catch {}
  }

  // ---------- Normalizzazione e filtro ----------
  const lower = x => (x ?? '').toString().toLowerCase();

  function normalizeRow(row) {
    if (Array.isArray(row)) {
      const keys = HEADERS.length ? HEADERS : ['RIPIANO', 'TIPO', 'POSIZIONE'];
      const o = {};
      keys.forEach((k, i) => (o[k] = row[i] ?? ''));
      return o;
    }
    return row;
  }

function filterRows() {
  const f = getFiltersFromUI();

  // normalizzatori robusti (spazi, maiuscole/minuscole)
  const norm = (s) => (s ?? '').toString().trim().replace(/\s+/g,' ').toLowerCase();

  const q = norm(f.quick);
  const campo = f.campo;

  FILTERED_ROWS = ROWS.filter((raw) => {
    const r = normalizeRow(raw);

    // --- FILTRI ESCLUSIVI ---
    // Tipologia esclusiva (mostra SOLO il tipo esatto richiesto)
    if (f.tipologia && norm(r.TIPO || r.tipologia) !== norm(f.tipologia)) return false;

    // Ripiano e Posizione (AND)
    if (f.ripiano   && norm(String(r.RIPIANO ?? r.ripiano)) !== norm(f.ripiano))   return false;
    if (f.posizione && norm(r.POSIZIONE || r.posizione)     !== norm(f.posizione)) return false;

    // --- Ricerca veloce ---
    if (q) {
      if (campo && !/tutti/i.test(campo)) {
        const v = r[campo] ?? r[campo?.toUpperCase?.()] ?? '';
        return norm(v).includes(q);
      }
      // cerca in tutte le colonne
      return Object.keys(r).some((k) => norm(r[k]).includes(q));
    }

    return true;
  });
}


  function renderTable() {
    if (!UI.tableBody) return;
    UI.tableBody.innerHTML = '';

    const rows = FILTERED_ROWS.length ? FILTERED_ROWS : ROWS;

    rows.forEach((r0) => {
      const r = normalizeRow(r0);
      const tr = document.createElement('tr');

      const keys = ['RIPIANO', 'TIPO', 'POSIZIONE', ...Object.keys(r).filter(k => !['RIPIANO','TIPO','POSIZIONE'].includes(k))];
      keys.forEach((k) => {
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
  window.render = render; // esposto per preset manager

  // ---------- Export / Import ----------
  function toCSV(rows) {
    if (!rows || !rows.length) return '';
    const isObj = typeof rows[0] === 'object' && !Array.isArray(rows[0]);
    if (isObj) {
      const headers = Object.keys(normalizeRow(rows[0]));
      const head = headers.join(',');
      const body = rows
        .map((r0) => {
          const r = normalizeRow(r0);
          return headers
            .map((h) => String(r[h] ?? '').replaceAll('"', '""'))
            .map((v) => `"${v}"`)
            .join(',');
        })
        .join('\n');
      return head + '\n' + body;
    } else {
      return rows.map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    }
  }
  function getVisibleData() { return FILTERED_ROWS.length ? FILTERED_ROWS : ROWS; }

  function exportAsJSON() {
    const payload = {
      version: 4,
      exportedAt: new Date().toISOString(),
      activePreset: getActivePresetName(),
      filters: getFiltersFromUI(),
      presets: loadPresets(),
      rows: getVisibleData(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kardex_${payload.activePreset || 'no-preset'}.json`;
    a.click();
  }

  function exportAsCSV() {
    const csv = toCSV(getVisibleData());
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kardex_${getActivePresetName() || 'no-preset'}.csv`;
    a.click();
  }

  async function importFileAuto(file, { append = false } = {}) {
    if (!file) return;
    const text = await file.text();

    // Prova JSON
    try {
      const obj = JSON.parse(text);
      if (obj && (Array.isArray(obj.rows) || Array.isArray(obj.dati_visibili))) {
        const rows = obj.rows || obj.dati_visibili || [];
        if (Array.isArray(obj.presets)) savePresets(obj.presets);
        if (obj.activePreset || obj.preset_attivo) setActivePresetName(obj.activePreset || obj.preset_attivo);
        ROWS = append && Array.isArray(ROWS) ? ROWS.concat(rows) : rows;
        render();
        alert('✅ Import JSON completato');
        return;
      }
    } catch {}

    // Fallback CSV
    const lines = text.replace(/\r/g, '').split('\n').filter((x) => x.trim() !== '');
    if (lines.length) {
      const first = lines[0];
      const looksHeader = /[A-Za-z]/.test(first);
      let headers = [];
      const rows = [];

      const split = (ln) => {
        const out = [];
        let cur = '';
        let inQ = false;
        for (let i = 0; i < ln.length; i++) {
          const ch = ln[i];
          if (ch === '"') {
            if (inQ && ln[i + 1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
          } else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
          else cur += ch;
        }
        out.push(cur);
        return out.map((s) => s.trim());
      };

      lines.forEach((ln, idx) => {
        const cols = split(ln);
        if (idx === 0 && looksHeader) headers = cols;
        else if (looksHeader) {
          const o = {};
          headers.forEach((h, i) => (o[h] = cols[i] ?? ''));
          rows.push(o);
        } else {
          rows.push(cols);
        }
      });

      ROWS = rows;
      render();
      alert('✅ Import CSV completato');
      return;
    }

    alert('❌ File non riconosciuto. Usa JSON esportato o un CSV valido.');
  }

  // ---------- Preset ----------
  function saveCurrentAsPreset() {
    const name = (UI.presetName?.value || '').trim();
    if (!name) { alert('Inserisci un nome preset'); return; }
    const presets = loadPresets();
    const payload = { name, filters: getFiltersFromUI(), savedAt: new Date().toISOString() };
    const idx = presets.findIndex((p) => (p.name || '').toLowerCase() === name.toLowerCase());
    if (idx >= 0) presets[idx] = payload;
    else presets.push(payload);
    savePresets(presets);
    setActivePresetName(name);
    alert('✅ Preset salvato');
  }

  function openPresetManager() {
    let modal = document.getElementById('presetModal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'presetModal';
    Object.assign(modal.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '9999'
    });
    modal.innerHTML = `
      <div style="background:#fff;color:#111;max-width:520px;width:92%;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25)">
        <div style="padding:14px 16px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between">
          <strong>Preset salvati</strong>
          <button id="pmClose" style="border:0;background:transparent;font-size:18px;cursor:pointer">✖</button>
        </div>
        <div id="pmBody" style="padding:12px 16px;max-height:60vh;overflow:auto"></div>
        <div style="padding:12px 16px;border-top:1px solid #eee;display:flex;gap:8px;justify-content:flex-end">
          <button id="pmExport">Esporta preset</button>
          <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">
            <input id="pmImport" type="file" style="display:none"/>
            <span class="btn" style="padding:.6rem .9rem;background:#eee;border-radius:8px;">Importa preset</span>
          </label>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.getElementById('pmClose').addEventListener('click', () => modal.remove());

    document.getElementById('pmExport').addEventListener('click', () => {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        activePreset: getActivePresetName(),
        presets: loadPresets(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'kardex_presets.json';
      a.click();
    });

    document.getElementById('pmImport').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const text = await file.text();
        const obj = JSON.parse(text);
        if (!Array.isArray(obj?.presets)) { alert('File preset non valido'); return; }
        savePresets(obj.presets);
        if (obj.activePreset) setActivePresetName(obj.activePreset);
        renderPresetList();
        alert('✅ Preset importati');
      } catch {
        alert('❌ Errore import preset');
      }
    });

    function renderPresetList() {
      const body = document.getElementById('pmBody');
      const list = loadPresets();
      const active = getActivePresetName();
      if (!list.length) { body.innerHTML = '<div style="color:#666">Nessun preset salvato.</div>'; return; }
      body.innerHTML = list.map(p => `
        <div style="border:1px solid #eee;border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div>
            <div><strong>${p.name}</strong> ${p.name === active ? '<span style="color:#0a7cff">• attivo</span>' : ''}</div>
            <div style="font-size:.9rem;color:#666">
              ripiano: <code>${p.filters?.ripiano || ''}</code> ·
              tipologia: <code>${p.filters?.tipologia || ''}</code> ·
              posizione: <code>${p.filters?.posizione || ''}</code> ·
              campo: <code>${p.filters?.campo || ''}</code> ·
              cerca: <code>${p.filters?.quick || ''}</code>
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button data-act="apply" data-name="${p.name}">Applica</button>
            <button data-act="rename" data-name="${p.name}">Rinomina</button>
            <button data-act="delete" data-name="${p.name}" style="color:#b91c1c">Elimina</button>
          </div>
        </div>
      `).join('');

      body.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', e => {
          const name = e.currentTarget.getAttribute('data-name');
          const act  = e.currentTarget.getAttribute('data-act');
          if (act === 'apply') {
            setActivePresetName(name);
            const p = loadPresets().find(x => (x.name || '') === name);
            if (p) setFiltersToUI(p.filters);
            modal.remove();
          }
          if (act === 'rename') {
            const list = loadPresets();
            const idx = list.findIndex(x => (x.name || '') === name);
            if (idx < 0) return;
            const nuovo = prompt('Nuovo nome preset:', name);
            if (!nuovo) return;
            list[idx].name = nuovo;
            savePresets(list);
            if (getActivePresetName() === name) setActivePresetName(nuovo);
            renderPresetList();
          }
          if (act === 'delete') {
            if (!confirm(`Eliminare il preset "${name}"?`)) return;
            const list = loadPresets().filter(p => (p.name || '') !== name);
            savePresets(list);
            if (getActivePresetName() === name) setActivePresetName('');
            renderPresetList();
          }
        });
      });
    }

    renderPresetList();
  }

  // ---------- Eventi ----------
  function wireEvents() {
    const attach = (el, ev, fn) => el && el.addEventListener(ev, fn);

    ['input', 'change'].forEach((ev) => {
      attach(UI.q, ev, render);
      attach(UI.campo, ev, render);
      attach(UI.ripiano, ev, render);
      attach(UI.tipologia, ev, render);
      attach(UI.posizione, ev, render);
    });

    attach(UI.btnClear, 'click', (e) => {
      e.preventDefault?.();
      setFiltersToUI({ quick: '', campo: UI.campo?.options?.[0]?.value || 'Tutti', ripiano: '', tipologia: '', posizione: '' });
    });

    attach(UI.btnReset, 'click', (e) => {
      e.preventDefault?.();
      localStorage.clear();
      setFiltersToUI({ quick: '', campo: UI.campo?.options?.[0]?.value || 'Tutti', ripiano: '', tipologia: '', posizione: '' });
    });

    attach(UI.btnSave, 'click', (e) => { e.preventDefault?.(); saveCurrentAsPreset(); });
    attach(UI.exportCsv, 'click', (e) => { e.preventDefault?.(); exportAsCSV(); });
    attach(UI.exportJson, 'click', (e) => { e.preventDefault?.(); exportAsJSON(); });
    attach(UI.fileInput, 'change', (e) => importFileAuto(e.target.files[0], { append: false }));
    attach(UI.btnManage, 'click', () => openPresetManager());
  }

  // ---------- Bootstrap ----------
  async function bootstrap() {
    if (UI.tableHead) {
      HEADERS = Array.from(UI.tableHead.querySelectorAll('th')).map(th => th.textContent.trim()).filter(Boolean);
    }
    loadState();

    if (!ROWS.length) {
      try {
        const res = await fetch('./data/kardex.json', { cache: 'no-store' });
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

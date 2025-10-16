
// === Import/Export & Preset FIX ===
// Inserisci questo blocco in coda al tuo app.js (o sostituisci le funzioni omonime).

const PRESETS_KEY = 'kardex-presets';
const ACTIVE_PRESET_KEY = 'kardex-active-preset-name';

/* Utilità base */
function loadPresets() {
  try {
    // Compatibilità con vecchie chiavi
    return JSON.parse(localStorage.getItem(PRESETS_KEY)) 
        || JSON.parse(localStorage.getItem('kardex-presets-v13')) 
        || [];
  } catch { return []; }
}
function savePresets(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets ?? []));
}
function getActivePresetName() {
  // se hai già una tua variabile di stato, leggila qui
  const fromInput = (typeof presetNameInput !== 'undefined' && presetNameInput && presetNameInput.value) ? presetNameInput.value.trim() : '';
  return fromInput || localStorage.getItem(ACTIVE_PRESET_KEY) || '';
}
function setActivePresetName(name) {
  localStorage.setItem(ACTIVE_PRESET_KEY, name || '');
}
function getFiltersFromUI() {
  return {
    ripiano: (typeof fRip !== 'undefined' && fRip) ? fRip.value : '',
    tipologia: (typeof fTip !== 'undefined' && fTip) ? fTip.value : '',
    posizione: (typeof fPos !== 'undefined' && fPos) ? fPos.value : '',
    campo: (typeof selCampo !== 'undefined' && selCampo) ? selCampo.value : '',
    ricerca: (typeof q !== 'undefined' && q) ? q.value : '',
  };
}
function getVisibleRows() {
  // Se hai già un array filtrato (es. FILTERED_ROWS), usa quello qui.
  if (typeof FILTERED_ROWS !== 'undefined' && Array.isArray(FILTERED_ROWS) && FILTERED_ROWS.length) {
    return FILTERED_ROWS;
  }
  // Fallback DOM: legge la tabella visibile
  const body = document.querySelector('tbody');
  if (!body) return [];
  const rows = [];
  body.querySelectorAll('tr').forEach(tr => {
    const tds = [...tr.querySelectorAll('td')].map(td => td.innerText.trim());
    if (tds.length) rows.push(tds);
  });
  return rows;
}

/* CSV helpers */
function toCSV(rows) {
  // rows può essere un array di oggetti o di array
  if (!rows || !rows.length) return '';
  const isObj = !Array.isArray(rows[0]);
  if (isObj) {
    const headers = Object.keys(rows[0]);
    const head = headers.join(',');
    const body = rows.map(r => headers.map(h => String(r[h] ?? '').replaceAll('"','""')).map(v => `"${v}"`).join(',')).join('\n');
    return head + '\n' + body;
  } else {
    return rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
  }
}
function parseCSV(text) {
  // Parser semplice: separatore virgola, virgolette supportate
  const lines = text.replace(/\r/g,'').split('\n').filter(x => x.trim() !== '');
  if (!lines.length) return [];
  const first = lines[0];
  const isHeader = /[A-Za-z]/.test(first); // euristica
  let headers = [];
  let out = [];
  function splitCsvLine(line) {
    const res = [];
    let cur = '';
    let inQ = false;
    for (let i=0; i<line.length; i++) {
      const ch = line[i];
      if (ch === '"' ) {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        res.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    res.push(cur);
    return res;
  }
  lines.forEach((ln, idx) => {
    const cols = splitCsvLine(ln).map(s => s.trim());
    if (idx === 0 && isHeader) {
      headers = cols;
    } else {
      if (isHeader) {
        const obj = {};
        headers.forEach((h,i) => obj[h] = cols[i] ?? '');
        out.push(obj);
      } else {
        out.push(cols);
      }
    }
  });
  return out;
}

/* ESPORTAZIONE */
function exportAsJSON() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    activePreset: getActivePresetName(),
    filters: getFiltersFromUI(),
    presets: loadPresets(),
    rows: getVisibleRows(),
  };
  const name = `kardex_${payload.activePreset || 'no-preset'}_${Date.now()}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}
function exportAsCSV() {
  const rows = getVisibleRows();
  const csv = toCSV(rows);
  const name = `kardex_${getActivePresetName() || 'no-preset'}_${Date.now()}.csv`;
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

/* IMPORTAZIONE (AUTO-DETECT JSON/CSV) */
async function importFileAuto(file, {append=false} = {}) {
  if (!file) return;
  const text = await file.text();

  // Tenta JSON
  try {
    const obj = JSON.parse(text);
    if (obj && obj.version && ('rows' in obj)) {
      // merge/sostituzione preset
      if (Array.isArray(obj.presets)) savePresets(obj.presets);
      if (obj.activePreset) setActivePresetName(obj.activePreset);

      // unisci o sostituisci righe
      if (Array.isArray(obj.rows)) {
        if (append && Array.isArray(window.ROWS)) {
          window.ROWS = window.ROWS.concat(obj.rows);
        } else {
          window.ROWS = obj.rows;
        }
        if (typeof render === 'function') render();
      }
      alert('✅ Import JSON completato');
      return;
    }
  } catch { /* non è JSON valido */ }

  // Fallback CSV
  const rows = parseCSV(text);
  if (rows && rows.length) {
    if (append && Array.isArray(window.ROWS)) {
      window.ROWS = window.ROWS.concat(rows);
    } else {
      window.ROWS = rows;
    }
    if (typeof render === 'function') render();
    alert('✅ Import CSV completato');
    return;
  }

  alert('❌ File non riconosciuto. Usa JSON esportato dall’app o un CSV valido.');
}

/* COLLEGAMENTO AI BOTTONI ESISTENTI */
// Se hai un solo bottone "Export CSV", trasformalo in un menu semplice
(function wireButtons() {
  const exportBtn = document.querySelector('#exportBtn, .export-btn, button[title="Export CSV"], button:has(> .export-csv)') 
                 || document.querySelector('button:contains("Export CSV")');
  const exportJsonBtn = document.querySelector('#exportJsonBtn') || null;
  const fileInput = document.querySelector('#fileInput, input[type="file"]');

  if (exportBtn) {
    exportBtn.addEventListener('click', (e) => {
      const what = prompt('Esportare come: "json" oppure "csv"?', 'json');
      if (!what) return;
      if (what.toLowerCase().startsWith('j')) exportAsJSON();
      else exportAsCSV();
    });
  }
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', exportAsJSON);
  }
  if (fileInput) {
    fileInput.addEventListener('change', (e) => importFileAuto(e.target.files[0], {append:false}));
  }
})();

// Suggerimento: quando salvi un preset, chiama anche setActivePresetName(nome);

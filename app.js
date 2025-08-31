// v12 – multi-sort (SHIFT+click), memoria impostazioni, filtri combinati, mobile card
let ROWS = [];
const $ = (id) => document.getElementById(id);
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
const STATE_KEY = 'kardex-state-v12';
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

// ===== Ricerca =====
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

async function loadData() {
  try {
    const resp = await fetch('./data/kardex.json', { cache: 'no-store' });
    ROWS = await resp.json();
  } catch { ROWS = []; }
  loadState(); // applica eventuale stato salvato
  render();
}

// Filtro rapido per campo
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

// Filtri avanzati combinati (AND)
function advancedMatch(r) {
  const fr = fRip?.value?.trim() ?? '';
  const ft = fTip?.value?.trim() ?? '';
  const fp = fPos?.value?.trim() ?? '';
  if (!fr && !ft && !fp) return true;

  const rip = norm(r.RIPIANO), tip = norm(r.TIPO), pos = norm(r.POSIZIONE);

  let okRip = true;
  if (fr) {
    const onlyDigits = /^\d+$/.test(fr);
    if (onlyDigits) {
      const raw = String(r.RIPIANO ?? '');
      okRip = (/^\d+/.test(raw) ? (raw.match(/^\d+/)?.[0] || '') === fr : rip === norm(fr));
    } else {
      okRip = rip.includes(norm(fr));
    }
  }

  const okTip = ft ? tip.includes(norm(ft)) : true;
  const okPos = fp ? pos.includes(norm(fp)) : true;

  return okRip && okTip && okPos;
}

function filtered() {
  const campo = selCampo?.value ?? 'ALL';
  const txtRaw = q?.value?.trim() ?? '';
  return ROWS.filter(r => quickMatch(r, campo, txtRaw) && advancedMatch(r));
}

// ===== Multi-sort (SHIFT + click) =====
let sortOrder = []; // es. [{key:'RIPIANO', dir:'asc'}, {key:'TIPO', dir:'desc'}]
const ths = Array.from(document.querySelectorAll('th.sortable'));

function toggleSort(key, additive) {
  if (!additive) {
    // click normale: reset alla singola colonna
    const current = sortOrder[0];
    if (current && current.key === key) {
      current.dir = current.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortOrder = [{ key, dir: 'asc' }];
    }
  } else {
    // SHIFT+click: aggiungi/aggiorna come secondario
    const idx = sortOrder.findIndex(s => s.key === key);
    if (idx === -1) {
      sortOrder.push({ key, dir: 'asc' });
    } else {
      // se è già presente, inverte la direzione
      sortOrder[idx].dir = sortOrder[idx].dir === 'asc' ? 'desc' : 'asc';
    }
    // limita a max 3 chiavi per semplicità
    sortOrder = sortOrder.slice(0, 3);
  }
  updateSortIndicators();
  render();
  saveState();
}

ths.forEach(th => th.addEventListener('click', (ev) => {
  const key = th.dataset.key;
  toggleSort(key, ev.shiftKey === true);
}));

function updateSortIndicators() {
  ths.forEach(th => {
    const s = th.querySelector('.sort');
    if (!s) return;
    const idx = sortOrder.findIndex(x => x.key === th.dataset.key);
    if (idx === -1) { s.textContent = ''; return; }
    const item = sortOrder[idx];
    const rank = (idx + 1); // 1,2,3…
    s.textContent = (item.dir === 'asc' ? '▲' : '▼') + rank;
  });
}

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

// ===== Render =====
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

function escapeHtml(x) {
  return String(x).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}

function toCSV(rows) {
  const headers = ['RIPIANO','TIPO','POSIZIONE'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const vals = headers.map(h => String(r[h] ?? '').replaceAll('"','""'));
    lines.push(vals.map(v => /[,\"\n]/.test(v) ? `"${v}"` : v).join(','));
  }
  return lines.join('\n');
}

exportBtn?.addEventListener('click', () => {
  const csv = toCSV(sortRows(filtered()));
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'kardex_export.csv'; a.click(); URL.revokeObjectURL(url);
});

clearBtn?.addEventListener('click', () => {
  if (q) q.value='';
  if (selCampo) selCampo.value='ALL';
  if (fRip) fRip.value='';
  if (fTip) fTip.value='';
  if (fPos) fPos.value='';
  sortOrder = [];
  updateSortIndicators();
  render();
  saveState();
});

resetBtn?.addEventListener('click', () => {
  localStorage.removeItem(STATE_KEY);
  if (q) q.value='';
  if (selCampo) selCampo.value='ALL';
  if (fRip) fRip.value='';
  if (fTip) fTip.value='';
  if (fPos) fPos.value='';
  sortOrder = [];
  updateSortIndicators();
  render();
  saveState();
});

// Eventi che salvano lo stato
[q, selCampo, fRip, fTip, fPos].forEach(el => {
  el && el.addEventListener('input', () => { render(); saveState(); });
});
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
  render();
  saveState();
});

loadData();



loadData();


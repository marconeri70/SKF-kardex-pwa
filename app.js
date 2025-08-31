// v10 – colonne ordinabili + mobile card + ricerca per campo + tema
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
  });
  const cur = document.documentElement.getAttribute('data-theme') || 'auto';
  themeBtn && (themeBtn.textContent = (cur === 'dark') ? '🌙 Tema' : '☀️ Tema');
})();

// ===== Ricerca =====
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

async function loadData() {
  try {
    const resp = await fetch('./data/kardex.json', { cache: 'no-store' });
    ROWS = await resp.json();
  } catch { ROWS = []; }
  render();
}

function filtered() {
  const txtRaw = q?.value?.trim() ?? '';
  const campo = selCampo?.value ?? 'ALL';
  const txt = norm(txtRaw);
  if (!txt) return ROWS.slice();
  const onlyDigits = /^\d+$/.test(txtRaw);
  return ROWS.filter(r => {
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
  });
}

// ===== Ordinamento =====
let sortKey = null;  // 'RIPIANO' | 'TIPO' | 'POSIZIONE'
let sortDir = 'asc'; // 'asc' | 'desc'
const ths = Array.from(document.querySelectorAll('th.sortable'));
ths.forEach(th => th.addEventListener('click', () => {
  const key = th.dataset.key;
  if (sortKey === key) sortDir = (sortDir === 'asc' ? 'desc' : 'asc');
  else { sortKey = key; sortDir = 'asc'; }
  updateSortIndicators();
  render();
}));
function updateSortIndicators() {
  ths.forEach(th => {
    const s = th.querySelector('.sort');
    if (!s) return;
    s.textContent = (th.dataset.key === sortKey) ? (sortDir === 'asc' ? '▲' : '▼') : '';
  });
}

function sortRows(rows) {
  if (!sortKey) return rows;
  const dir = sortDir === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const av = String(a[sortKey] ?? '').toLowerCase();
    const bv = String(b[sortKey] ?? '').toLowerCase();
    const an = av.match(/^\d+/), bn = bv.match(/^\d+/);
    let cmp;
    if (an && bn) cmp = parseInt(an[0],10) - parseInt(bn[0],10);
    else cmp = av.localeCompare(bv, 'it', { numeric:true, sensitivity:'base' });
    return dir * cmp;
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

clearBtn?.addEventListener('click', () => { if (q) q.value=''; if (selCampo) selCampo.value='ALL'; render(); });

q?.addEventListener('input', render);
selCampo?.addEventListener('change', render);
selCampo?.addEventListener('input', render);
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'campo') render(); });

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
});

loadData();


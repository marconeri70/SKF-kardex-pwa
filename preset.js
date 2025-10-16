
// ===================== preset.js (FINAL) =====================
// Pagina dedicata ai preset. Nessun elenco nella Home.
// Quando selezioni "Carica":
//   - imposta preset attivo + filtri in localStorage
//   - setta un flag per mostrare immediatamente la/e POSIZIONE sulla Home
//   - redireziona a index.html
// =============================================================
(() => {
  'use strict';
  const PRESETS_KEY = 'kardex-presets';
  const ACTIVE_KEY  = 'kardex-active-preset-name';
  const STATE_KEYS  = ['kardex-state-v2','kardex-state-v3','kardex-state-v4','kardex-state-v5'];
  const PRESET_PENDING_FLAG = 'kardex-preset-pending';

  const container = document.getElementById('presetContainer');
  const emptyMsg  = document.getElementById('empty');
  const fileInput = document.getElementById('fileInput');
  const btnExport = document.getElementById('btnExport');

  const loadPresets = () => { try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; } catch { return []; } };
  const savePresets = (p) => localStorage.setItem(PRESETS_KEY, JSON.stringify(p ?? []));
  const setActivePreset = (name) => localStorage.setItem(ACTIVE_KEY, name || '');

  function renderList(){
    const presets = loadPresets();
    container.innerHTML = '';
    if (!presets.length){ emptyMsg.style.display='block'; return; }
    emptyMsg.style.display='none';

    presets.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    presets.forEach(p=>{
      const card = document.createElement('div');
      card.className = 'preset-card';
      card.innerHTML = `
        <div class="preset-title">${p.name}</div>
        <div class="preset-actions">
          <button class="btn-green">Carica</button>
          <button class="btn-red">Elimina</button>
        </div>
      `;
      const [loadBtn, delBtn] = card.querySelectorAll('button');

      loadBtn.addEventListener('click',()=>{
        setActivePreset(p.name);
        const state = { filters: p.filters, activePreset: p.name };
        STATE_KEYS.forEach(k => localStorage.setItem(k, JSON.stringify(state)));
        // chiedi a index.html di mostrare subito le posizioni del risultato
        localStorage.setItem(PRESET_PENDING_FLAG, '1');
        // vai alla home
        window.location.href = 'index.html';
      });
      delBtn.addEventListener('click',()=>{
        if (!confirm(`Eliminare il preset "${p.name}"?`)) return;
        const all = loadPresets().filter(x => (x.name||'') !== p.name);
        savePresets(all);
        renderList();
      });

      container.appendChild(card);
    });
  }

  function exportPresets(){
    const data = loadPresets();
    if (!data.length) return alert('Nessun preset da esportare.');
    const blob = new Blob([JSON.stringify({ presets:data }, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kardex_presets.json';
    a.click();
  }

  async function importPresets(file){
    if (!file) return;
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      if (Array.isArray(obj.presets)){
        const current = loadPresets();
        obj.presets.forEach(np => {
          const idx = current.findIndex(p => (p.name||'').toLowerCase() === (np.name||'').toLowerCase());
          if (idx>=0) current[idx]=np; else current.push(np);
        });
        savePresets(current);
        renderList();
        alert('✅ Preset importati');
      } else {
        alert('❌ File non valido: atteso { presets: [...] }');
      }
    } catch {
      alert('❌ Errore di lettura file');
    }
  }

  btnExport?.addEventListener('click', exportPresets);
  fileInput?.addEventListener('change', e => importPresets(e.target.files[0]));
  document.addEventListener('DOMContentLoaded', renderList);
})();

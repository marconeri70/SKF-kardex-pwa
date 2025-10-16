(() => {
  'use strict';

  const PRESETS_KEY = 'kardex-presets';
  const ACTIVE_KEY  = 'kardex-active-preset-name';

  const container = document.getElementById('presetContainer');
  const emptyMsg  = document.getElementById('empty');
  const fileInput = document.getElementById('fileInput');
  const btnExport = document.getElementById('btnExport');

  // --- funzioni storage ---
  const loadPresets = () => {
    try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; }
    catch { return []; }
  };
  const savePresets = (p) => localStorage.setItem(PRESETS_KEY, JSON.stringify(p ?? []));
  const setActivePreset = (name) => localStorage.setItem(ACTIVE_KEY, name || '');

  // --- rendering ---
  function renderList() {
    const presets = loadPresets();
    container.innerHTML = '';
    if (!presets.length) {
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    presets.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
    presets.forEach(p => {
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

      loadBtn.addEventListener('click', () => {
        setActivePreset(p.name);
        localStorage.setItem('kardex-state-v2', JSON.stringify({ filters: p.filters, activePreset: p.name }));
        alert('✅ Preset "' + p.name + '" caricato. Torna alla Home per applicarlo.');
      });

      delBtn.addEventListener('click', () => {
        if (confirm('Eliminare il preset "' + p.name + '"?')) {
          const all = loadPresets().filter(x => x.name !== p.name);
          savePresets(all);
          renderList();
        }
      });

      container.appendChild(card);
    });
  }

  // --- import/export ---
  function exportPresets() {
    const data = loadPresets();
    if (!data.length) return alert('Nessun preset da esportare.');
    const blob = new Blob([JSON.stringify({ presets: data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kardex_presets.json';
    a.click();
  }

  async function importPresets(file) {
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      if (Array.isArray(obj.presets)) {
        savePresets(obj.presets);
        alert('✅ Preset importati correttamente');
        renderList();
      } else {
        alert('❌ File non valido');
      }
    } catch {
      alert('❌ Errore di lettura file');
    }
  }

  btnExport.addEventListener('click', exportPresets);
  fileInput.addEventListener('change', e => importPresets(e.target.files[0]));
  document.addEventListener('DOMContentLoaded', renderList);
})();

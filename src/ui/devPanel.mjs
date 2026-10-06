// The dev tuning panel (2026-10-06): sliders for every DEV multiplier,
// toggles, and one-tap test actions. Opened from the pause menu. The
// values live in engine/devTuning.mjs; this file is only the DOM.

import { DEV, DEV_SLIDERS, DEV_TOGGLES, setDev, resetDev, saveDev } from '../engine/devTuning.mjs';

// opts: { storage, actions: [{ label, run(), danger? }], onChange(key), onClose() }
export function createDevPanel(root, { storage, actions = [], onChange = () => {}, onClose = () => {} } = {}) {
  const el = document.createElement('div');
  el.id = 'dev-panel';
  el.hidden = true;
  el.innerHTML = `
    <div class="dev-card" role="dialog" aria-modal="true" aria-labelledby="dev-title">
      <div class="dev-head">
        <h1 id="dev-title">🛠 Dev tuning</h1>
        <button type="button" class="dev-close" aria-label="Close">✕</button>
      </div>
      <p class="dev-note">×1 is normal play. Saved on this device. Enemy health, damage and speed apply to new spawns.</p>
      <div class="dev-actions"></div>
      <div class="dev-body"></div>
      <button type="button" class="pm-btn dev-reset">↺ Reset everything to ×1</button>
    </div>`;
  root.appendChild(el);
  const body = el.querySelector('.dev-body');
  const rows = {};

  let group = null;
  for (const s of DEV_SLIDERS) {
    if (s.group !== group) {
      group = s.group;
      const h = document.createElement('h2'); h.textContent = group; body.appendChild(h);
    }
    const row = document.createElement('label');
    row.className = 'dev-row';
    row.innerHTML = `<span class="dev-label"></span><output></output><button type="button" class="dev-one" aria-label="Reset to ×1">×1</button><input type="range">`;
    row.querySelector('.dev-label').textContent = s.label;
    const input = row.querySelector('input');
    Object.assign(input, { min: s.min, max: s.max, step: s.step });
    input.addEventListener('input', () => commit(s.key, Number(input.value)));
    row.querySelector('.dev-one').addEventListener('click', (e) => { e.preventDefault(); commit(s.key, 1); });
    body.appendChild(row);
    rows[s.key] = row;
  }
  const h = document.createElement('h2'); h.textContent = 'Switches'; body.appendChild(h);
  for (const t of DEV_TOGGLES) {
    const row = document.createElement('label');
    row.className = 'dev-toggle';
    row.innerHTML = '<input type="checkbox"><span></span>';
    row.querySelector('span').textContent = t.label;
    const input = row.querySelector('input');
    input.addEventListener('change', () => commit(t.key, input.checked));
    body.appendChild(row);
    rows[t.key] = row;
  }

  const actionsEl = el.querySelector('.dev-actions');
  for (const a of actions) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'dev-act' + (a.danger ? ' danger' : '');
    b.textContent = a.label;
    b.addEventListener('click', () => { a.run(); flash(b); });
    actionsEl.appendChild(b);
  }

  function flash(b) { b.classList.add('done'); setTimeout(() => b.classList.remove('done'), 350); }

  function commit(key, value) {
    setDev(key, value);
    saveDev(storage);
    render(key);
    onChange(key);
  }

  function render(only = null) {
    for (const s of DEV_SLIDERS) {
      if (only && only !== s.key) continue;
      const row = rows[s.key]; const v = DEV[s.key];
      row.querySelector('input').value = v;
      row.querySelector('output').textContent = `×${v.toFixed(2).replace(/0$/, '')}`;
      row.classList.toggle('changed', v !== 1);
    }
    for (const t of DEV_TOGGLES) if (!only || only === t.key) rows[t.key].querySelector('input').checked = !!DEV[t.key];
  }

  el.querySelector('.dev-reset').addEventListener('click', () => {
    resetDev(); saveDev(storage); render();
    for (const s of DEV_SLIDERS) onChange(s.key);
    for (const t of DEV_TOGGLES) onChange(t.key);
  });
  const close = () => { el.hidden = true; onClose(); };
  el.querySelector('.dev-close').addEventListener('click', close);

  return {
    el,
    open() { render(); el.hidden = false; },
    close,
    get isOpen() { return !el.hidden; },
  };
}

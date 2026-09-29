// The Tower Yard (harbour building, 2026-09-29): Reef Defence's shop.
// Unlock towers, learn their specialisations, and buy reef works (perks),
// all paid in the same Salvage your voyages earn. Rendered into the
// harbour's building panel by main.mjs.

import { TOWER_LIST, TOWER_UNLOCKS, SPEC_UNLOCKS, TD_PERKS } from '../data/towers.mjs';
import { purchaseTdTower, purchaseTdSpec, purchaseTdPerk, canAffordTdPerk, canAfford } from '../engine/meta.mjs';
import { drawTower } from '../engine/tdArt.mjs';

const REACH_NOTE = {
  cannon: 'Hits ships, monsters and flyers',
  grapeshot: 'Hits flyers · blasts a whole pack',
  chain: 'Anti-air · slows',
  depth: 'Hits divers under the water · no flyers',
  flame: 'Burns · no flyers',
  lighthouse: 'Reveals hidden & ghost ships · lights the dark · boosts towers',
};

export function drawTowerPortrait(canvas, towerId, level = 3, spec = null) {
  const g = canvas.getContext('2d');
  const W = canvas.width; const H = canvas.height;
  g.clearRect(0, 0, W, H);
  const bg = g.createRadialGradient(W / 2, H * 0.7, 4, W / 2, H * 0.6, W * 0.6);
  bg.addColorStop(0, 'rgba(120, 160, 110, .9)'); bg.addColorStop(1, 'rgba(40, 70, 60, .0)');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H * 0.72); const k = W / 46; g.scale(k, k);
  drawTower(g, { towerId, x: 0, y: 0, level, spec, angle: -0.5, recoil: 0, id: 3, stunT: 0, slowT: 0, fireT: 0, inkT: 0, poisonT: 0 }, 1.2);
  g.restore();
}

// Anything affordable here right now (for the building's "!" badge).
export function towerYardBuyable(meta) {
  return TOWER_LIST.some((t) => !meta.tdTowers.includes(t.id) && canAfford(meta, TOWER_UNLOCKS[t.id]))
    || TOWER_LIST.some((t) => meta.tdTowers.includes(t.id) && t.specs.some((s) => !meta.tdSpecs.includes(s.id) && canAfford(meta, SPEC_UNLOCKS[s.id])))
    || TD_PERKS.some((p) => !meta.tdPerks.includes(p.id) && canAffordTdPerk(meta, p));
}

export function renderTowerYard(el, meta, onChange) {
  el.innerHTML = '';
  const head = (text) => { const h = document.createElement('h2'); h.className = 'ty-head'; h.textContent = text; el.appendChild(h); };
  head('Towers');
  for (const t of TOWER_LIST) {
    const owned = meta.tdTowers.includes(t.id);
    const cost = TOWER_UNLOCKS[t.id];
    const row = document.createElement('div');
    row.className = 'hub-item ty-tower';
    row.innerHTML = `
      <canvas class="hull-preview" width="112" height="112" aria-hidden="true"></canvas>
      <div class="hub-item-info">
        <span class="hub-item-name">${t.icon} ${t.name}${owned ? ' ✓' : ''}</span>
        <span class="hub-item-desc">${t.blurb}</span>
        <span class="hull-stats">${REACH_NOTE[t.id]}</span>
      </div>
      <button type="button" class="hub-item-btn" data-tower="${t.id}"${owned || !canAfford(meta, cost) ? ' disabled' : ''}>${owned ? 'Owned' : `Unlock ${cost} ⚓`}</button>
    `;
    drawTowerPortrait(row.querySelector('canvas'), t.id, owned ? 3 : 1);
    row.querySelector('button').addEventListener('click', () => { if (purchaseTdTower(meta, t.id).ok) onChange('tower', t.id); });
    el.appendChild(row);
    // Its two specialisations, under it.
    for (const sp of t.specs) {
      const have = meta.tdSpecs.includes(sp.id);
      const c = SPEC_UNLOCKS[sp.id];
      const r = document.createElement('div');
      r.className = 'hub-item ty-spec';
      r.innerHTML = `
        <canvas class="ty-spec-art" width="64" height="64" aria-hidden="true"></canvas>
        <div class="hub-item-info">
          <span class="hub-item-name">★ ${sp.name}${have ? ' ✓' : ''}</span>
          <span class="hub-item-desc">${sp.blurb}${owned ? '' : ` <i>Unlock the ${t.short} first.</i>`}</span>
        </div>
        <button type="button" class="hub-item-btn" data-spec="${sp.id}"${have || !owned || !canAfford(meta, c) ? ' disabled' : ''}>${have ? 'Learned' : `Learn ${c} ⚓`}</button>
      `;
      drawTowerPortrait(r.querySelector('canvas'), t.id, 3, sp.id);
      r.querySelector('button').addEventListener('click', () => { if (purchaseTdSpec(meta, sp.id).ok) onChange('spec', sp.id); });
      el.appendChild(r);
    }
  }
  head('Reef works — every defence');
  for (const p of TD_PERKS) {
    const have = meta.tdPerks.includes(p.id);
    const r = document.createElement('div');
    r.className = 'hub-item';
    r.innerHTML = `
      <div class="hub-item-info">
        <span class="hub-item-name">${p.name}${have ? ' ✓' : ''}</span>
        <span class="hub-item-desc">${p.blurb}</span>
      </div>
      <button type="button" class="hub-item-btn"${have || !canAffordTdPerk(meta, p) ? ' disabled' : ''}>${have ? 'Owned' : `${p.cost} ⚓${p.scales ? ` + ${p.scales} 🦑` : ''}`}</button>
    `;
    r.querySelector('button').addEventListener('click', () => { if (purchaseTdPerk(meta, p.id).ok) onChange('perk', p.id); });
    el.appendChild(r);
  }
}

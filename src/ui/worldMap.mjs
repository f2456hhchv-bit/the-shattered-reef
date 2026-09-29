// The voyage chart (2026-09-29): the page you slide to from the harbour.
// A winding route up a sea chart, one island per stage in that stage's
// biome, named like islands. Tap an island to see what's there and set
// sail; locked islands wait in the fog. DOM + small canvases; the island
// art is engine/islandArt.mjs.

import { drawIsland } from '../engine/islandArt.mjs';

const SPACING = 190; // px between islands along the route
const ISLAND_W = 150;
const ISLAND_H = 112;

export function createWorldMap(root, deps) {
  const {
    getMeta, onSail, onClose, stageName, stageInfo, biomeName, biomeForStage, bossName,
    drawBoat, boatRadius, getBoatStyle, levelsPerStage,
  } = deps;
  const el = document.createElement('div');
  el.id = 'world-map';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="wm-top">
      <button type="button" class="wm-back" aria-label="Back to the harbour">← Harbour</button>
      <div class="wm-title"><b>Voyage Chart</b><small></small></div>
    </div>
    <div class="wm-scroll"><div class="wm-sea">
      <svg class="wm-route" aria-hidden="true"><path class="wm-route-done"/><path class="wm-route-next"/></svg>
      <div class="wm-compass" aria-hidden="true">
        <svg viewBox="-50 -50 100 100"><circle r="44" fill="none" stroke="rgba(255,240,200,.35)" stroke-width="1.5"/>
        <path d="M0,-40 L7,0 L0,40 L-7,0 Z" fill="rgba(255,230,170,.55)"/><path d="M-40,0 L0,-7 L40,0 L0,7 Z" fill="rgba(255,230,170,.35)"/>
        <text y="-44" text-anchor="middle" font-size="12" fill="rgba(255,240,200,.7)" font-weight="700">N</text></svg>
      </div>
      <div class="wm-nodes"></div>
      <div class="wm-ship"><canvas width="96" height="96"></canvas></div>
    </div></div>
    <div class="wm-sheet" hidden>
      <div class="wm-sheet-card">
        <button type="button" class="wm-sheet-close" aria-label="Close">✕</button>
        <canvas class="wm-sheet-island" width="300" height="224" aria-hidden="true"></canvas>
        <div class="wm-sheet-kicker"></div>
        <h2 class="wm-sheet-name"></h2>
        <p class="wm-sheet-blurb"></p>
        <p class="wm-sheet-boss"></p>
        <button type="button" class="wm-sheet-sail">▶ Set Sail</button>
      </div>
    </div>
  `;
  root.appendChild(el);
  const scroll = el.querySelector('.wm-scroll');
  const sea = el.querySelector('.wm-sea');
  const nodes = el.querySelector('.wm-nodes');
  const ship = el.querySelector('.wm-ship');
  const sheet = el.querySelector('.wm-sheet');
  let points = [];
  let sheetStage = null;
  let paintToken = 0;

  function stageCount(meta) {
    return Math.max(meta.highestStageUnlocked + 3, 8);
  }

  function layout(meta) {
    const n = stageCount(meta);
    const w = Math.max(320, scroll.clientWidth || window.innerWidth);
    const h = n * SPACING + 260;
    sea.style.height = `${h}px`;
    // Stage 1 at the bottom; the route winds upward.
    points = [];
    for (let i = 0; i < n; i++) {
      const x = w / 2 + Math.sin(i * 1.3 + 0.4) * Math.min(w * 0.28, 260);
      const y = h - 170 - i * SPACING;
      points.push({ x, y });
    }
    const pathFor = (from, to) => {
      let d = '';
      for (let i = from; i <= to && i < points.length; i++) {
        const p = points[i];
        if (i === from) { d += `M${p.x},${p.y}`; continue; }
        const q = points[i - 1];
        const my = (p.y + q.y) / 2;
        d += ` C${q.x},${my} ${p.x},${my} ${p.x},${p.y}`;
      }
      return d;
    };
    const done = Math.max(0, meta.highestStageUnlocked - 1);
    const svg = el.querySelector('.wm-route');
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    el.querySelector('.wm-route-done').setAttribute('d', done > 0 ? pathFor(0, done) : '');
    el.querySelector('.wm-route-next').setAttribute('d', pathFor(done, n - 1));
  }

  function render() {
    const meta = getMeta();
    layout(meta);
    const unlocked = meta.highestStageUnlocked;
    const cleared = unlocked - 1;
    el.querySelector('.wm-title small').textContent = cleared ? `${cleared} island group${cleared > 1 ? 's' : ''} conquered` : 'Your voyage begins at the Corsair Keys';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const jobs = [];
    nodes.replaceChildren(...points.map((p, i) => {
      const stage = i + 1;
      const locked = stage > unlocked;
      const isCleared = stage < unlocked;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `wm-node${locked ? ' locked' : ''}${isCleared ? ' cleared' : ''}${stage === unlocked ? ' current' : ''}`;
      b.dataset.stage = String(stage);
      b.style.left = `${p.x}px`; b.style.top = `${p.y}px`;
      b.innerHTML = `<canvas width="${ISLAND_W * dpr}" height="${ISLAND_H * dpr}"></canvas>
        <span class="wm-label"><small>Stage ${stage}${isCleared ? ' ✓' : ''}${locked ? ' 🔒' : ''}</small><b></b></span>`;
      b.querySelector('b').textContent = stageName(stage);
      const c = b.querySelector('canvas').getContext('2d');
      c.scale(dpr, dpr);
      // Islands are painted by the terrain renderer (~20ms each on a
      // desktop), so they're drawn one per frame, nearest the ship first.
      jobs.push({ stage, run: () => drawIsland(c, ISLAND_W, ISLAND_H, biomeForStage(stage), stage, { locked }) });
      b.addEventListener('click', () => openSheet(stage));
      return b;
    }));
    jobs.sort((a, b) => Math.abs(a.stage - unlocked) - Math.abs(b.stage - unlocked));
    const token = ++paintToken;
    const step = () => {
      if (token !== paintToken) return;
      const job = jobs.shift();
      if (!job) return;
      job.run();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // Your ship waits at the furthest island you can sail to.
    const cur = points[Math.min(unlocked, points.length) - 1];
    // Moored beside the island, on the open-water side.
    const w = sea.clientWidth || window.innerWidth;
    const side = cur.x < w / 2 ? 1 : -1;
    ship.style.left = `${cur.x + side * 96 - 24}px`; ship.style.top = `${cur.y - 30}px`;
    const sc = ship.querySelector('canvas').getContext('2d');
    sc.clearRect(0, 0, 96, 96);
    sc.save(); sc.translate(48, 48); sc.scale(2, 2);
    drawBoat(sc, { x: 0, y: 0, heading: -Math.PI / 2, style: getBoatStyle() }, boatRadius, 0.3);
    sc.restore();
  }

  function openSheet(stage) {
    const meta = getMeta();
    const locked = stage > meta.highestStageUnlocked;
    sheetStage = stage;
    const cv = el.querySelector('.wm-sheet-island');
    const sd = Math.min(3, window.devicePixelRatio || 1);
    cv.width = 300 * sd; cv.height = 224 * sd;
    const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    c.save(); c.scale(2 * sd, 2 * sd); drawIsland(c, 150, 112, biomeForStage(stage), stage, { locked }); c.restore();
    el.querySelector('.wm-sheet-kicker').textContent = `Stage ${stage} · ${biomeName(stage)} · ${levelsPerStage} levels`;
    el.querySelector('.wm-sheet-name').textContent = stageName(stage);
    el.querySelector('.wm-sheet-blurb').textContent = stageInfo(stage).blurb + (stage > 4 ? ' Tougher crews than before.' : '');
    el.querySelector('.wm-sheet-boss').textContent = `☠ Lair: ${bossName(stage)}`;
    const sail = el.querySelector('.wm-sheet-sail');
    sail.disabled = locked;
    sail.textContent = locked ? `🔒 Clear ${stageName(stage - 1)} first` : stage < meta.highestStageUnlocked ? '▶ Sail again' : '▶ Set Sail';
    sheet.hidden = false;
  }
  el.querySelector('.wm-sheet-close').addEventListener('click', () => { sheet.hidden = true; });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.hidden = true; });
  el.querySelector('.wm-sheet-sail').addEventListener('click', () => {
    if (sheetStage == null) return;
    sheet.hidden = true;
    close(false);
    onSail(sheetStage);
  });
  el.querySelector('.wm-back').addEventListener('click', () => close());

  // Swipe right anywhere on the chart to slide back to the harbour.
  let sx = null; let sy = null;
  el.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  el.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx; const dy = e.clientY - sy;
    sx = null;
    if (dx > 70 && Math.abs(dy) < 60 && sheet.hidden) close();
  });

  function open() {
    render();
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    sheet.hidden = true;
    // Bring the current island into view.
    const meta = getMeta();
    const cur = points[Math.min(meta.highestStageUnlocked, points.length) - 1];
    requestAnimationFrame(() => { scroll.scrollTop = Math.max(0, cur.y - scroll.clientHeight * 0.55); });
  }
  function close(notify = true) {
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    if (notify && onClose) onClose();
  }
  window.addEventListener('resize', () => { if (el.classList.contains('open')) render(); });

  return { open, close, isOpen: () => el.classList.contains('open'), render, el };
}

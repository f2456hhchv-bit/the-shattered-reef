// Toy-style Reef Defence art (2026-10-08): one upright image per tower and
// the Heart of the Reef, in assets/towers/. Drawn standing on the tower's
// ground point; a tower without a loaded image keeps its code art in
// tdArt.mjs. Sizes are in world px before tdMode's TOWER_ART scale.
//
//   width   drawn width at level 1 (higher levels grow a little)
//   foot    how far below the ground point the image's bottom sits
//   lamp    [x, y] of the lamp as fractions of the image (lighthouse beams)
//   glow    [x, y] of the crystal's glow (the Heart)

export const TOWER_SPRITES = Object.freeze({
  cannon: { file: 'cannon', width: 30, foot: 5 },
  grapeshot: { file: 'grapeshot', width: 30, foot: 5 },
  chain: { file: 'chain', width: 32, foot: 5 },
  depth: { file: 'depth', width: 31, foot: 5 },
  flame: { file: 'flame', width: 27, foot: 5 },
  lighthouse: { file: 'lighthouse', width: 32, foot: 5, lamp: [0.389, 0.285] },
  heart: { file: 'heart', width: 56, foot: 14, glow: [0.468, 0.346] },
});

const images = {};
export function loadTowerSprites(base = 'assets/towers/') {
  if (typeof Image === 'undefined') return;
  for (const [id, s] of Object.entries(TOWER_SPRITES)) {
    if (images[id]) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = `${base}${s.file}.png`;
    images[id] = img;
  }
}

export function towerSpriteReady(id) {
  const img = images[id];
  return !!(img && img.complete && img.naturalWidth > 0);
}

// Level 1 → 1, each level after adds 7%.
export function towerSpriteScale(level = 1) { return 1 + (Math.max(1, level) - 1) * 0.07; }

// The drawn rectangle for sprite `id` standing at (x, y).
export function towerSpriteRect(id, x, y, scale = 1, natural = null) {
  const s = TOWER_SPRITES[id];
  const img = images[id];
  const nw = natural ? natural.w : img.naturalWidth; const nh = natural ? natural.h : img.naturalHeight;
  const w = s.width * scale; const h = (nh / nw) * w;
  return { x: x - w / 2, y: y + s.foot - h, w, h };
}

// Draws it with a soft ground shadow; returns the rect, or null if not loaded.
export function drawTowerSprite(ctx, id, x, y, scale = 1) {
  if (!towerSpriteReady(id)) return null;
  const r = towerSpriteRect(id, x, y, scale);
  ctx.fillStyle = 'rgba(8, 28, 22, 0.3)';
  ctx.beginPath(); ctx.ellipse(x + r.w * 0.08, y + TOWER_SPRITES[id].foot * 0.6, r.w * 0.5, r.w * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(images[id], r.x, r.y, r.w, r.h);
  return r;
}

// Where a lighthouse tower's lamp is, for the beams (null if no sprite).
export function towerLampPoint(T) {
  if (!towerSpriteReady('lighthouse')) return null;
  const r = towerSpriteRect('lighthouse', T.x, T.y, towerSpriteScale(T.level));
  const [fx, fy] = TOWER_SPRITES.lighthouse.lamp;
  return { x: r.x + r.w * fx, y: r.y + r.h * fy };
}

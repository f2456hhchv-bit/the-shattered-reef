// Painted harbour buildings (2026-10-05), in the V3 art direction. Each is a
// transparent PNG in assets/buildings/, drawn standing on its ground point.
// A building without a sprite (or before it loads) keeps its code art in
// baseRenderer.mjs, so adding one is just a file plus an entry here.
//
// Sizes are in the building's local units (before BUILDING_SCALE); `foot`
// is how far below the ground point the image's bottom edge sits.

export const BUILDING_SPRITES = Object.freeze({
  shipyard: { file: 'shipyard', width: 88, foot: 12, shadow: [40, 13] },
  lighthouse: { file: 'lighthouse', height: 100, foot: 8, shadow: [26, 9], lampY: 0.241 },
  shrine: { file: 'shrine', width: 70, foot: 10, shadow: [34, 11], portal: [0.496, 0.519] },
  armory: { file: 'armory', width: 86, foot: 8, shadow: [38, 12] },
  workshop: { file: 'workshop', width: 86, foot: 8, shadow: [38, 12], forge: [0.476, 0.745] },
  // Banner centres left to right: Reavers, Wyrdtide, Iron Accord.
  hall: { file: 'hall', width: 90, foot: 8, shadow: [40, 12], banners: [[0.273, 0.575], [0.431, 0.591], [0.607, 0.615]] },
});

const images = {};

export function loadBuildingSprites(base = 'assets/buildings/') {
  if (typeof Image === 'undefined') return;
  for (const [id, s] of Object.entries(BUILDING_SPRITES)) {
    if (images[id]) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = `${base}${s.file}.png`;
    images[id] = img;
  }
}

export function buildingSpriteReady(id) {
  const img = images[id];
  return !!(img && img.complete && img.naturalWidth > 0);
}

// The drawn rectangle for a building at (x, y), in local units.
export function buildingSpriteRect(id, x, y, natural) {
  const s = BUILDING_SPRITES[id];
  const { w: nw, h: nh } = natural;
  const k = s.width ? s.width / nw : s.height / nh;
  const w = nw * k; const h = nh * k;
  return { x: x - w / 2, y: y + s.foot - h, w, h };
}

// Draws the sprite with a soft ground shadow. Returns its rect, or null
// when it isn't loaded (the caller then draws its code art).
export function drawBuildingSprite(ctx, id, x, y) {
  if (!buildingSpriteReady(id)) return null;
  const img = images[id]; const s = BUILDING_SPRITES[id];
  const r = buildingSpriteRect(id, x, y, { w: img.naturalWidth, h: img.naturalHeight });
  const [rx, ry] = s.shadow;
  ctx.fillStyle = 'rgba(8, 28, 22, 0.32)';
  ctx.beginPath(); ctx.ellipse(x + rx * 0.3, y + s.foot - ry * 0.4, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(img, r.x, r.y, r.w, r.h);
  return r;
}

// Loads and draws the image creature sprites (data/creatureArt.mjs).
// Drawn at the enemy's origin, like every enemy body.

import { CREATURE_ART, CREATURE_FILES } from '../data/creatureArt.mjs';

const images = {};
export function loadCreatureSprites(base = 'assets/creatures/') {
  if (typeof Image === 'undefined') return;
  for (const f of CREATURE_FILES) {
    if (images[f]) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = `${base}${f}.png`;
    images[f] = img;
  }
}

// The art entry for an enemy, if its image has loaded.
export function creatureArtFor(enemy) {
  // A boss in a flying phase uses its '<id>_flying' art when there is one.
  const flying = enemy.archetype === 'flyer' && CREATURE_ART[`${enemy.defId}_flying`];
  const art = flying || CREATURE_ART[enemy.defId] || CREATURE_ART[enemy.sprite];
  if (!art) return null;
  const img = images[art.file];
  return img && img.complete && img.naturalWidth > 0 ? art : null;
}

// Rotation that points `art` along `heading` ('turn' mode).
export function creatureRotation(art, heading) {
  return heading - (art.forward === 'right' ? 0 : -Math.PI / 2);
}

export function drawCreature(ctx, e, art, heading, t) {
  const img = images[art.file];
  const L = e.radius * art.size;
  const k = L / Math.max(img.naturalWidth, img.naturalHeight);
  const w = img.naturalWidth * k, h = img.naturalHeight * k;
  // Shadow on the water: close under swimmers, offset for flyers.
  const lift = art.flies ? 1 : 0;
  ctx.fillStyle = `rgba(4, 30, 40, ${art.flies ? 0.22 : 0.3})`;
  ctx.beginPath();
  ctx.ellipse(2 + lift * 6, 3 + lift * 9, L * 0.32, L * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  if (art.flies) ctx.translate(0, -3 + Math.sin(t * 3 + e.id) * 1.5);
  if (art.mode === 'turn') {
    ctx.rotate(creatureRotation(art, heading));
    // A slow swim: a slight sway along the body.
    if (!art.flies) ctx.rotate(Math.sin(t * 4 + e.id) * 0.06);
    else ctx.scale(1 + Math.sin(t * 12 + e.id) * 0.05, 1);
  } else {
    if (Math.cos(heading) < -0.2) ctx.scale(-1, 1);
    ctx.translate(0, Math.sin(t * 2.2 + e.id) * 1);
  }
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

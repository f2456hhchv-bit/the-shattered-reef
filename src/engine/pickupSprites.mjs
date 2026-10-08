// Toy-style pickup art (batch C, 2026-10-08): sea glass, anchor coins, the
// lodestone, life rings and treasure chests. Each is one transparent PNG in
// assets/pickups/, drawn centred. Until an image loads, the caller draws its
// code art, so a missing file never breaks a pickup.

// `height` is the drawn height in world px (width follows the image).
export const PICKUP_SPRITES = Object.freeze({
  gem_small: { file: 'gem_small', height: 10 },
  gem_medium: { file: 'gem_medium', height: 13 },
  gem_large: { file: 'gem_large', height: 17 },
  coin: { file: 'coin', height: 12 },
  coin_big: { file: 'coin', height: 15 },
  lodestone: { file: 'lodestone', height: 20 },
  ring: { file: 'ring', height: 19 },
  chest: { file: 'chest', height: 24 },
});

const images = {};

export function loadPickupSprites(base = 'assets/pickups/') {
  if (typeof Image === 'undefined') return;
  for (const s of Object.values(PICKUP_SPRITES)) {
    if (images[s.file]) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = `${base}${s.file}.png`;
    images[s.file] = img;
  }
}

export function pickupSpriteReady(id) {
  const s = PICKUP_SPRITES[id]; const img = s && images[s.file];
  return !!(img && img.complete && img.naturalWidth > 0);
}

// Sea glass sprite for an XP value (1 / 5 / 25).
export function gemSpriteFor(value) {
  return value >= 25 ? 'gem_large' : value >= 5 ? 'gem_medium' : 'gem_small';
}

// Draws centred on (0, 0) of the current transform; `scale` multiplies the
// size. Returns false when the image isn't loaded yet.
export function drawPickupSprite(ctx, id, scale = 1) {
  if (!pickupSpriteReady(id)) return false;
  const s = PICKUP_SPRITES[id]; const img = images[s.file];
  const h = s.height * scale; const w = (img.naturalWidth / img.naturalHeight) * h;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return true;
}

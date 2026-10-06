// Painted ship sprites (2026-10-05, V3 art direction: the project owner's
// composite sheet of every hull in 3/4 view). Each hull has 9 views covering
// one half-turn: bow toward the camera (south), round the west side, to
// stern toward the camera (north), 22.5 degrees apart. The east half is the
// same frames mirrored, so a ship has 16 headings.
//
// Atlases live in assets/ships/<hull>.png, cut from the owner's sheet by a
// one-off script. Frame entries are [x, y, w, h, anchorX, anchorY] in atlas
// pixels; the anchor is the hull's centre (where the boat's x,y sits).
// Hulls with no atlas (the Galleon: its sheet row had no bow-on views) keep
// the code-drawn art in engine/shipArt.mjs.

import { recolourPixels, lookKey } from './shipRecolour.mjs';

export const SHIP_SPRITE_FRAMES = {
  // Toy-render sloop (2026-10-06, owner's 5-view set: bow, bow-quarter,
  // side, stern-quarter, stern), each view used for two headings.
  sloop: [
    [2, 2, 50, 90, 24.1, 68.4],
    [56, 2, 50, 90, 24.1, 68.4],
    [110, 2, 56, 89, 27.4, 68.5],
    [170, 2, 56, 89, 27.4, 68.5],
    [230, 2, 75, 83, 40.3, 67.3],
    [309, 2, 66, 90, 35.8, 69.8],
    [379, 2, 66, 90, 35.8, 69.8],
    [449, 2, 51, 90, 25.0, 68.5],
    [504, 2, 51, 90, 25.0, 68.5],
  ],
  longboat: [
    [2, 2, 55, 86, 27.0, 67.4],
    [61, 2, 55, 86, 27.0, 67.4],
    [120, 2, 61, 89, 29.4, 68.7],
    [185, 2, 61, 89, 29.4, 68.7],
    [250, 2, 86, 87, 44.2, 68.5],
    [340, 2, 65, 90, 33.3, 69.6],
    [409, 2, 65, 90, 33.3, 69.6],
    [478, 2, 55, 86, 27.1, 67.5],
    [537, 2, 55, 86, 27.1, 67.5],
  ],
  skiff: [
    [2, 2, 46, 89, 22.5, 66.6],
    [52, 2, 46, 89, 22.5, 66.6],
    [102, 2, 56, 86, 26.5, 65.7],
    [162, 2, 56, 86, 26.5, 65.7],
    [222, 2, 75, 81, 40.0, 65.5],
    [301, 2, 57, 90, 31.7, 68.5],
    [362, 2, 57, 90, 31.7, 68.5],
    [423, 2, 46, 90, 22.3, 67.9],
    [473, 2, 46, 90, 22.3, 67.9],
  ],
  catamaran: [
    [2, 2, 49, 89, 24.0, 68.3],
    [55, 2, 49, 89, 24.0, 68.3],
    [108, 2, 61, 89, 28.7, 67.4],
    [173, 2, 61, 89, 28.7, 67.4],
    [238, 2, 80, 84, 39.0, 67.5],
    [322, 2, 64, 89, 32.4, 67.8],
    [390, 2, 64, 89, 32.4, 67.8],
    [458, 2, 51, 90, 25.0, 69.5],
    [513, 2, 51, 90, 25.0, 69.5],
  ],
  junk: [
    [2, 2, 46, 88, 22.0, 67.8],
    [52, 2, 46, 88, 22.0, 67.8],
    [102, 2, 58, 88, 27.2, 67.0],
    [164, 2, 58, 88, 27.2, 67.0],
    [226, 2, 84, 85, 43.4, 67.6],
    [314, 2, 55, 90, 29.4, 68.8],
    [373, 2, 55, 90, 29.4, 68.8],
    [432, 2, 47, 89, 22.5, 68.7],
    [483, 2, 47, 89, 22.5, 68.7],
  ],
  steamer: [
    [2, 2, 47, 90, 22.7, 68.6],
    [53, 2, 47, 90, 22.7, 68.6],
    [104, 2, 61, 89, 28.6, 68.3],
    [169, 2, 61, 89, 28.6, 68.3],
    [234, 2, 89, 84, 44.5, 67.5],
    [327, 2, 66, 88, 33.4, 67.1],
    [397, 2, 66, 88, 33.4, 67.1],
    [467, 2, 46, 89, 21.5, 67.8],
    [517, 2, 46, 89, 21.5, 67.8],
  ],
  // 2026-10-05: from the owner's V5 Galleon 24-frame sheet (it has bow
  // views); views 4, 6 and 7 are mirrored frames of the other side.
  galleon: [
    [2, 2, 48, 88, 23.6, 67.5],
    [54, 2, 48, 88, 23.6, 67.5],
    [106, 2, 65, 87, 34.8, 67.0],
    [175, 2, 65, 87, 34.8, 67.0],
    [244, 2, 88, 86, 49.5, 68.2],
    [336, 2, 56, 90, 29.7, 69.1],
    [396, 2, 56, 90, 29.7, 69.1],
    [456, 2, 47, 89, 22.9, 68.9],
    [507, 2, 47, 89, 22.9, 68.9],
  ],
};

export const SHIP_SPRITE_VIEWS = 9;

// Heading (radians, 0 = east, +y = south) → which view, and whether to
// mirror it. View i faces 90° + 22.5°·i (south, round through west, to
// north); a heading on the east half uses the mirror image of 180° − θ.
export function spriteViewFor(heading) {
  let deg = (heading * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  let flip = false;
  if (deg < 90 || deg > 270) {
    flip = true;
    deg = (((180 - deg) % 360) + 360) % 360;
  }
  const view = Math.max(0, Math.min(SHIP_SPRITE_VIEWS - 1, Math.round((deg - 90) / 22.5)));
  return { view, flip };
}

// The widest frame of a hull (its broadside view), in atlas px. Every hull
// is scaled so this width matches the requested on-screen length.
export function spriteRefWidth(style) {
  const fr = SHIP_SPRITE_FRAMES[style];
  return fr ? Math.max(...fr.map((f) => f[2])) : 0;
}

export function hasShipSprite(style) {
  return !!SHIP_SPRITE_FRAMES[style];
}

const images = {};
const waiting = new Set();
// Calls `fn` once when `style`'s atlas has loaded (for previews drawn
// before it arrived). No-op if it's ready or has no sprite.
export function whenShipSpriteReady(style, fn) {
  const img = images[style];
  if (!img || shipSpriteReady(style)) return;
  waiting.add(fn);
  img.addEventListener('load', () => { if (waiting.delete(fn)) fn(); }, { once: true });
}
export function loadShipSprites(base = 'assets/ships/') {
  if (typeof Image === 'undefined') return;
  for (const id of Object.keys(SHIP_SPRITE_FRAMES)) {
    if (images[id]) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = `${base}${id}.png`;
    images[id] = img;
  }
}

export function shipSpriteReady(style) {
  const img = images[style];
  return !!(img && img.complete && img.naturalWidth > 0);
}

// A recoloured copy of a hull's atlas for `look` (engine/shipRecolour.mjs),
// built once and cached. Falls back to the original if pixels can't be read.
const recoloured = new Map();
function atlasFor(style, look) {
  const img = images[style];
  if (!look) return img;
  const key = `${style}#${lookKey(look)}`;
  let c = recoloured.get(key);
  if (c) return c;
  try {
    c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    recolourPixels(d.data, style, look);
    x.putImageData(d, 0, 0);
  } catch {
    c = img;
  }
  recoloured.set(key, c);
  return c;
}

// Draws `style` with its hull centre at the origin. `length` is the
// on-screen width of the broadside view; `look` recolours it.
export function drawShipSprite(ctx, style, heading, length, look = null) {
  const img = atlasFor(style, look);
  const { view, flip } = spriteViewFor(heading);
  const [sx, sy, sw, sh, ax, ay] = SHIP_SPRITE_FRAMES[style][view];
  const s = length / spriteRefWidth(style);
  ctx.save();
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, sw, sh, -ax * s, -ay * s, sw * s, sh * s);
  ctx.restore();
}

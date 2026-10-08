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
    [2, 2, 53, 90, 26.0, 68.5],
    [59, 2, 53, 90, 26.0, 68.5],
    [116, 2, 68, 86, 31.7, 65.9],
    [188, 2, 68, 86, 31.7, 65.9],
    [260, 2, 79, 85, 40.1, 66.0],
    [343, 2, 64, 87, 33.1, 66.3],
    [411, 2, 64, 87, 33.1, 66.3],
    [479, 2, 54, 89, 26.4, 68.1],
    [537, 2, 54, 89, 26.4, 68.1],
  ],
  longboat: [
    [2, 2, 56, 90, 27.5, 68.7],
    [62, 2, 56, 90, 27.5, 68.7],
    [122, 2, 76, 89, 34.7, 68.1],
    [202, 2, 76, 89, 34.7, 68.1],
    [282, 2, 95, 85, 47.0, 66.1],
    [381, 2, 71, 87, 38.6, 66.6],
    [456, 2, 71, 87, 38.6, 66.6],
    [531, 2, 56, 89, 27.5, 67.7],
    [591, 2, 56, 89, 27.5, 67.7],
  ],
  skiff: [
    [2, 2, 55, 87, 27.0, 67.1],
    [61, 2, 55, 87, 27.0, 67.1],
    [120, 2, 75, 89, 35.1, 68.0],
    [199, 2, 75, 89, 35.1, 68.0],
    [278, 2, 88, 87, 45.3, 68.3],
    [370, 2, 78, 90, 39.6, 68.6],
    [452, 2, 78, 90, 39.6, 68.6],
    [534, 2, 55, 87, 26.9, 67.3],
    [593, 2, 55, 87, 26.9, 67.3],
  ],
  catamaran: [
    [2, 2, 56, 87, 27.7, 66.7],
    [62, 2, 56, 87, 27.7, 66.7],
    [122, 2, 76, 90, 36.2, 68.1],
    [202, 2, 76, 90, 36.2, 68.1],
    [282, 2, 83, 88, 40.5, 69.4],
    [369, 2, 75, 89, 38.5, 66.9],
    [448, 2, 75, 89, 38.5, 66.9],
    [527, 2, 56, 87, 27.5, 66.7],
    [587, 2, 56, 87, 27.5, 66.7],
  ],
  junk: [
    [2, 2, 52, 90, 25.5, 68.8],
    [58, 2, 52, 90, 25.5, 68.8],
    [114, 2, 72, 88, 33.8, 67.1],
    [190, 2, 72, 88, 33.8, 67.1],
    [266, 2, 89, 87, 44.8, 67.5],
    [359, 2, 70, 89, 38.1, 67.9],
    [433, 2, 70, 89, 38.1, 67.9],
    [507, 2, 52, 90, 25.4, 68.8],
    [563, 2, 52, 90, 25.4, 68.8],
  ],
  steamer: [
    [2, 2, 50, 90, 24.5, 68.8],
    [56, 2, 50, 90, 24.5, 68.8],
    [110, 2, 72, 87, 33.1, 66.4],
    [186, 2, 72, 87, 33.1, 66.4],
    [262, 2, 84, 85, 41.3, 66.5],
    [350, 2, 71, 88, 37.4, 66.9],
    [425, 2, 71, 88, 37.4, 66.9],
    [500, 2, 50, 89, 24.4, 68.3],
    [554, 2, 50, 89, 24.4, 68.3],
  ],
  // 2026-10-05: from the owner's V5 Galleon 24-frame sheet (it has bow
  // views); views 4, 6 and 7 are mirrored frames of the other side.
  galleon: [
    [2, 2, 52, 90, 25.5, 68.4],
    [58, 2, 52, 90, 25.5, 68.4],
    [114, 2, 69, 88, 33.4, 67.7],
    [187, 2, 69, 88, 33.4, 67.7],
    [260, 2, 90, 88, 46.5, 68.5],
    [354, 2, 66, 87, 35.6, 66.4],
    [424, 2, 66, 87, 35.6, 66.4],
    [494, 2, 49, 90, 24.0, 69.0],
    [547, 2, 49, 90, 24.0, 69.0],
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

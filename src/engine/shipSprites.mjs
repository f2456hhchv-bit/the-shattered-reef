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
  sloop: [
    [2, 2, 30, 89, 14.1, 67.5],
    [36, 2, 44, 86, 21.0, 66.4],
    [84, 2, 50, 83, 23.7, 64.3],
    [138, 2, 52, 82, 24.7, 63.9],
    [194, 2, 56, 82, 26.2, 64.6],
    [254, 2, 44, 74, 21.9, 57.7],
    [302, 2, 43, 80, 21.3, 62.2],
    [349, 2, 41, 83, 20.1, 64.6],
    [394, 2, 34, 89, 16.7, 68.9],
  ],
  longboat: [
    [2, 2, 42, 87, 24.2, 65.4],
    [48, 2, 45, 81, 17.6, 62.6],
    [97, 2, 51, 76, 22.3, 58.6],
    [152, 2, 55, 74, 24.2, 57.6],
    [211, 2, 59, 74, 29.3, 58.4],
    [274, 2, 53, 75, 25.4, 59.2],
    [331, 2, 47, 82, 22.7, 63.5],
    [382, 2, 46, 83, 25.5, 64.2],
    [432, 2, 56, 88, 27.7, 67.2],
  ],
  skiff: [
    [2, 2, 29, 89, 14.5, 67.5],
    [35, 2, 31, 87, 14.9, 66.3],
    [70, 2, 47, 85, 22.1, 66.0],
    [121, 2, 56, 81, 26.3, 63.6],
    [181, 2, 58, 81, 28.4, 63.8],
    [243, 2, 48, 70, 24.2, 54.6],
    [295, 2, 50, 74, 25.6, 57.4],
    [349, 2, 43, 79, 22.1, 61.4],
    [396, 2, 32, 88, 15.6, 67.7],
  ],
  catamaran: [
    [2, 2, 40, 102, 19.7, 78.5],
    [46, 2, 52, 96, 25.8, 73.3],
    [102, 2, 59, 91, 28.3, 69.3],
    [165, 2, 57, 86, 26.7, 66.3],
    [226, 2, 56, 84, 24.9, 65.7],
    [286, 2, 65, 93, 32.4, 70.9],
    [355, 2, 61, 94, 30.4, 71.9],
    [420, 2, 56, 98, 27.2, 74.4],
    [480, 2, 40, 102, 19.5, 78.1],
  ],
  junk: [
    [2, 2, 34, 102, 17.1, 78.5],
    [40, 2, 46, 98, 21.9, 75.5],
    [90, 2, 53, 96, 25.3, 74.0],
    [147, 2, 55, 96, 27.1, 74.2],
    [206, 2, 57, 95, 27.6, 74.1],
    [267, 2, 55, 89, 28.1, 69.4],
    [326, 2, 52, 93, 26.1, 71.4],
    [382, 2, 49, 96, 25.2, 74.0],
    [435, 2, 40, 100, 19.3, 77.7],
  ],
  steamer: [
    [2, 2, 36, 97, 17.9, 73.4],
    [42, 2, 34, 96, 15.5, 72.1],
    [80, 2, 47, 94, 18.2, 70.8],
    [131, 2, 53, 89, 21.1, 67.7],
    [188, 2, 65, 82, 27.8, 63.3],
    [257, 2, 66, 84, 36.7, 64.7],
    [327, 2, 59, 90, 31.7, 69.3],
    [390, 2, 58, 91, 31.9, 69.7],
    [452, 2, 41, 97, 19.9, 73.8],
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

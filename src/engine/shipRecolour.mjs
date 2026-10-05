// Recolouring painted ship atlases (2026-10-05). One painted hull serves
// many ships: the player's liveries and every enemy ship are the same
// sprites with new sails, flags and hull tone. Pure pixel maths here
// (unit-tested); engine/shipSprites.mjs applies it to the loaded atlas once
// per look and caches the result.
//
// A look: { sail, flag, hull, hullMix, ghost }
//   sail / flag  '#rrggbb' or null (keep). Shading is kept: the new colour
//                is scaled by each pixel's own lightness.
//   hull         '#rrggbb' tint for everything that isn't sail or flag
//   hullMix      0..1, how strongly the hull tint applies (default 0.6)
//   ghost        pale, see-through, cyan-tinted (ghost ships)

export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Hue (degrees), chroma (0..1, max − min) and lightness (0..1). Chroma
// rather than HSL saturation: bright cream cloth has a high HSL saturation
// but a low chroma, which is what makes it read as off-white.
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = d;
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

const isTeal = (h, s, l) => h >= 160 && h <= 205 && s > 0.22 && l > 0.36 && l < 0.85;
const isCream = (h, s, l) => (l > 0.5 && s < 0.26 && (h < 70 || s < 0.08)) || (l > 0.4 && s < 0.2 && h > 20 && h < 60);
const isRed = (h, s, l) => (h < 18 || h > 340) && s > 0.3 && l > 0.2 && l < 0.8;

// Which pixels are sail cloth, per hull.
export const SAIL_TEST = {
  sloop: isCream,
  skiff: isCream,
  galleon: isCream,
  catamaran: (h, s, l) => isCream(h, s, l) || isTeal(h, s, l),
  longboat: (h, s, l) => isCream(h, s, l) || isRed(h, s, l),
  junk: isRed,
  steamer: () => false,
};

// 'sail' | 'flag' | 'hull' for one pixel of `hullId`.
export function classifyPixel(hullId, r, g, b) {
  const [h, s, l] = hsl(r, g, b);
  const sail = (SAIL_TEST[hullId] || isCream)(h, s, l);
  if (sail) return 'sail';
  if (isTeal(h, s, l)) return 'flag';
  return 'hull';
}

// Recolours RGBA pixel data in place.
export function recolourPixels(data, hullId, look) {
  if (!look) return data;
  const sail = look.sail ? hexRgb(look.sail) : null;
  const flag = look.flag ? hexRgb(look.flag) : null;
  const tint = look.hull ? hexRgb(look.hull) : null;
  const mix = look.hullMix ?? 0.6;
  const test = SAIL_TEST[hullId] || isCream;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    let r = data[i], g = data[i + 1], b = data[i + 2];
    const [h, s, l] = hsl(r, g, b);
    const kind = test(h, s, l) ? 'sail' : isTeal(h, s, l) ? 'flag' : 'hull';
    const target = kind === 'sail' ? sail : kind === 'flag' ? (flag || sail) : null;
    if (target) {
      // Keep the folds and shadows: scale the new colour by the pixel's
      // lightness relative to the cloth's typical lightness.
      const k = Math.min(1.35, Math.max(0.25, l / 0.72));
      r = target[0] * k; g = target[1] * k; b = target[2] * k;
    } else if (kind === 'hull' && tint) {
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      const tr = (lum / 128) * tint[0], tg = (lum / 128) * tint[1], tb = (lum / 128) * tint[2];
      r = r + (tr - r) * mix; g = g + (tg - g) * mix; b = b + (tb - b) * mix;
    }
    if (look.ghost) {
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      r = lum * 0.55 + 70; g = lum * 0.75 + 95; b = lum * 0.75 + 95;
      data[i + 3] = Math.round(data[i + 3] * 0.72);
    }
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }
  return data;
}

export function lookKey(look) {
  if (!look) return '';
  return [look.sail, look.flag, look.hull, look.hullMix, look.ghost ? 1 : 0].join('|');
}

// Terrain fields for the art pass (2026-09-28). Pure data, no Canvas: turns
// a reef's collision tile grid into smooth fields the renderer shades from.
//
//   sdf     signed distance to the coastline in px (+ land, - water),
//           computed exactly (Felzenszwalb EDT), blurred to round the tile
//           corners, then wobbled with noise so shores wind instead of
//           stepping. Collision still uses the tile grid; the blur/wobble
//           stay within a few px of it (tested), and the boat's 11px radius
//           hides the difference at concave corners.
//   shade   relief lighting from a height field (beach low, jungle higher,
//           rock outcrops highest), light from the top-left.
//   shadow  cast shadow of higher ground onto whatever is below-right.
//   rock    0..1 where exposed rock replaces jungle.
//   tex     low-frequency mottling noise.
//
// Everything is sampled on a coarse lattice (FIELD_CELL px) and bilinearly
// interpolated per pixel by the renderer.

import { makeValueNoise, fbm } from './maze.mjs';
import { makeSeededRng } from './rng.mjs';

export const FIELD_CELL = 4; // px per field sample

function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

// Exact squared Euclidean distance (in cells) to the nearest `feature` cell.
export function squaredDistanceTransform(feature, w, h) {
  const INF = 1e20;
  const out = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = feature[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n); const d = new Float64Array(n);
  const v = new Int32Array(n); const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = out[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = out[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = d[x];
  }
  return out;
}

function boxBlur(src, w, h, r, passes) {
  let a = src; let b = new Float32Array(w * h);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0; let n = 0;
        for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { sum += a[y * w + xx]; n++; } }
        b[y * w + x] = sum / n;
      }
    }
    [a, b] = [b, a];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0; let n = 0;
        for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { sum += a[yy * w + x]; n++; } }
        b[y * w + x] = sum / n;
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

const smoothstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export function sampleField(field, fx, fy) {
  const { w, h } = field;
  const x = Math.max(0, Math.min(w - 1.001, fx / FIELD_CELL - 0.5));
  const y = Math.max(0, Math.min(h - 1.001, fy / FIELD_CELL - 0.5));
  const x0 = x | 0; const y0 = y | 0; const tx = x - x0; const ty = y - y0;
  const i = y0 * w + x0;
  const a = field.data[i]; const b = field.data[i + 1]; const c = field.data[i + w]; const d = field.data[i + w + 1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

// The coastline both the art and the boat's physics use (2026-09-28):
// exact distance to the tile boundary, blurred to round corners, wobbled
// with noise. Built by engine/run.mjs per reef, so collision matches what's
// drawn instead of the tile steps underneath.
export function buildCoastField(grid, tileSize, seed) {
  const C = FIELD_CELL;
  const w = Math.ceil((grid.width * tileSize) / C);
  const h = Math.ceil((grid.height * tileSize) / C);
  const isLand = new Uint8Array(w * h); const isWater = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const ty = Math.min(grid.height - 1, Math.floor(((y + 0.5) * C) / tileSize));
    for (let x = 0; x < w; x++) {
      const tx = Math.min(grid.width - 1, Math.floor(((x + 0.5) * C) / tileSize));
      const land = grid.tiles[ty][tx] === 1;
      isLand[y * w + x] = land ? 1 : 0; isWater[y * w + x] = land ? 0 : 1;
    }
  }
  const dToLand = squaredDistanceTransform(isLand, w, h);
  const dToWater = squaredDistanceTransform(isWater, w, h);
  const raw = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    raw[i] = isLand[i] ? Math.sqrt(dToWater[i]) * C - C / 2 : -(Math.sqrt(dToLand[i]) * C - C / 2);
  }
  const blurred = boxBlur(raw, w, h, 2, 2);
  const noise = makeValueNoise(seed);
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      data[i] = blurred[i] + (fbm(noise, ((x + 0.5) * C) / 30, ((y + 0.5) * C) / 30, 3) - 0.5) * 9;
    }
  }
  return { w, h, data };
}

export function buildTerrain(grid, tileSize, seed, biome, coast = buildCoastField(grid, tileSize, seed)) {
  const C = FIELD_CELL;
  const { w, h } = coast;
  const noise2 = makeValueNoise(seed ^ 0x5bd1e995);
  const tex = new Float32Array(w * h);
  const rock = new Float32Array(w * h);
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x; const px = (x + 0.5) * C; const py = (y + 0.5) * C;
      const s = coast.data[i];
      tex[i] = fbm(noise2, px / 14, py / 14, 3);
      const r = s > 0 ? smoothstep(biome.rockStart - 6, biome.rockStart + 6, s + (fbm(noise2, px / 34 + 50, py / 34, 3) - 0.5) * 44) : 0;
      rock[i] = r;
      // Flat beach, a rise into the jungle, then rock outcrops on top.
      height[i] = s <= 0 ? 0 : 2 * smoothstep(0, 8, s) + 12 * smoothstep(8, 26, s) + r * 16 + (tex[i] - 0.5) * 5 * smoothstep(8, 14, s);
    }
  }

  // Relief lighting: normal from the height gradient, light from top-left.
  const L = [-0.55, -0.65, 0.53]; const Ln = Math.hypot(...L);
  const lx = L[0] / Ln; const ly = L[1] / Ln; const lz = L[2] / Ln;
  const shade = new Float32Array(w * h);
  const shadow = new Float32Array(w * h);
  const at = (x, y) => height[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const gx = (at(x + 1, y) - at(x - 1, y)) / (2 * C);
      const gy = (at(x, y + 1) - at(x, y - 1)) / (2 * C);
      const nl = Math.hypot(gx * 1.6, gy * 1.6, 1);
      const dot = (-gx * 1.6 * lx - gy * 1.6 * ly + lz) / nl;
      shade[i] = Math.max(0.72, Math.min(1.25, dot / lz));
      // Cast shadow: higher ground up-left of here darkens this spot.
      let sh = 0;
      for (const [dx, dy, k] of [[-1, -1, 1], [-2, -2, 0.8], [-3, -4, 0.55]]) sh = Math.max(sh, (at(x + dx, y + dy) - height[i] - 2) * k);
      shadow[i] = Math.max(0, Math.min(1, sh / 16)) * 0.32;
    }
  }

  const f = (data) => ({ w, h, data });
  const terrain = { w, h, cell: C, sdf: coast, tex: f(tex), rock: f(rock), shade: f(shade), shadow: f(shadow), widthPx: grid.width * tileSize, heightPx: grid.height * tileSize };
  terrain.decorations = placeDecorations(terrain, seed, biome);
  terrain.sparkles = placeSparkles(terrain, seed);
  return terrain;
}

// Palms, bushes, boulders and coral, placed on a jittered lattice by where
// they'd grow: palms on the jungle fringe, boulders on exposed rock, coral
// in the shallows. Deterministic from the reef seed.
export function placeDecorations(terrain, seed, biome) {
  const rng = makeSeededRng(seed ^ 0x2c1b3c6d);
  const out = [];
  const STEP = 10;
  for (let y = STEP / 2; y < terrain.heightPx; y += STEP) {
    for (let x = STEP / 2; x < terrain.widthPx; x += STEP) {
      const jx = x + (rng() - 0.5) * STEP * 0.9; const jy = y + (rng() - 0.5) * STEP * 0.9;
      const s = sampleField(terrain.sdf, jx, jy);
      const r = sampleField(terrain.rock, jx, jy);
      const roll = rng(); const size = rng(); const variant = rng();
      if (s > 11 && r < 0.35) {
        if (roll < biome.palm.density * 0.42) out.push({ kind: 'palm', x: jx, y: jy, size: 6 + size * 4, variant });
        else if (roll < biome.palm.density * 0.42 + 0.22) out.push({ kind: 'bush', x: jx, y: jy, size: 3 + size * 3, variant });
      } else if (s > 6 && r > 0.55 && roll < 0.2) {
        out.push({ kind: 'boulder', x: jx, y: jy, size: 3 + size * 4, variant });
      } else if (s < -5 && s > -15 && roll < 0.05) {
        out.push({ kind: 'coral', x: jx, y: jy, size: 2 + size * 2.5, variant });
      } else if (s > 2.5 && s < 8 && roll < 0.025) {
        out.push({ kind: 'shell', x: jx, y: jy, size: 1.2 + size, variant });
      }
    }
  }
  // Painter's order: things further down the screen draw on top.
  out.sort((a, b) => a.y - b.y);
  return out;
}

export function placeSparkles(terrain, seed) {
  const rng = makeSeededRng(seed ^ 0x68e31da4);
  const out = [];
  for (let y = 20; y < terrain.heightPx; y += 36) {
    for (let x = 20; x < terrain.widthPx; x += 36) {
      const jx = x + (rng() - 0.5) * 30; const jy = y + (rng() - 0.5) * 30;
      if (sampleField(terrain.sdf, jx, jy) < -14) out.push({ x: jx, y: jy, phase: rng() * Math.PI * 2, speed: 0.6 + rng() * 0.9, len: 3 + rng() * 4 });
    }
  }
  return out;
}

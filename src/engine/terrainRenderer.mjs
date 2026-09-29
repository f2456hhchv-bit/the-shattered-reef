// Canvas side of the terrain art pass (2026-09-28). Shades engine/terrain.mjs's
// fields into pixels, bakes decorations on top, and caches the result in
// chunks so the per-frame cost is a handful of drawImage calls.
//
// Chunks are rendered lazily: whatever is on screen when a reef starts is
// rendered immediately, then the rest streams in a chunk or so per frame
// (nearest to the camera first), so a big reef never stalls one frame.
// Each chunk canvas carries a small padding border so neighbouring chunks
// meet without hairline seams under image smoothing.

import { sampleField } from './terrain.mjs';
import { colorAtStops, hexToRgb } from '../data/biomes.mjs';

export const CHUNK = 256; // world px per chunk side
const PAD = 2; // canvas px of overlap on every side

function lut(stops, maxD, step) {
  const n = Math.ceil(maxD / step) + 1;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const c = colorAtStops(stops, i * step); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; }
  return { data: out, step, n };
}

export function createTerrainRenderer(terrain, biome, { res = 1.5 } = {}) {
  const waterLut = lut(biome.water, 100, 0.5);
  const landLut = lut(biome.land, 60, 0.5);
  const foam = hexToRgb(biome.foam); const jungleDark = hexToRgb(biome.jungleDark);
  const rockC = hexToRgb(biome.rock); const rockD = hexToRgb(biome.rockDark);
  const lava = biome.lava ? { c: hexToRgb(biome.lava.color), h: hexToRgb(biome.lava.hot), thr: biome.lava.threshold, start: biome.lava.start } : null;
  const cols = Math.ceil(terrain.widthPx / CHUNK); const rows = Math.ceil(terrain.heightPx / CHUNK);
  const chunks = new Array(cols * rows).fill(null);

  // Decorations bucketed by chunk (with neighbours' overhang handled at bake).
  const buckets = Array.from({ length: cols * rows }, () => []);
  for (const d of terrain.decorations) {
    const c = Math.min(cols - 1, Math.floor(d.x / CHUNK)); const r = Math.min(rows - 1, Math.floor(d.y / CHUNK));
    buckets[r * cols + c].push(d);
  }

  const C = terrain.cell; const FW = terrain.w; const FH = terrain.h;
  const S = terrain.sdf.data; const T = terrain.tex.data; const SH = terrain.shadow.data;
  const SD = terrain.shade.data; const R = terrain.rock.data;

  // A chunk renders in row bands across frames (see step()), so no single
  // frame pays for a whole chunk on a phone.
  function startChunk(ci, cj) {
    const x0 = ci * CHUNK; const y0 = cj * CHUNK;
    const cw = Math.min(CHUNK, terrain.widthPx - x0); const ch = Math.min(CHUNK, terrain.heightPx - y0);
    const W = Math.ceil(cw * res) + PAD * 2; const H = Math.ceil(ch * res) + PAD * 2;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    return { ci, cj, x0, y0, cw, ch, W, H, canvas, g, img: g.createImageData(W, H), row: 0 };
  }

  function shadeRows(job, rowEnd) {
    const { x0, y0, W, img } = job;
    const px = img.data;
    const inv = 1 / res;
    const aa = inv; // one output pixel of coast anti-aliasing, in world px
    const fwMax = FW - 1.001; const fhMax = FH - 1.001;
    const foamW = biome.foamWidth;
    for (let y = job.row; y < rowEnd; y++) {
      const wy = y0 + (y - PAD + 0.5) * inv;
      let fy = wy / C - 0.5; fy = fy < 0 ? 0 : (fy > fhMax ? fhMax : fy);
      const yi = fy | 0; const ty = fy - yi; const rowBase = yi * FW;
      for (let x = 0; x < W; x++) {
        const wx = x0 + (x - PAD + 0.5) * inv;
        let fx = wx / C - 0.5; fx = fx < 0 ? 0 : (fx > fwMax ? fwMax : fx);
        const xi = fx | 0; const tx = fx - xi;
        const i = rowBase + xi; const j = i + FW;
        const w00 = (1 - tx) * (1 - ty); const w10 = tx * (1 - ty); const w01 = (1 - tx) * ty; const w11 = tx * ty;
        const s = S[i] * w00 + S[i + 1] * w10 + S[j] * w01 + S[j + 1] * w11;
        const tex = T[i] * w00 + T[i + 1] * w10 + T[j] * w01 + T[j + 1] * w11;
        const shadow = SH[i] * w00 + SH[i + 1] * w10 + SH[j] * w01 + SH[j + 1] * w11;
        const grain = ((((wx * 7.31 | 0) * 73856093) ^ ((wy * 7.31 | 0) * 19349663)) & 255) / 255 - 0.5;
        let r; let gg; let b;
        const depth = s < 0 ? -s : 0;
        const wi = Math.min(waterLut.n - 1, (depth / waterLut.step) | 0) * 3;
        const m = 0.92 + tex * 0.16;
        let wr = waterLut.data[wi] * m; let wg = waterLut.data[wi + 1] * m; let wb = waterLut.data[wi + 2] * m;
        let f = depth < foamW ? Math.pow(1 - depth / foamW, 1.4) * 0.9 : 0;
        const dd = depth - 8;
        if (dd > -6 && dd < 6) f += Math.exp(-(dd * dd) / 5) * 0.16 * (0.4 + tex); // outer surf ring
        if (f > 1) f = 1;
        wr += (foam[0] - wr) * f; wg += (foam[1] - wg) * f; wb += (foam[2] - wb) * f;
        if (s <= -aa) {
          const k = 1 - shadow * 0.8;
          r = wr * k; gg = wg * k; b = wb * k;
        } else {
          const li = Math.min(landLut.n - 1, ((s > 0 ? s : 0) / landLut.step) | 0) * 3;
          r = landLut.data[li]; gg = landLut.data[li + 1]; b = landLut.data[li + 2];
          if (s > 10) {
            let mt = (tex - 0.42) / 0.25; mt = (mt < 0 ? 0 : mt > 1 ? 1 : mt) * 0.65 * Math.min(1, (s - 10) / 5);
            r += (jungleDark[0] - r) * mt; gg += (jungleDark[1] - gg) * mt; b += (jungleDark[2] - b) * mt;
          }
          const rk = R[i] * w00 + R[i + 1] * w10 + R[j] * w01 + R[j + 1] * w11;
          if (rk > 0.001) {
            const cr = rockD[0] + (rockC[0] - rockD[0]) * tex; const cg = rockD[1] + (rockC[1] - rockD[1]) * tex; const cb = rockD[2] + (rockC[2] - rockD[2]) * tex;
            r += (cr - r) * rk; gg += (cg - gg) * rk; b += (cb - b) * rk;
          }
          const sh = (SD[i] * w00 + SD[i + 1] * w10 + SD[j] * w01 + SD[j + 1] * w11) * (1 - shadow);
          r *= sh; gg *= sh; b *= sh;
          if (lava && s > lava.start) {
            // Molten pools: unshaded, so they glow; a dark crust at the rim.
            let m = (tex - lava.thr) / 0.07; m = (m < 0 ? 0 : m > 1 ? 1 : m) * Math.min(1, (s - lava.start) / 4);
            if (m > 0) {
              const k = m < 0.35 ? 0.55 : 1; const hot = Math.max(0, (tex - lava.thr - 0.08) / 0.12);
              const h = hot > 1 ? 1 : hot;
              const lr = (lava.c[0] + (lava.h[0] - lava.c[0]) * h) * k; const lg = (lava.c[1] + (lava.h[1] - lava.c[1]) * h) * k; const lb = (lava.c[2] + (lava.h[2] - lava.c[2]) * h) * k;
              r += (lr - r) * m; gg += (lg - gg) * m; b += (lb - b) * m;
            }
          }
          if (s < aa) { // anti-alias the shoreline over one output pixel
            const t = (s + aa) / (2 * aa);
            r = wr + (r - wr) * t; gg = wg + (gg - wg) * t; b = wb + (b - wb) * t;
          }
        }
        const gr = grain * 7;
        const o = (y * W + x) * 4;
        px[o] = r + gr; px[o + 1] = gg + gr; px[o + 2] = b + gr; px[o + 3] = 255;
      }
    }
    job.row = rowEnd;
  }

  function finishChunk(job) {
    const { g, ci, cj, x0, y0, cw, ch } = job;
    g.putImageData(job.img, 0, 0);
    // Bake decorations from this chunk and its neighbours (overhang).
    g.setTransform(res, 0, 0, res, (-x0) * res + PAD, (-y0) * res + PAD);
    const list = [];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di; const j = cj + dj;
      if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
      for (const d of buckets[j * cols + i]) if (d.x > x0 - 20 && d.x < x0 + cw + 20 && d.y > y0 - 20 && d.y < y0 + ch + 20) list.push(d);
    }
    list.sort((a, b2) => a.y - b2.y);
    const flat = (d) => d.kind === 'coral' || d.kind === 'shell' || styleOf(d, biome) === 'lilypad';
    for (const d of list) if (!flat(d)) drawShadowOf(g, d);
    for (const d of list) drawDecoration(g, d, biome);
    return { canvas: job.canvas, x0, y0, cw, ch };
  }

  function renderChunk(ci, cj) {
    const job = startChunk(ci, cj);
    shadeRows(job, job.H);
    return finishChunk(job);
  }

  // Advance background work until `deadline` (performance.now() ms).
  let job = null;
  function nearestMissing(cx, cy) {
    let best = -1; let bestD = Infinity;
    for (let k = 0; k < chunks.length; k++) {
      if (chunks[k]) continue;
      const d = Math.hypot(((k % cols) + 0.5) * CHUNK - cx, (((k / cols) | 0) + 0.5) * CHUNK - cy);
      if (d < bestD) { bestD = d; best = k; }
    }
    return best;
  }

  return {
    chunkCount: cols * rows,
    renderedCount() { return chunks.filter(Boolean).length; },
    // Draw everything overlapping the camera's visible world rect.
    draw(ctx, visible, t, { maxNewChunks = 1, forceVisible = false } = {}) {
      const c0 = Math.max(0, Math.floor(visible.left / CHUNK)); const c1 = Math.min(cols - 1, Math.floor(visible.right / CHUNK));
      const r0 = Math.max(0, Math.floor(visible.top / CHUNK)); const r1 = Math.min(rows - 1, Math.floor(visible.bottom / CHUNK));
      let made = 0;
      for (let j = r0; j <= r1; j++) {
        for (let i = c0; i <= c1; i++) {
          let c = chunks[j * cols + i];
          if (!c && (forceVisible || made < maxNewChunks)) { c = chunks[j * cols + i] = renderChunk(i, j); made++; }
          if (c) {
            ctx.drawImage(c.canvas, PAD, PAD, c.canvas.width - PAD * 2, c.canvas.height - PAD * 2, c.x0, c.y0, c.cw, c.ch);
          } else {
            ctx.fillStyle = biome.water[3][1];
            ctx.fillRect(i * CHUNK, j * CHUNK, CHUNK, CHUNK);
          }
        }
      }
      // Animated glints on open water — cheap, and keeps the sea alive.
      ctx.strokeStyle = biome.sparkle; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      for (const s of terrain.sparkles) {
        if (s.x < visible.left - 8 || s.x > visible.right + 8 || s.y < visible.top - 8 || s.y > visible.bottom + 8) continue;
        const a = Math.sin(t * s.speed * 2 + s.phase);
        if (a < 0.55) continue;
        ctx.globalAlpha = (a - 0.55) / 0.45 * 0.7;
        const l = s.len * (0.6 + a * 0.4);
        ctx.beginPath(); ctx.moveTo(s.x - l / 2, s.y); ctx.lineTo(s.x + l / 2, s.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return made;
    },
    // Render off-screen chunks in the background, nearest the camera
    // first, stopping at `budgetMs` of work this frame (a chunk can span
    // several frames). Returns true once every chunk is rendered.
    prewarm(cx, cy, budgetMs = 3) {
      const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (budgetMs <= 0) return false;
      const deadline = now() + budgetMs;
      while (now() < deadline) {
        if (!job || chunks[job.cj * cols + job.ci]) {
          const k = nearestMissing(cx, cy);
          if (k < 0) { job = null; return true; }
          job = startChunk(k % cols, (k / cols) | 0);
        }
        shadeRows(job, Math.min(job.H, job.row + 10));
        if (job.row >= job.H) { chunks[job.cj * cols + job.ci] = finishChunk(job); job = null; }
      }
      return false;
    },
  };
}

function drawShadowOf(g, d) {
  g.fillStyle = 'rgba(8, 30, 20, 0.28)';
  g.beginPath();
  const s = d.size;
  if (d.kind === 'palm') g.ellipse(d.x + s * 0.55, d.y + s * 0.25, s * 0.95, s * 0.6, 0.5, 0, Math.PI * 2);
  else g.ellipse(d.x + s * 0.4, d.y + s * 0.35, s * 0.9, s * 0.6, 0.4, 0, Math.PI * 2);
  g.fill();
}

// A biome can draw a decoration kind in another style (data/biomes.mjs `decor`).
function styleOf(d, biome) { return biome.decor?.[d.kind] ?? d.kind; }

// Decorations that give off light in this biome (data/biomes.mjs `glow`):
// [{ x, y, r, rgb }] for the darkness overlay and the glow halos.
export function glowingDecorations(terrain, biome) {
  if (!biome.glow) return [];
  const out = [];
  for (const d of terrain.decorations) {
    const rgb = biome.glow[d.kind];
    if (rgb) out.push({ x: d.x, y: d.y - (d.kind === 'palm' ? d.size * 0.4 : 0), r: 10 + d.size * 2.2, rgb, phase: d.variant * 6.28 });
  }
  return out;
}

function drawDecoration(g, d, biome) {
  const s = d.size;
  const style = styleOf(d, biome);
  if (style !== d.kind && drawStyled(g, d, biome, style)) return;
  switch (d.kind) {
    case 'palm': {
      const lean = (d.variant - 0.5) * s * 0.6;
      const topX = d.x + lean; const topY = d.y - s * 0.55;
      g.strokeStyle = biome.palm.trunk; g.lineWidth = Math.max(1, s * 0.18); g.lineCap = 'round';
      g.beginPath(); g.moveTo(d.x, d.y); g.quadraticCurveTo(d.x + lean * 0.2, d.y - s * 0.3, topX, topY); g.stroke();
      const fronds = 6; const rot = d.variant * Math.PI * 2;
      for (let pass = 0; pass < 2; pass++) {
        g.fillStyle = pass === 0 ? biome.palm.frond : biome.palm.frondLight;
        for (let k = 0; k < fronds; k++) {
          const a = rot + (k / fronds) * Math.PI * 2 + (pass ? 0.25 : 0);
          const len = s * (pass ? 0.62 : 0.95);
          const ex = topX + Math.cos(a) * len; const ey = topY + Math.sin(a) * len * 0.8;
          const nx = -Math.sin(a) * s * 0.2; const ny = Math.cos(a) * s * 0.2;
          g.beginPath();
          g.moveTo(topX, topY);
          g.quadraticCurveTo((topX + ex) / 2 + nx, (topY + ey) / 2 + ny - s * 0.1, ex, ey + s * 0.12);
          g.quadraticCurveTo((topX + ex) / 2 - nx, (topY + ey) / 2 - ny - s * 0.1, topX, topY);
          g.fill();
        }
      }
      g.fillStyle = '#5a3d1e'; g.beginPath(); g.arc(topX, topY, s * 0.13, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'bush': {
      const [dark, light] = biome.bush;
      g.fillStyle = dark;
      for (const [ox, oy, k] of [[-0.5, 0.1, 0.75], [0.45, 0.15, 0.7], [0, -0.3, 0.8]]) { g.beginPath(); g.arc(d.x + ox * s, d.y + oy * s, s * k, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = light;
      for (const [ox, oy, k] of [[-0.6, -0.1, 0.35], [0.25, -0.1, 0.35], [-0.15, -0.5, 0.4]]) { g.beginPath(); g.arc(d.x + ox * s, d.y + oy * s, s * k, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'boulder': {
      const [light, dark] = biome.boulder;
      g.fillStyle = dark; g.beginPath(); g.ellipse(d.x, d.y, s, s * 0.75, d.variant, 0, Math.PI * 2); g.fill();
      g.fillStyle = light; g.beginPath(); g.ellipse(d.x - s * 0.2, d.y - s * 0.22, s * 0.7, s * 0.5, d.variant, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'coral': {
      g.globalAlpha = 0.75;
      g.fillStyle = biome.coral[Math.floor(d.variant * biome.coral.length)];
      for (let k = 0; k < 4; k++) {
        const a = d.variant * 20 + k * 1.7;
        g.beginPath(); g.arc(d.x + Math.cos(a) * s * 0.7, d.y + Math.sin(a) * s * 0.7, s * (0.45 + (k % 2) * 0.2), 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      break;
    }
    case 'shell': {
      g.fillStyle = d.variant > 0.5 ? '#fff4e0' : '#f2c9b8';
      g.beginPath(); g.arc(d.x, d.y, s * 0.6, 0, Math.PI * 2); g.fill();
      break;
    }
    default: break;
  }
}

// Biome-specific decoration styles (2026-09-29). Returns false for an
// unknown style so the default kind is drawn instead.
function drawStyled(g, d, biome, style) {
  const s = d.size; const x = d.x; const y = d.y; const v = d.variant;
  const TAU = Math.PI * 2;
  switch (style) {
    case 'charred': { // a dead, burnt tree
      g.strokeStyle = biome.palm.trunk; g.lineCap = 'round';
      g.lineWidth = Math.max(1, s * 0.2);
      const lean = (v - 0.5) * s * 0.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + lean, y - s * 0.9); g.stroke();
      g.lineWidth = Math.max(0.8, s * 0.1);
      for (let k = 0; k < 3; k++) {
        const t = 0.4 + k * 0.2; const bx = x + lean * t; const by = y - s * 0.9 * t; const dir = k % 2 ? 1 : -1;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + dir * s * 0.45, by - s * 0.3); g.stroke();
      }
      g.fillStyle = 'rgba(255, 120, 40, 0.8)'; g.beginPath(); g.arc(x + lean * 0.3, y - s * 0.25, s * 0.08, 0, TAU); g.fill();
      return true;
    }
    case 'stalagmite': {
      const h = s * (1.1 + v * 0.8); const w = s * 0.45;
      g.fillStyle = biome.palm.trunk;
      g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 0.3, y - h * 0.5, x + (v - 0.5) * 2, y - h); g.quadraticCurveTo(x + w * 0.4, y - h * 0.5, x + w, y); g.closePath(); g.fill();
      g.fillStyle = biome.palm.frondLight;
      g.beginPath(); g.moveTo(x - w * 0.6, y - 1); g.quadraticCurveTo(x - w * 0.3, y - h * 0.5, x + (v - 0.5) * 2, y - h); g.lineTo(x - w * 0.1, y - 1); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y, w * 1.1, w * 0.4, 0, 0, TAU); g.fill();
      return true;
    }
    case 'mushroom': { // glowing cave fungi
      const [cap, hi] = biome.bush;
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * s * 0.55 + (v - 0.5) * 2; const sz = s * (0.45 + ((k + v * 3) % 1) * 0.25);
        g.strokeStyle = '#d8e8e0'; g.lineWidth = Math.max(0.8, sz * 0.25);
        g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox, y - sz * 0.9); g.stroke();
        g.fillStyle = cap; g.beginPath(); g.ellipse(x + ox, y - sz * 0.9, sz * 0.8, sz * 0.45, 0, Math.PI, TAU); g.fill();
        g.fillStyle = hi; g.beginPath(); g.arc(x + ox - sz * 0.2, y - sz * 1.05, sz * 0.14, 0, TAU); g.fill();
      }
      return true;
    }
    case 'mangrove': { // arched stilt roots under a dark canopy
      g.strokeStyle = biome.palm.trunk; g.lineWidth = Math.max(0.8, s * 0.1); g.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        const a = v * 6 + (k / 5) * TAU; const ex = x + Math.cos(a) * s * 0.9; const ey = y + Math.sin(a) * s * 0.55 + s * 0.2;
        g.beginPath(); g.moveTo(x, y - s * 0.3); g.quadraticCurveTo((x + ex) / 2, y - s * 0.6, ex, ey); g.stroke();
      }
      g.fillStyle = biome.palm.frond;
      for (const [ox, oy, k] of [[-0.45, -0.7, 0.7], [0.4, -0.65, 0.65], [0, -1, 0.75], [0, -0.45, 0.6]]) { g.beginPath(); g.arc(x + ox * s, y + oy * s, s * k, 0, TAU); g.fill(); }
      g.fillStyle = biome.palm.frondLight;
      for (const [ox, oy, k] of [[-0.5, -0.85, 0.3], [0.25, -1.1, 0.32]]) { g.beginPath(); g.arc(x + ox * s, y + oy * s, s * k, 0, TAU); g.fill(); }
      // Hanging moss
      g.strokeStyle = 'rgba(150, 170, 110, 0.7)'; g.lineWidth = 0.7;
      for (let k = 0; k < 3; k++) { const mx = x + (k - 1) * s * 0.4; g.beginPath(); g.moveTo(mx, y - s * 0.4); g.lineTo(mx + 0.5, y + s * 0.1); g.stroke(); }
      return true;
    }
    case 'lilypad': {
      const c = biome.coral;
      g.fillStyle = c[Math.floor(v * 2)];
      g.beginPath(); g.arc(x, y, s * 0.9, 0.3 + v, TAU + v - 0.3); g.lineTo(x, y); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20, 50, 20, 0.35)'; g.lineWidth = 0.5; g.stroke();
      if (v > 0.6) { g.fillStyle = c[2 + Math.floor(v * 7) % 2]; g.beginPath(); g.arc(x + s * 0.2, y - s * 0.1, s * 0.3, 0, TAU); g.fill(); }
      return true;
    }
    case 'tubeworm': { // tall white tubes with red plumes
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * s * 0.35; const h = s * (0.7 + ((v * 7 + k) % 1) * 0.6);
        g.fillStyle = biome.palm.trunk; g.fillRect(x + ox - s * 0.09, y - h, s * 0.18, h);
        g.fillStyle = biome.palm.frond; g.beginPath(); g.arc(x + ox, y - h, s * 0.2, 0, TAU); g.fill();
        g.fillStyle = biome.palm.frondLight; g.beginPath(); g.arc(x + ox - s * 0.05, y - h - s * 0.05, s * 0.08, 0, TAU); g.fill();
      }
      return true;
    }
    case 'anemone': {
      const [base, tip] = biome.bush;
      g.strokeStyle = base; g.lineWidth = Math.max(0.8, s * 0.16); g.lineCap = 'round';
      for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU + v; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * s * 0.85, y + Math.sin(a) * s * 0.6); g.stroke(); }
      g.fillStyle = tip;
      for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU + v; g.beginPath(); g.arc(x + Math.cos(a) * s * 0.85, y + Math.sin(a) * s * 0.6, s * 0.12, 0, TAU); g.fill(); }
      return true;
    }
    case 'cactus': {
      const [dark, light] = biome.bush; const h = s * 1.4; const w = s * 0.3;
      g.fillStyle = dark; g.lineCap = 'round';
      g.fillRect(x - w, y - h, w * 2, h); g.beginPath(); g.arc(x, y - h, w, 0, TAU); g.fill();
      const arm = (dir, at) => { g.fillRect(x + dir * w, y - h * at, dir * s * 0.45, w * 1.2); g.fillRect(x + dir * (w + s * 0.45) - (dir > 0 ? w * 1.2 : 0), y - h * at - s * 0.5, w * 1.2, s * 0.5 + w * 1.2); };
      arm(-1, 0.55); if (v > 0.4) arm(1, 0.75);
      g.fillStyle = light; g.fillRect(x - w * 0.35, y - h, w * 0.5, h);
      return true;
    }
    case 'bones': { // a bleached ribcage half-buried in the sand
      const [light, dark] = biome.boulder;
      g.save(); g.translate(x, y); g.rotate((v - 0.5) * 1.2);
      g.strokeStyle = dark; g.lineWidth = Math.max(1, s * 0.22); g.lineCap = 'round';
      g.beginPath(); g.moveTo(-s * 1.2, 0); g.lineTo(s * 1.2, 0); g.stroke();
      g.strokeStyle = light; g.lineWidth = Math.max(0.8, s * 0.16);
      for (let k = 0; k < 5; k++) { const bx = -s + k * s * 0.5; g.beginPath(); g.moveTo(bx, 0); g.quadraticCurveTo(bx + s * 0.35, -s * 0.9, bx + s * 0.1, -s * 1.2); g.stroke(); g.beginPath(); g.moveTo(bx, 0); g.quadraticCurveTo(bx + s * 0.35, s * 0.6, bx + s * 0.15, s * 0.8); g.stroke(); }
      g.restore();
      return true;
    }
    case 'skull': {
      g.fillStyle = '#f2ead6'; g.beginPath(); g.arc(x, y, s * 0.75, 0, TAU); g.fill();
      g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(x - s * 0.28, y - s * 0.05, s * 0.18, 0, TAU); g.arc(x + s * 0.28, y - s * 0.05, s * 0.18, 0, TAU); g.fill();
      return true;
    }
    case 'crystal': { // a cluster of faceted shards
      const cols = [biome.palm.frond, biome.palm.frondLight, biome.palm.trunk];
      const big = d.kind === 'palm' ? 1.3 : 0.8;
      for (let k = 0; k < 4; k++) {
        const a = -Math.PI / 2 + (k - 1.5) * 0.45 + (v - 0.5) * 0.4; const h = s * big * (0.8 + ((v * 5 + k * 0.37) % 1) * 0.7); const w = s * 0.22;
        const bx = x + (k - 1.5) * s * 0.25; const tx = bx + Math.cos(a) * h; const ty = y + Math.sin(a) * h;
        const nx = -Math.sin(a) * w; const ny = Math.cos(a) * w;
        g.fillStyle = cols[k % 2]; g.beginPath(); g.moveTo(bx + nx, y + ny); g.lineTo(tx, ty); g.lineTo(bx - nx, y - ny); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(bx, y); g.lineTo(tx, ty); g.lineTo(bx - nx, y - ny); g.closePath(); g.fill();
        g.strokeStyle = cols[2]; g.lineWidth = 0.5; g.beginPath(); g.moveTo(bx + nx, y + ny); g.lineTo(tx, ty); g.lineTo(bx - nx, y - ny); g.stroke();
      }
      return true;
    }
    case 'ember': case 'glowcoral': {
      const c = biome.coral;
      g.globalAlpha = 0.85;
      for (let k = 0; k < 4; k++) {
        const a = v * 20 + k * 1.7; const cc = c[(Math.floor(v * c.length) + k) % c.length];
        g.fillStyle = cc; g.beginPath(); g.arc(x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7, s * (0.35 + (k % 2) * 0.2), 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      return true;
    }
    default: return false;
  }
}

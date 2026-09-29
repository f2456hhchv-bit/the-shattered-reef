// Island portraits for the voyage chart (2026-09-29; redone the same day
// after the project owner found the first flat-vector version "a bit
// plain"). Each island is now painted by the same terrain renderer as the
// reefs themselves (engine/terrain.mjs + terrainRenderer.mjs: depth-graded
// shallows, surf, beach, jungle, relief lighting, palms and rocks), in its
// stage's biome, with a landmark on top in the harbour buildings' style.
// Seeded by the stage, so an island always looks the same. Portraits are
// cached per stage and resolution; the first draw of each costs a few ms.

import { makeSeededRng } from './rng.mjs';
import { makeValueNoise, fbm } from './maze.mjs';
import { buildCoastField, buildTerrain, sampleField } from './terrain.mjs';
import { createTerrainRenderer } from './terrainRenderer.mjs';
import { getBiome } from '../data/biomes.mjs';
import { shadow, box, barrel, drawLighthouse } from './baseRenderer.mjs';

const TILE = 8;
const GW = 38; const GH = 28;
const PW = GW * TILE; const PH = GH * TILE; // portrait world size (304×224)
const TAU = Math.PI * 2;

// Island shape per biome: radii (tiles), how much the coast wanders, and
// whether it has a cove bitten out and an islet off the shore.
const SHAPES = {
  tropical: { rx: 12, ry: 8, wob: 0.45, cove: 0.36, islets: 2 },
  cliff_cove: { rx: 13, ry: 8.5, wob: 0.35, cove: 0.42, islets: 1 },
  glacial: { rx: 13.5, ry: 8.5, wob: 0.55, cove: 0.3, islets: 3 },
  shipwreck: { rx: 12, ry: 7.5, wob: 0.6, cove: 0.45, islets: 2 },
};

function islandGrid(biomeId, stage) {
  const sh = SHAPES[biomeId] || SHAPES.tropical;
  const rng = makeSeededRng(0x1517 + stage * 7919);
  const noise = makeValueNoise(Math.floor(rng() * 2 ** 31));
  const cx = GW / 2; const cy = GH / 2 + 0.5;
  const coveA = rng() * TAU;
  const cove = { x: cx + Math.cos(coveA) * sh.rx * 0.85, y: cy + Math.sin(coveA) * sh.ry * 0.85, r: sh.cove * sh.ry };
  const islets = Array.from({ length: sh.islets }, (_, i) => {
    const a = coveA + Math.PI * (0.55 + i * 0.5) + (rng() - 0.5) * 0.5;
    return { x: cx + Math.cos(a) * sh.rx * 1.3, y: cy + Math.sin(a) * sh.ry * 1.32, r: 1.3 + rng() * 0.9 };
  });
  const tiles = Array.from({ length: GH }, () => Array(GW).fill(0));
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const px = x + 0.5; const py = y + 0.5;
      const dx = (px - cx) / sh.rx; const dy = (py - cy) / sh.ry;
      const a = Math.atan2(dy, dx);
      const wob = (fbm(noise, Math.cos(a) * 1.4 + 3, Math.sin(a) * 1.4 + 7, 3) - 0.5) * sh.wob;
      let land = Math.hypot(dx, dy) < 1 + wob;
      if (land && Math.hypot(px - cove.x, py - cove.y) < cove.r) land = false;
      if (!land) for (const s of islets) if (Math.hypot(px - s.x, py - s.y) < s.r) land = true;
      if (x < 2 || y < 2 || x >= GW - 2 || y >= GH - 2) land = false;
      tiles[y][x] = land ? 1 : 0;
    }
  }
  return { grid: { width: GW, height: GH, tiles }, seed: Math.floor(rng() * 2 ** 31), coveA };
}

// The most inland point: where the landmark goes.
function heartOf(coast) {
  let best = -Infinity; let bi = 0;
  for (let i = 0; i < coast.data.length; i++) if (coast.data[i] > best) { best = coast.data[i]; bi = i; }
  const cell = PW / coast.w;
  return { x: ((bi % coast.w) + 0.5) * cell, y: (Math.floor(bi / coast.w) + 0.5) * cell, depth: best };
}

// --- Landmarks (drawn around a ground point, harbour-building style) ---

function flag(ctx, x, y, h, cloth, emblem) {
  ctx.strokeStyle = '#3b2211'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.fillStyle = cloth;
  ctx.beginPath(); ctx.moveTo(x, y - h); ctx.quadraticCurveTo(x + 8, y - h - 2, x + 16, y - h + 1);
  ctx.lineTo(x + 15, y - h + 10); ctx.quadraticCurveTo(x + 8, y - h + 8, x, y - h + 10); ctx.closePath(); ctx.fill();
  if (emblem) {
    ctx.fillStyle = emblem;
    ctx.beginPath(); ctx.arc(x + 8, y - h + 4.5, 2.2, 0, TAU); ctx.fill();
    ctx.fillRect(x + 6.8, y - h + 6, 2.4, 1.6);
  }
}

function pirateFort(ctx, x, y) {
  shadow(ctx, x, y + 2, 30, 12);
  // Palisade ring of sharpened stakes.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    const sx = x + Math.cos(a) * 26; const sy = y + Math.sin(a) * 11;
    const front = Math.sin(a) > -0.2;
    ctx.fillStyle = front ? '#8a5a2b' : '#6b4320';
    ctx.fillRect(sx - 1.6, sy - 9, 3.2, 9);
    ctx.beginPath(); ctx.moveTo(sx - 1.6, sy - 9); ctx.lineTo(sx, sy - 12); ctx.lineTo(sx + 1.6, sy - 9); ctx.fill();
  }
  box(ctx, x - 6, y + 2, 26, 15, 11, '#b08450', '#7a5a33', '#6f4a2a', '#4f341d');
  ctx.fillStyle = '#2a170a'; ctx.fillRect(x - 10, y - 8, 7, 10);
  barrel(ctx, x + 14, y + 3, 0.7); barrel(ctx, x + 19, y + 5, 0.6);
  // Watchtower + black flag.
  ctx.fillStyle = '#6b4320'; ctx.fillRect(x + 12, y - 26, 2.4, 26); ctx.fillRect(x + 20, y - 26, 2.4, 26);
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x + 10, y - 30, 14, 5);
  flag(ctx, x + 17, y - 30, 20, '#1b1b22', '#f4efe6');
}

function iceSpires(ctx, x, y) {
  shadow(ctx, x + 4, y + 2, 30, 10);
  const spire = (sx, h, w) => {
    ctx.fillStyle = '#bfe3f2';
    ctx.beginPath(); ctx.moveTo(sx - w, y); ctx.lineTo(sx - w * 0.2, y - h); ctx.lineTo(sx + w, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(sx - w, y); ctx.lineTo(sx - w * 0.2, y - h); ctx.lineTo(sx - w * 0.1, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(40, 110, 160, 0.35)';
    ctx.beginPath(); ctx.moveTo(sx - w * 0.2, y - h); ctx.lineTo(sx + w, y); ctx.lineTo(sx + w * 0.3, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(sx - w * 0.2, y - h); ctx.lineTo(sx - w * 0.15, y - h * 0.4); ctx.stroke();
  };
  spire(x - 14, 30, 9); spire(x + 16, 24, 8); spire(x + 1, 46, 11);
  // A frozen-in mast with a torn sail: someone didn't make it out.
  ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 30, y + 6); ctx.lineTo(x + 34, y - 26); ctx.stroke();
  ctx.fillStyle = 'rgba(235, 228, 210, 0.9)';
  ctx.beginPath(); ctx.moveTo(x + 33, y - 22); ctx.lineTo(x + 43, y - 19); ctx.lineTo(x + 39, y - 11); ctx.lineTo(x + 33, y - 13); ctx.closePath(); ctx.fill();
  // Snow cabin with a lit window and smoke.
  box(ctx, x - 30, y + 8, 16, 9, 7, '#7a5a3a', '#4f3a26', '#f4f8fb', '#cfdde6');
  ctx.fillStyle = '#ffd98a'; ctx.fillRect(x - 32, y + 1, 3, 3);
  ctx.fillStyle = 'rgba(230, 236, 240, 0.7)';
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x - 25 + k * 2, y - 12 - k * 5, 2 + k, 0, TAU); ctx.fill(); }
}

function wreck(ctx, x, y) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5);
  shadow(ctx, 0, 3, 34, 10);
  // Hull on its side, split open with the ribs showing.
  ctx.fillStyle = '#5a3d22';
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(-30, -14, 0, -15); ctx.quadraticCurveTo(28, -14, 36, -2);
  ctx.quadraticCurveTo(20, 8, -4, 8); ctx.quadraticCurveTo(-26, 8, -34, 0); ctx.fill();
  ctx.fillStyle = '#7a5530';
  ctx.beginPath(); ctx.moveTo(-30, -2); ctx.quadraticCurveTo(-26, -11, 0, -12); ctx.quadraticCurveTo(12, -12, 16, -9); ctx.lineTo(10, 3); ctx.quadraticCurveTo(-14, 5, -30, -2); ctx.fill();
  ctx.fillStyle = '#2a1a0c';
  ctx.beginPath(); ctx.moveTo(14, -10); ctx.quadraticCurveTo(26, -10, 32, -2); ctx.quadraticCurveTo(22, 5, 10, 4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#a07a4a'; ctx.lineWidth = 1.6;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(14 + k * 5, 4 - k); ctx.quadraticCurveTo(17 + k * 5, -6, 14 + k * 5, -13 + k); ctx.stroke(); }
  // Gunports
  ctx.fillStyle = '#1a0f07';
  for (let k = 0; k < 4; k++) ctx.fillRect(-24 + k * 8, -6, 3.5, 3);
  // Broken mast and a tattered sail.
  ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(-2, -40); ctx.stroke();
  ctx.fillStyle = 'rgba(225, 214, 186, 0.92)';
  ctx.beginPath(); ctx.moveTo(-3, -36); ctx.lineTo(10, -33); ctx.lineTo(7, -26); ctx.lineTo(9, -21); ctx.lineTo(-2, -22); ctx.closePath(); ctx.fill();
  ctx.restore();
  // A skull-and-bones marker on the sand.
  ctx.fillStyle = '#e9e2cf';
  ctx.beginPath(); ctx.arc(x - 30, y + 16, 3.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 31.1, y + 15.4, 0.8, 0, TAU); ctx.arc(x - 28.9, y + 15.4, 0.8, 0, TAU); ctx.fill();
}

function landmark(ctx, biomeId, p, t) {
  if (biomeId === 'cliff_cove') {
    ctx.save(); ctx.translate(p.x, p.y + 6); ctx.scale(0.72, 0.72); drawLighthouse(ctx, { x: 0, y: 0 }, t); ctx.restore();
  } else if (biomeId === 'glacial') iceSpires(ctx, p.x, p.y + 6);
  else if (biomeId === 'shipwreck') wreck(ctx, p.x, p.y + 4);
  else pirateFort(ctx, p.x, p.y + 4);
}

const cache = new Map();
function portrait(biomeId, stage, res) {
  const key = `${biomeId}|${stage}|${res}`;
  if (cache.has(key)) return cache.get(key);
  const biome = getBiome(biomeId);
  const { grid, seed } = islandGrid(biomeId, stage);
  const coast = buildCoastField(grid, TILE, seed);
  const terrain = buildTerrain(grid, TILE, seed, biome, coast);
  const renderer = createTerrainRenderer(terrain, biome, { res });
  const cv = document.createElement('canvas');
  cv.width = Math.round(PW * res); cv.height = Math.round(PH * res);
  const g = cv.getContext('2d');
  g.scale(res, res);
  renderer.draw(g, { left: 0, top: 0, right: PW, bottom: PH }, 0, { forceVisible: true });
  // Keep only the island and its ring of shallows: water fades out with
  // depth, so the portrait's edge follows the coast instead of a box.
  g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, cv.width, cv.height);
  const px = img.data;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      const wx = (x + 0.5) / res; const wy = (y + 0.5) / res;
      const d = -sampleField(coast, wx, wy);
      // Distance to the portrait's own edge: fade out before reaching it.
      const edge = Math.min(wx, wy, PW - wx, PH - wy);
      let k = Math.min(1, Math.max(0, 1 - (d - 10) / 22), Math.max(0, (edge - 2) / 16));
      if (k >= 1) continue;
      k = k * k * (3 - 2 * k);
      px[(y * cv.width + x) * 4 + 3] *= k;
    }
  }
  g.putImageData(img, 0, 0);
  // The landmark sits on the island's heart, drawn over everything.
  g.scale(res, res);
  landmark(g, biomeId, heartOf(coast), 0);
  cache.set(key, cv);
  return cv;
}

// Draws the island for `stage` in `biomeId` into a w×h box. `locked`
// sinks it into the fog.
export function drawIsland(ctx, w, h, biomeId, stage, { locked = false } = {}) {
  const tr = ctx.getTransform();
  const devicePerWorld = (Math.hypot(tr.a, tr.b) * w) / PW;
  const res = Math.min(3, Math.max(0.5, Math.ceil(devicePerWorld * 2) / 2));
  const cv = portrait(biomeId, stage, res);
  ctx.save();
  // Fit the portrait's height to the box (it's slightly wider, by design).
  const s = Math.min(w / PW, h / PH);
  const dw = PW * s; const dh = PH * s;
  ctx.drawImage(cv, (w - dw) / 2, (h - dh) / 2, dw, dh);
  if (locked) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(34, 52, 68, 0.66)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

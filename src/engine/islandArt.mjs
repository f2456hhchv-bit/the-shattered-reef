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
import { ISLAND_SHAPES } from '../data/islandShapes.mjs';
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
  volcanic: { rx: 12.5, ry: 9, wob: 0.3, cove: 0.25, islets: 2 },
  caverns: { rx: 13, ry: 8.5, wob: 0.5, cove: 0.5, islets: 1 },
  mangrove: { rx: 13.5, ry: 8, wob: 0.7, cove: 0.4, islets: 4 },
  abyss: { rx: 11.5, ry: 7.5, wob: 0.55, cove: 0.55, islets: 3 },
  bone_sands: { rx: 13.5, ry: 8.5, wob: 0.4, cove: 0.35, islets: 1 },
  crystal: { rx: 12, ry: 8, wob: 0.5, cove: 0.4, islets: 3 },
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

// ---- 2026-09-29: landmarks for the six new biomes ----
function volcano(ctx, x, y) {
  shadow(ctx, x + 4, y + 2, 34, 11);
  ctx.fillStyle = '#2a2220';
  ctx.beginPath(); ctx.moveTo(x - 34, y + 4); ctx.lineTo(x - 9, y - 38); ctx.lineTo(x + 9, y - 38); ctx.lineTo(x + 36, y + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3f3430';
  ctx.beginPath(); ctx.moveTo(x - 34, y + 4); ctx.lineTo(x - 9, y - 38); ctx.lineTo(x - 2, y - 38); ctx.lineTo(x - 12, y + 4); ctx.closePath(); ctx.fill();
  // Lava down the slope and in the crater.
  ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + 2, y - 37); ctx.quadraticCurveTo(x + 8, y - 20, x + 4, y - 8); ctx.quadraticCurveTo(x + 2, y - 2, x + 10, y + 3); ctx.stroke();
  ctx.strokeStyle = '#ffd060'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.ellipse(x, y - 38, 9, 2.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe07a'; ctx.beginPath(); ctx.ellipse(x, y - 38.5, 5, 1.4, 0, 0, TAU); ctx.fill();
  // Smoke plume.
  for (let k = 0; k < 5; k++) { ctx.fillStyle = `rgba(70, 62, 60, ${0.7 - k * 0.1})`; ctx.beginPath(); ctx.arc(x + k * 4 - 2, y - 46 - k * 8, 5 + k * 2, 0, TAU); ctx.fill(); }
}

function caveMouth(ctx, x, y) {
  shadow(ctx, x, y + 2, 32, 10);
  ctx.fillStyle = '#5a5048';
  ctx.beginPath(); ctx.moveTo(x - 32, y + 4); ctx.quadraticCurveTo(x - 30, y - 34, x, y - 38); ctx.quadraticCurveTo(x + 30, y - 34, x + 32, y + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6e645a';
  ctx.beginPath(); ctx.moveTo(x - 32, y + 4); ctx.quadraticCurveTo(x - 30, y - 34, x, y - 38); ctx.lineTo(x - 6, y - 30); ctx.quadraticCurveTo(x - 22, y - 26, x - 20, y + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#07080a';
  ctx.beginPath(); ctx.moveTo(x - 17, y + 4); ctx.quadraticCurveTo(x - 16, y - 20, x, y - 22); ctx.quadraticCurveTo(x + 16, y - 20, x + 17, y + 4); ctx.closePath(); ctx.fill();
  // Stalactite teeth and a pair of eyes in the dark.
  ctx.fillStyle = '#6e645a';
  for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(x + k * 4.5 - 2, y - 19 + Math.abs(k)); ctx.lineTo(x + k * 4.5, y - 12 + Math.abs(k)); ctx.lineTo(x + k * 4.5 + 2, y - 19 + Math.abs(k)); ctx.fill(); }
  ctx.fillStyle = '#ffd24a';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 3.5, y - 5, 1.4, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#3fe0c8';
  for (const [ox, oy] of [[-26, 2], [24, 3], [-20, 6]]) { ctx.beginPath(); ctx.arc(x + ox, y + oy, 2, Math.PI, TAU); ctx.fill(); }
}

function stiltHut(ctx, x, y) {
  shadow(ctx, x, y + 3, 26, 8);
  ctx.strokeStyle = '#4a3a26'; ctx.lineWidth = 2;
  for (const ox of [-12, -4, 4, 12]) { ctx.beginPath(); ctx.moveTo(x + ox, y + 6); ctx.lineTo(x + ox, y - 8); ctx.stroke(); }
  box(ctx, x, y - 8, 30, 14, 12, '#6b5a3c', '#4a3e28', '#5c4a2c', '#3a2e1c');
  ctx.fillStyle = '#ffd98a'; ctx.fillRect(x - 3, y - 18, 4, 4);
  // Hanging moss and a lantern.
  ctx.strokeStyle = 'rgba(150, 170, 110, 0.8)'; ctx.lineWidth = 0.8;
  for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x - 14 + k * 7, y - 22); ctx.lineTo(x - 14 + k * 7, y - 14); ctx.stroke(); }
  ctx.fillStyle = '#ffe07a'; ctx.beginPath(); ctx.arc(x + 17, y - 14, 2, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(220, 255, 120, 0.5)';
  for (const [ox, oy] of [[-22, -20], [20, -28], [-8, -34]]) { ctx.beginPath(); ctx.arc(x + ox, y + oy, 1.3, 0, TAU); ctx.fill(); }
}

function abyssRift(ctx, x, y) {
  shadow(ctx, x, y + 2, 30, 10);
  // Broken pillars of a drowned temple around a glowing rift.
  ctx.fillStyle = 'rgba(80, 255, 240, 0.35)'; ctx.beginPath(); ctx.ellipse(x, y, 20, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#081222'; ctx.beginPath(); ctx.ellipse(x, y, 14, 4.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#6afff0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 14, 4.5, 0, 0, TAU); ctx.stroke();
  for (const [ox, h] of [[-24, 26], [-12, 34], [14, 18], [26, 30]]) {
    ctx.fillStyle = '#3a4152'; ctx.fillRect(x + ox - 3.5, y - h, 7, h + 2);
    ctx.fillStyle = '#5a6278'; ctx.fillRect(x + ox - 3.5, y - h, 2.5, h + 2);
    ctx.fillStyle = '#4a5163'; ctx.fillRect(x + ox - 5, y - h - 3, 10, 3);
  }
  ctx.fillStyle = '#ff7ad9';
  for (const [ox, oy] of [[-18, 6], [20, 5], [0, 9]]) { ctx.beginPath(); ctx.arc(x + ox, y + oy, 1.8, 0, TAU); ctx.fill(); }
}

function giantSkull(ctx, x, y) {
  shadow(ctx, x + 2, y + 3, 30, 9);
  // Ribs of a great beast arching out of the sand, and its skull.
  ctx.strokeStyle = '#efe6d0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) { const bx = x + 6 + k * 7; ctx.beginPath(); ctx.moveTo(bx, y + 4); ctx.quadraticCurveTo(bx + 6, y - 22 + k * 3, bx + 14, y - 4); ctx.stroke(); }
  ctx.fillStyle = '#efe6d0';
  ctx.beginPath(); ctx.ellipse(x - 14, y - 8, 15, 12, -0.2, 0, TAU); ctx.fill();
  ctx.fillRect(x - 24, y - 2, 18, 8);
  ctx.fillStyle = '#b8ad94'; ctx.beginPath(); ctx.ellipse(x - 12, y - 4, 12, 7, -0.2, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath(); ctx.ellipse(x - 19, y - 10, 3.6, 4.4, 0, 0, TAU); ctx.ellipse(x - 9, y - 11, 3.6, 4.4, 0, 0, TAU); ctx.fill();
  for (let k = 0; k < 4; k++) ctx.fillRect(x - 22 + k * 4, y + 2, 2, 3);
  // A tattered banner on a spear.
  ctx.strokeStyle = '#5a3e22'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 36, y + 6); ctx.lineTo(x + 36, y - 26); ctx.stroke();
  ctx.fillStyle = '#b8342a'; ctx.beginPath(); ctx.moveTo(x + 36, y - 26); ctx.lineTo(x + 48, y - 22); ctx.lineTo(x + 36, y - 17); ctx.fill();
}

function crystalSpire(ctx, x, y) {
  shadow(ctx, x + 4, y + 2, 28, 9);
  const shard = (sx, h, w, lean, c) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(sx - w, y); ctx.lineTo(sx + lean, y - h); ctx.lineTo(sx + w, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(sx - w, y); ctx.lineTo(sx + lean, y - h); ctx.lineTo(sx - w * 0.1, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6a5a9a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(sx - w, y); ctx.lineTo(sx + lean, y - h); ctx.lineTo(sx + w, y); ctx.stroke();
  };
  shard(x - 16, 26, 7, -5, '#c8a8ff'); shard(x + 16, 30, 7, 5, '#9affff'); shard(x, 50, 10, 0, '#e8d8ff'); shard(x + 6, 22, 5, 3, '#ff9ae0');
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y - 30, 0, x, y - 30, 30); g.addColorStop(0, 'rgba(220, 200, 255, 0.5)'); g.addColorStop(1, 'rgba(220, 200, 255, 0)');
  ctx.fillStyle = g; ctx.fillRect(x - 30, y - 60, 60, 60); ctx.restore();
}

function landmark(ctx, biomeId, p, t) {
  const L = { volcanic: volcano, caverns: caveMouth, mangrove: stiltHut, abyss: abyssRift, bone_sands: giantSkull, crystal: crystalSpire }[biomeId];
  if (L) { L(ctx, p.x, p.y + 4); return; }
  if (biomeId === 'cliff_cove') {
    ctx.save(); ctx.translate(p.x, p.y + 6); ctx.scale(0.72, 0.72); drawLighthouse(ctx, { x: 0, y: 0 }, t); ctx.restore();
  } else if (biomeId === 'glacial') iceSpires(ctx, p.x, p.y + 6);
  else if (biomeId === 'shipwreck') wreck(ctx, p.x, p.y + 4);
  else pirateFort(ctx, p.x, p.y + 4);
}

// Landmarks out on a survival arena (2026-10-04): the same set pieces the
// chart islands carry, by kind (engine/arena.mjs BIOME_LANDMARKS).
const LANDMARK_KINDS = { fort: pirateFort, ice: iceSpires, wreck, volcano, cave: caveMouth, hut: stiltHut, rift: abyssRift, skull: giantSkull, crystal: crystalSpire };
export function drawLandmarkKind(ctx, kind, x, y, t, scale = 1, angle = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.rotate(angle * 0.4);
  if (kind === 'lighthouse') { ctx.translate(0, 6); ctx.scale(0.72, 0.72); drawLighthouse(ctx, { x: 0, y: 0 }, t); }
  else (LANDMARK_KINDS[kind] || pirateFort)(ctx, 0, 4);
  ctx.restore();
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

// Toy island images (art batch I) replace the rendered portrait per biome
// once loaded; biomes without one keep the terrain-renderer portrait.
export const ISLAND_SPRITES = ['tropical', 'cliff_cove', 'glacial', 'shipwreck', 'volcanic', 'mangrove', 'abyss', 'bone_sands', 'crystal'];
const islandImgs = new Map();
export function loadIslandSprites() { for (const b of Object.keys(ISLAND_SHAPES)) islandSpriteReady(b); }
// Also serves the plain pads (<biome>_pad<N>) used as arena obstacles.
export function islandSpriteReady(biomeId) {
  if (!ISLAND_SHAPES[biomeId] || typeof Image === 'undefined') return null;
  let im = islandImgs.get(biomeId);
  if (!im) { im = new Image(); im.src = `assets/islands/${biomeId}.png`; islandImgs.set(biomeId, im); }
  return im.complete && im.naturalWidth ? im : null;
}

// Draws the island for `stage` in `biomeId` into a w×h box. `locked`
// sinks it into the fog.
export function drawIsland(ctx, w, h, biomeId, stage, { locked = false } = {}) {
  const sp = islandSpriteReady(biomeId);
  if (sp) {
    const s = Math.min(w / sp.naturalWidth, h / sp.naturalHeight) * 0.9;
    const dw = sp.naturalWidth * s; const dh = sp.naturalHeight * s;
    ctx.save();
    ctx.drawImage(sp, (w - dw) / 2, (h - dh) / 2, dw, dh);
    if (locked) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(34, 52, 68, 0.66)';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
    return;
  }
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

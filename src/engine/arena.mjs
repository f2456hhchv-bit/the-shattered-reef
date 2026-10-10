// Survival arena generator (2026-10-04, project owner: "Survivor.io
// gameplay structure, but unmistakably The Shattered Reef"). Replaces the
// maze as the level layout: one large open reef, several screens across,
// ringed by an island coastline, with islands, rock clusters, sandbars
// and channels scattered through it, wrecks and biome landmarks to sail
// past, and treasure floating beside them. You start in open water in
// the middle and enemies come from every side.
//
// Same tile-grid contract as maze.mjs (grid.tiles[y][x], 1 = land), so
// the coast field, collision, terrain art, weather and spawning all work
// unchanged. Pure and deterministic from the rng.

import { makeValueNoise, fbm } from './maze.mjs';
import { ISLAND_SHAPES } from '../data/islandShapes.mjs';

export const ARENA_DEFAULTS = Object.freeze({
  size: 122, // tiles per side (16px tiles: 1952px; was 128 until 2026-10-04)
  border: 5, // tiles of coastline round the edge (plus noise)
  centreClear: 11, // tiles of open water round the spawn
  islandDensity: 1, // biome data can scale this (arena.islands)
  minGap: 3.5, // tiles of water between islands, so channels fit a ship
  seaIslands: 7, // toy island images placed as obstacles (2026-10-10)
});

// Toy island images (assets/islands) usable as sea obstacles in a biome:
// its chart island plus any plain pads (<biome>_pad<N>).
export function seaIslandPool(biomeId) {
  return Object.keys(ISLAND_SHAPES).filter((n) => n === biomeId || n.startsWith(`${biomeId}_pad`));
}

// Outline radius (tiles) of island image `name` drawn with its longest
// side 2r tiles, at angle a (radians, +x = 0, +y down), mirrored if flip.
export function seaIslandRadius(name, r, a, flip = false) {
  const sh = ISLAND_SHAPES[name]; const n = sh.r.length;
  let t = flip ? Math.PI - a : a;
  t = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const f = (t / (2 * Math.PI)) * n; const i = Math.floor(f) % n; const k = f - Math.floor(f);
  return (sh.r[i] * (1 - k) + sh.r[(i + 1) % n] * k) * r;
}
// Collision sits this far inside the drawn outline, so the terrain's own
// land (and its shore wobble) stays hidden under the image's rim.
export const SEA_ISLAND_INSET = 0.84;

// Biome flavour for landmarks: what the 2-3 big set pieces on each map are.
export const BIOME_LANDMARKS = Object.freeze({
  tropical: 'fort', cliff_cove: 'lighthouse', glacial: 'ice', shipwreck: 'wreck',
  volcanic: 'volcano', caverns: 'cave', mangrove: 'hut', abyss: 'rift', bone_sands: 'skull', crystal: 'crystal',
});

function blob(tiles, size, cx, cy, rx, ry, ang, noise, rough = 0.6) {
  const R = Math.max(rx, ry) * (1 + rough) + 2;
  const ca = Math.cos(ang); const sa = Math.sin(ang);
  for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(size - 1, Math.ceil(cy + R)); y++) {
    for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(size - 1, Math.ceil(cx + R)); x++) {
      const dx = x + 0.5 - cx; const dy = y + 0.5 - cy;
      const u = (dx * ca + dy * sa) / rx; const v = (-dx * sa + dy * ca) / ry;
      const d = Math.hypot(u, v);
      if (d < 1 + (fbm(noise, x * 0.22, y * 0.22, 3) - 0.5) * rough * 2) tiles[y][x] = 1;
    }
  }
}

// Water tiles not inside any 3x3 all-water window become land: removes
// slivers a ship couldn't fit through (they'd read as channels but jam).
function closeSlivers(tiles, size) {
  const open = (x, y) => x >= 0 && y >= 0 && x < size && y < size && tiles[y][x] === 0;
  const keep = Array.from({ length: size }, () => new Uint8Array(size));
  for (let y = 0; y < size - 2; y++) {
    for (let x = 0; x < size - 2; x++) {
      let ok = true;
      for (let dy = 0; dy < 3 && ok; dy++) for (let dx = 0; dx < 3; dx++) if (!open(x + dx, y + dy)) { ok = false; break; }
      if (ok) for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) keep[y + dy][x + dx] = 1;
    }
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (tiles[y][x] === 0 && !keep[y][x]) tiles[y][x] = 1;
}

function fillUnreachable(tiles, size, sx, sy) {
  const seen = Array.from({ length: size }, () => new Uint8Array(size));
  const stack = [sx, sy]; seen[sy][sx] = 1;
  while (stack.length) {
    const y = stack.pop(); const x = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || seen[ny][nx] || tiles[ny][nx] !== 0) continue;
      seen[ny][nx] = 1; stack.push(nx, ny);
    }
  }
  let water = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (tiles[y][x] === 0 && !seen[y][x]) tiles[y][x] = 1;
    if (tiles[y][x] === 0) water++;
  }
  return water;
}

// Distance in tiles from each tile to the nearest land (BFS, 8-neighbour).
export function waterDistance(tiles, size) {
  const d = Array.from({ length: size }, () => new Float32Array(size).fill(Infinity));
  const q = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (tiles[y][x] === 1) { d[y][x] = 0; q.push(x, y); }
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i]; const y = q[i + 1];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const nd = d[y][x] + (dx && dy ? 1.414 : 1);
      if (nd < d[ny][nx]) { d[ny][nx] = nd; q.push(nx, ny); }
    }
  }
  return d;
}

// Builds the arena. Returns { grid, spawnTile, landmarks, chestTiles }
// where landmarks are { kind, tx, ty, angle } in tile units (centre of
// the set piece, on land) and chestTiles are open-water tiles beside them.
export function buildArenaGrid(rng, biomeId = 'tropical', opts = {}) {
  const o = { ...ARENA_DEFAULTS, ...opts };
  const N = o.size;
  const tiles = Array.from({ length: N }, () => new Array(N).fill(0));
  const noise = makeValueNoise(Math.floor(rng() * 2 ** 31));
  const c = N / 2;

  // 1. The coastline that rings the map: an island chain, not a wall.
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const edge = Math.min(x, y, N - 1 - x, N - 1 - y);
      // Low-frequency swell makes bays and headlands, not an even wall.
      const reach = o.border - 3 + (fbm(noise, x * 0.035 + 40, y * 0.035 + 11, 3) - 0.3) * 22 + fbm(noise, x * 0.2, y * 0.2, 2) * 3;
      if (edge < reach) tiles[y][x] = 1;
    }
  }

  // 2. Islands of every size: big jungle islands, middling isles, and
  // clusters of rocks. Rejection-sampled with a gap so channels stay
  // sailable; none inside the spawn's clear water.
  const placed = [];
  const fits = (x, y, r) => Math.hypot(x - c, y - c) > o.centreClear + r
    && placed.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + o.minGap);
  // Toy island images first (2026-10-10): obstacles in the open sea, drawn
  // as sprites over land stamped to their outline.
  const seaIslands = [];
  const pool = seaIslandPool(biomeId);
  for (let tries = 0; pool.length && seaIslands.length < o.seaIslands && tries < o.seaIslands * 40; tries++) {
    const x = o.border + 12 + rng() * (N - 2 * o.border - 24);
    const y = o.border + 12 + rng() * (N - 2 * o.border - 24);
    const r = 5 + rng() * 4;
    const sprite = pool[Math.floor(rng() * pool.length)];
    const flip = rng() < 0.5;
    if (!fits(x, y, r)) continue;
    const R = Math.ceil(r * 1.6);
    for (let ty = Math.max(0, Math.floor(y) - R); ty <= Math.min(N - 1, Math.floor(y) + R); ty++) {
      for (let tx = Math.max(0, Math.floor(x) - R); tx <= Math.min(N - 1, Math.floor(x) + R); tx++) {
        const dx = tx + 0.5 - x; const dy = ty + 0.5 - y;
        if (Math.hypot(dx, dy) < seaIslandRadius(sprite, r, Math.atan2(dy, dx), flip) * SEA_ISLAND_INSET) tiles[ty][tx] = 1;
      }
    }
    placed.push({ x, y, r, kind: 'sea' });
    seaIslands.push({ sprite, tx: x, ty: y, r, flip });
  }
  const want = Math.round(44 * o.islandDensity * (N / 128) ** 2);
  for (let tries = 0; placed.length < want && tries < want * 40; tries++) {
    const x = o.border + 8 + rng() * (N - 2 * o.border - 16);
    const y = o.border + 8 + rng() * (N - 2 * o.border - 16);
    const big = rng();
    const r = big < 0.3 ? 7.5 + rng() * 5 : big < 0.65 ? 4.2 + rng() * 2.8 : 2 + rng() * 1.6;
    if (!fits(x, y, r)) continue;
    const aspect = 1 + rng() * 1.3;
    const ang = rng() * Math.PI;
    placed.push({ x, y, r, kind: r >= 7 ? 'island' : r >= 4 ? 'isle' : 'rocks' });
    if (r < 4) {
      // A rock cluster: two to four stacks.
      const n = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const a = rng() * Math.PI * 2; const d = rng() * r;
        blob(tiles, N, x + Math.cos(a) * d, y + Math.sin(a) * d, 1.1 + rng() * 1.1, 1.1 + rng() * 1.1, rng() * 3, noise, 0.35);
      }
    } else {
      blob(tiles, N, x, y, r * 1.15, (r * 1.15) / aspect, ang, noise, 0.45);
    }
  }
  // A few long sandbars/reefs: thin chains that make channels and cover.
  const bars = Math.round(4 * o.islandDensity * (N / 128) ** 2);
  for (let b = 0, tries = 0; b < bars && tries < 200; tries++) {
    const x = o.border + 14 + rng() * (N - 2 * o.border - 28);
    const y = o.border + 14 + rng() * (N - 2 * o.border - 28);
    const len = 9 + rng() * 8; const ang = rng() * Math.PI;
    const ok = [0, 0.5, 1].every((k) => fits(x + Math.cos(ang) * len * (k - 0.5), y + Math.sin(ang) * len * (k - 0.5), 2));
    if (!ok) continue;
    for (let k = 0; k <= 1.0001; k += 0.12) {
      blob(tiles, N, x + Math.cos(ang) * len * (k - 0.5), y + Math.sin(ang) * len * (k - 0.5) + Math.sin(k * 6) * 1.2, 1.4, 1, ang, noise, 0.4);
    }
    placed.push({ x, y, r: len / 2, kind: 'bar' });
    b++;
  }

  // 3. Clean up: no slivers, no cut-off pools, centre guaranteed open.
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot(x + 0.5 - c, y + 0.5 - c) < o.centreClear - 2) tiles[y][x] = 0;
  closeSlivers(tiles, N);
  fillUnreachable(tiles, N, Math.floor(c), Math.floor(c));

  // 4. Landmarks: shipwrecks on beaches and the biome's set piece on the
  // biggest islands; treasure floats in the water beside them.
  const dist = waterDistance(tiles, N);
  const landmarks = [];
  const bigs = placed.filter((p) => p.kind === 'island').sort((a, b) => b.r - a.r);
  const setPiece = BIOME_LANDMARKS[biomeId] || 'fort';
  for (const p of bigs.slice(0, 3)) {
    if (tiles[Math.floor(p.y)][Math.floor(p.x)] !== 1) continue;
    landmarks.push({ kind: setPiece, tx: p.x, ty: p.y, angle: 0 });
  }
  // Wrecks: on an isle's shore, or as a lone wreck on its own reef.
  const isles = placed.filter((p) => p.kind === 'isle' || p.kind === 'rocks');
  const wrecks = Math.min(isles.length, 3 + Math.floor(rng() * 2));
  for (let k = 0; k < wrecks; k++) {
    const p = isles.splice(Math.floor(rng() * isles.length), 1)[0];
    const angle = -0.6 + rng() * 1.2;
    // A rock cluster's centre can be water between its stacks: use the
    // nearest land tile instead.
    let spot = null; let bd = Infinity;
    const R = Math.ceil(p.r + 3);
    for (let y = Math.max(0, Math.floor(p.y) - R); y <= Math.min(N - 1, Math.floor(p.y) + R); y++) {
      for (let x = Math.max(0, Math.floor(p.x) - R); x <= Math.min(N - 1, Math.floor(p.x) + R); x++) {
        if (tiles[y][x] !== 1) continue;
        const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
        if (d < bd) { bd = d; spot = { tx: x + 0.5, ty: y + 0.5 }; }
      }
    }
    if (spot) landmarks.push({ kind: 'wreck', ...spot, angle });
  }
  // Chests: an open-water tile 2-6 tiles from each landmark, clear of shore.
  const chestTiles = [];
  for (const lm of landmarks) {
    let best = null;
    for (let tries = 0; tries < 60 && !best; tries++) {
      const a = rng() * Math.PI * 2; const d = 4 + rng() * 6;
      const x = Math.floor(lm.tx + Math.cos(a) * d); const y = Math.floor(lm.ty + Math.sin(a) * d);
      if (x < 1 || y < 1 || x >= N - 1 || y >= N - 1) continue;
      if (dist[y][x] >= 2.5) best = { tx: x + 0.5, ty: y + 0.5 };
    }
    if (best) chestTiles.push(best);
  }

  const grid = { width: N, height: N, tiles, unit: 1 };
  return { grid, spawnTile: { tx: c, ty: c }, landmarks, chestTiles, waterDist: dist, seaIslands };
}

// True if world point (x, y) is open water at least `clear` tiles from land.
export function isOpenWater(arena, x, y, tileSize, clear = 1.5) {
  const tx = Math.floor(x / tileSize); const ty = Math.floor(y / tileSize);
  const d = arena.waterDist;
  if (ty < 0 || tx < 0 || ty >= d.length || tx >= d.length) return false;
  return d[ty][tx] >= clear;
}

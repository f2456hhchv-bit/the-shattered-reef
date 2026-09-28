// The boss lair (2026-09-28, project owner: "Boss level needs to be
// different... a circle with a main central pit where the boss has its
// lair"). Level 5 of every stage uses this layout instead of the square
// maze:
//
//   outer ring channel  ── spawn sits on it, between two spokes
//        │ 3 spokes (random angles)
//   middle ring channel
//        │ 2 spokes, offset from the outer ones, so you must travel around
//   central pit         ── the Kraken's Anchor, tethered here; the exit is a
//                          sealed whirlpool at its centre (run.mjs opens it
//                          when the boss dies)
//
// Same contract as buildOrganicReefGrid: a tile grid (0 water, 1 rock) that
// the coast field, collision and spawns all read. Pure function of the rng.
// Ring edges wobble with noise for an organic look, but each ring shifts as
// a whole (one shared wobble) with only a small independent wobble on its
// width, so a channel can bend without pinching shut.

import { makeValueNoise, fbm } from './maze.mjs';

export const LAIR_TUNING = Object.freeze({
  size: 93, // tiles square (same footprint as a 9×9 maze level)
  pitRadius: 11, // tiles
  middleRing: { radius: 22.5, halfWidth: 2.9 },
  outerRing: { radius: 37, halfWidth: 3.1 },
  outerSpokes: 3,
  innerSpokes: 2,
  spokeHalfWidth: 2.6, // tiles
  ringWobble: 2.2, // tiles the ring centre-line can bend in or out
  widthWobble: 0.5, // tiles either way on a ring's half-width
  pillars: 3, // small rock pillars inside the pit: cover to kite around
  pillarRadius: 1.3,
  pillarOrbit: 0.58, // × pitRadius
});

const TAU = Math.PI * 2;

function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax; const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

export function buildLairGrid(rng, o = LAIR_TUNING) {
  const W = o.size;
  const c = W / 2;
  const noise = makeValueNoise(Math.floor(rng() * 2 ** 31));
  // Smooth wobble as a function of angle only (sampled on a circle in noise
  // space, so it wraps seamlessly at 0/2π).
  const wob = (a, k) => (fbm(noise, Math.cos(a) * 1.6 + k * 7.1, Math.sin(a) * 1.6 + k * 3.3, 2) - 0.5) * 2;
  const tiles = Array.from({ length: W }, () => Array(W).fill(1));

  const outerStart = rng() * TAU;
  const outerAngles = Array.from({ length: o.outerSpokes }, (_, i) => outerStart + (i * TAU) / o.outerSpokes + (rng() - 0.5) * 0.5);
  const innerStart = outerStart + Math.PI / o.outerSpokes; // offset: no straight run to the pit
  const innerAngles = Array.from({ length: o.innerSpokes }, (_, i) => innerStart + (i * TAU) / o.innerSpokes + (rng() - 0.5) * 0.4);
  const pillarStart = rng() * TAU;
  const pillars = Array.from({ length: o.pillars }, (_, i) => {
    const a = pillarStart + (i * TAU) / o.pillars;
    return { x: c + Math.cos(a) * o.pitRadius * o.pillarOrbit, y: c + Math.sin(a) * o.pitRadius * o.pillarOrbit };
  });

  const ringCentre = (ring, a, k) => ring.radius + wob(a, k) * o.ringWobble;
  const inRing = (ring, r, a, k) => Math.abs(r - ringCentre(ring, a, k)) <= ring.halfWidth + wob(a, k + 11) * o.widthWobble;
  const at = (ring, a, k) => ({ x: c + Math.cos(a) * ringCentre(ring, a, k), y: c + Math.sin(a) * ringCentre(ring, a, k) });

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - c; const py = y + 0.5 - c;
      const r = Math.hypot(px, py); const a = Math.atan2(py, px);
      let water = r <= o.pitRadius + wob(a, 5) * 1.2
        || inRing(o.middleRing, r, a, 1)
        || inRing(o.outerRing, r, a, 2);
      if (!water) {
        for (const sa of outerAngles) {
          const p = at(o.middleRing, sa, 1); const q = at(o.outerRing, sa, 2);
          if (segDist(x + 0.5, y + 0.5, p.x, p.y, q.x, q.y) <= o.spokeHalfWidth) { water = true; break; }
        }
      }
      if (!water) {
        for (const sa of innerAngles) {
          const q = at(o.middleRing, sa, 1);
          if (segDist(x + 0.5, y + 0.5, c, c, q.x, q.y) <= o.spokeHalfWidth && r >= o.pitRadius - 2) { water = true; break; }
        }
      }
      if (water && pillars.some((p) => Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) <= o.pillarRadius)) water = false;
      if (water) tiles[y][x] = 0;
    }
  }

  // Spawn: on the outer ring, halfway between two outer spokes.
  const spawnAngle = outerAngles[0] + Math.PI / o.outerSpokes;
  const sp = at(o.outerRing, spawnAngle, 2);
  const spawnTile = { tx: sp.x, ty: sp.y };

  // Fill any pocket not reachable from the spawn (keeps isFullyConnected).
  const seen = Array.from({ length: W }, () => Array(W).fill(false));
  const stack = [[Math.floor(sp.x), Math.floor(sp.y)]];
  if (tiles[stack[0][1]][stack[0][0]] === 0) seen[stack[0][1]][stack[0][0]] = true;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= W || seen[ny][nx] || tiles[ny][nx] !== 0) continue;
      seen[ny][nx] = true; stack.push([nx, ny]);
    }
  }
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (tiles[y][x] === 0 && !seen[y][x]) tiles[y][x] = 1;

  return {
    grid: { width: W, height: W, tiles, unit: 10, room: 7, wall: 3 },
    spawnTile,
    centreTile: { tx: c, ty: c },
    pitRadiusTiles: o.pitRadius,
    outerAngles, innerAngles, pillars,
  };
}

// The boss lair (2026-09-28, project owner: "Boss level needs to be
// different... a circle with a main central pit where the boss has its
// lair"). Level 5 of every stage uses this layout instead of the square
// maze:
//
//   outer ring channel  ── spawn sits on it, between two spokes
//        │ 3 spokes (random angles)
//   middle ring channel
//        │ 2 spokes, offset from the ones above
//   inner ring channel
//        │ 2 spokes, offset again, so you must travel around each ring
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
  // 2026-09-29 (project owner: "Boss maze I took 2 turns and was at the
  // centre"): three rings instead of two, each joined to the next by
  // spokes offset from the ones before, so the way in winds.
  size: 113, // tiles square
  pitRadius: 11, // tiles
  // Outermost first. `spokes` = channels from this ring inward (the last
  // ring's spokes open into the pit).
  rings: [
    { radius: 47, halfWidth: 3.1, spokes: 3 },
    { radius: 34, halfWidth: 2.9, spokes: 2 },
    { radius: 21.5, halfWidth: 2.9, spokes: 2 },
  ],
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

  const rings = o.rings;
  // Spoke angles per ring (inward from ring i), each set rotated half a gap
  // from the set before so there is never a straight run to the pit.
  const spokeAngles = [];
  let start = rng() * TAU;
  for (let i = 0; i < rings.length; i++) {
    const n = rings[i].spokes;
    spokeAngles.push(Array.from({ length: n }, (_, j) => start + (j * TAU) / n + (rng() - 0.5) * 0.45));
    start += Math.PI / n;
  }
  const pillarStart = rng() * TAU;
  const pillars = Array.from({ length: o.pillars }, (_, i) => {
    const a = pillarStart + (i * TAU) / o.pillars;
    return { x: c + Math.cos(a) * o.pitRadius * o.pillarOrbit, y: c + Math.sin(a) * o.pitRadius * o.pillarOrbit };
  });

  const ringCentre = (i, a) => rings[i].radius + wob(a, i + 1) * o.ringWobble;
  const inRing = (i, r, a) => Math.abs(r - ringCentre(i, a)) <= rings[i].halfWidth + wob(a, i + 12) * o.widthWobble;
  const at = (i, a) => ({ x: c + Math.cos(a) * ringCentre(i, a), y: c + Math.sin(a) * ringCentre(i, a) });

  // Spoke segments: ring i -> ring i+1, or the last ring -> the pit centre.
  const segs = [];
  for (let i = 0; i < rings.length; i++) {
    for (const sa of spokeAngles[i]) {
      const p = at(i, sa);
      const q = i + 1 < rings.length ? at(i + 1, sa) : { x: c, y: c };
      segs.push({ p, q, toPit: i + 1 >= rings.length });
    }
  }

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - c; const py = y + 0.5 - c;
      const r = Math.hypot(px, py); const a = Math.atan2(py, px);
      let water = r <= o.pitRadius + wob(a, 5) * 1.2;
      for (let i = 0; !water && i < rings.length; i++) water = inRing(i, r, a);
      for (let k = 0; !water && k < segs.length; k++) {
        const s = segs[k];
        if (segDist(x + 0.5, y + 0.5, s.p.x, s.p.y, s.q.x, s.q.y) <= o.spokeHalfWidth && (!s.toPit || r >= o.pitRadius - 2)) water = true;
      }
      if (water && pillars.some((p) => Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) <= o.pillarRadius)) water = false;
      if (water) tiles[y][x] = 0;
    }
  }

  // Spawn: on the outer ring, halfway between two of its spokes.
  const n0 = rings[0].spokes;
  const spawnAngle = spokeAngles[0][0] + Math.PI / n0;
  const sp = at(0, spawnAngle);
  const spawnTile = { tx: sp.x, ty: sp.y };
  // Warding seals: one on each ring, in a stretch between that ring's
  // inward spokes (never the stretch the spawn sits in), so reaching each
  // one means sailing the ring rather than cutting straight through.
  const seals = rings.map((ring, i) => {
    const gaps = spokeAngles[i].map((sa) => sa + Math.PI / ring.spokes);
    const choice = i === 0 ? gaps[1 % gaps.length] : gaps[Math.floor(rng() * gaps.length)];
    const p = at(i, choice);
    return { tx: p.x, ty: p.y, ring: i };
  });

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
    spokeAngles, pillars, seals,
  };
}

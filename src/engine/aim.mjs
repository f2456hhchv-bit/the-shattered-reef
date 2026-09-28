// Aim-assist (2026-09-28 rework). Pure logic, shared by main.mjs and the
// balance sim so both fire exactly the same way.
//
// The old aim pointed at where the target WAS. Skimmers orbit the boat at
// ~2 rad/s and Harpies circle before diving, so a cannonball arriving
// 0.15s later missed ~4 in 5 shots. This module:
//   1. tracks each enemy's velocity and turn rate (smoothed),
//   2. predicts its position along a constant-speed, constant-turn arc,
//   3. solves the intercept time iteratively, and
//   4. picks targets it can actually hit: in range, visible over water,
//      preferring the enemy the active weapon counters, and sticking to
//      the current target so the aim doesn't flicker between a pack.

import { sampleField } from './terrain.mjs';

const TURN_SMOOTH = 8; // 1/s — exponential smoothing on measured turn rate
const MAX_TURN_RATE = 6; // rad/s — clamp noisy estimates

function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Call once per simulated frame, after enemies have moved. Velocity is
// measured from actual displacement (not the AI's intended vx/vy), so wall
// slides, knockback and any AI quirk are all seen as they really happen.
const VEL_SMOOTH = 14; // 1/s
export function trackEnemyMotion(enemies, dt) {
  if (dt <= 0) return;
  const kv = 1 - Math.exp(-VEL_SMOOTH * dt);
  const kw = 1 - Math.exp(-TURN_SMOOTH * dt);
  for (const e of enemies) {
    if (e._aimX == null) { e._aimX = e.x; e._aimY = e.y; e._aimVx = 0; e._aimVy = 0; e._aimOmega = 0; e._aimDir = null; continue; }
    const mvx = (e.x - e._aimX) / dt; const mvy = (e.y - e._aimY) / dt;
    e._aimX = e.x; e._aimY = e.y;
    if (Math.hypot(mvx, mvy) > 600) { e._aimVx = 0; e._aimVy = 0; e._aimOmega = 0; e._aimDir = null; continue; } // teleport/spawn
    e._aimVx += (mvx - e._aimVx) * kv; e._aimVy += (mvy - e._aimVy) * kv;
    const speed = Math.hypot(e._aimVx, e._aimVy);
    const dir = Math.atan2(e._aimVy, e._aimVx);
    if (e._aimDir == null || speed < 8) { e._aimDir = dir; e._aimOmega *= 1 - kw; continue; }
    const measured = Math.max(-MAX_TURN_RATE, Math.min(MAX_TURN_RATE, wrapAngle(dir - e._aimDir) / dt));
    e._aimOmega += (measured - e._aimOmega) * kw;
    e._aimDir = dir;
  }
}

// Position after `t` seconds on a constant-speed arc with turn rate omega.
export function predictPosition(e, t) {
  const w = e._aimOmega || 0;
  let vx = e._aimVx ?? e.vx ?? 0; let vy = e._aimVy ?? e.vy ?? 0;
  if (e._aimVx != null) {
    // Undo the smoothing lag: an exponential average of a vector turning at
    // w trails it by exactly the factor 1/(1 + i·w/k) (as complex numbers).
    const q = w / VEL_SMOOTH;
    [vx, vy] = [vx - vy * q, vy + vx * q];
  }
  if (Math.abs(w) < 1e-3) return { x: e.x + vx * t, y: e.y + vy * t };
  const s = Math.sin(w * t); const c = Math.cos(w * t);
  // Integral of the rotated velocity vector.
  return {
    x: e.x + (vx * s - vy * (1 - c)) / w,
    y: e.y + (vy * s + vx * (1 - c)) / w,
  };
}

// Heading that meets `target` with a projectile of `speed` from (sx, sy).
export function interceptHeading(sx, sy, target, speed, iterations = 6) {
  let t = Math.hypot(target.x - sx, target.y - sy) / speed;
  let p = { x: target.x, y: target.y };
  for (let i = 0; i < iterations; i++) {
    p = predictPosition(target, t);
    t = Math.hypot(p.x - sx, p.y - sy) / speed;
  }
  return { heading: Math.atan2(p.y - sy, p.x - sx), t, point: p };
}

function clearShot(sx, sy, x, y, grid, tileSize, coast) {
  const dx = x - sx; const dy = y - sy;
  const steps = Math.ceil(Math.hypot(dx, dy) / 8);
  for (let i = 1; i < steps; i++) {
    const px = sx + (dx * i) / steps; const py = sy + (dy * i) / steps;
    if (coast) { if (sampleField(coast, px, py) > 0) return false; continue; }
    if (!grid) continue;
    const tx = Math.floor(px / tileSize); const ty = Math.floor(py / tileSize);
    if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height || grid.tiles[ty][tx] === 1) return false;
  }
  return true;
}

// Chooses what the active weapon should shoot at, and where.
// Returns { target, heading, point } or null when nothing is worth firing
// at (the caller then fires along the boat's heading).
export function computeAim(enemies, boat, weapon, {
  grid = null, tileSize = 16, coast = null, counterOf = (e) => e.counter, previousTarget = null,
} = {}) {
  let best = null; let bestScore = Infinity;
  const speed = weapon.projectileSpeed;
  const reach = weapon.range;
  for (const e of enemies) {
    if (e.health <= 0 || e.invulnerable) continue;
    const d = Math.hypot(e.x - boat.x, e.y - boat.y);
    if (d > reach + e.radius) continue;
    const aim = interceptHeading(boat.x, boat.y, e, speed);
    const lead = Math.hypot(aim.point.x - boat.x, aim.point.y - boat.y);
    if (lead > reach + e.radius) continue; // it'll be out of range by then
    // Flyers pass over land, so only water-bound shots need a clear line.
    if (!clearShot(boat.x, boat.y, aim.point.x, aim.point.y, grid, tileSize, coast)) continue;
    let score = d;
    if (counterOf(e) === weapon.id) score *= 0.5; // this is what the weapon is for
    if (e === previousTarget) score *= 0.7; // don't flicker across a pack
    if (score < bestScore) { bestScore = score; best = { target: e, heading: aim.heading, point: aim.point }; }
  }
  return best;
}

// Arcade boat physics: momentum + drag + a turn rate, not a rigid-body sim.
// The ship steers toward wherever the movement stick points (twin-stick
// feel, not tank controls) but keeps its own inertia — the "weight" that
// makes it feel like a ship and not a car is entirely in the drag/turnRate
// tuning, not the model itself.

export const DEFAULT_BOAT_TUNING = {
  acceleration: 240, // px/s^2 at full stick deflection
  maxSpeed: 120,      // px/s
  drag: 2.4,          // fraction of velocity removed per second (approx.) — high on purpose: a boat that keeps coasting into walls after you let go of the stick isn't "weighty", it's just unresponsive. See run.test.mjs / decisions log.
  turnRate: Math.PI * 2.2, // radians/s the heading can turn at full stick — quick enough to actually dodge a wall you see coming
  lateralGrip: 4, // keel: per-second damping of sideways velocity only. 4 halves turn drift (90° turn at speed: 51px → 26px slide) with top speed and straight coast unchanged — 2026-09-28 feedback
};

export const MAX_HULL = 100;
// Wall-impact damage tuning: damage scales with how hard you hit the wall
// head-on (the velocity component along the collision normal), not with
// mere contact — sliding along a wall you're already touching does zero
// damage, since its normal-component velocity was already cancelled the
// frame the contact started. Only a fresh, hard hit costs hull.
export const WALL_IMPACT_DAMAGE_THRESHOLD = 40; // px/s of inward speed below this: no damage (a graze)
export const WALL_IMPACT_DAMAGE_PER_SPEED = 0.12; // hull lost per px/s of inward speed above the threshold

// `maxHull` defaults to the baseline MAX_HULL but can be overridden per the
// selected Ship Hull (data/meta.mjs) — stored on the boat itself so UI and
// damage code read the boat's own capacity rather than a fixed constant.
export function createBoat(x, y, heading = 0, maxHull = MAX_HULL) {
  return { x, y, heading, vx: 0, vy: 0, health: maxHull, maxHull };
}

function shortestAngleDelta(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

// `input` is a stick vector, each axis roughly in [-1, 1] (not required to
// be normalized — magnitude also drives throttle).
export function stepBoat(boat, input, dt, tuning = DEFAULT_BOAT_TUNING) {
  const mag = Math.hypot(input.x, input.y);
  if (mag > 0.08) {
    const targetHeading = Math.atan2(input.y, input.x);
    const maxTurn = tuning.turnRate * dt;
    const delta = shortestAngleDelta(boat.heading, targetHeading);
    boat.heading += Math.max(-maxTurn, Math.min(maxTurn, delta));
    const throttle = Math.min(mag, 1);
    boat.vx += Math.cos(boat.heading) * tuning.acceleration * throttle * dt;
    boat.vy += Math.sin(boat.heading) * tuning.acceleration * throttle * dt;
  }

  // Keel: extra damping on the velocity component ACROSS the bow only, so
  // the boat carves into a turn instead of skidding sideways along its old
  // line (2026-09-28 feedback: "too much drift when turning"). Forward
  // speed and straight-line coasting are untouched — that's `drag`'s job.
  const grip = tuning.lateralGrip ?? DEFAULT_BOAT_TUNING.lateralGrip;
  if (grip > 0) {
    const fx = Math.cos(boat.heading), fy = Math.sin(boat.heading);
    const forward = boat.vx * fx + boat.vy * fy;
    const lateral = -boat.vx * fy + boat.vy * fx;
    const keptLateral = lateral * Math.max(0, 1 - grip * dt);
    boat.vx = forward * fx - keptLateral * fy;
    boat.vy = forward * fy + keptLateral * fx;
  }

  const dragFactor = Math.max(0, 1 - tuning.drag * dt);
  boat.vx *= dragFactor;
  boat.vy *= dragFactor;

  const speed = Math.hypot(boat.vx, boat.vy);
  if (speed > tuning.maxSpeed) {
    const s = tuning.maxSpeed / speed;
    boat.vx *= s;
    boat.vy *= s;
  }

  boat.x += boat.vx * dt;
  boat.y += boat.vy * dt;
  return boat;
}

// Circle-vs-tile-grid collision. Resolved as a proper minimum-translation-
// vector push (not a per-axis "which edge is closer" heuristic) because
// that heuristic has a real failure mode at a multi-tile-thick wall
// corner: pushing out of one overlapping tile can land the circle inside
// a *different* solid tile, and if that keeps picking a direction that
// re-embeds it, the boat walks sideways through solid rock one tile per
// frame instead of stopping. Finding the single deepest overlap and
// pushing along its actual normal each pass — repeated a few times so a
// corner (two tiles overlapping at once) resolves cleanly instead of
// fighting itself — doesn't have that failure mode: every push strictly
// reduces total penetration, so it converges instead of oscillating.
// Returns the hardest inward impact speed seen this call (px/s), or 0 if
// the boat wasn't colliding with anything. A boat already resting/sliding
// against a wall has ~0 inward speed (it was cancelled the frame contact
// started), so this is naturally 0 on every subsequent frame of a slide —
// only a fresh, hard hit reports a nonzero value. Callers use this to
// decide whether/how much hull damage to apply; boat.mjs itself doesn't
// touch boat.health so physics stays decoupled from game-state concerns.
export function resolveTileCollision(boat, radius, grid, tileSize) {
  let maxImpactSpeed = 0;
  for (let pass = 0; pass < 4; pass++) {
    const hit = deepestOverlap(boat.x, boat.y, radius, grid, tileSize);
    if (!hit) break;
    boat.x += hit.pushX;
    boat.y += hit.pushY;
    // Kill velocity along the push direction only, so sliding along a
    // wall (the tangential component) still feels smooth.
    const dot = boat.vx * hit.nx + boat.vy * hit.ny;
    if (dot < 0) {
      maxImpactSpeed = Math.max(maxImpactSpeed, -dot);
      boat.vx -= dot * hit.nx;
      boat.vy -= dot * hit.ny;
    }
  }
  return maxImpactSpeed;
}

// Converts an impact speed (from resolveTileCollision) into hull damage
// and applies it, clamped at 0. Returns the damage actually dealt (0 for
// a graze under the threshold) so a caller can decide whether to show hit
// feedback (a flash, a sound) at all.
export function applyWallImpactDamage(boat, impactSpeed) {
  if (impactSpeed <= WALL_IMPACT_DAMAGE_THRESHOLD) return 0;
  const damage = (impactSpeed - WALL_IMPACT_DAMAGE_THRESHOLD) * WALL_IMPACT_DAMAGE_PER_SPEED;
  boat.health = Math.max(0, boat.health - damage);
  return damage;
}

function isSolidTile(grid, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return true; // out of bounds = solid
  return grid.tiles[ty][tx] === 1;
}

// Scans every solid tile the circle's bounding box could touch and returns
// the push (pushX/pushY) that resolves the single deepest penetration, or
// null if the circle isn't overlapping anything solid. `nx`/`ny` is the
// push's unit normal, for velocity cancellation.
function deepestOverlap(x, y, radius, grid, tileSize) {
  const minTx = Math.floor((x - radius) / tileSize);
  const maxTx = Math.floor((x + radius) / tileSize);
  const minTy = Math.floor((y - radius) / tileSize);
  const maxTy = Math.floor((y + radius) / tileSize);

  let best = null;
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isSolidTile(grid, tx, ty)) continue;
      const rectLeft = tx * tileSize;
      const rectTop = ty * tileSize;
      const rectRight = rectLeft + tileSize;
      const rectBottom = rectTop + tileSize;
      const closestX = Math.max(rectLeft, Math.min(x, rectRight));
      const closestY = Math.max(rectTop, Math.min(y, rectBottom));
      let dx = x - closestX;
      let dy = y - closestY;
      let dist = Math.hypot(dx, dy);

      if (dist === 0) {
        // Circle center is exactly inside this tile (shouldn't happen at
        // normal per-frame speeds, but a defensive fallback matters more
        // than a correct answer here) — push out along whichever axis has
        // the least distance to an edge.
        const left = x - rectLeft, right = rectRight - x;
        const top = y - rectTop, bottom = rectBottom - y;
        const minEdge = Math.min(left, right, top, bottom);
        if (minEdge === left) { dx = -1; dy = 0; dist = 0; }
        else if (minEdge === right) { dx = 1; dy = 0; dist = 0; }
        else if (minEdge === top) { dx = 0; dy = -1; dist = 0; }
        else { dx = 0; dy = 1; dist = 0; }
        const penetration = radius + minEdge;
        const candidate = { penetration, nx: dx, ny: dy, pushX: dx * penetration, pushY: dy * penetration };
        if (!best || candidate.penetration > best.penetration) best = candidate;
        continue;
      }

      if (dist >= radius) continue; // not overlapping this tile
      const penetration = radius - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      const candidate = { penetration, nx, ny, pushX: nx * penetration, pushY: ny * penetration };
      if (!best || candidate.penetration > best.penetration) best = candidate;
    }
  }
  return best;
}

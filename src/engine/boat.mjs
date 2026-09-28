// Arcade boat physics: momentum + drag + a turn rate, not a rigid-body sim.
// The ship steers toward wherever the movement stick points (twin-stick
// feel, not tank controls) but keeps its own inertia — the "weight" that
// makes it feel like a ship and not a car is entirely in the drag/turnRate
// tuning, not the model itself.

export const DEFAULT_BOAT_TUNING = {
  acceleration: 260, // px/s^2 at full stick deflection
  maxSpeed: 140,      // px/s
  drag: 1.1,          // fraction of velocity removed per second (approx.)
  turnRate: Math.PI * 1.6, // radians/s the heading can turn at full stick
};

export function createBoat(x, y, heading = 0) {
  return { x, y, heading, vx: 0, vy: 0 };
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
export function resolveTileCollision(boat, radius, grid, tileSize) {
  for (let pass = 0; pass < 4; pass++) {
    const hit = deepestOverlap(boat.x, boat.y, radius, grid, tileSize);
    if (!hit) return;
    boat.x += hit.pushX;
    boat.y += hit.pushY;
    // Kill velocity along the push direction only, so sliding along a
    // wall (the tangential component) still feels smooth.
    const dot = boat.vx * hit.nx + boat.vy * hit.ny;
    if (dot < 0) {
      boat.vx -= dot * hit.nx;
      boat.vy -= dot * hit.ny;
    }
  }
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

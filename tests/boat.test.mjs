import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBoat, stepBoat, resolveTileCollision, applyWallImpactDamage,
  DEFAULT_BOAT_TUNING, MAX_HULL, WALL_IMPACT_DAMAGE_THRESHOLD,
} from '../src/engine/boat.mjs';

test('a boat at rest with no input stays put', () => {
  const boat = createBoat(100, 100, 0);
  stepBoat(boat, { x: 0, y: 0 }, 1 / 60);
  assert.equal(boat.x, 100);
  assert.equal(boat.y, 100);
});

test('full-throttle input accelerates the boat toward the stick direction', () => {
  const boat = createBoat(0, 0, 0);
  for (let i = 0; i < 30; i++) stepBoat(boat, { x: 1, y: 0 }, 1 / 60);
  assert.ok(boat.x > 0, 'boat should have moved in +x');
  assert.ok(Math.abs(boat.y) < 1, 'boat should stay near y=0 when pushed straight along +x');
});

test('the boat never exceeds its configured max speed', () => {
  const boat = createBoat(0, 0, 0);
  for (let i = 0; i < 300; i++) stepBoat(boat, { x: 1, y: 0 }, 1 / 60);
  const speed = Math.hypot(boat.vx, boat.vy);
  assert.ok(speed <= DEFAULT_BOAT_TUNING.maxSpeed + 0.01);
});

test('drag brings the boat to rest once input stops', () => {
  const boat = createBoat(0, 0, 0);
  for (let i = 0; i < 60; i++) stepBoat(boat, { x: 1, y: 0 }, 1 / 60);
  const speedWithInput = Math.hypot(boat.vx, boat.vy);
  for (let i = 0; i < 300; i++) stepBoat(boat, { x: 0, y: 0 }, 1 / 60);
  const speedAfterCoasting = Math.hypot(boat.vx, boat.vy);
  assert.ok(speedAfterCoasting < speedWithInput * 0.05);
});

test('the boat turns to face the stick direction rather than snapping instantly', () => {
  const boat = createBoat(0, 0, 0); // facing +x (heading 0)
  stepBoat(boat, { x: 0, y: 1 }, 1 / 60); // stick points +y (heading PI/2)
  assert.notEqual(boat.heading, 0);
  assert.ok(Math.abs(boat.heading) < Math.PI / 2, 'one frame should not fully complete the turn');
});

function makeOpenGridWithWallAt(tx) {
  const width = 20;
  const height = 10;
  const tiles = Array.from({ length: height }, () => Array(width).fill(0));
  for (let y = 0; y < height; y++) tiles[y][tx] = 1;
  return { width, height, tiles };
}

test('resolveTileCollision never lets the boat escape through a 2-tile-thick wall corner (regression)', () => {
  // Reproduces a real bug found via headless-browser playtesting: driving
  // diagonally into an L-shaped corner where a 2-tile-thick wall meets
  // another wall could get the boat simultaneously overlapping two solid
  // tiles with contradictory "push" directions. The old per-axis midpoint
  // heuristic picked whichever tile was checked last, which could push the
  // boat deeper into rock instead of out — and once embedded, it walked
  // sideways through solid ground one tile per frame, forever.
  const tileSize = 16;
  const width = 30;
  const height = 30;
  const tiles = Array.from({ length: height }, () => Array(width).fill(0));
  // An L-shaped 2-tile-thick wall corner at (7,8)-(8,8) and (7,9)-(7,10),
  // matching the exact geometry that reproduced the bug.
  for (let ty = 6; ty <= 10; ty++) tiles[ty][7] = 1;
  for (let ty = 6; ty <= 10; ty++) tiles[ty][8] = 1;
  const grid = { width, height, tiles };
  const boat = createBoat(125.2, 117.9, Math.atan2(1, 1));
  const radius = 11;

  for (let i = 0; i < 200; i++) {
    stepBoat(boat, { x: 1, y: 1 }, 1 / 60);
    resolveTileCollision(boat, radius, grid, tileSize);
    assert.ok(Math.abs(boat.x) < 1000 && Math.abs(boat.y) < 1000, `boat escaped at frame ${i}: x=${boat.x}, y=${boat.y}`);
  }
});

test('resolveTileCollision stops the boat from passing through a solid tile', () => {
  const tileSize = 16;
  const wallTx = 5;
  const grid = makeOpenGridWithWallAt(wallTx);
  const boat = createBoat((wallTx - 2) * tileSize, 5 * tileSize, 0);
  const radius = 11;
  for (let i = 0; i < 120; i++) {
    stepBoat(boat, { x: 1, y: 0 }, 1 / 60);
    resolveTileCollision(boat, radius, grid, tileSize);
  }
  const wallLeftEdge = wallTx * tileSize;
  assert.ok(boat.x < wallLeftEdge, 'boat should be stopped before the wall, never inside it');
  assert.ok(boat.x > wallLeftEdge - radius - 2, 'boat should be resting right against the wall, not far short of it');
});

test('a fresh boat starts at full hull', () => {
  const boat = createBoat(0, 0, 0);
  assert.equal(boat.health, MAX_HULL);
});

test('resolveTileCollision reports 0 impact speed when nothing is hit', () => {
  const grid = makeOpenGridWithWallAt(50); // far away
  const boat = createBoat(0, 0, 0);
  const impact = resolveTileCollision(boat, 11, grid, 16);
  assert.equal(impact, 0);
});

// Drives the boat toward a wall a few tiles away, resolving collision
// every frame from the start (no tunneling), and returns the first
// nonzero impact speed reported.
function driveIntoWall(boat, grid, tileSize, input, maxFrames = 90) {
  for (let i = 0; i < maxFrames; i++) {
    stepBoat(boat, input, 1 / 60);
    const impact = resolveTileCollision(boat, 11, grid, tileSize);
    if (impact > 0) return impact;
  }
  return 0;
}

test('driving straight into a wall at speed reports a real impact speed', () => {
  const tileSize = 16;
  const wallTx = 5;
  const grid = makeOpenGridWithWallAt(wallTx);
  const boat = createBoat((wallTx - 3) * tileSize, 5 * tileSize, 0);
  const impact = driveIntoWall(boat, grid, tileSize, { x: 1, y: 0 });
  assert.ok(impact > 40, `expected a real impact speed on a head-on hit, got ${impact}`);
});

test('sliding along a wall you are already touching does not keep reporting impact speed', () => {
  const tileSize = 16;
  const wallTx = 5;
  const grid = makeOpenGridWithWallAt(wallTx);
  const boat = createBoat((wallTx - 3) * tileSize, 5 * tileSize, 0);
  const firstImpact = driveIntoWall(boat, grid, tileSize, { x: 1, y: 0 });
  assert.ok(firstImpact > 0, 'the initial hit should register an impact');
  // Now slide along the wall (steer down, staying pressed against it). A
  // small graze from re-turning into the wall is fine — the property that
  // matters is that it stays under the damage threshold, i.e. sliding
  // never costs hull the way the initial hit did.
  for (let i = 0; i < 20; i++) {
    stepBoat(boat, { x: 0.3, y: 1 }, 1 / 60);
    const impact = resolveTileCollision(boat, 11, grid, tileSize);
    assert.ok(impact < WALL_IMPACT_DAMAGE_THRESHOLD, `sliding should stay under the damage threshold at frame ${i}, got ${impact}`);
  }
});

test('applyWallImpactDamage ignores grazes under the threshold and damages hard hits', () => {
  const boat = createBoat(0, 0, 0);
  const grazeDamage = applyWallImpactDamage(boat, WALL_IMPACT_DAMAGE_THRESHOLD - 1);
  assert.equal(grazeDamage, 0);
  assert.equal(boat.health, MAX_HULL);

  const hitDamage = applyWallImpactDamage(boat, WALL_IMPACT_DAMAGE_THRESHOLD + 50);
  assert.ok(hitDamage > 0);
  assert.equal(boat.health, MAX_HULL - hitDamage);
  assert.ok(hitDamage < 20, `damage from one hit should be "miniscule", got ${hitDamage}`);
});

test('applyWallImpactDamage never takes hull below 0', () => {
  const boat = createBoat(0, 0, 0);
  boat.health = 2;
  applyWallImpactDamage(boat, 1000);
  assert.equal(boat.health, 0);
});

// Keel (2026-09-28): "too much drift when turning — halve it".
function turnOvershoot(tuning) {
  const b = createBoat(0, 0, 0);
  for (let i = 0; i < 180; i++) stepBoat(b, { x: 1, y: 0 }, 1 / 60, tuning);
  const x0 = b.x;
  for (let i = 0; i < 120; i++) stepBoat(b, { x: 0, y: 1 }, 1 / 60, tuning);
  return b.x - x0;
}
test('the keel at least halves the sideways slide after a hard 90° turn', () => {
  const without = turnOvershoot({ ...DEFAULT_BOAT_TUNING, lateralGrip: 0 });
  const withKeel = turnOvershoot(DEFAULT_BOAT_TUNING);
  assert.ok(withKeel <= without * 0.52, `slide ${withKeel.toFixed(1)}px vs ${without.toFixed(1)}px without keel`);
});
test('the keel does not change straight-line top speed or coasting', () => {
  const run = (tuning) => {
    const b = createBoat(0, 0, 0);
    for (let i = 0; i < 180; i++) stepBoat(b, { x: 1, y: 0 }, 1 / 60, tuning);
    const top = b.vx; const x0 = b.x;
    for (let i = 0; i < 300; i++) stepBoat(b, { x: 0, y: 0 }, 1 / 60, tuning);
    return [top, b.x - x0];
  };
  const [a1, c1] = run({ ...DEFAULT_BOAT_TUNING, lateralGrip: 0 });
  const [a2, c2] = run(DEFAULT_BOAT_TUNING);
  assert.ok(Math.abs(a1 - a2) < 1e-9 && Math.abs(c1 - c2) < 1e-9);
});

// --- Smooth-coast collision (2026-09-28 art pass) ---------------------------
import { resolveCoastCollision } from '../src/engine/boat.mjs';
import { buildCoastField, sampleField } from '../src/engine/terrain.mjs';
import { createRun, checkReachedExit, TILE_SIZE, BOAT_RADIUS } from '../src/engine/run.mjs';

function wallGrid() {
  // Open water on the left, solid rock from column 10 onward.
  const tiles = Array.from({ length: 20 }, () => Array.from({ length: 20 }, (_, x) => (x >= 10 ? 1 : 0)));
  for (const row of [tiles[0], tiles[19]]) row.fill(1);
  for (const row of tiles) row[0] = 1;
  return { width: 20, height: 20, tiles };
}

test('coast collision: a boat driven into the shore stops at the drawn coastline and reports the impact', () => {
  const coast = buildCoastField(wallGrid(), 16, 1);
  const boat = createBoat(100, 160, 0);
  boat.vx = 110; boat.vy = 0;
  let impact = 0;
  for (let i = 0; i < 60; i++) {
    boat.x += boat.vx / 60; boat.y += boat.vy / 60;
    impact = Math.max(impact, resolveCoastCollision(boat, 11, coast));
  }
  assert.ok(impact > 60, `a head-on hit should report a real impact speed (got ${impact})`);
  const edge = sampleField(coast, boat.x, boat.y) + 11;
  assert.ok(Math.abs(edge) < 1.5, `hull edge should rest on the coastline, off by ${edge.toFixed(2)}px`);
});

test('coast collision: steering along the shore while pressed into it costs no further impact', () => {
  const coast = buildCoastField(wallGrid(), 16, 1);
  const boat = createBoat(120, 40, 0);
  // Drive into the wall, then hold the stick mostly along it (and a bit
  // into it) — a player hugging the shoreline.
  for (let i = 0; i < 60; i++) { stepBoat(boat, { x: 1, y: 0 }, 1 / 60); resolveCoastCollision(boat, 11, coast); }
  let worst = 0;
  for (let i = 0; i < 90; i++) {
    stepBoat(boat, { x: 0.35, y: 0.94 }, 1 / 60);
    const hit = resolveCoastCollision(boat, 11, coast);
    if (i > 20) worst = Math.max(worst, hit);
  }
  assert.ok(boat.y > 120, 'the boat should have slid a real distance along the shore');
  assert.ok(worst < WALL_IMPACT_DAMAGE_THRESHOLD, `hugging the shore should stay a graze, got ${worst.toFixed(1)}`);
});

test('coast collision: the drawn coast never blocks a maze passage — every passage centreline has boat clearance', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const run = createRun(seed);
    for (let reef = 0; reef < 3; reef++) {
      const { maze, grid, coast } = run;
      const u = grid.unit; const w = grid.wall; const half = grid.room / 2; const T = TILE_SIZE;
      for (let r = 0; r < maze.rows; r++) for (let c = 0; c < maze.cols; c++) {
        const cell = maze.cells[r][c];
        const cx = (c * u + w + half) * T; const cy = (r * u + w + half) * T;
        for (const [dir, dx, dy] of [['E', 1, 0], ['S', 0, 1]]) {
          if (!cell[dir]) continue;
          for (let t = 0; t <= 1.0001; t += 0.05) {
            const s = sampleField(coast, cx + dx * u * T * t, cy + dy * u * T * t);
            assert.ok(s <= -(BOAT_RADIUS + 1), `seed ${seed} reef ${reef}: passage pinched to ${s.toFixed(1)}px`);
          }
        }
      }
      if (reef < 2) { run.boat.x = run.exitWorld.x; run.boat.y = run.exitWorld.y; checkReachedExit(run); }
    }
  }
});

test('coast collision: the spawn and exit sit in open water with room for the hull', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const run = createRun(seed);
    assert.ok(sampleField(run.coast, run.boat.x, run.boat.y) < -BOAT_RADIUS);
    assert.ok(sampleField(run.coast, run.exitWorld.x, run.exitWorld.y) < -BOAT_RADIUS);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBoat, stepBoat, resolveTileCollision, DEFAULT_BOAT_TUNING } from '../src/engine/boat.mjs';

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

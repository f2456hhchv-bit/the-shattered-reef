import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, checkReachedExit } from '../src/engine/run.mjs';
import { isFullyConnected } from '../src/engine/maze.mjs';

test('createRun is deterministic for a given seed', () => {
  const a = createRun(123);
  const b = createRun(123);
  assert.deepEqual(a.grid.tiles, b.grid.tiles);
  assert.deepEqual(a.boat, b.boat);
  assert.deepEqual(a.exitWorld, b.exitWorld);
});

test('the boat spawns in open water, not inside rock', () => {
  const run = createRun(55);
  const tx = Math.floor(run.boat.x / run.tileSize);
  const ty = Math.floor(run.boat.y / run.tileSize);
  assert.equal(run.grid.tiles[ty][tx], 0);
});

test('the exit is reachable from the spawn across the whole tile grid', () => {
  const run = createRun(77);
  const tx = Math.floor(run.boat.x / run.tileSize);
  const ty = Math.floor(run.boat.y / run.tileSize);
  assert.ok(isFullyConnected(run.grid, { tx, ty }));
});

test('checkReachedExit only fires once the boat is close enough, and only once', () => {
  const run = createRun(9);
  assert.equal(checkReachedExit(run), false);
  run.boat.x = run.exitWorld.x;
  run.boat.y = run.exitWorld.y;
  assert.equal(checkReachedExit(run), true);
  assert.equal(run.complete, true);
  // Calling again after completion should not re-trigger.
  assert.equal(checkReachedExit(run), false);
});

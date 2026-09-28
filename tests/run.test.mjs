import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, checkReachedExit, checkSunk } from '../src/engine/run.mjs';
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
  assert.equal(run.over, true);
  assert.equal(run.outcome, 'exit');
  // Calling again after completion should not re-trigger.
  assert.equal(checkReachedExit(run), false);
});

test('checkSunk ends the run once hull reaches 0, and only once', () => {
  const run = createRun(21);
  assert.equal(checkSunk(run), false);
  run.boat.health = 0;
  assert.equal(checkSunk(run), true);
  assert.equal(run.over, true);
  assert.equal(run.outcome, 'sunk');
  assert.equal(checkSunk(run), false);
});

test('reaching the exit and sinking are mutually exclusive — whichever fires first wins', () => {
  const run = createRun(22);
  run.boat.x = run.exitWorld.x;
  run.boat.y = run.exitWorld.y;
  checkReachedExit(run);
  run.boat.health = 0;
  assert.equal(checkSunk(run), false, 'a run already over from reaching the exit should not also become "sunk"');
  assert.equal(run.outcome, 'exit');
});

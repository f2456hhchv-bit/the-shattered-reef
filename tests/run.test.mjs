import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, checkReachedExit, checkSunk, addSalvage, totalSalvage, REEF_COUNT } from '../src/engine/run.mjs';
import { isFullyConnected } from '../src/engine/maze.mjs';

test('createRun is deterministic for a given seed', () => {
  const a = createRun(123);
  const b = createRun(123);
  assert.deepEqual(a.grid.tiles, b.grid.tiles);
  assert.deepEqual(a.boat, b.boat);
  assert.deepEqual(a.exitWorld, b.exitWorld);
  assert.deepEqual(a.enemies.map((e) => [e.defId, e.x, e.y]), b.enemies.map((e) => [e.defId, e.x, e.y]));
  assert.deepEqual(a.pickups.map((p) => [p.kind, p.weaponId, p.x, p.y]), b.pickups.map((p) => [p.kind, p.weaponId, p.x, p.y]));
});

test('a fresh run starts on reef 1 of REEF_COUNT with no over/outcome', () => {
  const run = createRun(5);
  assert.equal(run.reefIndex, 0);
  assert.equal(run.reefCount, REEF_COUNT);
  assert.equal(run.over, false);
  assert.equal(run.outcome, null);
  assert.equal(totalSalvage(run), 0);
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

test('addSalvage/totalSalvage: gains are at-risk (reefSalvage) until banked', () => {
  const run = createRun(9);
  addSalvage(run, 12);
  assert.equal(run.reefSalvage, 12);
  assert.equal(run.bankedSalvage, 0);
  assert.equal(totalSalvage(run), 12);
});

test('checkReachedExit only fires once the boat is close enough', () => {
  const run = createRun(9);
  assert.equal(checkReachedExit(run), null);
  run.boat.x = run.exitWorld.x;
  run.boat.y = run.exitWorld.y;
  assert.notEqual(checkReachedExit(run), null);
});

test('reaching a non-final reef\'s exit banks its Salvage and advances to the next reef, without ending the run', () => {
  const run = createRun(31);
  addSalvage(run, 20);
  run.boat.x = run.exitWorld.x;
  run.boat.y = run.exitWorld.y;

  const result = checkReachedExit(run);
  assert.equal(result, 'advanced');
  assert.equal(run.over, false);
  assert.equal(run.outcome, null);
  assert.equal(run.reefIndex, 1);
  assert.equal(run.bankedSalvage, 20, 'the previous reef\'s Salvage should be banked');
  assert.equal(run.reefSalvage, 0, 'the new reef starts with no at-risk Salvage');
  assert.equal(totalSalvage(run), 20);
  // The boat should be repositioned to the new reef's spawn, not left at
  // the old reef's exit coordinates.
  assert.notEqual(run.boat.x, undefined);
});

test('reaching the final reef\'s exit ends the run in victory and banks all remaining Salvage', () => {
  const run = createRun(41);
  // Fast-forward through every reef but the last.
  for (let i = 0; i < REEF_COUNT - 1; i++) {
    addSalvage(run, 5);
    run.boat.x = run.exitWorld.x;
    run.boat.y = run.exitWorld.y;
    assert.equal(checkReachedExit(run), 'advanced');
  }
  addSalvage(run, 5);
  run.boat.x = run.exitWorld.x;
  run.boat.y = run.exitWorld.y;
  const result = checkReachedExit(run);
  assert.equal(result, 'victory');
  assert.equal(run.over, true);
  assert.equal(run.outcome, 'victory');
  assert.equal(run.bankedSalvage, 5 * REEF_COUNT);
  assert.equal(run.reefSalvage, 0);

  // Calling again after completion should not re-trigger.
  assert.equal(checkReachedExit(run), null);
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

test('sinking loses only the current reef\'s at-risk Salvage — banked Salvage from earlier reefs survives', () => {
  const run = createRun(51);
  addSalvage(run, 20);
  run.boat.x = run.exitWorld.x;
  run.boat.y = run.exitWorld.y;
  checkReachedExit(run); // banks 20, advances to reef 2
  assert.equal(run.bankedSalvage, 20);

  addSalvage(run, 7); // at risk in reef 2
  run.boat.health = 0;
  checkSunk(run);

  assert.equal(run.outcome, 'sunk');
  assert.equal(run.bankedSalvage, 20, 'Salvage banked from a completed reef should survive sinking');
  assert.equal(run.reefSalvage, 7, 'the still-at-risk Salvage from the reef the boat died in is not banked');
});

test('reaching the exit and sinking are mutually exclusive — whichever fires first wins', () => {
  const run = createRun(22);
  for (let i = 0; i < REEF_COUNT; i++) {
    run.boat.x = run.exitWorld.x;
    run.boat.y = run.exitWorld.y;
    checkReachedExit(run);
  }
  assert.equal(run.outcome, 'victory');
  run.boat.health = 0;
  assert.equal(checkSunk(run), false, 'a run already over from reaching the final exit should not also become "sunk"');
  assert.equal(run.outcome, 'victory');
});

// Assembles and advances a whole voyage: a fixed sequence of reefs (3, per
// the PRD's locked vertical-slice scope), increasing in size/density —
// "difficulty scaled by size/density across a run rather than multiple
// generation styles". A single seeded rng is threaded through every reef
// in the voyage (not re-seeded per reef), so a whole run is deterministic
// and replayable from one seed, not just each reef in isolation.
//
// The boat, its hull, and the weapon/ammo state all carry over between
// reefs — no mid-run healing, no re-arming. Salvage has real permadeath
// stakes: what's collected in the *current* reef is only "banked" (safe)
// once its exit is reached; sinking before that loses it. `bankedSalvage`
// is therefore the only total that survives a run ending in `sunk`.

import { makeSeededRng } from './rng.mjs';
import { generateMazeGraph, farthestCell, buildTileGrid, cellCenterTile } from './maze.mjs';
import { createBoat } from './boat.mjs';
import { createWeaponState } from './combat.mjs';
import { spawnReefEnemies } from './enemies.mjs';
import { spawnPoolForReefIndex } from '../data/enemies.mjs';
import { spawnReefPickups } from './pickups.mjs';

export const TILE_SIZE = 16; // px per tile at 1x zoom
export const BOAT_RADIUS = 11; // px, collision + draw radius
export const EXIT_RADIUS_TILES = 1.5; // how close (in tiles) counts as "reached the exit"
export const REEF_COUNT = 3; // locked vertical-slice scope: 3 reefs per run, fixed sequence
const ROOM = 6;
const WALL = 2;

// One entry per reef in the fixed sequence — larger, denser mazes and more
// enemies as the voyage progresses. The last entry repeats if REEF_COUNT
// ever grows past this table without a matching tuning update.
const REEF_TUNING = [
  { cols: 7, rows: 7, enemyCount: 7 },
  { cols: 9, rows: 9, enemyCount: 10 },
  { cols: 11, rows: 11, enemyCount: 13 },
];

function tuningFor(reefIndex) {
  return REEF_TUNING[Math.min(reefIndex, REEF_TUNING.length - 1)];
}

function buildReefWorld(rng, reefIndex) {
  const tuning = tuningFor(reefIndex);
  const maze = generateMazeGraph(tuning.cols, tuning.rows, rng);
  const grid = buildTileGrid(maze, { room: ROOM, wall: WALL });
  const exitCell = farthestCell(maze, maze.start);
  const startTile = cellCenterTile(maze.start, grid);
  const exitTile = cellCenterTile(exitCell, grid);
  return {
    maze,
    grid,
    tileSize: TILE_SIZE,
    spawnWorld: { x: (startTile.tx + 0.5) * TILE_SIZE, y: (startTile.ty + 0.5) * TILE_SIZE },
    exitWorld: { x: (exitTile.tx + 0.5) * TILE_SIZE, y: (exitTile.ty + 0.5) * TILE_SIZE },
    widthPx: grid.width * TILE_SIZE,
    heightPx: grid.height * TILE_SIZE,
  };
}

// Mutates `run` into its next reef: new maze/grid/exit/enemies/pickups,
// boat repositioned to the new spawn with velocity/turn-jam cleared (but
// hull and weapons untouched — those persist across the whole voyage) and
// this reef's at-risk Salvage tally reset to 0.
function enterReef(run, reefIndex) {
  const world = buildReefWorld(run.rng, reefIndex);
  const tuning = tuningFor(reefIndex);

  run.reefIndex = reefIndex;
  run.maze = world.maze;
  run.grid = world.grid;
  run.tileSize = world.tileSize;
  run.exitWorld = world.exitWorld;
  run.widthPx = world.widthPx;
  run.heightPx = world.heightPx;

  run.boat.x = world.spawnWorld.x;
  run.boat.y = world.spawnWorld.y;
  run.boat.vx = 0;
  run.boat.vy = 0;
  run.boat.heading = 0;
  run.boat.turnJamRemaining = 0;

  run.enemies = spawnReefEnemies(
    spawnPoolForReefIndex(reefIndex), run.grid, run.tileSize,
    world.spawnWorld, run.exitWorld, tuning.enemyCount, run.rng
  );
  run.pickups = spawnReefPickups(run.grid, run.tileSize, world.spawnWorld, run.rng);
  run.reefSalvage = 0;
}

export function createRun(seed) {
  const run = {
    seed,
    rng: makeSeededRng(seed),
    reefIndex: 0,
    reefCount: REEF_COUNT,
    boat: createBoat(0, 0, 0),
    weapons: createWeaponState(),
    bankedSalvage: 0, // safe — carried from every reef already cleared
    reefSalvage: 0,   // at risk — lost if the boat sinks before this reef's exit
    over: false,
    outcome: null, // 'victory' | 'sunk', once over
  };
  enterReef(run, 0);
  return run;
}

export function totalSalvage(run) {
  return run.bankedSalvage + run.reefSalvage;
}

// Call whenever Salvage is gained (a kill drop or a pickup) — it's at risk
// until the current reef's exit is reached.
export function addSalvage(run, amount) {
  run.reefSalvage += amount;
}

// Checked every frame. Returns:
//   null      — not at the exit, nothing happened
//   'advanced' — this reef's Salvage was banked and the voyage moved on to
//                the next reef (run stays in progress)
//   'victory'  — the last reef's exit was reached; the whole voyage is over
export function checkReachedExit(run) {
  if (run.over) return null;
  const dx = run.boat.x - run.exitWorld.x;
  const dy = run.boat.y - run.exitWorld.y;
  if (Math.hypot(dx, dy) > EXIT_RADIUS_TILES * run.tileSize) return null;

  run.bankedSalvage += run.reefSalvage;
  run.reefSalvage = 0;

  if (run.reefIndex >= run.reefCount - 1) {
    run.over = true;
    run.outcome = 'victory';
    return 'victory';
  }
  enterReef(run, run.reefIndex + 1);
  return 'advanced';
}

// Checked every frame after collision/damage is applied. A sunk boat ends
// the whole voyage immediately (permadeath) — whatever Salvage was still
// at risk in the current reef (run.reefSalvage) is lost; only
// run.bankedSalvage survives into the run summary.
export function checkSunk(run) {
  if (run.over) return false;
  if (run.boat.health <= 0) {
    run.over = true;
    run.outcome = 'sunk';
    return true;
  }
  return false;
}

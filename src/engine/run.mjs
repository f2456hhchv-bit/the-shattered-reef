// Assembles one run's level from a seed: generate the maze, build its tile
// grid, place the boat at the start room and the exit at the farthest
// room. Pure and deterministic — the same seed always produces the same
// level, boat spawn and exit position, so runs are testable and replayable.

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
export const ENEMY_COUNT = 9; // step 3 scope: one reef's worth on a single test arena — reef-to-reef scaling is step 6 (Roguelike run structure)

export function createRun(seed, { cols = 9, rows = 9, room = 6, wall = 2, reefIndex = 0 } = {}) {
  const rng = makeSeededRng(seed);
  const maze = generateMazeGraph(cols, rows, rng);
  const grid = buildTileGrid(maze, { room, wall });
  const exitCell = farthestCell(maze, maze.start);

  const startTile = cellCenterTile(maze.start, grid);
  const exitTile = cellCenterTile(exitCell, grid);

  const boat = createBoat(
    (startTile.tx + 0.5) * TILE_SIZE,
    (startTile.ty + 0.5) * TILE_SIZE,
    0
  );
  const exitWorld = {
    x: (exitTile.tx + 0.5) * TILE_SIZE,
    y: (exitTile.ty + 0.5) * TILE_SIZE,
  };

  const enemies = spawnReefEnemies(
    spawnPoolForReefIndex(reefIndex), grid, TILE_SIZE, boat, exitWorld, ENEMY_COUNT, rng
  );
  const pickups = spawnReefPickups(grid, TILE_SIZE, boat, rng);

  return {
    seed,
    maze,
    grid,
    tileSize: TILE_SIZE,
    boat,
    exitWorld,
    widthPx: grid.width * TILE_SIZE,
    heightPx: grid.height * TILE_SIZE,
    enemies,
    pickups,
    weapons: createWeaponState(),
    salvage: 0, // step 3 placeholder tally — real per-reef banking is step 6 (Run Structure)
    over: false,
    outcome: null, // 'exit' | 'sunk', once over
  };
}

export function checkReachedExit(run) {
  if (run.over) return false;
  const dx = run.boat.x - run.exitWorld.x;
  const dy = run.boat.y - run.exitWorld.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= EXIT_RADIUS_TILES * run.tileSize) {
    run.over = true;
    run.outcome = 'exit';
    return true;
  }
  return false;
}

// Checked every frame after collision/damage is applied. A sunk boat ends
// the run immediately — no "keep floating at 0 hull" state.
export function checkSunk(run) {
  if (run.over) return false;
  if (run.boat.health <= 0) {
    run.over = true;
    run.outcome = 'sunk';
    return true;
  }
  return false;
}

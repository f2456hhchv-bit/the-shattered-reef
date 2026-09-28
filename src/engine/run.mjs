// Assembles one run's level from a seed: generate the maze, build its tile
// grid, place the boat at the start room and the exit at the farthest
// room. Pure and deterministic — the same seed always produces the same
// level, boat spawn and exit position, so runs are testable and replayable.

import { makeSeededRng } from './rng.mjs';
import { generateMazeGraph, farthestCell, buildTileGrid, cellCenterTile } from './maze.mjs';
import { createBoat } from './boat.mjs';

export const TILE_SIZE = 16; // px per tile at 1x zoom
export const BOAT_RADIUS = 11; // px, collision + draw radius
export const EXIT_RADIUS_TILES = 1.5; // how close (in tiles) counts as "reached the exit"

export function createRun(seed, { cols = 9, rows = 9, room = 6, wall = 2 } = {}) {
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

  return {
    seed,
    maze,
    grid,
    tileSize: TILE_SIZE,
    boat,
    exitWorld,
    widthPx: grid.width * TILE_SIZE,
    heightPx: grid.height * TILE_SIZE,
    complete: false,
  };
}

export function checkReachedExit(run) {
  if (run.complete) return false;
  const dx = run.boat.x - run.exitWorld.x;
  const dy = run.boat.y - run.exitWorld.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= EXIT_RADIUS_TILES * run.tileSize) {
    run.complete = true;
    return true;
  }
  return false;
}

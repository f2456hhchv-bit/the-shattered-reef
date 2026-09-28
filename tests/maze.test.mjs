import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMazeGraph, farthestCell, buildTileGrid, cellCenterTile, isFullyConnected,
} from '../src/engine/maze.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

test('generateMazeGraph produces a fully connected graph (every cell reachable from start)', () => {
  const rng = makeSeededRng(1);
  const maze = generateMazeGraph(9, 9, rng);
  const seen = new Set();
  const stack = [maze.start];
  seen.add(`${maze.start.r},${maze.start.c}`);
  while (stack.length) {
    const cur = stack.pop();
    const cell = maze.cells[cur.r][cur.c];
    for (const [dir, dr, dc] of [['N', -1, 0], ['S', 1, 0], ['E', 0, 1], ['W', 0, -1]]) {
      if (!cell[dir]) continue;
      const key = `${cur.r + dr},${cur.c + dc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push({ r: cur.r + dr, c: cur.c + dc });
    }
  }
  assert.equal(seen.size, 9 * 9);
});

test('generateMazeGraph is deterministic for a given seed', () => {
  const a = generateMazeGraph(6, 6, makeSeededRng(42));
  const b = generateMazeGraph(6, 6, makeSeededRng(42));
  assert.deepEqual(a.cells, b.cells);
});

test('two different seeds produce different mazes', () => {
  const a = generateMazeGraph(8, 8, makeSeededRng(1));
  const b = generateMazeGraph(8, 8, makeSeededRng(2));
  assert.notDeepEqual(a.cells, b.cells);
});

test('farthestCell finds a cell strictly farther than an adjacent one', () => {
  const maze = generateMazeGraph(9, 9, makeSeededRng(7));
  const far = farthestCell(maze, maze.start);
  assert.ok(far.distance > 0);
  // The farthest cell should not be the start itself for a 9x9 maze.
  assert.ok(far.r !== maze.start.r || far.c !== maze.start.c);
});

test('buildTileGrid produces a fully connected tile grid matching the graph maze', () => {
  const maze = generateMazeGraph(7, 7, makeSeededRng(3));
  const grid = buildTileGrid(maze, { room: 6, wall: 2 });
  const startTile = cellCenterTile(maze.start, grid);
  assert.equal(grid.tiles[startTile.ty][startTile.tx], 0, 'start cell center should be open water');
  assert.ok(isFullyConnected(grid, startTile), 'every open tile should be reachable from the start');
});

test('buildTileGrid dimensions match cols/rows and room/wall sizing', () => {
  const maze = generateMazeGraph(4, 5, makeSeededRng(9));
  const grid = buildTileGrid(maze, { room: 6, wall: 2 });
  assert.equal(grid.width, 4 * (6 + 2) + 2);
  assert.equal(grid.height, 5 * (6 + 2) + 2);
});

test('the exit cell is open water and reachable from the start', () => {
  const maze = generateMazeGraph(8, 8, makeSeededRng(11));
  const grid = buildTileGrid(maze, { room: 6, wall: 2 });
  const exitCell = farthestCell(maze, maze.start);
  const exitTile = cellCenterTile(exitCell, grid);
  assert.equal(grid.tiles[exitTile.ty][exitTile.tx], 0);
});

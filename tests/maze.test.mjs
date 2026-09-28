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

// --- Organic reef layout (2026-09-28 art pass) ------------------------------
import { buildOrganicReefGrid } from '../src/engine/maze.mjs';
import { makeSeededRng as seeded } from '../src/engine/rng.mjs';

function organic(seed, cols = 9, rows = 9) {
  const rng = seeded(seed);
  const maze = generateMazeGraph(cols, rows, rng);
  return { maze, grid: buildOrganicReefGrid(maze, rng, { room: 7, wall: 3 }), base: buildTileGrid(maze, { room: 7, wall: 3 }) };
}
const startOf = (maze, grid) => { const t = cellCenterTile(maze.start, grid); return { tx: Math.floor(t.tx), ty: Math.floor(t.ty) }; };

test('organic reef: every open tile is reachable from the start, across many seeds', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { maze, grid } = organic(seed);
    assert.ok(isFullyConnected(grid, startOf(maze, grid)), `seed ${seed}`);
  }
});

test('organic reef: only ever adds rock — no wall between unconnected cells is eroded (no shortcuts)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { grid, base } = organic(seed);
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
      if (base.tiles[y][x] === 1) assert.equal(grid.tiles[y][x], 1, `seed ${seed} eroded rock at ${x},${y}`);
    }
  }
});

test('organic reef: every graph passage keeps a boat-wide open channel between cell centres', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { maze, grid } = organic(seed);
    const u = grid.unit; const w = grid.wall; const half = grid.room / 2;
    for (let r = 0; r < maze.rows; r++) for (let c = 0; c < maze.cols; c++) {
      const cell = maze.cells[r][c];
      const cx = c * u + w + half; const cy = r * u + w + half;
      const check = (x0, y0, x1, y1) => {
        for (let t = 0; t <= 1; t += 0.05) {
          const px = x0 + (x1 - x0) * t; const py = y0 + (y1 - y0) * t;
          // 3 tiles wide: centre line and one tile either side.
          for (const off of [-1, 0, 1]) {
            const tx = Math.floor(y0 === y1 ? px : px + off); const ty = Math.floor(y0 === y1 ? py + off : py);
            assert.equal(grid.tiles[ty][tx], 0, `seed ${seed} blocked passage at ${tx},${ty}`);
          }
        }
      };
      if (cell.E) check(cx, cy, cx + u, cy);
      if (cell.S) check(cx, cy, cx, cy + u);
    }
  }
});

test('organic reef: actually reshapes the rooms, keeping open water close to the old 6/2 layout', () => {
  const water = (g) => g.tiles.flat().filter((t) => t === 0).length;
  for (let seed = 1; seed <= 10; seed++) {
    const rng = seeded(seed);
    const maze = generateMazeGraph(9, 9, rng);
    const grid = buildOrganicReefGrid(maze, rng, { room: 7, wall: 3 });
    const old = water(buildTileGrid(maze, { room: 6, wall: 2 }));
    const ratio = water(grid) / old;
    assert.ok(ratio > 0.8 && ratio < 1.15, `seed ${seed}: water ${ratio.toFixed(2)}x the old layout`);
    assert.ok(water(grid) < water(buildTileGrid(maze, { room: 7, wall: 3 })) * 0.85, 'should grow real rock into the rooms');
  }
});

test('organic reef: deterministic for a seed', () => {
  assert.deepEqual(organic(7).grid.tiles, organic(7).grid.tiles);
});

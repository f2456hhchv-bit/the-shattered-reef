// Treasure (2026-09-29, project owner: "more meaning for exploring each
// maze rather than just heading to the exit"). Chests sit at the ends of
// dead-end passages, off the route to the exit, and each holds a choice of
// armaments (data/armaments.mjs). One chest per level is guarded by an
// elite. Pure logic: where things go.

import { farthestCell, cellCenterTile } from './maze.mjs';

function openSides(cell) {
  return (cell.N ? 1 : 0) + (cell.S ? 1 : 0) + (cell.E ? 1 : 0) + (cell.W ? 1 : 0);
}

// Cells on the one path from start to exit (a perfect maze has exactly one).
function pathCells(maze, from, to) {
  const key = (c) => `${c.r},${c.c}`;
  const prev = new Map([[key(from), null]]);
  const queue = [from];
  const step = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1] };
  while (queue.length) {
    const cur = queue.shift();
    if (cur.r === to.r && cur.c === to.c) break;
    const cell = maze.cells[cur.r][cur.c];
    for (const [d, [dr, dc]] of Object.entries(step)) {
      if (!cell[d]) continue;
      const n = { r: cur.r + dr, c: cur.c + dc };
      if (prev.has(key(n))) continue;
      prev.set(key(n), cur); queue.push(n);
    }
  }
  const out = new Set();
  let c = to;
  while (c) { out.add(key(c)); c = prev.get(key(c)); }
  return out;
}

// Dead ends off the start→exit route, the most out-of-the-way first
// (farthest from the route by BFS distance from start, as a proxy).
export function treasureSpots(maze, grid, tileSize, count, rng = Math.random) {
  const exit = maze.exitCell || farthestCell(maze, maze.start);
  const onPath = pathCells(maze, maze.start, exit);
  const spots = [];
  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      if (onPath.has(`${r},${c}`)) continue;
      const t = cellCenterTile({ r, c }, grid);
      // Dead ends first; any other side passage if a maze has too few.
      spots.push({ x: t.tx * tileSize, y: t.ty * tileSize, r, c, deadEnd: openSides(maze.cells[r][c]) === 1, roll: rng() });
    }
  }
  spots.sort((a, b) => (b.deadEnd - a.deadEnd) || (a.roll - b.roll));
  // A maze whose one route visits every cell has no side passages: then
  // the treasure sits on the route itself (never the start or exit room).
  if (spots.length < count) {
    const extra = [];
    for (let r = 0; r < maze.rows; r++) {
      for (let c = 0; c < maze.cols; c++) {
        if (!onPath.has(`${r},${c}`)) continue;
        if ((r === maze.start.r && c === maze.start.c) || (r === exit.r && c === exit.c)) continue;
        const t = cellCenterTile({ r, c }, grid);
        extra.push({ x: t.tx * tileSize, y: t.ty * tileSize, r, c, deadEnd: false, roll: rng() });
      }
    }
    extra.sort((a, b) => a.roll - b.roll);
    spots.push(...extra.slice(0, count - spots.length));
  }
  return spots.slice(0, count);
}

// Procedural maze generation for a run's reef level. Two layers, kept
// separate on purpose:
//
//   1. A graph maze (one cell per node, N/S/E/W passages) — a classic
//      recursive-backtracker carve. This is what "is the maze fully
//      connected/solvable" tests reason about; it's cheap to verify.
//   2. A tile grid built from that graph — open "room" blocks per cell
//      joined by corridor gaps where a passage exists, everything else
//      solid rock. This is what the renderer draws and the boat physics
//      collides against. Rooms are several tiles wide (not a 1-tile-wide
//      corridor maze) so a boat with momentum has room to actually turn.
//
// Both are pure functions of (cols, rows, rng) — no global state, fully
// replayable from a seed.

const DIRS = [
  { dir: 'N', dr: -1, dc: 0, opp: 'S' },
  { dir: 'S', dr: 1, dc: 0, opp: 'N' },
  { dir: 'E', dr: 0, dc: 1, opp: 'W' },
  { dir: 'W', dr: 0, dc: -1, opp: 'E' },
];

export function generateMazeGraph(cols, rows, rng) {
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ N: false, S: false, E: false, W: false, visited: false }))
  );
  const start = { r: 0, c: 0 };
  cells[start.r][start.c].visited = true;
  const stack = [start];

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = [];
    for (const d of DIRS) {
      const nr = cur.r + d.dr;
      const nc = cur.c + d.dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !cells[nr][nc].visited) {
        options.push({ ...d, nr, nc });
      }
    }
    if (!options.length) {
      stack.pop();
      continue;
    }
    const pick = options[Math.floor(rng() * options.length)];
    cells[cur.r][cur.c][pick.dir] = true;
    cells[pick.nr][pick.nc][pick.opp] = true;
    cells[pick.nr][pick.nc].visited = true;
    stack.push({ r: pick.nr, c: pick.nc });
  }

  return { cols, rows, cells, start };
}

// BFS from `from` to find the cell with the longest shortest-path distance
// — used to place the exit as far from the start as the maze allows, so a
// run always has real distance to cross rather than spawning next to its
// own exit.
export function farthestCell(maze, from) {
  const { cols, rows, cells } = maze;
  const dist = Array.from({ length: rows }, () => Array(cols).fill(-1));
  dist[from.r][from.c] = 0;
  const queue = [from];
  let far = from;
  while (queue.length) {
    const cur = queue.shift();
    for (const d of DIRS) {
      if (!cells[cur.r][cur.c][d.dir]) continue;
      const nr = cur.r + d.dr;
      const nc = cur.c + d.dc;
      if (dist[nr][nc] !== -1) continue;
      dist[nr][nc] = dist[cur.r][cur.c] + 1;
      if (dist[nr][nc] > dist[far.r][far.c]) far = { r: nr, c: nc };
      queue.push({ r: nr, c: nc });
    }
  }
  return { ...far, distance: dist[far.r][far.c] };
}

// Converts the graph maze into a solid tile grid. `room` is the open
// interior width/height of each cell in tiles; `wall` is the thickness of
// rock between adjacent cells (and the border). 0 = water, 1 = rock.
export function buildTileGrid(maze, { room = 6, wall = 2 } = {}) {
  const unit = room + wall;
  const width = maze.cols * unit + wall;
  const height = maze.rows * unit + wall;
  const tiles = Array.from({ length: height }, () => Array(width).fill(1));

  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      const cell = maze.cells[r][c];
      const x0 = c * unit + wall;
      const y0 = r * unit + wall;
      for (let y = 0; y < room; y++) {
        for (let x = 0; x < room; x++) tiles[y0 + y][x0 + x] = 0;
      }
      // Only open E/S doorways here — a cell's N/W passage is the same
      // edge as its neighbor's S/E, already opened when that neighbor
      // was visited (generateMazeGraph sets both sides of a passage).
      if (cell.E) {
        for (let y = 0; y < room; y++) {
          for (let x = 0; x < wall; x++) tiles[y0 + y][x0 + room + x] = 0;
        }
      }
      if (cell.S) {
        for (let x = 0; x < room; x++) {
          for (let y = 0; y < wall; y++) tiles[y0 + room + y][x0 + x] = 0;
        }
      }
    }
  }

  return { width, height, tiles, unit, room, wall };
}

// Center of a graph cell, in tile coordinates — used for spawn points,
// exit placement and enemy placement.
export function cellCenterTile(cell, grid) {
  const { r, c } = cell;
  const x0 = c * grid.unit + grid.wall;
  const y0 = r * grid.unit + grid.wall;
  return { tx: x0 + grid.room / 2, ty: y0 + grid.room / 2 };
}

// True if every open (water) tile is reachable from `from` — sanity check
// for the tile-grid conversion, distinct from the graph-level connectivity
// the generator already guarantees (this also catches a bad room/wall
// conversion bug, not just a bad carve).
export function isFullyConnected(grid, from) {
  const seen = Array.from({ length: grid.height }, () => Array(grid.width).fill(false));
  const queue = [from];
  seen[from.ty][from.tx] = true;
  let count = 0;
  let totalOpen = 0;
  for (const row of grid.tiles) for (const t of row) if (t === 0) totalOpen++;
  while (queue.length) {
    const { tx, ty } = queue.pop();
    count++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      if (seen[ny][nx] || grid.tiles[ny][nx] !== 0) continue;
      seen[ny][nx] = true;
      queue.push({ tx: nx, ty: ny });
    }
  }
  return count === totalOpen;
}

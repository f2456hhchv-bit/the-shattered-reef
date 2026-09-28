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

// --- Organic reef layout (2026-09-28 art pass) ------------------------------
// buildTileGrid's rooms are perfect squares joined by straight gaps: correct,
// but it reads as a dungeon, not a reef. This keeps the exact same graph and
// cell geometry (so spawns, exits, enemy placement and the balance bot's
// cell-to-cell pathing all still work) and grows rock *into* the rooms with
// noise, so coastlines wind, bays and headlands form, and passages narrow
// and widen.
//
// Guarantees, enforced rather than hoped for:
//   - It only ever ADDS rock. Walls between unconnected cells are never
//     eroded, so no shortcut can appear and the graph stays the truth.
//   - A protected core stays open water: a disc at every cell centre plus a
//     3-tile band along every passage. The boat (22px) always fits.
//   - Any water pocket cut off from the start is filled in, so every open
//     tile is reachable (isFullyConnected holds).

// Smooth 2D value noise on an integer lattice, deterministic from `seed`.
export function makeValueNoise(seed) {
  const hash = (x, y) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const fade = (t) => t * t * (3 - 2 * t);
  return function noise(x, y) {
    const x0 = Math.floor(x); const y0 = Math.floor(y);
    const fx = fade(x - x0); const fy = fade(y - y0);
    const a = hash(x0, y0); const b = hash(x0 + 1, y0);
    const c = hash(x0, y0 + 1); const d = hash(x0 + 1, y0 + 1);
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  };
}

export function fbm(noise, x, y, octaves = 3) {
  let sum = 0; let amp = 0.5; let freq = 1; let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, y * freq) * amp;
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

export const ORGANIC_DEFAULTS = Object.freeze({
  coreRadius: 2.0, // tiles — open disc at each cell centre (spawn/exit keep >= ~3px hull margin across 2,100 level seeds)
  passageHalfWidth: 1.5, // tiles — open band along each passage (3 tiles wide)
  noiseScale: 0.28, // lattice units per tile (≈3.5-tile blobs)
  growth: 0.45, // higher = more rock grows into rooms
  wallPull: 0.05, // per tile of distance from existing rock, how much less likely
  isletThreshold: 0.68,
  smoothPasses: 2,
});

export function buildOrganicReefGrid(maze, rng, { room = 7, wall = 3, ...opts } = {}) {
  const o = { ...ORGANIC_DEFAULTS, ...opts };
  const grid = buildTileGrid(maze, { room, wall });
  const { width, height, tiles, unit } = grid;
  const noise = makeValueNoise(Math.floor(rng() * 2 ** 31));

  // 1 = must stay water, 2 = must stay rock (everything already rock).
  const lock = Array.from({ length: height }, (_, y) => tiles[y].map((t) => (t === 1 ? 2 : 0)));
  const centre = (r, c) => ({ x: c * unit + wall + room / 2, y: r * unit + wall + room / 2 });
  const openDisc = (cx, cy, rad) => {
    for (let y = Math.floor(cy - rad - 1); y <= Math.ceil(cy + rad); y++) {
      for (let x = Math.floor(cx - rad - 1); x <= Math.ceil(cx + rad); x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= rad) lock[y][x] = 1;
      }
    }
  };
  const openBand = (a, b, half) => {
    const minX = Math.floor(Math.min(a.x, b.x) - half - 1); const maxX = Math.ceil(Math.max(a.x, b.x) + half);
    const minY = Math.floor(Math.min(a.y, b.y) - half - 1); const maxY = Math.ceil(Math.max(a.y, b.y) + half);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const px = x + 0.5; const py = y + 0.5;
        const vx = b.x - a.x; const vy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / (vx * vx + vy * vy)));
        const dx = px - (a.x + vx * t); const dy = py - (a.y + vy * t);
        if (Math.hypot(dx, dy) <= half) { lock[y][x] = 1; tiles[y][x] = 0; }
      }
    }
  };
  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      const cell = maze.cells[r][c];
      const p = centre(r, c);
      openDisc(p.x, p.y, o.coreRadius);
      if (cell.E) openBand(p, centre(r, c + 1), o.passageHalfWidth);
      if (cell.S) openBand(p, centre(r + 1, c), o.passageHalfWidth);
    }
  }

  // Distance (tiles, 4-neighbour BFS) from each water tile to existing rock.
  const dist = Array.from({ length: height }, () => Array(width).fill(Infinity));
  const q = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (tiles[y][x] === 1) { dist[y][x] = 0; q.push(x, y); }
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i]; const y = q[i + 1];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || dist[ny][nx] !== Infinity) continue;
      dist[ny][nx] = dist[y][x] + 1; q.push(nx, ny);
    }
  }

  // Grow rock where noise is high, favouring tiles near existing rock.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (lock[y][x] !== 0) continue;
      const n = fbm(noise, x * o.noiseScale, y * o.noiseScale);
      if (n - (dist[y][x] - 1) * o.wallPull > o.growth) tiles[y][x] = 1;
      // Islets: a second, finer noise seeds free-standing rocks out in open
      // water, so wide lagoons get islands instead of reading as empty rooms.
      else if (dist[y][x] >= 2 && fbm(noise, x * 0.5 + 97, y * 0.5 + 31, 2) > o.isletThreshold) tiles[y][x] = 1;
    }
  }

  // Cellular-automaton smoothing: removes 1-tile spikes and notches.
  for (let pass = 0; pass < o.smoothPasses; pass++) {
    const next = tiles.map((row) => row.slice());
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (lock[y][x] !== 0) continue;
        let rock = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx; const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || tiles[ny][nx] === 1) rock++;
        }
        if (rock >= 5) next[y][x] = 1; else if (rock <= 3) next[y][x] = 0;
      }
    }
    for (let y = 0; y < height; y++) tiles[y] = next[y];
  }

  // Fill any water pocket the growth cut off from the start.
  const s = centre(maze.start.r, maze.start.c);
  const seen = Array.from({ length: height }, () => Array(width).fill(false));
  const stack = [[Math.floor(s.x), Math.floor(s.y)]];
  seen[stack[0][1]][stack[0][0]] = true;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[ny][nx] || tiles[ny][nx] !== 0) continue;
      seen[ny][nx] = true; stack.push([nx, ny]);
    }
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (tiles[y][x] === 0 && !seen[y][x]) tiles[y][x] = 1;

  return grid;
}

// True if (tx, ty) is water AND so are all 8 neighbours. Spawn placement
// uses this so pickups and enemies start in open water, not tucked against
// a shore where the art's soft coastline would draw them on the beach.
export function isOpenWithClearance(grid, tx, ty) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx; const y = ty + dy;
      if (x < 0 || y < 0 || x >= grid.width || y >= grid.height || grid.tiles[y][x] !== 0) return false;
    }
  }
  return true;
}

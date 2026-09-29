// Reef Defence map generator (2026-09-29). Pure and deterministic: the
// same map def always builds the same reef.
//
// The canonical map is a portrait reef (28 × 46 tiles). Each lane is a
// winding channel from the open sea at the map's edge down to the Heart of
// the Reef in a lagoon near the bottom; everything else is land. Build
// spots are chosen where a tower would cover the most channel: on the
// inside of bends, between lanes. Flyers get a straight(ish) air route per
// lane that ignores the land.
//
// For a landscape screen the whole map is transposed (x ↔ y): the same
// reef, same distances, drawn natively sideways (no rotated sprites or
// text). `transposeDefenceMap` does that.

import { makeSeededRng } from './rng.mjs';
import { makeValueNoise } from './maze.mjs';
import { buildCoastField, sampleField } from './terrain.mjs';

export const TD_TILE = 16;
export const TD_COLS = 28;
export const TD_ROWS = 46;
export const CHANNEL_HALF = 30; // px, centre line to shore (before the coast wobble)
export const HEART_RADIUS = 50; // the Heart's lagoon
export const LEAK_RADIUS = 24; // an enemy this close to the Heart has got through
const SPOT_OFFSET = 60; // px, channel centre to a build spot
const SPOT_SPACING = 54;

function catmullRom(points, step = 6) {
  const out = [];
  const P = [points[0], ...points, points[points.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const seg = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const n = Math.max(2, Math.ceil(seg / step));
    for (let k = 0; k < n; k++) {
      const t = k / n; const t2 = t * t; const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push({ ...points[points.length - 1] });
  return out;
}

// A polyline with cumulative arc length, for walking enemies along it.
export function makePath(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, length: cum[cum.length - 1] };
}

// Position and direction at arc length `s` along a path (clamped).
export function pointAt(path, s) {
  const { pts, cum } = path;
  if (s <= 0) { const d = dirOf(pts[0], pts[1]); return { x: pts[0].x, y: pts[0].y, ...d, i: 0 }; }
  if (s >= path.length) { const n = pts.length; const d = dirOf(pts[n - 2], pts[n - 1]); return { x: pts[n - 1].x, y: pts[n - 1].y, ...d, i: n - 2 }; }
  let lo = 0; let hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
  const a = pts[lo]; const b = pts[hi];
  const f = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
  const d = dirOf(a, b);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, ...d, i: lo };
}
function dirOf(a, b) { const dx = b.x - a.x; const dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; return { dx: dx / l, dy: dy / l }; }

export function distToPath(path, x, y) {
  let best = Infinity;
  const p = path.pts;
  for (let i = 1; i < p.length; i++) {
    const ax = p[i - 1].x; const ay = p[i - 1].y; const bx = p[i].x; const by = p[i].y;
    const vx = bx - ax; const vy = by - ay; const l2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2));
    const d = Math.hypot(x - (ax + vx * t), y - (ay + vy * t));
    if (d < best) best = d;
  }
  return best;
}

function entryPoint(lane, W, H) {
  const a = lane.at;
  if (lane.from === 'left') return { x: -24, y: 40 + a * H * 0.55 };
  if (lane.from === 'right') return { x: W + 24, y: 40 + a * H * 0.55 };
  return { x: 40 + a * (W - 80), y: -24 };
}

function laneControlPoints(lane, rng, W, H, heart) {
  const entry = entryPoint(lane, W, H);
  const pts = [entry];
  const inward = lane.from === 'left' ? { x: entry.x + 64, y: entry.y } : lane.from === 'right' ? { x: entry.x - 64, y: entry.y } : { x: entry.x, y: entry.y + 64 };
  pts.push(inward);
  const leftX = () => 62 + rng() * 34; const rightX = () => W - 62 - rng() * 34;
  // First switchback goes to the far side from where the lane came in.
  let side = inward.x < W / 2 ? 1 : -1;
  const y0 = inward.y + 56; const y1 = heart.y - 150;
  const n = Math.max(1, lane.turns);
  for (let k = 0; k < n; k++) {
    const y = n === 1 ? (y0 + y1) / 2 : y0 + ((y1 - y0) * k) / (n - 1);
    pts.push({ x: side > 0 ? rightX() : leftX(), y: y + (rng() - 0.5) * 18 });
    side = -side;
  }
  pts.push({ x: heart.x + (rng() - 0.5) * 60, y: heart.y - 86 });
  pts.push({ x: heart.x, y: heart.y });
  return pts;
}

// The flyers' route: the channel with its bends smoothed right out, so
// flyers cut every corner over the land (a much shorter trip) but still
// pass within reach of towers guarding the channel.
function airRoute(ground) {
  const N = 48;
  let pts = [];
  for (let k = 0; k <= N; k++) { const p = pointAt(ground, (ground.length * k) / N); pts.push({ x: p.x, y: p.y }); }
  for (let pass = 0; pass < 4; pass++) {
    pts = pts.map((p, i) => {
      if (i === 0 || i === N) return p;
      let x = 0; let y = 0; let n = 0;
      for (let j = Math.max(0, i - 5); j <= Math.min(N, i + 5); j++) { x += pts[j].x; y += pts[j].y; n++; }
      return { x: x / n, y: y / n };
    });
  }
  return makePath(pts);
}

export function buildDefenceMap(def) {
  const W = TD_COLS * TD_TILE; const H = TD_ROWS * TD_TILE;
  const rng = makeSeededRng(def.seed);
  const noise = makeValueNoise(Math.floor(rng() * 2 ** 31));
  const heart = { x: W / 2, y: H - 5 * TD_TILE, r: HEART_RADIUS };

  const lanes = def.lanes.map((lane, i) => {
    const ctrl = laneControlPoints(lane, rng, W, H, heart);
    const ground = makePath(catmullRom(ctrl));
    return { id: i, from: lane.from, entry: ctrl[0], ground, air: airRoute(ground) };
  });

  // Carve the channels, the Heart's lagoon and a bay at each entry.
  const tiles = Array.from({ length: TD_ROWS }, () => Array(TD_COLS).fill(1));
  for (let ty = 0; ty < TD_ROWS; ty++) {
    for (let tx = 0; tx < TD_COLS; tx++) {
      const x = (tx + 0.5) * TD_TILE; const y = (ty + 0.5) * TD_TILE;
      const wob = (noise(x / 70, y / 70) - 0.5) * 12;
      let water = Math.hypot(x - heart.x, y - heart.y) < HEART_RADIUS + wob;
      for (const l of lanes) {
        if (water) break;
        if (distToPath(l.ground, x, y) < CHANNEL_HALF + wob) water = true;
        else if (Math.hypot(x - l.entry.x, y - l.entry.y) < 74 + wob * 2) water = true;
      }
      tiles[ty][tx] = water ? 0 : 1;
    }
  }
  const grid = { width: TD_COLS, height: TD_ROWS, tiles };
  const coastSeed = Math.floor(rng() * 2 ** 31);
  const coast = buildCoastField(grid, TD_TILE, coastSeed);

  const spots = pickSpots(def.spots || 16, lanes, coast, heart, W, H);
  return { id: def.id, widthPx: W, heightPx: H, tileSize: TD_TILE, grid, coast, coastSeed, lanes, heart, spots, transposed: false };
}

function coverageOf(x, y, lanes, radius) {
  let n = 0;
  for (const l of lanes) for (let i = 0; i < l.ground.pts.length; i += 2) {
    const p = l.ground.pts[i];
    if (p.x < 0 || p.y < 0) continue;
    if (Math.hypot(p.x - x, p.y - y) < radius) n++;
  }
  return n;
}

function pickSpots(count, lanes, coast, heart, W, H) {
  const cands = [];
  for (const l of lanes) {
    const { length } = l.ground;
    for (let s = 50; s < length - 40; s += 22) {
      const p = pointAt(l.ground, s);
      for (const side of [-1, 1]) {
        for (const off of [SPOT_OFFSET, SPOT_OFFSET + 14]) {
          const x = p.x - p.dy * side * off; const y = p.y + p.dx * side * off;
          if (x < 24 || y < 24 || x > W - 24 || y > H - 24) continue;
          if (sampleField(coast, x, y) < 13) continue;
          if (lanes.some((q) => distToPath(q.ground, x, y) < 46)) continue;
          if (Math.hypot(x - heart.x, y - heart.y) < HEART_RADIUS + 40) continue;
          cands.push({ x, y, score: coverageOf(x, y, lanes, 105) + (off === SPOT_OFFSET ? 0.5 : 0) });
        }
      }
    }
  }
  cands.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
  const out = [];
  for (const spacing of [SPOT_SPACING, SPOT_SPACING - 8]) {
    for (const c of cands) {
      if (out.length >= count) break;
      if (out.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < spacing)) continue;
      out.push(c);
    }
    if (out.length >= count) break;
  }
  // Stable ids in reading order.
  out.sort((a, b) => a.y - b.y || a.x - b.x);
  return out.map((c, i) => ({ id: i, x: Math.round(c.x), y: Math.round(c.y) }));
}

// ---- Landscape: the same map with x and y swapped.
const swapPt = (p) => ({ ...p, x: p.y, y: p.x });
const swapPath = (path) => makePath(path.pts.map(swapPt));
export function transposeDefenceMap(map) {
  const { grid, coast } = map;
  const tiles = Array.from({ length: grid.width }, (_, y) => Array.from({ length: grid.height }, (__, x) => grid.tiles[x][y]));
  const data = new Float32Array(coast.w * coast.h);
  for (let y = 0; y < coast.h; y++) for (let x = 0; x < coast.w; x++) data[x * coast.h + y] = coast.data[y * coast.w + x];
  return {
    ...map,
    widthPx: map.heightPx, heightPx: map.widthPx,
    grid: { width: grid.height, height: grid.width, tiles },
    coast: { w: coast.h, h: coast.w, data },
    lanes: map.lanes.map((l) => ({ ...l, entry: swapPt(l.entry), ground: swapPath(l.ground), air: swapPath(l.air) })),
    heart: swapPt(map.heart),
    spots: map.spots.map(swapPt),
    transposed: !map.transposed,
  };
}

// Camera for a defence: the whole map, fitted into the screen region the
// HUD leaves free (insets in screen px), centred. Pure.
export function computeTdView(vw, vh, insets, mapW, mapH) {
  const fw = Math.max(1, vw - insets.left - insets.right);
  const fh = Math.max(1, vh - insets.top - insets.bottom);
  const scale = Math.min(fw / mapW, fh / mapH);
  const tx = insets.left + (fw - mapW * scale) / 2;
  const ty = insets.top + (fh - mapH * scale) / 2;
  return {
    scale, tx, ty,
    toScreen: (x, y) => ({ x: x * scale + tx, y: y * scale + ty }),
    toWorld: (x, y) => ({ x: (x - tx) / scale, y: (y - ty) / scale }),
    visible: { left: -tx / scale, top: -ty / scale, right: (vw - tx) / scale, bottom: (vh - ty) / scale },
  };
}

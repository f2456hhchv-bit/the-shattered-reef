// Builds the home-base harbour (2026-09-28) as an ordinary tile grid + coast
// field, so the same terrain renderer that paints the reefs paints the base
// in exactly the same style. Pure and deterministic (fixed seed): everyone's
// harbour is the same place.

import { BASE_BUILDINGS, BASE_LAYOUT } from '../data/base.mjs';
import { makeValueNoise } from './maze.mjs';
import { makeSeededRng } from './rng.mjs';
import { buildCoastField } from './terrain.mjs';

const TILE = 16;

export function buildingPosition(b, layout = BASE_LAYOUT) {
  const c = (layout.tiles * TILE) / 2;
  const a = (b.angleDeg * Math.PI) / 180;
  return { x: c + Math.cos(a) * layout.ringRx, y: c + Math.sin(a) * layout.ringRy };
}

export function boatOrbitPoint(t, layout = BASE_LAYOUT) {
  const c = (layout.tiles * TILE) / 2;
  const { rx, ry, secondsPerLap } = layout.boatOrbit;
  const a = (t / secondsPerLap) * Math.PI * 2;
  const x = c + Math.cos(a) * rx; const y = c + Math.sin(a) * ry;
  // Heading along the orbit's tangent (anticlockwise on screen = increasing a).
  const heading = Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx);
  return { x, y, heading };
}

export function buildBaseWorld(layout = BASE_LAYOUT, buildingsData = BASE_BUILDINGS) {
  const W = layout.tiles; const size = W * TILE; const c = size / 2;
  const rng = makeSeededRng(layout.seed);
  const noise = makeValueNoise(Math.floor(rng() * 2 ** 31));
  const buildings = buildingsData.map((b) => ({ ...b, ...buildingPosition(b, layout), lagoonX: c, lagoonY: c }));

  // Decorative islets out in the surrounding sea (never inside the ring).
  const islets = [];
  for (let i = 0; i < layout.islets * 8 && islets.length < layout.islets; i++) {
    const a = rng() * Math.PI * 2; const r = 400 + rng() * 360;
    const p = { x: c + Math.cos(a) * r * 0.8, y: c + Math.sin(a) * r, r: 22 + rng() * 34 };
    if (p.x < 60 || p.y < 60 || p.x > size - 60 || p.y > size - 60) continue;
    if (islets.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < q.r + p.r + 50)) continue;
    islets.push(p);
  }

  // Sea stacks: little rock pillars in the water between the ring and the
  // open sea, so the harbour has texture instead of flat blue.
  for (let i = 0; i < 90 && islets.length < layout.islets + 12; i++) {
    const a = rng() * Math.PI * 2; const r = 250 + rng() * 150;
    const p = { x: c + Math.cos(a) * r * 0.85, y: c + Math.sin(a) * r * 1.05, r: 15 + rng() * 10 };
    if (buildings.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < layout.islandRadius + 34)) continue;
    if (islets.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < q.r + p.r + 30)) continue;
    islets.push(p);
  }

  // Channels between neighbouring building islands: kept open so the
  // lagoon reads as a harbour with ways out to sea, not a closed pond.
  const sorted = [...buildings].sort((a, b) => a.angleDeg - b.angleDeg);
  const channels = sorted.map((b, i) => {
    const n = sorted[(i + 1) % sorted.length];
    let mid = (b.angleDeg + n.angleDeg) / 2;
    if (i === sorted.length - 1) mid = (b.angleDeg + n.angleDeg + 360) / 2;
    return (mid * Math.PI) / 180;
  });

  const tiles = Array.from({ length: W }, () => Array(W).fill(0));
  for (let ty = 0; ty < W; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const x = (tx + 0.5) * TILE; const y = (ty + 0.5) * TILE;
      let land = false;
      for (const b of buildings) {
        const d = Math.hypot(x - b.x, y - b.y);
        const a = Math.atan2(y - b.y, x - b.x);
        const wob = 0.82 + 0.36 * noise(Math.cos(a) * 1.4 + b.x * 0.01, Math.sin(a) * 1.4 + b.y * 0.01);
        if (d < layout.islandRadius * wob) { land = true; break; }
      }
      if (!land) {
        for (const p of islets) {
          const a = Math.atan2(y - p.y, x - p.x);
          if (Math.hypot(x - p.x, y - p.y) < p.r * (0.75 + 0.5 * noise(Math.cos(a) + p.x, Math.sin(a) + p.y))) { land = true; break; }
        }
      }
      // Rugged coast framing the far edges of the view.
      const dc = Math.hypot((x - c) * 0.9, y - c);
      if (dc > 760 + noise(x / 90, y / 90) * 160) land = true;
      // Keep the lagoon and the channels open water, whatever the noise did.
      if (Math.hypot((x - c) / 1.0, (y - c) / 1.12) < layout.lagoonRadius) land = false;
      for (const ang of channels) {
        const dx = x - c; const dy = y - c;
        const along = dx * Math.cos(ang) + dy * Math.sin(ang);
        const across = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
        if (along > 0 && along < 470 && across < layout.channelHalfWidth) land = false;
      }
      tiles[ty][tx] = land ? 1 : 0;
    }
  }

  const grid = { width: W, height: W, tiles };
  const coastSeed = Math.floor(rng() * 2 ** 31);
  const coast = buildCoastField(grid, TILE, coastSeed);
  return { grid, coast, coastSeed, tileSize: TILE, widthPx: size, heightPx: size, centre: { x: c, y: c }, buildings, layout };
}

// Camera for the base: fit the ring of buildings (plus their labels) into
// the free screen region left by the HUD panels, centred. Pure.
export function computeBaseView(viewW, viewH, free, layout = BASE_LAYOUT) {
  const fw = Math.max(1, viewW - free.left - free.right);
  const fh = Math.max(1, viewH - free.top - free.bottom);
  const scale = Math.max(0.42, Math.min(1.25, fw / (2 * layout.fitHalfWidth), fh / (2 * layout.fitHalfHeight)));
  const c = (layout.tiles * TILE) / 2;
  const tx = free.left + fw / 2 - c * scale;
  const ty = free.top + fh / 2 - c * scale;
  return {
    scale, tx, ty,
    toScreen: (x, y) => ({ x: x * scale + tx, y: y * scale + ty }),
    visible: { left: -tx / scale, top: -ty / scale, right: (viewW - tx) / scale, bottom: (viewH - ty) / scale },
  };
}

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
  const decor = buildDecor(tiles, W, c, buildings, islets, channels, layout, rng);
  const coastSeed = Math.floor(rng() * 2 ** 31);
  const coast = buildCoastField(grid, TILE, coastSeed);
  return { grid, coast, coastSeed, tileSize: TILE, widthPx: size, heightPx: size, centre: { x: c, y: c }, buildings, layout, decor };
}

// Harbour life: jetties into the lagoon with ships moored alongside,
// buoys marking the channels, rock clusters and wrecks out at sea.
// Painted hulls only (the galleon has no painted sprite yet).
const MOORED = ['junk', 'steamer', 'longboat', 'skiff', 'sloop', 'catamaran'];
function buildDecor(tiles, W, c, buildings, islets, channels, layout, rng) {
  const water = (x, y) => { const tx = Math.floor(x / TILE); const ty = Math.floor(y / TILE); return tx >= 0 && ty >= 0 && tx < W && ty < W && tiles[ty][tx] === 0; };
  const decor = [];
  // Ships riding at anchor in the channel mouths, bows to the sea. The two
  // channels nearest north are left clear (the lighthouse beam and the
  // shipyard crane own that water).
  channels.forEach((ang, i) => {
    const deg = ((ang * 180) / Math.PI + 360) % 360;
    if (deg > 200 && deg < 340) return;
    // Side channels: just outside the lagoon. Southern ones sit further
    // out, beyond the building labels.
    const side = deg < 30 || deg > 330 || (deg > 150 && deg < 210);
    const along = side ? 205 : 380;
    const x = c + Math.cos(ang) * along; const y = c + Math.sin(ang) * along;
    if (!water(x, y)) return;
    decor.push({ kind: 'moored', style: MOORED[i % MOORED.length], x, y, heading: ang + 0.25, scale: 11, anchor: true });
    const rx = c + Math.cos(ang) * (along - 34) + Math.cos(ang + Math.PI / 2) * 14;
    const ry = c + Math.sin(ang) * (along - 34) + Math.sin(ang + Math.PI / 2) * 14;
    if (water(rx, ry) && rng() < 0.7) decor.push({ kind: 'rowboat', x: rx, y: ry, heading: ang + 2 });
  });
  // Buoys in pairs at each channel mouth, red to port and green to starboard.
  for (const ang of channels) {
    for (const along of [230, 320]) {
      for (const s of [-1, 1]) {
        const x = c + Math.cos(ang) * along - Math.sin(ang) * s * (layout.channelHalfWidth + 2);
        const y = c + Math.sin(ang) * along + Math.cos(ang) * s * (layout.channelHalfWidth + 2);
        if (water(x, y)) decor.push({ kind: 'buoy', x, y, color: s < 0 ? '#c8402e' : '#2f8f4e' });
      }
    }
  }
  // Rock clusters out in open water.
  for (let i = 0, made = 0; i < 200 && made < 14; i++) {
    const a = rng() * Math.PI * 2; const r = 270 + rng() * 420;
    const x = c + Math.cos(a) * r * 0.9; const y = c + Math.sin(a) * r * 1.05;
    if (!water(x, y) || !water(x + 18, y) || !water(x - 18, y) || !water(x, y + 18) || !water(x, y - 18)) continue;
    if (buildings.some((b) => Math.hypot(b.x - x, b.y - y) < layout.islandRadius + 40)) continue;
    if (decor.some((d) => Math.hypot(d.x - x, d.y - y) < 60)) continue;
    const n = 1 + Math.floor(rng() * 3);
    decor.push({ kind: 'rocks', x, y, stones: Array.from({ length: n }, (_, k) => ({ dx: (rng() - 0.5) * 16 * k, dy: (rng() - 0.5) * 10 * k, r: 3.5 + rng() * 4.5 })) });
    made++;
  }
  // Wrecks run aground on two of the outer islets.
  const outer = islets.filter((p) => p.r > 30).slice(0, 2);
  for (const p of outer) decor.push({ kind: 'wreck', x: p.x, y: p.y, scale: 0.9, angle: rng() * 1.2 - 0.6 });
  return decor;
}

// Camera for the base: fit every building AND its fixed-size label chip
// into the free screen region left by the HUD panels. Pure. The labels are
// fitted in screen px (they don't scale with the map), which is what kept
// the bottom label (Faction Hall) under the voyage card on short screens.
export function computeBaseView(viewW, viewH, free, layout = BASE_LAYOUT, buildings = BASE_BUILDINGS) {
  const fw = Math.max(1, viewW - free.left - free.right);
  const fh = Math.max(1, viewH - free.top - free.bottom);
  const c = (layout.tiles * TILE) / 2;
  const pts = buildings.map((b) => buildingPosition(b, layout));
  const minX = Math.min(...pts.map((p) => p.x)) - c; const maxX = Math.max(...pts.map((p) => p.x)) - c;
  const top = Math.min(...pts.map((p) => p.y)) - c - layout.spriteAbove; // world, negative
  const labelTop = Math.max(...pts.map((p) => p.y)) - c + layout.labelOffset; // lowest label anchor
  const { w: lw, h: lh } = layout.labelPx;
  const pad = 6;
  // Vertical: (labelTop - top)·s + lh ≤ fh.  Horizontal: the span between
  // building centres plus half a label (or half a sprite) on each side.
  const sV = (fh - lh - 2 * pad) / (labelTop - top);
  const sH1 = (fw - lw - 2 * pad) / (maxX - minX);
  const sH2 = (fw - 2 * pad) / (maxX - minX + 2 * layout.spriteHalfWidth);
  const scale = Math.max(0.25, Math.min(1.25, sV, sH1, sH2));
  const contentH = (labelTop - top) * scale + lh;
  const tx = free.left + fw / 2 - (c + (minX + maxX) / 2) * scale;
  const ty = free.top + (fh - contentH) / 2 - (c + top) * scale;
  return {
    scale, tx, ty,
    toScreen: (x, y) => ({ x: x * scale + tx, y: y * scale + ty }),
    visible: { left: -tx / scale, top: -ty / scale, right: (viewW - tx) / scale, bottom: (viewH - ty) / scale },
  };
}

// Screen rect of a building's label chip (for layout checks/tests).
export function labelRect(view, b, layout = BASE_LAYOUT) {
  const p = view.toScreen(b.x, b.y + layout.labelOffset);
  return { left: p.x - layout.labelPx.w / 2, right: p.x + layout.labelPx.w / 2, top: p.y, bottom: p.y + layout.labelPx.h };
}

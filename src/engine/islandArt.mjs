// Small island portraits for the voyage chart (2026-09-29): one per stage,
// in that stage's biome, in the same painted style as the reefs. Pure
// canvas drawing, seeded by the stage so an island always looks the same.

import { makeSeededRng } from './rng.mjs';

function blob(ctx, cx, cy, rx, ry, rng, wobble = 0.22, n = 18) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (rng() - 0.5) * wobble * 2;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pts[i]; const q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2; const my = (p[1] + q[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p[0], p[1], mx, my);
  }
  const p = pts[0]; const q = pts[1];
  ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  ctx.closePath();
}

function palm(ctx, x, y, s, frond = '#2f8a34', light = '#58b04a') {
  ctx.strokeStyle = '#7a5a33'; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.6, x + s * 0.15, y - s * 1.1); ctx.stroke();
  const tx = x + s * 0.15; const ty = y - s * 1.1;
  for (const [c, off] of [[frond, 0], [light, 0.4]]) {
    ctx.fillStyle = c;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + off;
      ctx.beginPath(); ctx.ellipse(tx + Math.cos(a) * s * 0.35, ty + Math.sin(a) * s * 0.2, s * 0.42, s * 0.14, a, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function pine(ctx, x, y, s) {
  ctx.fillStyle = '#24503c';
  for (let k = 0; k < 3; k++) {
    const w = s * (0.55 - k * 0.13); const yy = y - k * s * 0.35;
    ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.lineTo(x, yy - s * 0.55); ctx.lineTo(x + w, yy); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.moveTo(x - s * 0.12, y - s * 0.95); ctx.lineTo(x, y - s * 1.25); ctx.lineTo(x + s * 0.12, y - s * 0.95); ctx.fill();
}

function peak(ctx, x, y, w, h, rock = '#7d8a94', snow = '#f4f8fb') {
  ctx.fillStyle = rock;
  ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w * 0.1, y - h); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.moveTo(x - w * 0.1, y - h); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.2, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = snow;
  ctx.beginPath(); ctx.moveTo(x - w * 0.42, y - h * 0.6); ctx.lineTo(x - w * 0.1, y - h); ctx.lineTo(x + w * 0.32, y - h * 0.6);
  ctx.lineTo(x + w * 0.1, y - h * 0.68); ctx.lineTo(x - w * 0.12, y - h * 0.55); ctx.closePath(); ctx.fill();
}

const LOOKS = {
  tropical: { shallow: '#7fe3cf', sand: '#ead69c', land: '#3f7f33', landLight: '#58a043', rim: '#2f6a2a' },
  cliff_cove: { shallow: '#8fe0d8', sand: '#cdbd97', land: '#6d8f4a', landLight: '#8fae5e', rim: '#5f5c57' },
  glacial: { shallow: '#bff1f4', sand: '#c9d6dc', land: '#e6eef2', landLight: '#ffffff', rim: '#9fb3bd' },
  shipwreck: { shallow: '#8ad0c0', sand: '#a8966f', land: '#5a6038', landLight: '#6f7446', rim: '#403d39' },
};

// Draws the island for `stage` in `biomeId` centred in a w×h canvas.
// `locked` greys it into the fog.
export function drawIsland(ctx, w, h, biomeId, stage, { locked = false, t = 0 } = {}) {
  const L = LOOKS[biomeId] || LOOKS.tropical;
  const rng = makeSeededRng(0x15a0 + stage * 977);
  const cx = w / 2; const cy = h * 0.56; const rx = w * 0.36; const ry = h * 0.3;
  ctx.save();
  // Shallows halo and surf ring.
  ctx.fillStyle = L.shallow; ctx.globalAlpha = 0.55;
  blob(ctx, cx, cy, rx * 1.28, ry * 1.32, makeSeededRng(stage + 5)); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(4, 30, 40, 0.25)';
  blob(ctx, cx + 3, cy + 5, rx, ry, makeSeededRng(stage + 9)); ctx.fill();
  ctx.fillStyle = L.sand;
  blob(ctx, cx, cy, rx, ry, makeSeededRng(stage + 9)); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = L.land;
  blob(ctx, cx, cy - 2, rx * 0.8, ry * 0.74, makeSeededRng(stage + 13), 0.28); ctx.fill();
  ctx.fillStyle = L.landLight; ctx.globalAlpha = 0.6;
  blob(ctx, cx - rx * 0.2, cy - ry * 0.25, rx * 0.4, ry * 0.3, makeSeededRng(stage + 17), 0.3); ctx.fill();
  ctx.globalAlpha = 1;

  if (biomeId === 'glacial') {
    peak(ctx, cx - rx * 0.1, cy + ry * 0.1, rx * 0.45, ry * 1.4);
    peak(ctx, cx + rx * 0.35, cy + ry * 0.2, rx * 0.3, ry * 0.95);
    for (let i = 0; i < 5; i++) pine(ctx, cx - rx * 0.6 + rng() * rx * 1.2, cy + ry * (0.25 + rng() * 0.3), 7 + rng() * 3);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(cx + (rng() - 0.5) * rx * 2.6, cy + ry * (0.9 + rng() * 0.3), 4 + rng() * 4, 2 + rng() * 2, 0, 0, Math.PI * 2); ctx.fill(); }
  } else if (biomeId === 'cliff_cove') {
    // Grey cliffs with a lighthouse on the headland.
    ctx.fillStyle = '#a19b90';
    blob(ctx, cx + rx * 0.25, cy - ry * 0.05, rx * 0.45, ry * 0.5, makeSeededRng(stage + 21), 0.35); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    blob(ctx, cx + rx * 0.32, cy + ry * 0.06, rx * 0.35, ry * 0.35, makeSeededRng(stage + 22), 0.35); ctx.fill();
    const lx = cx + rx * 0.3; const ly = cy - ry * 0.3;
    ctx.fillStyle = '#f4efe6'; ctx.fillRect(lx - 3, ly - 16, 6, 16);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(lx - 3, ly - 11, 6, 3); ctx.fillRect(lx - 3, ly - 5, 6, 3);
    ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(lx, ly - 18, 3 + Math.sin(t * 3) * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 226, 138, 0.25)'; ctx.beginPath(); ctx.arc(lx, ly - 18, 8, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#4f7a3a'; ctx.beginPath(); ctx.arc(cx - rx * 0.5 + rng() * rx * 0.5, cy + (rng() - 0.3) * ry * 0.6, 4 + rng() * 3, 0, Math.PI * 2); ctx.fill(); }
  } else if (biomeId === 'shipwreck') {
    // A broken hull on the beach and masts jutting from the shallows.
    ctx.save(); ctx.translate(cx - rx * 0.1, cy + ry * 0.35); ctx.rotate(-0.35);
    ctx.fillStyle = '#5a3d22'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 1.2;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 5, 0); ctx.lineTo(k * 5 + 1, -7); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const [dx, dy, a] of [[rx * 0.95, ry * 0.7, -0.4], [-rx * 1.0, ry * 0.2, 0.3]]) {
      ctx.beginPath(); ctx.moveTo(cx + dx, cy + dy); ctx.lineTo(cx + dx + Math.sin(a) * 14, cy + dy - 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + dx + Math.sin(a) * 9 - 5, cy + dy - 9); ctx.lineTo(cx + dx + Math.sin(a) * 9 + 5, cy + dy - 9); ctx.stroke();
    }
    for (let i = 0; i < 3; i++) palm(ctx, cx - rx * 0.4 + rng() * rx * 0.8, cy - ry * 0.1 + rng() * ry * 0.3, 9, '#5d6e34', '#7a8a45');
    ctx.fillStyle = '#e9e2cf';
    ctx.beginPath(); ctx.arc(cx + rx * 0.35, cy - ry * 0.1, 3.2, 0, Math.PI * 2); ctx.fill(); // a skull
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx + rx * 0.35 - 1.1, cy - ry * 0.15, 0.8, 0, Math.PI * 2); ctx.arc(cx + rx * 0.35 + 1.1, cy - ry * 0.15, 0.8, 0, Math.PI * 2); ctx.fill();
  } else {
    // Tropical: palms, a little jetty.
    for (let i = 0; i < 5; i++) palm(ctx, cx - rx * 0.55 + rng() * rx * 1.1, cy - ry * 0.2 + rng() * ry * 0.5, 9 + rng() * 3);
    ctx.fillStyle = '#8c5a2b'; ctx.fillRect(cx + rx * 0.7, cy + ry * 0.25, 16, 3);
    ctx.fillStyle = '#e0766a'; ctx.beginPath(); ctx.arc(cx - rx * 1.1, cy + ry * 0.8, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  if (locked) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(40, 60, 75, 0.62)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

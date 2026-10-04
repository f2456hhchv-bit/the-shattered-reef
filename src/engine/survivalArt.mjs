// Survival mode's own drawings (2026-10-04), in the game's existing style:
// sea glass and anchor coins, fire pools, the Reaper Chains' blades, the
// hull bar under your ship, shockwave rings, enemies going under, arrows
// to what's off-screen, and the screen vignette. Canvas only, no state.

import { drawEnemyBody, drawPickup } from './renderer.mjs';
import { drawLandmarkKind } from './islandArt.mjs';

const TAU = Math.PI * 2;
const inView = (v, x, y, m = 30) => x > v.left - m && x < v.right + m && y > v.top - m && y < v.bottom + m;

// Sea glass (XP), anchor coins (Salvage), lodestones and life rings.
export function drawSurvivalPickups(ctx, pickups, view, t) {
  for (const p of pickups) {
    if (p.collected || !inView(view, p.x, p.y)) continue;
    if (p.kind === 'gem') drawGem(ctx, p, t);
    else if (p.kind === 'coin') drawCoin(ctx, p, t);
    else if (p.kind === 'magnet') drawMagnet(ctx, p, t);
    else drawPickup(ctx, p, null, t);
  }
}

function drawGem(ctx, p, t) {
  const tier = p.tier; const s = p.value >= 25 ? 6 : p.value >= 5 ? 4.6 : 3.4;
  const bob = p.pulled ? 0 : Math.sin(t * 3 + p.id) * 1.2;
  ctx.save(); ctx.translate(p.x, p.y + bob);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = tier.color; ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 5 + p.id);
  ctx.beginPath(); ctx.arc(0, 0, s * 2.1, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.rotate(Math.sin(t * 1.5 + p.id) * 0.3);
  ctx.fillStyle = tier.color; ctx.strokeStyle = 'rgba(10, 30, 40, 0.85)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -s * 1.25); ctx.lineTo(s, 0); ctx.lineTo(0, s * 1.25); ctx.lineTo(-s, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = tier.glow;
  ctx.beginPath(); ctx.moveTo(0, -s * 1.25); ctx.lineTo(s * 0.45, -s * 0.1); ctx.lineTo(-s * 0.2, -s * 0.15); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawCoin(ctx, p, t) {
  const bob = p.pulled ? 0 : Math.sin(t * 2.6 + p.id) * 1.2;
  const big = p.amount >= 5; const R = big ? 6.5 : 5;
  const squash = 0.75 + 0.25 * Math.abs(Math.cos(t * 3 + p.id));
  ctx.save(); ctx.translate(p.x, p.y + bob);
  ctx.fillStyle = 'rgba(4, 30, 40, 0.3)'; ctx.beginPath(); ctx.ellipse(1.5, 3, R, R * 0.6, 0, 0, TAU); ctx.fill();
  ctx.scale(squash, 1);
  ctx.fillStyle = '#b7811f'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(-0.4, -0.4, R - 1.2, 0, TAU); ctx.fill();
  // An anchor stamped on the face.
  ctx.strokeStyle = '#a06a12'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -R * 0.55); ctx.lineTo(0, R * 0.5); ctx.moveTo(-R * 0.3, -R * 0.3); ctx.lineTo(R * 0.3, -R * 0.3); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, R * 0.1, R * 0.42, 0.25, Math.PI - 0.25); ctx.stroke();
  const gl = (Math.sin(t * 4 + p.id) + 1) / 2;
  ctx.fillStyle = `rgba(255, 250, 220, ${0.3 + gl * 0.6})`; ctx.beginPath(); ctx.arc(-R * 0.4, -R * 0.4, 1.1, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawMagnet(ctx, p, t) {
  ctx.save(); ctx.translate(p.x, p.y + Math.sin(t * 3 + p.id) * 1.5);
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  ctx.strokeStyle = `rgba(160, 220, 255, ${0.3 + pulse * 0.4})`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 11 + pulse * 3, 0, TAU); ctx.stroke();
  ctx.lineWidth = 4.5; ctx.lineCap = 'butt';
  ctx.strokeStyle = '#c0392b'; ctx.beginPath(); ctx.arc(0, -1, 5, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = '#d8dde2';
  ctx.beginPath(); ctx.moveTo(-5, -1); ctx.lineTo(-5, 4); ctx.moveTo(5, -1); ctx.lineTo(5, 4); ctx.stroke();
  ctx.restore();
}

// Burning pools on the water: a hot core, licking flames, fading at the end.
export function drawFirePools(ctx, pools, view, t) {
  for (const p of pools) {
    if (!inView(view, p.x, p.y, p.r)) continue;
    const life = Math.min(1, p.t / 0.18, (p.duration - p.t) / 0.5);
    const r = p.r * (0.7 + 0.3 * Math.min(1, p.t / 0.25));
    ctx.save(); ctx.globalAlpha = Math.max(0, life);
    const g = ctx.createRadialGradient(p.x, p.y, r * 0.1, p.x, p.y, r);
    g.addColorStop(0, 'rgba(255, 220, 120, 0.75)');
    g.addColorStop(0.45, 'rgba(255, 120, 40, 0.5)');
    g.addColorStop(1, 'rgba(160, 30, 10, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const n = Math.max(5, Math.round(r / 5));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + p.x * 0.01;
      const d = r * (0.25 + 0.55 * ((k * 0.37 + p.y * 0.003) % 1));
      const fx = p.x + Math.cos(a) * d; const fy = p.y + Math.sin(a) * d * 0.8;
      const h = 4 + 4 * Math.abs(Math.sin(t * 9 + k * 1.7 + p.x));
      ctx.fillStyle = k % 2 ? 'rgba(255, 170, 60, 0.6)' : 'rgba(255, 230, 140, 0.55)';
      ctx.beginPath(); ctx.moveTo(fx - 2.2, fy); ctx.quadraticCurveTo(fx, fy - h * 1.6, fx + 2.2, fy); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// Reaper Chains: curved chain-blades whirling round the ship.
export function drawOrbitBlades(ctx, blades, t) {
  for (const b of blades) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a + Math.PI / 2 + t * 10);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(200, 230, 255, 0.35)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 1.2); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#d7dde3'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 1.2); ctx.stroke();
    ctx.fillStyle = '#5b6068'; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// Your hull, under your ship (as the reference shows): green to red.
export function drawHullBar(ctx, boat, radius, flash = 0) {
  const w = 34; const h = 5; const x = boat.x - w / 2; const y = boat.y + radius + 11;
  const f = Math.max(0, Math.min(1, boat.health / boat.maxHull));
  ctx.fillStyle = 'rgba(6, 20, 28, 0.85)';
  roundRect(ctx, x - 1.5, y - 1.5, w + 3, h + 3, 3); ctx.fill();
  ctx.fillStyle = f > 0.5 ? '#6fdc5a' : f > 0.25 ? '#e8c64b' : '#e0503f';
  if (f > 0) { roundRect(ctx, x, y, w * f, h, 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'; ctx.fillRect(x + 1, y + 0.5, Math.max(0, w * f - 2), 1.2);
  if (flash > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${flash})`; roundRect(ctx, x, y, w, h, 2); ctx.fill(); }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// Shockwaves: blasts, level-up picks, a boss going down.
export function drawRings(ctx, rings) {
  for (const r of rings) {
    const f = 1 - r.life / r.maxLife;
    const rad = r.r * (0.25 + 0.75 * Math.sqrt(f));
    ctx.strokeStyle = `rgba(${r.color}, ${0.75 * (1 - f)})`;
    ctx.lineWidth = 2 + 4 * (1 - f);
    ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.stroke();
  }
}

// Sunk enemies slipping under: shrink, tilt, fade, a ring of bubbles.
export function drawSinkers(ctx, sinkers, t, colorFor) {
  for (const s of sinkers) {
    const f = s.life / s.maxLife; // 1 → 0
    const e = s.e;
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.globalAlpha = f * 0.9;
    ctx.scale(0.55 + 0.45 * f, 0.55 + 0.45 * f);
    ctx.rotate((1 - f) * 0.5 * (e.id % 2 ? 1 : -1));
    drawEnemyBody(ctx, e, colorFor(e), t);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(230, 250, 255, ${0.6 * f})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * (1.2 + (1 - f) * 1.4), 0, TAU); ctx.stroke();
  }
}

// Landmarks: the biome's set pieces and the wrecks, on their islands.
export function drawLandmarks(ctx, landmarks, view, t) {
  for (const l of landmarks) {
    if (!inView(view, l.x, l.y, 90)) continue;
    drawLandmarkKind(ctx, l.kind, l.x, l.y, t, l.kind === 'wreck' ? 1.25 : 1.45, l.angle || 0);
  }
}

// Arrows at the screen edge to things worth knowing about off-screen: the
// boss or an elite (red), treasure (gold). `rect` is the usable screen.
export function drawEdgeArrows(ctx, targets, toScreen, rect, t) {
  const cx = (rect.left + rect.right) / 2; const cy = (rect.top + rect.bottom) / 2;
  for (const tg of targets) {
    const p = toScreen(tg.x, tg.y);
    if (p.x > rect.left && p.x < rect.right && p.y > rect.top && p.y < rect.bottom) continue;
    const dx = p.x - cx; const dy = p.y - cy;
    const k = Math.min((rect.right - rect.left) / 2 / Math.abs(dx || 1e-6), (rect.bottom - rect.top) / 2 / Math.abs(dy || 1e-6));
    const ax = cx + dx * k * 0.92; const ay = cy + dy * k * 0.92;
    const a = Math.atan2(dy, dx);
    const pulse = 0.75 + 0.25 * Math.sin(t * 6);
    ctx.save(); ctx.translate(ax, ay);
    ctx.fillStyle = 'rgba(6, 20, 28, 0.8)'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = tg.color; ctx.lineWidth = 2; ctx.globalAlpha = pulse; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tg.icon, 0, 1);
    ctx.rotate(a);
    ctx.fillStyle = tg.color; ctx.beginPath(); ctx.moveTo(19, 0); ctx.lineTo(13, -5); ctx.lineTo(13, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// A soft dark vignette for depth, reddening and pulsing when the hull is low.
let vigCache = null;
export function drawVignette(ctx, vw, vh, hullFrac, t) {
  const key = `${vw}x${vh}`;
  if (!vigCache || vigCache.key !== key) {
    const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.42, vw / 2, vh / 2, Math.hypot(vw, vh) * 0.62);
    g.addColorStop(0, 'rgba(0, 10, 20, 0)'); g.addColorStop(1, 'rgba(0, 10, 20, 0.38)');
    const r = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.hypot(vw, vh) * 0.6);
    r.addColorStop(0, 'rgba(200, 20, 10, 0)'); r.addColorStop(1, 'rgba(200, 20, 10, 0.55)');
    vigCache = { key, g, r };
  }
  ctx.fillStyle = vigCache.g; ctx.fillRect(0, 0, vw, vh);
  if (hullFrac < 0.3) {
    ctx.globalAlpha = (1 - hullFrac / 0.3) * (0.55 + 0.45 * Math.sin(t * 5));
    ctx.fillStyle = vigCache.r; ctx.fillRect(0, 0, vw, vh);
    ctx.globalAlpha = 1;
  }
}

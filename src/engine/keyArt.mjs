// What a turned key leaves on the water (engine/keys.mjs): the Mire Key's
// cloud, the Bone Key's sandstorm, the Deep Key's whirlpool, the glow of
// the Ghost, Lantern and Prism keys, and ice on frozen enemies. World
// space, drawn over the enemies. Code-drawn until art batch Z arrives.

import { KEYS } from '../data/keys.mjs';

const TAU = Math.PI * 2;

export function drawKeyEffects(ctx, run, t) {
  const K = run.key; const b = run.boat;
  if (K) {
    for (const a of K.active) {
      const fade = Math.min(1, a.t / 0.5);
      if (a.kind === 'aura') glowRing(ctx, b.x, b.y, a.r, '123, 191, 74', 0.22 * fade, t, 18);
      else if (a.kind === 'sand') glowRing(ctx, b.x, b.y, a.r, '232, 200, 140', 0.12 * fade, t, 40);
      else if (a.kind === 'vortex') vortex(ctx, a, t);
      else if (a.kind === 'pierce') halo(ctx, b.x, b.y, '159, 227, 208', 0.45 * fade, t);
      else if (a.kind === 'buff') halo(ctx, b.x, b.y, '244, 194, 74', 0.5 * fade, t);
      else if (a.kind === 'split') halo(ctx, b.x, b.y, '180, 140, 240', 0.5 * fade, t);
    }
  }
  // Ice on everything the Frost Key froze.
  for (const e of run.enemies) {
    if (!(e.frozenT > 0) || e.health <= 0) continue;
    const k = Math.min(1, e.frozenT / 0.6);
    ctx.fillStyle = `rgba(190, 238, 255, ${0.35 * k})`;
    ctx.strokeStyle = `rgba(235, 252, 255, ${0.9 * k})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * k})`; ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + e.id;
      ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * 3, e.y + Math.sin(a) * 3); ctx.lineTo(e.x + Math.cos(a) * (e.radius + 3), e.y + Math.sin(a) * (e.radius + 3)); ctx.stroke();
    }
  }
}

function glowRing(ctx, x, y, r, rgb, alpha, t, dots) {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
  g.addColorStop(0, `rgba(${rgb}, 0)`); g.addColorStop(0.75, `rgba(${rgb}, ${alpha})`); g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(${rgb}, ${Math.min(1, alpha * 3)})`;
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * TAU + t * (0.6 + (i % 3) * 0.2);
    const rr = r * (0.4 + 0.55 * ((i * 37 % 100) / 100)) + Math.sin(t * 2 + i) * 6;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1.6 + (i % 3), 0, TAU); ctx.fill();
  }
}

function halo(ctx, x, y, rgb, alpha, t) {
  const r = 30 + Math.sin(t * 6) * 3;
  const g = ctx.createRadialGradient(x, y, 6, x, y, r);
  g.addColorStop(0, `rgba(${rgb}, 0)`); g.addColorStop(0.7, `rgba(${rgb}, ${alpha})`); g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

function vortex(ctx, a, t) {
  const col = KEYS.deep.colour;
  ctx.save(); ctx.translate(a.x, a.y);
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let arm = 0; arm < 4; arm++) {
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let s = 0; s <= 1; s += 0.05) {
      const ang = arm * (TAU / 4) + s * 4 - t * 5;
      const r = s * a.r * 0.9;
      const px = Math.cos(ang) * r; const py = Math.sin(ang) * r;
      if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#0b1440';
  ctx.beginPath(); ctx.arc(0, 0, 18 + Math.sin(t * 8) * 3, 0, TAU); ctx.fill();
  ctx.restore();
}

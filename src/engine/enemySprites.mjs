import { drawSeal } from './armamentArt.mjs';
// Code-drawn sprites for the 2026-09-29 roster (pirate ships, sharks, the
// sea serpent, the stage bosses) plus enemy shots and attack telegraphs.
// Everything hostile that's about to hurt you is marked in red/orange: a
// sighting line, glowing gunports, a charge lane. renderer.mjs delegates
// here by enemy id (SPRITES).

function facingOf(e) {
  const sp = Math.hypot(e.vx || 0, e.vy || 0);
  if (e.sharkState === 'windup' || e.sharkState === 'charging' || e.submergedState === 'surfaced') return e.heading || 0;
  if (sp > 4) e._facing = Math.atan2(e.vy, e.vx);
  return e._facing ?? e.heading ?? 0;
}

function shadow(ctx, rx, ry, a = 0.3, ox = 2.5, oy = 3.5) {
  ctx.fillStyle = `rgba(4, 30, 40, ${a})`;
  ctx.beginPath(); ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

function hull(ctx, L, B, fill, deck, stroke, stern = 0.85) {
  ctx.beginPath();
  ctx.moveTo(L, 0);
  ctx.quadraticCurveTo(L * 0.35, -B * 1.15, -L * stern, -B * 0.8);
  ctx.lineTo(-L * stern - 1.5, 0);
  ctx.lineTo(-L * stern, B * 0.8);
  ctx.quadraticCurveTo(L * 0.35, B * 1.15, L, 0);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1.3; ctx.strokeStyle = stroke; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(L * 0.8, 0);
  ctx.quadraticCurveTo(L * 0.3, -B * 0.8, -L * stern * 0.85, -B * 0.55);
  ctx.lineTo(-L * stern * 0.85, B * 0.55);
  ctx.quadraticCurveTo(L * 0.3, B * 0.8, L * 0.8, 0);
  ctx.fillStyle = deck; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.6;
  for (let x = -L * 0.6; x < L * 0.6; x += 3) { ctx.beginPath(); ctx.moveTo(x, -B * 0.5); ctx.lineTo(x, B * 0.5); ctx.stroke(); }
}

// Gunports along both sides; the side about to fire glows.
function gunports(ctx, L, B, n, glowSide, glow) {
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const x = -L * 0.5 + (i + 0.5) * (L * 1.0 / n);
      const lit = glowSide === side || glowSide === 0;
      ctx.fillStyle = lit && glow > 0 ? `rgba(255, ${140 + 80 * glow}, 60, ${0.5 + 0.5 * glow})` : '#1a120c';
      ctx.fillRect(x - 1.2, side * B * 0.86 - 1.1, 2.4, 2.2);
      if (lit && glow > 0) {
        ctx.fillStyle = `rgba(255, 150, 60, ${0.35 * glow})`;
        ctx.beginPath(); ctx.arc(x, side * B * 1.15, 3 + glow * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

function windupGlow(e) {
  return e.gunWindup > 0 && e.gunWindupMax ? 1 - e.gunWindup / e.gunWindupMax : 0;
}

function broadsideSide(e, boat) {
  if (!boat) return 1;
  const h = e.heading || 0; const nx = -Math.sin(h); const ny = Math.cos(h);
  return Math.sign(nx * (boat.x - e.x) + ny * (boat.y - e.y)) || 1;
}

function squareSail(ctx, x, span, depth, color, trim, billow) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, -span);
  ctx.quadraticCurveTo(x + depth * (1 + billow), 0, x, span);
  ctx.lineTo(x - depth * 0.35, span * 0.9);
  ctx.quadraticCurveTo(x + depth * 0.4, 0, x - depth * 0.35, -span * 0.9);
  ctx.closePath(); ctx.fill();
  if (trim) { ctx.strokeStyle = trim; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.strokeStyle = '#3b2616'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x - 0.5, -span * 1.05); ctx.lineTo(x - 0.5, span * 1.05); ctx.stroke();
}

function flag(ctx, x, y, t, color = '#111') {
  const w = Math.sin(t * 9) * 1.2;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 3, y - 2 + w, x - 6, y - 1 + w); ctx.lineTo(x - 6, y + 2.5 + w); ctx.quadraticCurveTo(x - 3, y + 3 + w, x, y + 3); ctx.fill();
  ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(x - 3, y + 1 + w * 0.5, 0.8, 0, Math.PI * 2); ctx.fill();
}

function drawCutter(ctx, e, color, t, boat) {
  const r = e.radius; const L = r * 1.45; const B = r * 0.6;
  shadow(ctx, L, B * 1.1);
  ctx.save(); ctx.rotate(facingOf(e));
  hull(ctx, L, B, '#5a3a22', '#a9794a', '#24160c');
  // Bow chaser gun
  const g = windupGlow(e);
  ctx.fillStyle = '#222'; ctx.fillRect(L * 0.55, -1, L * 0.35, 2);
  if (g > 0) { ctx.fillStyle = `rgba(255, 160, 60, ${g})`; ctx.beginPath(); ctx.arc(L * 0.95, 0, 1.5 + g * 3, 0, Math.PI * 2); ctx.fill(); }
  // Gaff sail, red
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(r * 0.15, 0); ctx.quadraticCurveTo(-r * 0.3, -r * 1.35, -r * 1.05, -r * 0.9); ctx.lineTo(-r * 0.95, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(60,10,10,0.8)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.strokeStyle = '#3b2616'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(r * 0.15, 0); ctx.lineTo(-r * 0.95, 0); ctx.stroke();
  ctx.fillStyle = '#2b1a0e'; ctx.beginPath(); ctx.arc(r * 0.15, 0, 1.6, 0, Math.PI * 2); ctx.fill();
  flag(ctx, -L * 0.85, -1.5, t + e.id);
  ctx.restore();
}

function drawBrig(ctx, e, color, t, boat, big = false) {
  const r = e.radius; const L = r * 1.5; const B = r * 0.62;
  shadow(ctx, L * 1.02, B * 1.2, 0.34, 3, 4.5);
  ctx.save(); ctx.rotate(facingOf(e));
  hull(ctx, L, B, big ? '#2a1d17' : '#4a2e1b', big ? '#6b4a33' : '#94683f', '#140c07', 0.9);
  if (big) {
    // Raised stern castle with lit windows.
    ctx.fillStyle = '#3a2a20'; ctx.fillRect(-L * 0.9, -B * 0.62, L * 0.32, B * 1.24);
    ctx.fillStyle = '#ffcf6b';
    for (const y of [-B * 0.35, 0, B * 0.35]) ctx.fillRect(-L * 0.92, y - 1, 1.6, 2);
  }
  const g = windupGlow(e);
  const side = e.gun?.bothSides ? 0 : broadsideSide(e, boat);
  gunports(ctx, L, B, big ? 5 : 3, side, g);
  const billow = 0.25 + Math.sin(t * 1.6 + e.id) * 0.1;
  const masts = big ? [L * 0.45, 0, -L * 0.42] : [L * 0.25, -L * 0.3];
  for (const x of masts) squareSail(ctx, x, B * (big ? 1.45 : 1.3), r * 0.35, color, big ? '#8b1a1a' : null, billow);
  if (big) {
    // A skull on the main sail.
    ctx.fillStyle = '#e8e2d0';
    ctx.beginPath(); ctx.arc(r * 0.12, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(r * 0.12, -1.1, 0.8, 0, Math.PI * 2); ctx.arc(r * 0.12, 1.1, 0.8, 0, Math.PI * 2); ctx.fill();
  }
  flag(ctx, -L * 0.95, -2, t + e.id, big ? '#111' : '#1a1a1a');
  ctx.restore();
}

function sharkBody(ctx, r, color, t, e, alpha) {
  ctx.globalAlpha *= alpha;
  const sway = Math.sin(t * 10 + e.id) * 0.25;
  // Tail
  ctx.fillStyle = color;
  ctx.save(); ctx.translate(-r * 1.2, 0); ctx.rotate(sway);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.7, -r * 0.6); ctx.lineTo(-r * 0.45, 0); ctx.lineTo(-r * 0.7, r * 0.6); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Pectoral fins
  ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.3); ctx.lineTo(-r * 0.3, -r * 0.95); ctx.lineTo(-r * 0.1, -r * 0.25); ctx.fill();
  ctx.beginPath(); ctx.moveTo(r * 0.2, r * 0.3); ctx.lineTo(-r * 0.3, r * 0.95); ctx.lineTo(-r * 0.1, r * 0.25); ctx.fill();
  // Body
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.35, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.12, r * 1.0, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha /= alpha;
}

function drawShark(ctx, e, color, t, boat, boss = false) {
  const r = e.radius;
  ctx.save(); ctx.rotate(facingOf(e));
  const state = e.sharkState;
  if (e.invulnerable) {
    // Deep dive: only a big shadow.
    ctx.fillStyle = 'rgba(10, 30, 40, 0.45)';
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.5, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const up = state === 'charging' || state === 'stunned' ? 1 : state === 'windup' ? 0.9 : 0.7;
  // Dark outline under the body so the grey shark reads on bright water.
  ctx.fillStyle = `rgba(10, 30, 40, ${0.35 * up})`;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.45, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  sharkBody(ctx, r, color, t, e, up);
  if (boss) {
    ctx.strokeStyle = 'rgba(160, 30, 40, 0.8)'; ctx.lineWidth = 1.2;
    for (const k of [-0.3, 0.1, 0.5]) { ctx.beginPath(); ctx.moveTo(k * r, -r * 0.35); ctx.lineTo(k * r + 3, r * 0.1); ctx.stroke(); }
  }
  // Dorsal fin cutting the water, with a V of foam.
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(r * 0.35, 0); ctx.lineTo(-r * 0.25, -r * 0.12); ctx.lineTo(-r * 0.05, 0); ctx.lineTo(-r * 0.25, r * 0.12); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(240, 252, 250, 0.8)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(r * 0.45, 0); ctx.lineTo(-r * 0.2, -r * 0.35); ctx.moveTo(r * 0.45, 0); ctx.lineTo(-r * 0.2, r * 0.35); ctx.stroke();
  if (state === 'charging') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(r * 1.35, (k - 1.5) * 2.2, 1.4, 0, Math.PI * 2); ctx.fill(); }
  }
  // Eyes
  ctx.fillStyle = state === 'windup' || state === 'charging' ? '#ff3b30' : '#111';
  ctx.beginPath(); ctx.arc(r * 0.95, -r * 0.2, 1.1, 0, Math.PI * 2); ctx.arc(r * 0.95, r * 0.2, 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (state === 'stunned') {
    ctx.fillStyle = '#ffe36b';
    for (let k = 0; k < 3; k++) {
      const a = t * 5 + (k * Math.PI * 2) / 3;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.8, -r * 0.9 + Math.sin(a) * 2.5, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawSerpent(ctx, e, color, t) {
  const r = e.radius;
  if (e.invulnerable) {
    // Submerged: a sinuous dark shape and a trail of ripples.
    ctx.save(); ctx.rotate(facingOf(e));
    ctx.strokeStyle = 'rgba(10, 45, 45, 0.5)'; ctx.lineWidth = r * 0.8; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) { const x = r * 1.2 - k * r * 0.45; const y = Math.sin(t * 6 - k * 0.9) * r * 0.35; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(230, 250, 245, 0.35)'; ctx.lineWidth = 1;
    const ph = (t * 1.5 + e.id * 0.2) % 1;
    ctx.beginPath(); ctx.arc(0, 0, r * (0.6 + ph * 1.2), 0, Math.PI * 2); ctx.stroke();
    return;
  }
  ctx.save(); ctx.rotate(facingOf(e));
  // Coils breaking the surface behind the head.
  for (let k = 3; k >= 1; k--) {
    const x = -k * r * 0.75; const y = Math.sin(t * 3 + k * 1.3) * r * 0.35;
    ctx.fillStyle = 'rgba(230, 250, 245, 0.55)';
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.62, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = k % 2 ? color : '#256e58';
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.5, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9e8a0';
    ctx.beginPath(); ctx.ellipse(x + 1, y - r * 0.12, r * 0.22, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Head with a frill; the mouth glows before it spits.
  const g = windupGlow(e);
  ctx.fillStyle = '#1f5e4b';
  ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.9); ctx.lineTo(r * 0.25, -r * 0.2); ctx.lineTo(r * 0.25, r * 0.2); ctx.lineTo(-r * 0.1, r * 0.9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(r * 0.45, 0, r * 0.7, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = g > 0 ? `rgba(160, 255, 90, ${0.5 + 0.5 * g})` : '#153f33';
  ctx.beginPath(); ctx.ellipse(r * 1.05, 0, r * 0.18 + g * 2, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe36b';
  ctx.beginPath(); ctx.arc(r * 0.6, -r * 0.22, 1.3, 0, Math.PI * 2); ctx.arc(r * 0.6, r * 0.22, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Drawn a little larger than the collision circle so silhouettes read at
// phone size (the hit circle stays honest; the art just has more detail).
const scaled = (k, fn) => (ctx, e, c, t, boat) => { ctx.save(); ctx.scale(k, k); fn(ctx, e, c, t, boat); ctx.restore(); };
export const SPRITES = {
  pirate_cutter: scaled(1.3, (ctx, e, c, t, boat) => drawCutter(ctx, e, c, t, boat)),
  pirate_brig: scaled(1.25, (ctx, e, c, t, boat) => drawBrig(ctx, e, c, t, boat, false)),
  pirate_flagship: scaled(1.15, (ctx, e, c, t, boat) => drawBrig(ctx, e, c, t, boat, true)),
  reef_shark: scaled(1.3, (ctx, e, c, t, boat) => drawShark(ctx, e, c, t, boat, false)),
  bloodfin_matriarch: scaled(1.2, (ctx, e, c, t, boat) => drawShark(ctx, e, c, t, boat, true)),
  sea_serpent: scaled(1.3, (ctx, e, c, t) => drawSerpent(ctx, e, c, t)),
  warding_seal: (ctx, e, c, t) => drawSeal(ctx, e, c, t),
};

// Telegraphs, drawn under the enemies: an aimed gun's sighting line, a
// shark's charge lane. Red/orange means "this is coming at you".
export function drawAttackTelegraphs(ctx, enemies, t) {
  ctx.save();
  for (const e of enemies) {
    if (e.health <= 0) continue;
    if (e.gunWindup > 0 && e.gun && e.gun.pattern === 'aimed' && e.gunAimX != null) {
      const g = windupGlow(e);
      ctx.strokeStyle = `rgba(255, 120, 60, ${0.25 + 0.55 * g})`;
      ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]); ctx.lineDashOffset = -t * 30;
      const n = e.gun.count || 1;
      const a0 = Math.atan2(e.gunAimY - e.y, e.gunAimX - e.x);
      const len = Math.min(e.gun.range, Math.hypot(e.gunAimX - e.x, e.gunAimY - e.y) + 20);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i - (n - 1) / 2) * (e.gun.spread || 0);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a) * len, e.y + Math.sin(a) * len); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    if (e.sharkState === 'windup' && e.chargeTargetX != null) {
      const a = Math.atan2(e.chargeTargetY - e.y, e.chargeTargetX - e.x);
      const pulse = 0.5 + 0.5 * Math.sin(t * 22);
      const len = 260 * 0.7 + 20;
      ctx.fillStyle = `rgba(255, 60, 50, ${0.12 + 0.12 * pulse})`;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      ctx.fillRect(0, -e.radius, len, e.radius * 2);
      ctx.strokeStyle = `rgba(255, 80, 60, ${0.6 + 0.3 * pulse})`; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
      ctx.strokeRect(0, -e.radius, len, e.radius * 2);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
  ctx.restore();
}

export function drawEnemyProjectiles(ctx, shots, t) {
  for (const s of shots) {
    const sp = Math.hypot(s.vx, s.vy) || 1;
    const tx = -s.vx / sp; const ty = -s.vy / sp;
    if (s.kind === 'glob') {
      ctx.fillStyle = 'rgba(140, 255, 90, 0.35)';
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(s.x + tx * k * 4, s.y + ty * k * 4, s.radius * (1 - k * 0.2), 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#9bff5a';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f6d1a'; ctx.beginPath(); ctx.arc(s.x + 1, s.y + 1, s.radius * 0.4, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    // Iron shot with a hot orange halo and smoke trail: enemy fire reads
    // differently from your own dark cannonballs.
    ctx.fillStyle = 'rgba(80, 80, 80, 0.3)';
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(s.x + tx * k * 5, s.y + ty * k * 5, s.radius * (0.9 - k * 0.15), 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = `rgba(255, 110, 40, ${0.45 + 0.2 * Math.sin(t * 20 + s.id)})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.radius + 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(s.x - s.radius * 0.35, s.y - s.radius * 0.35, s.radius * 0.3, 0, Math.PI * 2); ctx.fill();
  }
}

import { drawSeal } from './armamentArt.mjs';
// Code-drawn sprites for the 2026-09-29 roster (pirate ships, sharks, the
// sea serpent, the stage bosses) plus enemy shots and attack telegraphs.
// Everything hostile that's about to hurt you is marked in red/orange: a
// sighting line, glowing gunports, a charge lane. renderer.mjs delegates
// here by enemy id (SPRITES).

export function facingOf(e) {
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

export function windupGlow(e) {
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

// Raider Longboat (survival horde): a narrow rowboat, oars sweeping in
// time, a little square sail in its crew's colour and a lantern at the bow.
function drawLongboat(ctx, e, color, t) {
  const r = e.radius; const L = r * 1.5; const B = r * 0.5;
  shadow(ctx, L, B * 1.2, 0.28);
  ctx.save(); ctx.rotate(facingOf(e));
  const stroke = Math.sin(t * 7 + e.id * 1.3);
  ctx.strokeStyle = '#3b2616'; ctx.lineWidth = 1; ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const x = -L * 0.45 + k * L * 0.42;
      ctx.beginPath(); ctx.moveTo(x, side * B * 0.7); ctx.lineTo(x - 2 + stroke * 2.2, side * B * 2.1); ctx.stroke();
    }
  }
  hull(ctx, L, B, '#6b4426', '#b88a55', '#2a1a0c', 0.9);
  // Crew: three heads in a row.
  ctx.fillStyle = '#2a1e18';
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-L * 0.45 + k * L * 0.42, 0, 1.3, 0, Math.PI * 2); ctx.fill(); }
  // Square sail on a short mast, billowing.
  const bil = 0.5 + Math.sin(t * 2 + e.id) * 0.15;
  squareSail(ctx, r * 0.1, r * 0.85, r * 0.5, color, 'rgba(40,10,10,0.6)', bil);
  ctx.fillStyle = 'rgba(255, 220, 140, 0.9)'; ctx.beginPath(); ctx.arc(L * 0.82, 0, 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Fire Ship: a tarred hulk stacked with powder kegs. Once kindled its sail
// is ablaze and it trails fire.
function drawFireShip(ctx, e, color, t) {
  const r = e.radius; const L = r * 1.4; const B = r * 0.62;
  shadow(ctx, L, B * 1.1);
  ctx.save(); ctx.rotate(facingOf(e));
  hull(ctx, L, B, '#2e1f14', '#5a3a22', '#120a05');
  ctx.fillStyle = '#7a4a22';
  for (const [x, y] of [[L * 0.35, -B * 0.3], [L * 0.35, B * 0.3], [0, 0], [-L * 0.35, -B * 0.3], [-L * 0.35, B * 0.3]]) {
    ctx.beginPath(); ctx.arc(x, y, 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3b3f44'; ctx.fillRect(x - 2.3, y - 0.5, 4.6, 1); ctx.fillStyle = '#7a4a22';
  }
  const lit = e.kindled ? 1 : Math.max(0, 1 - (e.kindleTimer ?? 1) / 0.9) * (e.aggro ? 1 : 0);
  // Sail: tattered tar-black, burning once lit.
  ctx.fillStyle = lit > 0 ? `rgb(${80 + lit * 150}, ${40 + lit * 60}, 20)` : '#2a2420';
  ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 1.05); ctx.quadraticCurveTo(-r * 0.2, 0, r * 0.2, r * 1.05); ctx.lineTo(-r * 0.25, r * 0.9); ctx.lineTo(-r * 0.4, -r * 0.9); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3b2616'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.lineTo(0, r * 1.1); ctx.stroke();
  ctx.restore();
  if (lit > 0) {
    // Flames licking up off the deck, leaning back from the direction of travel.
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const ph = (t * 2.2 + i / 7 + e.id * 0.13) % 1;
      const a = (i / 7) * Math.PI * 2 + e.id;
      const x = Math.cos(a) * r * 0.5; const y = Math.sin(a) * r * 0.35 - ph * 12;
      ctx.fillStyle = `rgba(255, ${140 + (1 - ph) * 100}, 40, ${(1 - ph) * 0.8 * lit})`;
      ctx.beginPath(); ctx.arc(x, y, (3.5 - ph * 2.5) * (0.6 + lit * 0.4), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

// Mortar Gunboat: a squat, low hull built around one fat mortar.
function drawMortarBoat(ctx, e, color, t) {
  const r = e.radius; const L = r * 1.2; const B = r * 0.78;
  shadow(ctx, L, B * 1.1);
  ctx.save(); ctx.rotate(facingOf(e));
  hull(ctx, L, B, '#3d4a2a', '#6f7b4f', '#1c2412', 0.95);
  ctx.fillStyle = color; ctx.fillRect(-L * 0.75, -B * 0.55, L * 0.35, B * 1.1); // wheelhouse
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(-L * 0.75, -B * 0.55, L * 0.35, 2);
  ctx.restore();
  // The mortar points up: seen from above, a ringed muzzle that glows as it
  // winds up to fire.
  const g = windupGlow(e);
  ctx.fillStyle = '#2b2f33'; ctx.beginPath(); ctx.arc(1, 0, r * 0.52, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6a7076'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(1, 0, r * 0.52, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = g > 0 ? `rgb(${60 + g * 195}, ${40 + g * 120}, 30)` : '#0e0f10';
  ctx.beginPath(); ctx.arc(1, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
  if (g > 0.6) {
    ctx.fillStyle = `rgba(200, 200, 200, ${(g - 0.6) * 1.5})`;
    ctx.beginPath(); ctx.arc(1 + Math.sin(t * 20) * 1.5, -4, 3, 0, Math.PI * 2); ctx.fill();
  }
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

const SERPENT_PAL = { dark: '#256e58', belly: '#c9e8a0', frill: '#1f5e4b', mouth: '#153f33', glow: '160, 255, 90', eye: '#ffe36b', shadow: '10, 45, 45' };
const FROST_PAL = { dark: '#5e93b0', belly: '#f1fbff', frill: '#3d6f8e', mouth: '#1b3a52', glow: '150, 230, 255', eye: '#dff8ff', shadow: '20, 50, 80' };

function drawSerpent(ctx, e, color, t, pal = SERPENT_PAL) {
  const r = e.radius;
  if (e.invulnerable) {
    // Submerged: a sinuous dark shape and a trail of ripples.
    ctx.save(); ctx.rotate(facingOf(e));
    ctx.strokeStyle = `rgba(${pal.shadow}, 0.5)`; ctx.lineWidth = r * 0.8; ctx.lineCap = 'round';
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
    ctx.fillStyle = k % 2 ? color : pal.dark;
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.5, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.belly;
    ctx.beginPath(); ctx.ellipse(x + 1, y - r * 0.12, r * 0.22, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Head with a frill; the mouth glows before it spits.
  const g = windupGlow(e);
  ctx.fillStyle = pal.frill;
  ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.9); ctx.lineTo(r * 0.25, -r * 0.2); ctx.lineTo(r * 0.25, r * 0.2); ctx.lineTo(-r * 0.1, r * 0.9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(r * 0.45, 0, r * 0.7, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = g > 0 ? `rgba(${pal.glow}, ${0.5 + 0.5 * g})` : pal.mouth;
  ctx.beginPath(); ctx.ellipse(r * 1.05, 0, r * 0.18 + g * 2, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = pal.eye;
  ctx.beginPath(); ctx.arc(r * 0.6, -r * 0.22, 1.3, 0, Math.PI * 2); ctx.arc(r * 0.6, r * 0.22, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}


// ---- Glacial roster ----

// Frost Narwhal: a pale shark-like body with a long spiral tusk.
function drawNarwhal(ctx, e, color, t, boat) {
  drawShark(ctx, e, color, t, boat, false);
  if (e.invulnerable) return;
  const r = e.radius;
  ctx.save(); ctx.rotate(facingOf(e));
  ctx.strokeStyle = '#fbf6e4'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(r * 1.3, 0); ctx.lineTo(r * 2.6, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(120, 110, 80, 0.7)'; ctx.lineWidth = 0.6;
  for (let x = r * 1.45; x < r * 2.5; x += 2.2) { ctx.beginPath(); ctx.moveTo(x, -0.9); ctx.lineTo(x + 1.2, 0.9); ctx.stroke(); }
  // Mottled back
  ctx.fillStyle = 'rgba(90, 120, 140, 0.45)';
  for (const [x, y] of [[-r * 0.3, -r * 0.1], [r * 0.2, r * 0.12], [-r * 0.8, r * 0.05]]) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// Ice Golem: a hunched block of glacier wading through the water, with a
// glowing core that brightens as it winds up its slam.
function drawIceGolem(ctx, e, color, t) {
  const r = e.radius;
  shadow(ctx, r * 1.1, r * 0.8, 0.35);
  // Churned water ring
  ctx.strokeStyle = 'rgba(240, 250, 255, 0.55)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, r * (1.05 + 0.08 * Math.sin(t * 3 + e.id)), 0, Math.PI * 2); ctx.stroke();
  ctx.save(); ctx.rotate(facingOf(e));
  const g = windupGlow(e);
  // Shoulder blocks
  const block = (x, y, w, h, c) => {
    ctx.fillStyle = c; ctx.beginPath();
    ctx.moveTo(x - w, y - h * 0.6); ctx.lineTo(x - w * 0.4, y - h); ctx.lineTo(x + w, y - h * 0.7);
    ctx.lineTo(x + w * 0.8, y + h * 0.8); ctx.lineTo(x - w * 0.6, y + h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6ea4c2'; ctx.lineWidth = 0.9; ctx.stroke();
  };
  const lift = g * 2;
  block(r * 0.15, -r * 0.85 - lift, r * 0.45, r * 0.4, '#d6eef8');
  block(r * 0.15, r * 0.85 + lift, r * 0.45, r * 0.4, '#d6eef8');
  block(-r * 0.15, 0, r * 0.8, r * 0.75, color);
  // Facets
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.4); ctx.lineTo(-r * 0.1, -r * 0.6); ctx.lineTo(-r * 0.2, -r * 0.1); ctx.closePath(); ctx.fill();
  // Head and glowing core
  ctx.fillStyle = '#eef9ff'; ctx.beginPath(); ctx.arc(r * 0.6, 0, r * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(110, 210, 255, ${0.55 + 0.45 * g})`;
  ctx.beginPath(); ctx.arc(-r * 0.1, 0, r * (0.22 + 0.15 * g), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1b4a66';
  ctx.beginPath(); ctx.arc(r * 0.72, -r * 0.12, 1, 0, Math.PI * 2); ctx.arc(r * 0.72, r * 0.12, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Frost Wisp: a floating cold flame with a ground shadow (it flies).
function drawFrostWisp(ctx, e, color, t) {
  const r = e.radius;
  const bob = Math.sin(t * 4 + e.id) * 2;
  ctx.fillStyle = 'rgba(4, 30, 40, 0.22)';
  ctx.beginPath(); ctx.ellipse(6, 10, r * 0.8, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  const g = windupGlow(e);
  ctx.save(); ctx.translate(0, -6 + bob); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 5; k++) {
    const ph = (t * 1.8 + k / 5 + e.id * 0.17) % 1;
    ctx.fillStyle = `rgba(150, 225, 255, ${(1 - ph) * 0.45})`;
    ctx.beginPath(); ctx.arc(Math.sin(k * 2.1 + t * 3) * r * 0.3, r * 0.2 + ph * r * 1.2, r * (0.55 - ph * 0.35), 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = `rgba(120, 210, 255, ${0.5 + 0.4 * g})`;
  ctx.beginPath(); ctx.arc(0, 0, r * (0.95 + g * 0.35), 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#f2fcff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a6a8e';
  ctx.beginPath(); ctx.arc(-r * 0.18, -r * 0.08, 1, 0, Math.PI * 2); ctx.arc(r * 0.18, -r * 0.08, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---- Shipwreck roster ----

// Ghost ship: a spectral, glowing hulk with torn sails. Faded out (phased)
// it's a flickering outline you can't hit; solid it glows fully.
function drawGhostShip(ctx, e, color, t, boat, big = false) {
  const r = e.radius; const L = r * 1.5; const B = r * 0.62;
  const a = e.phased ? 0.28 + 0.1 * Math.sin(t * 12 + e.id) : 1;
  ctx.save();
  ctx.globalAlpha *= a;
  if (!e.phased) shadow(ctx, L, B * 1.1, 0.3);
  // Eerie glow under the hull
  ctx.fillStyle = `rgba(110, 255, 200, ${e.phased ? 0.25 : 0.2})`;
  ctx.beginPath(); ctx.ellipse(0, 0, L * 1.2, B * 1.9, facingOf(e), 0, Math.PI * 2); ctx.fill();
  ctx.rotate(facingOf(e));
  hull(ctx, L, B, big ? '#1f3530' : '#2a3a34', big ? '#3f5c52' : '#4e6a5e', color, 0.9);
  // Broken planks: dark holes in the deck
  ctx.fillStyle = '#0c1714';
  for (const [x, y] of [[L * 0.3, -B * 0.2], [-L * 0.25, B * 0.25], [-L * 0.55, -B * 0.1]]) { ctx.beginPath(); ctx.ellipse(x, y, 2.2, 1.3, 0.4, 0, Math.PI * 2); ctx.fill(); }
  const g = windupGlow(e);
  const side = e.gun?.bothSides ? 0 : broadsideSide(e, boat);
  // Spectral gunports glow green
  for (const sd of [-1, 1]) {
    const n = big ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const x = -L * 0.5 + (i + 0.5) * (L / n);
      const lit = (side === sd || side === 0) && g > 0;
      ctx.fillStyle = lit ? `rgba(140, 255, 210, ${0.5 + 0.5 * g})` : '#0e1f1a';
      ctx.fillRect(x - 1.2, sd * B * 0.86 - 1.1, 2.4, 2.2);
      if (lit) { ctx.fillStyle = `rgba(120, 255, 200, ${0.35 * g})`; ctx.beginPath(); ctx.arc(x, sd * B * 1.15, 3 + g * 3, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // Tattered sails, see-through
  const masts = big ? [L * 0.45, 0, -L * 0.42] : [L * 0.25, -L * 0.3];
  for (const x of masts) {
    const span = B * (big ? 1.45 : 1.3);
    ctx.fillStyle = 'rgba(200, 255, 235, 0.45)';
    ctx.beginPath(); ctx.moveTo(x, -span);
    ctx.quadraticCurveTo(x + r * 0.45, -span * 0.3, x + r * 0.2, 0);
    ctx.lineTo(x + r * 0.35, span * 0.35); ctx.lineTo(x + r * 0.05, span * 0.55); ctx.lineTo(x, span);
    ctx.lineTo(x - r * 0.12, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1c2a25'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - 0.5, -span * 1.05); ctx.lineTo(x - 0.5, span * 1.05); ctx.stroke();
  }
  if (big) {
    // The Admiral: a glowing skull-and-anchor on his stern castle.
    ctx.fillStyle = '#16302a'; ctx.fillRect(-L * 0.9, -B * 0.62, L * 0.32, B * 1.24);
    ctx.fillStyle = color;
    for (const y of [-B * 0.35, 0, B * 0.35]) ctx.fillRect(-L * 0.92, y - 1, 1.6, 2);
    ctx.fillStyle = '#d9fff0'; ctx.beginPath(); ctx.arc(r * 0.1, 0, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d1f1a'; ctx.beginPath(); ctx.arc(r * 0.1, -1.1, 0.9, 0, Math.PI * 2); ctx.arc(r * 0.1, 1.1, 0.9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Wisps of mist trailing off
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.8 + k / 4 + e.id * 0.11) % 1;
    const ang = facingOf(e) + Math.PI + (k - 1.5) * 0.35;
    ctx.fillStyle = `rgba(120, 255, 210, ${(1 - ph) * 0.18})`;
    ctx.beginPath(); ctx.arc(Math.cos(ang) * (L * 0.6 + ph * 16), Math.sin(ang) * (L * 0.6 + ph * 16), 3 + ph * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Drowned Skiff: a waterlogged rowboat crewed by skeletons, weed trailing.
function drawDrownedSkiff(ctx, e, color, t) {
  const r = e.radius; const L = r * 1.35; const B = r * 0.62;
  shadow(ctx, L, B * 1.1, 0.28);
  ctx.save(); ctx.rotate(facingOf(e));
  hull(ctx, L, B, '#3f4a3c', '#5c6a55', '#1a2018', 0.9);
  // Seaweed trailing off the stern
  ctx.strokeStyle = 'rgba(70, 120, 60, 0.8)'; ctx.lineWidth = 1;
  for (const y of [-B * 0.4, B * 0.4]) {
    ctx.beginPath(); ctx.moveTo(-L * 0.8, y);
    ctx.quadraticCurveTo(-L * 1.1, y + Math.sin(t * 4 + y) * 2, -L * 1.35, y + Math.sin(t * 4 + y + 1) * 3); ctx.stroke();
  }
  // Two skeletal rowers
  for (const x of [L * 0.2, -L * 0.3]) {
    ctx.fillStyle = '#e6e2cf'; ctx.beginPath(); ctx.arc(x, 0, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d1d1a'; ctx.beginPath(); ctx.arc(x + 0.8, -0.7, 0.55, 0, Math.PI * 2); ctx.arc(x + 0.8, 0.7, 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a7a58'; ctx.lineWidth = 1;
    const sw = Math.sin(t * 9 + e.id + x) * 1.5;
    ctx.beginPath(); ctx.moveTo(x, -B * 0.5); ctx.lineTo(x - 2 + sw, -B * 1.4); ctx.moveTo(x, B * 0.5); ctx.lineTo(x - 2 + sw, B * 1.4); ctx.stroke();
  }
  // Green lantern at the bow
  ctx.fillStyle = `rgba(150, 255, 190, ${0.6 + 0.3 * Math.sin(t * 5 + e.id)})`;
  ctx.beginPath(); ctx.arc(L * 0.7, 0, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Siren: sits on a small rock, hair streaming; while she sings, rings of
// notes pulse outward (that's the pull).
function drawSiren(ctx, e, color, t) {
  const r = e.radius;
  if (e.singing) {
    ctx.save();
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.7 + k / 3) % 1;
      ctx.strokeStyle = `rgba(255, 170, 220, ${(1 - ph) * 0.5})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r + ph * 60, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 200, 235, 0.85)'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.5 + k / 3 + e.id * 0.1) % 1;
      const a = k * 2.1 + t * 0.4;
      ctx.globalAlpha = 1 - ph;
      ctx.fillText(k % 2 ? '♪' : '♫', Math.cos(a) * (r + ph * 30), Math.sin(a) * (r + ph * 30) - 4);
    }
    ctx.restore();
  }
  shadow(ctx, r * 1.1, r * 0.7, 0.3);
  // Rock
  ctx.fillStyle = '#5c5a58';
  ctx.beginPath(); ctx.ellipse(0, 2, r * 1.05, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a7874';
  ctx.beginPath(); ctx.ellipse(-1.5, 0.5, r * 0.8, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(240, 250, 250, 0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, 2, r * 1.15, r * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
  // Tail curled on the rock
  ctx.fillStyle = '#3aa89a';
  ctx.beginPath(); ctx.moveTo(-1, 2); ctx.quadraticCurveTo(r * 0.8, r * 0.6, r * 0.5, -r * 0.1); ctx.lineTo(r * 0.9, -r * 0.3); ctx.lineTo(r * 0.75, r * 0.05); ctx.quadraticCurveTo(r * 0.9, r * 0.9, -2, 4); ctx.fill();
  // Body and flowing hair
  const sway = Math.sin(t * 2 + e.id) * 1.5;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.4); ctx.quadraticCurveTo(-r * 1.1, -r * 0.2 + sway, -r * 1.0, r * 0.6 + sway); ctx.quadraticCurveTo(-r * 0.5, r * 0.2, -r * 0.1, r * 0.1); ctx.fill();
  ctx.fillStyle = '#f2d2b8';
  ctx.beginPath(); ctx.ellipse(-r * 0.05, -r * 0.05, r * 0.28, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-r * 0.1, -r * 0.5, r * 0.24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.58, r * 0.22, Math.PI * 0.6, Math.PI * 1.9); ctx.fill();
  ctx.fillStyle = e.singing ? '#ff5fa8' : '#6a2848';
  ctx.beginPath(); ctx.arc(-r * 0.02, -r * 0.44, 0.9, 0, Math.PI * 2); ctx.fill();
}

// Frost Leviathan: the serpent in ice colours, with a crown of ice spikes.
function drawLeviathan(ctx, e, color, t, boat) {
  if (e.archetype === 'tank') {
    // Phase 2: reared up out of the water, rings of ice around it.
    const r = e.radius; const g = windupGlow(e);
    shadow(ctx, r * 1.2, r * 0.9, 0.35);
    ctx.strokeStyle = `rgba(200, 240, 255, ${0.4 + 0.5 * g})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * (1.2 + g * 0.5), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5e93b0'; ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.rotate(facingOf(e));
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(r * 0.35, 0, r * 0.65, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(150, 230, 255, ${0.5 + 0.5 * g})`; ctx.beginPath(); ctx.ellipse(r * 0.9, 0, r * 0.2 + g * 3, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dff8ff'; ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.22, 1.5, 0, Math.PI * 2); ctx.arc(r * 0.5, r * 0.22, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else {
    drawSerpent(ctx, e, color, t, FROST_PAL);
  }
  if (e.invulnerable && e.archetype !== 'tank') return;
  // Ice crown
  ctx.save(); ctx.rotate(facingOf(e));
  ctx.fillStyle = '#eefaff'; ctx.strokeStyle = '#6ea4c2'; ctx.lineWidth = 0.8;
  const r = e.radius;
  for (let k = -2; k <= 2; k++) {
    const a = k * 0.45; const bx = r * 0.3 + Math.cos(a) * r * 0.3; const by = Math.sin(a) * r * 0.45;
    ctx.beginPath(); ctx.moveTo(bx, by - 1.5); ctx.lineTo(bx - r * 0.55, by + k * 1.5); ctx.lineTo(bx, by + 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}


// ==== Stages 5-10 sprites (2026-09-29) ====
const TAU2 = Math.PI * 2;
const MAGMA_PAL = { dark: '#5a2014', belly: '#ffcf6b', frill: '#3a1a12', mouth: '#2a0a04', glow: '255, 170, 60', eye: '#ffe07a', shadow: '60, 20, 10' };
const SAND_PAL = { dark: '#8a5a30', belly: '#f2d6a0', frill: '#6a4424', mouth: '#3a2210', glow: '255, 220, 150', eye: '#1a1008', shadow: '90, 60, 30' };
const ABYSS_PAL = { dark: '#2a1a5a', belly: '#9affff', frill: '#1a1040', mouth: '#0a0620', glow: '120, 240, 255', eye: '#ff7ad9', shadow: '10, 5, 30' };

// Wings for bats, the cinder bat and the vulture: flapping, seen from above.
function wings(ctx, r, color, t, e, { span = 1.3, bat = true, dark = 'rgba(0,0,0,0.35)' } = {}) {
  const flap = Math.sin(t * 16 + e.id) * 0.5 + 0.5; const sp = r * (span + flap * 0.4);
  ctx.fillStyle = color; ctx.strokeStyle = dark; ctx.lineWidth = 0.8;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(r * 0.3, 0);
    if (bat) {
      ctx.lineTo(-r * 0.1, side * sp); ctx.lineTo(-r * 0.35, side * sp * 0.7); ctx.lineTo(-r * 0.6, side * sp * 0.9); ctx.lineTo(-r * 0.7, side * sp * 0.5); ctx.lineTo(-r * 0.4, side * r * 0.2);
    } else {
      ctx.quadraticCurveTo(-r * 0.1, side * sp * 1.1, -r * 0.9, side * sp); ctx.quadraticCurveTo(-r * 0.4, side * sp * 0.45, -r * 0.5, side * r * 0.15);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}
function airShadow(ctx, r, a = 0.25) { ctx.fillStyle = `rgba(4, 30, 40, ${a})`; ctx.beginPath(); ctx.ellipse(7, 11, r * 0.9, r * 0.5, 0, 0, TAU2); ctx.fill(); }

function drawCinderBat(ctx, e, color, t) {
  const r = e.radius; airShadow(ctx, r);
  ctx.save(); ctx.rotate(facingOf(e));
  wings(ctx, r, '#3a2420', t, e, { span: 1.4 });
  ctx.strokeStyle = 'rgba(255, 120, 40, 0.8)'; ctx.lineWidth = 0.8;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.1, 0); ctx.lineTo(-r * 0.3, s * r * 0.9); ctx.stroke(); }
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r * 0.35, 0, 0, TAU2); ctx.fill();
  ctx.fillStyle = '#ffe07a'; ctx.beginPath(); ctx.arc(r * 0.35, -r * 0.12, 1, 0, TAU2); ctx.arc(r * 0.35, r * 0.12, 1, 0, TAU2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) { const ph = (t * 2 + k / 3 + e.id * 0.1) % 1; ctx.fillStyle = `rgba(255, 140, 40, ${(1 - ph) * 0.6})`; ctx.beginPath(); ctx.arc(-Math.cos(facingOf(e)) * ph * 14, -Math.sin(facingOf(e)) * ph * 14, 2 - ph, 0, TAU2); ctx.fill(); }
  ctx.restore();
}

function drawMagmaGolem(ctx, e, color, t) {
  const r = e.radius; const g = windupGlow(e);
  shadow(ctx, r * 1.1, r * 0.8, 0.35);
  ctx.fillStyle = 'rgba(255, 140, 60, 0.35)'; ctx.beginPath(); ctx.arc(0, 0, r * (1.1 + 0.06 * Math.sin(t * 4 + e.id)), 0, TAU2); ctx.fill();
  ctx.save(); ctx.rotate(facingOf(e));
  const rock = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - w, y - h * 0.4); ctx.lineTo(x - w * 0.3, y - h); ctx.lineTo(x + w, y - h * 0.6); ctx.lineTo(x + w * 0.7, y + h * 0.8); ctx.lineTo(x - w * 0.6, y + h); ctx.closePath(); ctx.fill(); };
  rock(r * 0.1, -r * 0.85 - g * 2, r * 0.45, r * 0.4, '#2a1e1a'); rock(r * 0.1, r * 0.85 + g * 2, r * 0.45, r * 0.4, '#2a1e1a');
  rock(-r * 0.15, 0, r * 0.85, r * 0.75, color);
  // Glowing cracks.
  ctx.strokeStyle = `rgba(255, ${140 + g * 100}, 40, ${0.7 + 0.3 * g})`; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.2); ctx.lineTo(-r * 0.2, r * 0.1); ctx.lineTo(r * 0.3, -r * 0.3); ctx.moveTo(-r * 0.3, r * 0.5); ctx.lineTo(0, r * 0.1); ctx.stroke();
  ctx.fillStyle = '#ffd060'; ctx.beginPath(); ctx.arc(r * 0.6, -r * 0.14, 1.3, 0, TAU2); ctx.arc(r * 0.6, r * 0.14, 1.3, 0, TAU2); ctx.fill();
  ctx.restore();
}

function drawGalley(ctx, e, color, t, boat) {
  const r = e.radius; const L = r * 1.6; const B = r * 0.55;
  shadow(ctx, L, B * 1.2, 0.34, 3, 4.5);
  ctx.save(); ctx.rotate(facingOf(e));
  hull(ctx, L, B, '#1a1616', '#3a3230', '#050404', 0.9);
  // Oars sweeping.
  ctx.strokeStyle = '#6a5040'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) { const x = -L * 0.5 + i * L * 0.22; const sw = Math.sin(t * 6 + i * 0.4) * 3; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, s * B * 0.8); ctx.lineTo(x - 3 + sw, s * B * 1.9); ctx.stroke(); } }
  const g = windupGlow(e);
  gunports(ctx, L, B, 3, broadsideSide(e, boat), g);
  squareSail(ctx, 0, B * 1.4, r * 0.4, color, '#5a1a0a', 0.25 + Math.sin(t * 1.6 + e.id) * 0.1);
  ctx.restore();
}

function drawBat(ctx, e, color, t) {
  const r = e.radius; airShadow(ctx, r, 0.2);
  ctx.save(); ctx.rotate(facingOf(e));
  wings(ctx, r, color, t, e, { span: 1.5 });
  ctx.fillStyle = '#2a1e2a'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.5, r * 0.32, 0, 0, TAU2); ctx.fill();
  ctx.fillStyle = '#2a1e2a'; ctx.beginPath(); ctx.moveTo(r * 0.35, -r * 0.2); ctx.lineTo(r * 0.55, -r * 0.35); ctx.lineTo(r * 0.45, 0); ctx.lineTo(r * 0.55, r * 0.35); ctx.lineTo(r * 0.35, r * 0.2); ctx.fill();
  ctx.fillStyle = '#ff4a3a'; ctx.beginPath(); ctx.arc(r * 0.4, -r * 0.1, 0.9, 0, TAU2); ctx.arc(r * 0.4, r * 0.1, 0.9, 0, TAU2); ctx.fill();
  ctx.restore();
}

// Long-bodied eel/gator/angler: a segmented body that undulates.
function longBody(ctx, r, color, t, e, { len = 2.2, width = 0.45, pal = null } = {}) {
  const n = 7;
  for (let k = n; k >= 0; k--) {
    const u = k / n; const x = r * 0.9 - u * r * len; const y = Math.sin(t * 8 - k * 0.8 + e.id) * r * 0.22 * u;
    ctx.fillStyle = k % 2 ? color : (pal || color);
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.42, r * width * (1 - u * 0.55), 0, 0, TAU2); ctx.fill();
  }
}

function drawEel(ctx, e, color, t) {
  const r = e.radius; const st = e.sharkState;
  ctx.save(); ctx.rotate(facingOf(e));
  ctx.fillStyle = 'rgba(4, 20, 20, 0.35)'; ctx.beginPath(); ctx.ellipse(-r * 0.4, 2, r * 1.6, r * 0.5, 0, 0, TAU2); ctx.fill();
  longBody(ctx, r, color, t, e, { len: 2.4, width: 0.38, pal: '#2a4a40' });
  ctx.fillStyle = '#2a4a40'; ctx.beginPath(); ctx.ellipse(r * 0.9, 0, r * 0.55, r * 0.35, 0, 0, TAU2); ctx.fill();
  const hot = st === 'windup' || st === 'charging';
  ctx.fillStyle = hot ? '#eaff5a' : '#9ab83a';
  ctx.beginPath(); ctx.arc(r * 1.1, -r * 0.15, 1.3, 0, TAU2); ctx.arc(r * 1.1, r * 0.15, 1.3, 0, TAU2); ctx.fill();
  if (hot) { ctx.strokeStyle = 'rgba(200, 255, 255, 0.8)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 6; k++) { const x = r * 0.8 - k * r * 0.4; ctx.lineTo(x, (k % 2 ? 1 : -1) * r * 0.5); } ctx.stroke(); }
  ctx.restore();
}

function drawTroll(ctx, e, color, t) {
  const r = e.radius; const g = windupGlow(e);
  shadow(ctx, r * 1.1, r * 0.8, 0.35);
  ctx.strokeStyle = 'rgba(230, 250, 250, 0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, TAU2); ctx.stroke();
  ctx.save(); ctx.rotate(facingOf(e));
  // Hunched back, long arms (one raised with a boulder while winding up).
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(-r * 0.1, 0, r * 0.8, r * 0.7, 0, 0, TAU2); ctx.fill();
  ctx.fillStyle = '#4a5a4a'; ctx.beginPath(); ctx.ellipse(-r * 0.3, 0, r * 0.45, r * 0.5, 0, 0, TAU2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(r * 0.45, -r * 0.75, r * 0.35, r * 0.2, 0.5, 0, TAU2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.45, r * 0.75 + g * 3, r * 0.35, r * 0.2, -0.5, 0, TAU2); ctx.fill();
  if (g > 0) { ctx.fillStyle = '#7a7068'; ctx.beginPath(); ctx.arc(r * 0.2, r * 1.0 + g * 3, r * 0.35, 0, TAU2); ctx.fill(); }
  ctx.fillStyle = '#7a8a7a'; ctx.beginPath(); ctx.arc(r * 0.55, 0, r * 0.3, 0, TAU2); ctx.fill();
  ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(r * 0.7, -r * 0.1, 1.1, 0, TAU2); ctx.arc(r * 0.7, r * 0.1, 1.1, 0, TAU2); ctx.fill();
  ctx.restore();
}

// The Hollow King: a vast pale blind crab-thing; bubbles when under.
function drawHollowKing(ctx, e, color, t) {
  const r = e.radius;
  if (e.invulnerable) {
    ctx.fillStyle = 'rgba(8, 20, 30, 0.5)'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r * 0.9, 0, 0, TAU2); ctx.fill();
    ctx.fillStyle = 'rgba(200, 240, 255, 0.7)';
    for (let k = 0; k < 5; k++) { const ph = (t * 1.2 + k * 0.2) % 1; ctx.beginPath(); ctx.arc(Math.sin(k * 2.3) * r * 0.8, -ph * r, 1.2 + ph * 1.5, 0, TAU2); ctx.fill(); }
    return;
  }
  shadow(ctx, r * 1.3, r * 0.9, 0.4);
  ctx.save(); ctx.rotate(facingOf(e));
  ctx.strokeStyle = '#a8a294'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const w = Math.sin(t * 5 + k + s) * 2; ctx.beginPath(); ctx.moveTo(-r * 0.4 + k * r * 0.3, s * r * 0.5); ctx.lineTo(-r * 0.6 + k * r * 0.3 + w, s * r * 1.25); ctx.stroke(); }
  for (const s of [-1, 1]) { ctx.fillStyle = '#e8e2d4'; ctx.beginPath(); ctx.ellipse(r * 1.05, s * r * 0.6, r * 0.45, r * 0.25, s * 0.5, 0, TAU2); ctx.fill(); }
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.75, 0, 0, TAU2); ctx.fill();
  ctx.strokeStyle = 'rgba(90, 80, 70, 0.5)'; ctx.lineWidth = 1;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * r * 0.3, -r * 0.7); ctx.quadraticCurveTo(k * r * 0.3 + 3, 0, k * r * 0.3, r * 0.7); ctx.stroke(); }
  ctx.fillStyle = 'rgba(160, 230, 255, 0.9)';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 0.75, s * r * 0.22, 2, 0, TAU2); ctx.fill(); }
  // A crown of stalactite spikes.
  ctx.fillStyle = '#b8b0a0';
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(-r * 0.2 + k * 3, k * r * 0.2 - 2); ctx.lineTo(-r * 0.7, k * r * 0.25); ctx.lineTo(-r * 0.2 + k * 3, k * r * 0.2 + 2); ctx.fill(); }
  ctx.restore();
}

function drawGator(ctx, e, color, t) {
  const r = e.radius;
  ctx.save(); ctx.rotate(facingOf(e));
  ctx.fillStyle = 'rgba(10, 30, 20, 0.35)'; ctx.beginPath(); ctx.ellipse(-r * 0.3, 2, r * 1.7, r * 0.55, 0, 0, TAU2); ctx.fill();
  // Tail, body, legs, long snout, and the ridge of scutes.
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.3); ctx.quadraticCurveTo(-r * 1.6, Math.sin(t * 6 + e.id) * r * 0.4, -r * 2.2, 0); ctx.quadraticCurveTo(-r * 1.6, Math.sin(t * 6 + e.id) * r * 0.2 + r * 0.1, -r * 0.6, r * 0.3); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.8, r * 0.42, 0, 0, TAU2); ctx.fill();
  for (const [x, s] of [[r * 0.4, -1], [r * 0.4, 1], [-r * 0.4, -1], [-r * 0.4, 1]]) { ctx.beginPath(); ctx.ellipse(x, s * r * 0.45, r * 0.2, r * 0.12, s * 0.6, 0, TAU2); ctx.fill(); }
  const open = e.sharkState === 'charging' || e.sharkState === 'windup' ? 0.25 : 0.05;
  ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.25); ctx.lineTo(r * 1.5, -r * (0.12 + open)); ctx.lineTo(r * 1.5, -0.3); ctx.lineTo(r * 0.6, 0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(r * 0.6, r * 0.25); ctx.lineTo(r * 1.5, r * (0.12 + open)); ctx.lineTo(r * 1.5, 0.3); ctx.lineTo(r * 0.6, 0); ctx.fill();
  ctx.fillStyle = '#2f4424';
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(r * 0.5 - k * r * 0.35, 0, r * 0.1, 0, TAU2); ctx.fill(); }
  ctx.fillStyle = e.sharkState === 'windup' ? '#ff3b30' : '#e8d24a';
  ctx.beginPath(); ctx.arc(r * 0.7, -r * 0.22, 1.2, 0, TAU2); ctx.arc(r * 0.7, r * 0.22, 1.2, 0, TAU2); ctx.fill();
  ctx.restore();
}

function drawWitch(ctx, e, color, t) {
  const r = e.radius; const bob = Math.sin(t * 3 + e.id) * 2;
  airShadow(ctx, r, 0.22);
  ctx.save(); ctx.translate(0, -5 + bob); ctx.rotate(facingOf(e));
  // Broom
  ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(r * 1.1, 0); ctx.lineTo(-r * 1.0, 0); ctx.stroke();
  ctx.fillStyle = '#b89a50'; ctx.beginPath(); ctx.moveTo(-r * 0.9, 0); ctx.lineTo(-r * 1.6, -r * 0.45); ctx.lineTo(-r * 1.6, r * 0.45); ctx.fill();
  // Cloak and pointed hat.
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r * 0.5, 0, 0, TAU2); ctx.fill();
  ctx.fillStyle = '#2a1a3a'; ctx.beginPath(); ctx.arc(r * 0.1, 0, r * 0.55, 0, TAU2); ctx.fill();
  ctx.fillStyle = '#3a2a4a'; ctx.beginPath(); ctx.moveTo(r * 0.1 - r * 0.25, -r * 0.1); ctx.lineTo(r * 0.1 + r * 0.25, -r * 0.1); ctx.lineTo(r * 0.1, -r * 0.1 - 3); ctx.fill();
  const g = windupGlow(e);
  ctx.fillStyle = `rgba(190, 120, 255, ${0.5 + 0.5 * g})`; ctx.beginPath(); ctx.arc(r * 0.9, 0, 2 + g * 3, 0, TAU2); ctx.fill();
  ctx.fillStyle = '#b8ff6a'; ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.12, 0.9, 0, TAU2); ctx.arc(r * 0.3, r * 0.12, 0.9, 0, TAU2); ctx.fill();
  ctx.restore();
}

function drawLeech(ctx, e, color, t) {
  const r = e.radius;
  ctx.save(); ctx.rotate(facingOf(e));
  for (let k = 3; k >= 0; k--) {
    const x = r * 0.5 - k * r * 0.45; const y = Math.sin(t * 9 - k + e.id) * r * 0.2;
    ctx.fillStyle = k % 2 ? color : '#5a3a3a'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.42, r * 0.35 * (1 - k * 0.1), 0, 0, TAU2); ctx.fill();
  }
  ctx.fillStyle = '#c84a4a'; ctx.beginPath(); ctx.arc(r * 0.8, 0, r * 0.2, 0, TAU2); ctx.fill();
  ctx.restore();
}

function drawMireMother(ctx, e, color, t) {
  const r = e.radius;
  if (e.invulnerable) {
    ctx.fillStyle = 'rgba(40, 60, 20, 0.55)'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r * 1.0, 0, 0, TAU2); ctx.fill();
    for (let k = 0; k < 5; k++) { const ph = (t + k * 0.2) % 1; ctx.fillStyle = `rgba(160, 210, 90, ${1 - ph})`; ctx.beginPath(); ctx.arc(Math.cos(k * 1.9) * r * 0.8, Math.sin(k * 1.9) * r * 0.5, 1.5 + ph * 2, 0, TAU2); ctx.fill(); }
    return;
  }
  shadow(ctx, r * 1.3, r * 1.0, 0.4);
  // A walking mound of roots: gnarled roots splaying out, a mossy hump,
  // a hag's face of bark with two glowing eyes.
  ctx.strokeStyle = '#4a3a26'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU2 + Math.sin(t * 1.5 + k) * 0.08; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9 - 4, Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.25); ctx.stroke(); }
  ctx.fillStyle = '#3a4a24'; ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, TAU2); ctx.fill();
  ctx.fillStyle = color;
  for (const [x, y, k] of [[-0.3, -0.3, 0.5], [0.3, -0.2, 0.45], [0, 0.3, 0.5]]) { ctx.beginPath(); ctx.arc(x * r, y * r, k * r, 0, TAU2); ctx.fill(); }
  ctx.fillStyle = '#6a5436'; ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.35, r * 0.45, 0, 0, TAU2); ctx.fill();
  ctx.fillStyle = '#d8ff6a'; ctx.beginPath(); ctx.arc(-r * 0.13, 0, 1.8, 0, TAU2); ctx.arc(r * 0.13, 0, 1.8, 0, TAU2); ctx.fill();
  ctx.fillStyle = '#2a1e10'; ctx.fillRect(-r * 0.12, r * 0.25, r * 0.24, 1.6);
  const g = windupGlow(e);
  if (g > 0) { ctx.fillStyle = `rgba(170, 230, 90, ${g * 0.4})`; ctx.beginPath(); ctx.arc(0, 0, r * (1 + g * 0.4), 0, TAU2); ctx.fill(); }
}

function drawAngler(ctx, e, color, t) {
  const r = e.radius; const st = e.sharkState;
  const lurking = st === 'circling';
  ctx.save(); ctx.rotate(facingOf(e));
  ctx.globalAlpha *= lurking ? 0.55 : 1;
  ctx.fillStyle = 'rgba(0, 0, 10, 0.4)'; ctx.beginPath(); ctx.ellipse(0, 2, r * 1.3, r * 0.9, 0, 0, TAU2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.8, 0, 0, TAU2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-r * 0.9, 0); ctx.lineTo(-r * 1.6, -r * 0.6); ctx.lineTo(-r * 1.5, 0); ctx.lineTo(-r * 1.6, r * 0.6); ctx.fill();
  // Jaw full of teeth, wider when striking.
  const open = st === 'charging' || st === 'windup' ? 0.45 : 0.18;
  ctx.fillStyle = '#0a0a12'; ctx.beginPath(); ctx.ellipse(r * 0.75, 0, r * 0.35, r * open + r * 0.2, 0, 0, TAU2); ctx.fill();
  ctx.fillStyle = '#e8e8f0';
  for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(r * 0.6, k * r * 0.12); ctx.lineTo(r * 0.85, k * r * 0.12 + 1); ctx.lineTo(r * 0.6, k * r * 0.12 + 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  // The lure: a stalk and a bright bulb (always bright — that's the trap).
  const bx = r * 1.4 + Math.sin(t * 2 + e.id) * 2; const by = Math.cos(t * 1.7 + e.id) * 2;
  ctx.strokeStyle = '#5a6a7a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r * 0.2, 0); ctx.quadraticCurveTo(r * 0.8, -r * 0.9, bx, by); ctx.stroke();
  ctx.fillStyle = '#eaffff'; ctx.beginPath(); ctx.arc(bx, by, 2.8, 0, TAU2); ctx.fill();
  ctx.restore();
}

function drawJelly(ctx, e, color, t) {
  const r = e.radius; const p = Math.sin(t * 3 + e.id) * 0.12;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(200, 160, 255, 0.5)`; ctx.lineWidth = 1;
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); ctx.quadraticCurveTo(Math.cos(a + 0.4) * r * 1.2, Math.sin(a + 0.4) * r * 1.2, Math.cos(a + Math.sin(t * 2 + k) * 0.4) * r * 1.8, Math.sin(a + Math.sin(t * 2 + k) * 0.4) * r * 1.8); ctx.stroke(); }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * (1 + p));
  g.addColorStop(0, 'rgba(255, 230, 255, 0.9)'); g.addColorStop(0.5, 'rgba(180, 120, 255, 0.6)'); g.addColorStop(1, 'rgba(120, 80, 255, 0.1)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * (1 + p), 0, TAU2); ctx.fill();
  ctx.restore();
  void color;
}

function drawSquid(ctx, e, color, t) {
  const r = e.radius;
  ctx.save(); ctx.rotate(facingOf(e));
  ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let k = 0; k < 8; k++) { const y = (k - 3.5) * r * 0.14; ctx.beginPath(); ctx.moveTo(-r * 0.2, y); ctx.quadraticCurveTo(-r * 0.9, y + Math.sin(t * 7 + k) * 3, -r * 1.6, y * 1.8 + Math.sin(t * 5 + k) * 3); ctx.stroke(); }
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(r * 1.3, 0); ctx.quadraticCurveTo(r * 0.6, -r * 0.7, -r * 0.3, -r * 0.4); ctx.lineTo(-r * 0.3, r * 0.4); ctx.quadraticCurveTo(r * 0.6, r * 0.7, r * 1.3, 0); ctx.fill();
  ctx.fillStyle = '#8a2a4a'; ctx.beginPath(); ctx.moveTo(r * 1.3, 0); ctx.lineTo(r * 1.0, -r * 0.55); ctx.lineTo(r * 0.8, 0); ctx.lineTo(r * 1.0, r * 0.55); ctx.fill();
  const g = windupGlow(e);
  ctx.fillStyle = g > 0 ? '#ffe07a' : '#1a0a14'; ctx.beginPath(); ctx.arc(0, -r * 0.25, 1.6, 0, TAU2); ctx.arc(0, r * 0.25, 1.6, 0, TAU2); ctx.fill();
  ctx.restore();
}

function drawDeepMother(ctx, e, color, t, boat) {
  if (e.archetype === 'tank') {
    const r = e.radius; const g = windupGlow(e);
    shadow(ctx, r * 1.2, r, 0.4);
    ctx.strokeStyle = `rgba(160, 240, 255, ${0.5 + 0.5 * g})`; ctx.lineWidth = 2;
    for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU2 + t * 0.4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); ctx.quadraticCurveTo(Math.cos(a + 0.3) * r * 1.3, Math.sin(a + 0.3) * r * 1.3, Math.cos(a + 0.1 * Math.sin(t * 3 + k)) * r * 1.8, Math.sin(a) * r * 1.8); ctx.stroke(); }
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU2); ctx.fill();
    ctx.fillStyle = 'rgba(150, 255, 255, 0.8)';
    for (let k = 0; k < 7; k++) { const a = k * 0.9 + t * 0.2; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 1.6, 0, TAU2); ctx.fill(); }
    ctx.fillStyle = '#ff7ad9'; ctx.beginPath(); ctx.arc(0, 0, r * (0.3 + g * 0.15), 0, TAU2); ctx.fill();
    return;
  }
  drawSerpent(ctx, e, color, t, ABYSS_PAL);
  void boat;
}

function drawRaider(ctx, e, color, t) {
  const r = e.radius; const L = r * 1.5; const B = r * 0.55;
  shadow(ctx, L, B * 1.1);
  ctx.save(); ctx.rotate(facingOf(e));
  hull(ctx, L, B, '#7a5530', '#c8a070', '#3a2410', 0.8);
  // A lateen (triangular) sail, striped.
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(L * 0.8, -1); ctx.quadraticCurveTo(0, -r * 1.6, -L * 0.8, -r * 0.3); ctx.lineTo(-L * 0.2, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#b8342a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(L * 0.3, -r * 0.8); ctx.lineTo(-L * 0.4, -r * 0.35); ctx.stroke();
  ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(L * 0.8, -1); ctx.lineTo(-L * 0.8, -r * 0.3); ctx.stroke();
  const g = windupGlow(e);
  if (g > 0) { ctx.fillStyle = `rgba(255, 160, 60, ${g})`; ctx.beginPath(); ctx.arc(L * 0.95, 0, 1.5 + g * 3, 0, TAU2); ctx.fill(); }
  flag(ctx, -L * 0.8, -1.5, t + e.id, '#b8342a');
  ctx.restore();
}

function drawVulture(ctx, e, color, t) {
  const r = e.radius; airShadow(ctx, r);
  ctx.save(); ctx.rotate(facingOf(e));
  wings(ctx, r, '#4a3a2e', t, e, { span: 1.6, bat: false });
  ctx.fillStyle = '#3a2e24'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.6, r * 0.35, 0, 0, TAU2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(r * 0.55, 0, r * 0.25, 0, TAU2); ctx.fill(); // bald head (bone white)
  ctx.fillStyle = '#e0a23a'; ctx.beginPath(); ctx.moveTo(r * 0.95, 0); ctx.lineTo(r * 0.72, -r * 0.1); ctx.lineTo(r * 0.72, r * 0.1); ctx.fill();
  ctx.restore();
}

function drawColossus(ctx, e, color, t) {
  const r = e.radius; const g = windupGlow(e);
  shadow(ctx, r * 1.2, r * 0.9, 0.4);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2);
  halo.addColorStop(0, `rgba(210, 180, 255, ${0.35 + g * 0.3})`); halo.addColorStop(1, 'rgba(210, 180, 255, 0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, TAU2); ctx.fill(); ctx.restore();
  // A ring of shards around a glowing core; rotates as it fires spirals.
  const spin = (e._ringSpin || 0) + t * 0.2;
  const cols = ['#c8a8ff', '#9affff', '#ff9ae0', '#f0e6ff'];
  for (let k = 0; k < 8; k++) {
    const a = spin + (k / 8) * TAU2; const len = r * (1.1 + (k % 2) * 0.35);
    const nx = -Math.sin(a) * r * 0.22; const ny = Math.cos(a) * r * 0.22;
    ctx.fillStyle = cols[k % 4]; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); ctx.lineTo(-nx, -ny); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6a5a9a'; ctx.lineWidth = 0.7; ctx.stroke();
  }
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TAU2); ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + g * 0.4})`; ctx.beginPath(); ctx.arc(0, 0, r * (0.25 + g * 0.1), 0, TAU2); ctx.fill();
}

function drawTortoise(ctx, e, color, t) {
  const r = e.radius;
  shadow(ctx, r * 1.1, r * 0.85, 0.35);
  ctx.save(); ctx.rotate(facingOf(e));
  ctx.fillStyle = '#6a8a7a';
  for (const [x, s] of [[r * 0.55, -1], [r * 0.55, 1], [-r * 0.5, -1], [-r * 0.5, 1]]) { ctx.beginPath(); ctx.ellipse(x + Math.sin(t * 4 + x) * 1.5, s * r * 0.75, r * 0.28, r * 0.16, s * 0.6, 0, TAU2); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(r * 1.0, 0, r * 0.3, r * 0.22, 0, 0, TAU2); ctx.fill();
  // The mirrored shell: bright facets on the FRONT half (that's the armour).
  ctx.fillStyle = '#4a6a78'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.75, 0, 0, TAU2); ctx.fill();
  const shine = 0.6 + 0.4 * Math.sin(t * 3 + e.id);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(r * 0.9, 0); ctx.lineTo(r * 0.3, -r * 0.72); ctx.lineTo(0, 0); ctx.lineTo(r * 0.3, r * 0.72); ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * shine})`;
  ctx.beginPath(); ctx.moveTo(r * 0.9, 0); ctx.lineTo(r * 0.3, -r * 0.72); ctx.lineTo(r * 0.25, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(40, 60, 70, 0.6)'; ctx.lineWidth = 0.8;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-r * 0.2, 0, r * (0.25 + k * 0.18), Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); }
  ctx.restore();
}

function drawCrab(ctx, e, color, t) {
  const r = e.radius;
  ctx.save(); ctx.rotate(facingOf(e));
  ctx.strokeStyle = '#b86aa8'; ctx.lineWidth = 1.2;
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const w = Math.sin(t * 12 + k + s) * 1.2; ctx.beginPath(); ctx.moveTo(-r * 0.2 + k * r * 0.3, s * r * 0.3); ctx.lineTo(-r * 0.4 + k * r * 0.3 + w, s * r * 0.95); ctx.stroke(); }
  ctx.fillStyle = color;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.5, s * r * 0.3); ctx.lineTo(r * 1.2, s * r * 0.55); ctx.lineTo(r * 0.8, s * r * 0.15); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(r * 0.7, 0); ctx.lineTo(0, -r * 0.6); ctx.lineTo(-r * 0.7, 0); ctx.lineTo(0, r * 0.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(r * 0.7, 0); ctx.lineTo(0, -r * 0.6); ctx.lineTo(0, 0); ctx.fill();
  ctx.restore();
}

function drawPrismSprite(ctx, e, color, t) {
  const r = e.radius; const bob = Math.sin(t * 3.5 + e.id) * 2;
  airShadow(ctx, r, 0.2);
  ctx.save(); ctx.translate(0, -6 + bob); ctx.rotate(t * 1.5 + e.id);
  const g = windupGlow(e);
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, r * 1.2); ctx.lineTo(-r * 0.7, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, 0); ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + g * 0.5})`; ctx.beginPath(); ctx.arc(0, 0, 2 + g * 2, 0, TAU2); ctx.fill();
  ctx.restore();
}

// Drawn a little larger than the collision circle so silhouettes read at
// phone size (the hit circle stays honest; the art just has more detail).
const scaled = (k, fn) => (ctx, e, c, t, boat) => { ctx.save(); ctx.scale(k, k); fn(ctx, e, c, t, boat); ctx.restore(); };
export const SPRITES = {
  longboat: scaled(1.35, (ctx, e, c, t) => drawLongboat(ctx, e, c, t)),
  pirate_cutter: scaled(1.3, (ctx, e, c, t, boat) => drawCutter(ctx, e, c, t, boat)),
  pirate_brig: scaled(1.25, (ctx, e, c, t, boat) => drawBrig(ctx, e, c, t, boat, false)),
  pirate_flagship: scaled(1.15, (ctx, e, c, t, boat) => drawBrig(ctx, e, c, t, boat, true)),
  reef_shark: scaled(1.3, (ctx, e, c, t, boat) => drawShark(ctx, e, c, t, boat, false)),
  bloodfin_matriarch: scaled(1.2, (ctx, e, c, t, boat) => drawShark(ctx, e, c, t, boat, true)),
  sea_serpent: scaled(1.3, (ctx, e, c, t) => drawSerpent(ctx, e, c, t)),
  warding_seal: (ctx, e, c, t) => drawSeal(ctx, e, c, t),
  fire_ship: scaled(1.3, (ctx, e, c, t) => drawFireShip(ctx, e, c, t)),
  mortar_boat: scaled(1.3, (ctx, e, c, t) => drawMortarBoat(ctx, e, c, t)),
  frost_narwhal: scaled(1.25, (ctx, e, c, t, boat) => drawNarwhal(ctx, e, c, t, boat)),
  ice_golem: scaled(1.2, (ctx, e, c, t) => drawIceGolem(ctx, e, c, t)),
  frost_wisp: scaled(1.3, (ctx, e, c, t) => drawFrostWisp(ctx, e, c, t)),
  ghost_ship: scaled(1.25, (ctx, e, c, t, boat) => drawGhostShip(ctx, e, c, t, boat, false)),
  drowned_skiff: scaled(1.3, (ctx, e, c, t) => drawDrownedSkiff(ctx, e, c, t)),
  siren: scaled(1.25, (ctx, e, c, t) => drawSiren(ctx, e, c, t)),
  frost_leviathan: scaled(1.25, (ctx, e, c, t, boat) => drawLeviathan(ctx, e, c, t, boat)),
  drowned_admiral: scaled(1.15, (ctx, e, c, t, boat) => drawGhostShip(ctx, e, c, t, boat, true)),
  cinder_bat: scaled(1.3, (ctx, e, c, t) => drawCinderBat(ctx, e, c, t)),
  magma_golem: scaled(1.2, (ctx, e, c, t) => drawMagmaGolem(ctx, e, c, t)),
  obsidian_galley: scaled(1.25, (ctx, e, c, t, boat) => drawGalley(ctx, e, c, t, boat)),
  caldera_wyrm: scaled(1.25, (ctx, e, c, t) => (e.archetype === 'flyer'
    ? (() => { const r = e.radius; airShadow(ctx, r, 0.3); ctx.save(); ctx.rotate(facingOf(e)); wings(ctx, r, '#6a2014', t, e, { span: 1.8 }); ctx.restore(); drawSerpent(ctx, { ...e, invulnerable: false }, c, t, MAGMA_PAL); })()
    : drawSerpent(ctx, e, c, t, MAGMA_PAL))),
  cave_bats: scaled(1.3, (ctx, e, c, t) => drawBat(ctx, e, c, t)),
  stalker_eel: scaled(1.25, (ctx, e, c, t) => drawEel(ctx, e, c, t)),
  deep_troll: scaled(1.2, (ctx, e, c, t) => drawTroll(ctx, e, c, t)),
  hollow_king: scaled(1.15, (ctx, e, c, t) => drawHollowKing(ctx, e, c, t)),
  bayou_gator: scaled(1.2, (ctx, e, c, t) => drawGator(ctx, e, c, t)),
  bog_witch: scaled(1.3, (ctx, e, c, t) => drawWitch(ctx, e, c, t)),
  leech_swarm: scaled(1.3, (ctx, e, c, t) => drawLeech(ctx, e, c, t)),
  mire_mother: scaled(1.15, (ctx, e, c, t) => drawMireMother(ctx, e, c, t)),
  anglerfish: scaled(1.25, (ctx, e, c, t) => drawAngler(ctx, e, c, t)),
  jelly_bloom: scaled(1.3, (ctx, e, c, t) => drawJelly(ctx, e, c, t)),
  ink_squid: scaled(1.25, (ctx, e, c, t) => drawSquid(ctx, e, c, t)),
  deep_mother: scaled(1.2, (ctx, e, c, t, boat) => drawDeepMother(ctx, e, c, t, boat)),
  dune_raider: scaled(1.3, (ctx, e, c, t) => drawRaider(ctx, e, c, t)),
  bone_vulture: scaled(1.3, (ctx, e, c, t) => drawVulture(ctx, e, c, t)),
  sand_wyrm: scaled(1.3, (ctx, e, c, t) => drawSerpent(ctx, e, c, t, SAND_PAL)),
  dunemaw: scaled(1.25, (ctx, e, c, t) => drawSerpent(ctx, e, c, t, SAND_PAL)),
  prism_sprite: scaled(1.3, (ctx, e, c, t) => drawPrismSprite(ctx, e, c, t)),
  mirror_tortoise: scaled(1.2, (ctx, e, c, t) => drawTortoise(ctx, e, c, t)),
  crystal_crab: scaled(1.3, (ctx, e, c, t) => drawCrab(ctx, e, c, t)),
  prism_colossus: scaled(1.1, (ctx, e, c, t) => drawColossus(ctx, e, c, t)),
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
    if (e.gunWindup > 0 && e.gun && e.gun.pattern === 'ring') {
      // A slam: the ring it'll throw shards across, tightening as it lands.
      const g = windupGlow(e);
      const rr = Math.min(e.gun.range, 70) * (1.2 - g * 0.4);
      ctx.strokeStyle = `rgba(255, 120, 60, ${0.3 + 0.5 * g})`; ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t * 25;
      ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, Math.PI * 2); ctx.stroke();
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

const SHOT_TINTS = {
  fire: ['rgba(255, 110, 30, 0.4)', 'rgba(255, 160, 50, 0.75)', '#fff0b0'],
  hex: ['rgba(170, 80, 255, 0.35)', 'rgba(190, 120, 255, 0.7)', '#2a0a3a'],
  spore: ['rgba(150, 230, 80, 0.35)', 'rgba(170, 240, 100, 0.6)', '#3a5a1a'],
  ink: ['rgba(20, 10, 30, 0.45)', 'rgba(30, 15, 45, 0.85)', '#6a3a8a'],
  shock: ['rgba(120, 220, 255, 0.35)', 'rgba(170, 240, 255, 0.8)', '#ffffff'],
  sand: ['rgba(220, 190, 130, 0.45)', 'rgba(210, 170, 110, 0.85)', '#8a6a3a'],
  prism: ['rgba(255, 160, 240, 0.35)', 'rgba(200, 180, 255, 0.8)', '#ffffff'],
  boulder: ['rgba(80, 76, 70, 0.35)', 'rgba(110, 104, 96, 0.9)', '#5a534c'],
};

export function drawEnemyProjectiles(ctx, shots, t) {
  for (const s of shots) {
    if (s.lob) {
      // Target ring on the water (tightening as the shell falls), the
      // shell's shadow sliding along the ground, and the shell high above.
      const u = Math.min(1, s.t / s.flight);
      const ring = s.blast * (1.35 - u * 0.35);
      ctx.strokeStyle = `rgba(255, 70, 50, ${0.45 + u * 0.45})`; ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.arc(s.tx, s.ty, ring, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255, 60, 40, ${0.1 + u * 0.18})`;
      ctx.beginPath(); ctx.arc(s.tx, s.ty, s.blast, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(4, 30, 40, 0.3)';
      ctx.beginPath(); ctx.ellipse(s.x + 2, s.y + 3, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      const h = Math.sin(u * Math.PI) * 46;
      ctx.fillStyle = 'rgba(255, 140, 60, 0.35)'; ctx.beginPath(); ctx.arc(s.x, s.y - h, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1c1c1c'; ctx.beginPath(); ctx.arc(s.x, s.y - h, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.arc(s.x + 2, s.y - h - 3, 1.3, 0, Math.PI * 2); ctx.fill();
      continue;
    }
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
    if (SHOT_TINTS[s.kind]) {
      const [c1, c2, c3] = SHOT_TINTS[s.kind];
      ctx.save(); if (s.kind !== 'ink' && s.kind !== 'sand' && s.kind !== 'boulder') ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = c1;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(s.x + tx * k * 4.5, s.y + ty * k * 4.5, s.radius * (1.05 - k * 0.2), 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(s.x, s.y, s.radius + 1.6 + (s.kind === 'shock' ? Math.sin(t * 40 + s.id) : 0), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = c3; ctx.beginPath(); ctx.arc(s.x, s.y, s.radius * 0.7, 0, Math.PI * 2); ctx.fill();
      if (s.kind === 'shock') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.x - 4, s.y - 2); ctx.lineTo(s.x, s.y + 1); ctx.lineTo(s.x + 4, s.y - 1); ctx.stroke(); }
      continue;
    }
    if (s.kind === 'frost') {
      ctx.fillStyle = 'rgba(170, 230, 255, 0.35)';
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(s.x + tx * k * 4, s.y + ty * k * 4, s.radius * (1 - k * 0.2), 0, Math.PI * 2); ctx.fill(); }
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(s.vy, s.vx) + t * 6);
      ctx.fillStyle = '#e8f9ff'; ctx.strokeStyle = '#4f9ccc'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const rr = k % 2 ? s.radius * 0.55 : s.radius * 1.35; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      continue;
    }
    if (s.kind === 'spectral') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(110, 255, 200, 0.3)';
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(s.x + tx * k * 5, s.y + ty * k * 5, s.radius * (1.1 - k * 0.2), 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = `rgba(140, 255, 215, ${0.6 + 0.25 * Math.sin(t * 18 + s.id)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.radius + 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#0e2a22'; ctx.beginPath(); ctx.arc(s.x, s.y, s.radius * 0.8, 0, Math.PI * 2); ctx.fill();
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

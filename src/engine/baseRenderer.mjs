// Draws the home-base harbour's buildings and ambient life (2026-09-28).
// Code-drawn in the same style as the reef art: top-down terrain with the
// buildings in a slight three-quarter view (a front face plus a roof), light
// from the top-left, soft shadows falling down-right. Each building is drawn
// around its ground point (x, y) and a scale `S` (1 = ~80px wide).
//
// Animated parts (lighthouse beam, portal swirl, forge smoke, banners,
// crane, gulls) are driven by `t` (seconds). Nothing here reads game state
// except the few facts passed in `state` (e.g. the selected faction).

import { FACTIONS } from '../data/factions.mjs';
import { drawTower } from './tdArt.mjs';
import { drawBuildingSprite } from './buildingSprites.mjs';

const TAU = Math.PI * 2;

export function shadow(ctx, x, y, rx, ry) {
  ctx.fillStyle = 'rgba(10, 30, 20, 0.30)';
  ctx.beginPath(); ctx.ellipse(x + rx * 0.25, y + ry * 0.35, rx, ry, 0, 0, TAU); ctx.fill();
}

export function box(ctx, x, y, w, h, roofH, wall, wallDark, roof, roofDark) {
  // Front wall (x centred, y = ground line), lit from the left.
  const wg = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  wg.addColorStop(0, wall); wg.addColorStop(1, wallDark);
  ctx.fillStyle = wg; ctx.fillRect(x - w / 2, y - h, w, h);
  // Timber frame: corner posts, a mid rail and weatherboard lines.
  ctx.strokeStyle = 'rgba(40, 24, 10, .28)'; ctx.lineWidth = 0.6;
  for (let yy = y - h + 3; yy < y - 3; yy += 3) { ctx.beginPath(); ctx.moveTo(x - w / 2, yy); ctx.lineTo(x + w / 2, yy); ctx.stroke(); }
  ctx.fillStyle = 'rgba(50, 30, 14, .75)';
  ctx.fillRect(x - w / 2, y - h, 2.2, h); ctx.fillRect(x + w / 2 - 2.2, y - h, 2.2, h);
  ctx.fillRect(x - w / 2, y - h * 0.55, w, 1.4);
  // Stone footing.
  ctx.fillStyle = '#6f6c66'; ctx.fillRect(x - w / 2 - 1, y - 4, w + 2, 4);
  ctx.fillStyle = 'rgba(255, 255, 255, .15)'; ctx.fillRect(x - w / 2 - 1, y - 4, w + 2, 1);
  // Eave shadow on the wall.
  ctx.fillStyle = 'rgba(0, 0, 0, .25)'; ctx.fillRect(x - w / 2, y - h, w, 3.5);
  // Pitched roof seen from the front-top: a trapezoid, lit left, shaded
  // right, laid in rows of shingles.
  const L = () => { ctx.beginPath(); ctx.moveTo(x - w / 2 - 5, y - h); ctx.lineTo(x + w / 2 + 5, y - h); ctx.lineTo(x + w / 2 - 4, y - h - roofH); ctx.lineTo(x - w / 2 + 4, y - h - roofH); ctx.closePath(); };
  ctx.fillStyle = roof; L(); ctx.fill();
  ctx.save(); L(); ctx.clip();
  ctx.fillStyle = roofDark; ctx.fillRect(x, y - h - roofH, w / 2 + 6, roofH);
  const rows = Math.max(3, Math.round(roofH / 3.2));
  for (let r = 0; r < rows; r++) {
    const yy = y - h - (r / rows) * roofH;
    ctx.strokeStyle = 'rgba(0, 0, 0, .22)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 6, yy); ctx.lineTo(x + w / 2 + 6, yy); ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, .12)'; ctx.lineWidth = 0.5;
    for (let xx = x - w / 2 - 5 + (r % 2) * 2.5; xx < x + w / 2 + 5; xx += 5) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - roofH / rows); ctx.stroke(); }
  }
  // A sunlit sheen along the lower left.
  const sg = ctx.createLinearGradient(x - w / 2, y - h, x, y - h - roofH);
  sg.addColorStop(0, 'rgba(255, 245, 220, .22)'); sg.addColorStop(1, 'rgba(255, 245, 220, 0)');
  ctx.fillStyle = sg; ctx.fillRect(x - w / 2 - 6, y - h - roofH, w / 2 + 6, roofH);
  ctx.restore();
  // Ridge and eave lines.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x - w / 2 + 4, y - h - roofH); ctx.lineTo(x + w / 2 - 4, y - h - roofH); ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 240, 210, .3)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 5, y - h); ctx.lineTo(x + w / 2 + 5, y - h); ctx.stroke();
}

// A lit window with a frame and a warm glow spilling out.
export function windowGlow(ctx, x, y, w, h, t = 0) {
  const fl = 0.85 + 0.15 * Math.sin(t * 4 + x);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 1.6);
  g.addColorStop(0, `rgba(255, 190, 90, ${0.35 * fl})`); g.addColorStop(1, 'rgba(255, 160, 60, 0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, Math.max(w, h) * 1.6, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#3a2412'; ctx.fillRect(x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 2);
  ctx.fillStyle = `rgba(255, ${210 + 30 * fl}, 130, 1)`; ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = '#3a2412'; ctx.fillRect(x - 0.4, y - h / 2, 0.8, h); ctx.fillRect(x - w / 2, y - 0.4, w, 0.8);
}

export function barrel(ctx, x, y, s = 1) {
  ctx.fillStyle = '#7a4a22'; ctx.beginPath(); ctx.ellipse(x, y, 5 * s, 6 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#a8703a'; ctx.beginPath(); ctx.ellipse(x - 0.5, y - 1, 4 * s, 4.5 * s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3b3f44'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 5 * s, 6 * s, 0, 0, TAU); ctx.stroke();
}

function drawShipyard(ctx, b, t) {
  const { x, y } = b;
  // Dock running south into the lagoon.
  ctx.fillStyle = 'rgba(10,30,20,0.25)'; ctx.fillRect(x - 8, y + 30, 26, 92);
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x - 12, y + 24, 24, 92);
  ctx.strokeStyle = 'rgba(60,35,15,0.6)'; ctx.lineWidth = 1;
  for (let py = y + 28; py < y + 116; py += 6) { ctx.beginPath(); ctx.moveTo(x - 12, py); ctx.lineTo(x + 12, py); ctx.stroke(); }
  ctx.fillStyle = '#4a2c12';
  for (let py = y + 36; py <= y + 116; py += 20) { ctx.beginPath(); ctx.arc(x - 13, py, 2.6, 0, TAU); ctx.arc(x + 13, py, 2.6, 0, TAU); ctx.fill(); }
  if (drawBuildingSprite(ctx, 'shipyard', x - 4, y + 4)) return;
  // A hull on the slipway, ribs showing.
  ctx.save(); ctx.translate(x + 30, y + 8);
  ctx.fillStyle = '#b07a3e';
  ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(14, -6, 9, 20); ctx.lineTo(-9, 20); ctx.quadraticCurveTo(-14, -6, 0, -24); ctx.fill();
  ctx.strokeStyle = '#5a3616'; ctx.lineWidth = 1.4;
  for (let k = -14; k <= 14; k += 6) { ctx.beginPath(); ctx.moveTo(-9, k); ctx.lineTo(9, k); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, 20); ctx.stroke();
  ctx.restore();
  // Boathouse.
  shadow(ctx, x - 12, y + 4, 36, 14);
  box(ctx, x - 12, y + 6, 50, 26, 22, '#c79a5a', '#8a6333', '#c2472f', '#8f2f1f');
  ctx.fillStyle = '#3a2412'; ctx.fillRect(x - 20, y - 12, 16, 18);
  windowGlow(ctx, x + 6, y - 11, 7, 6, t);
  // Crane with a swinging crate.
  ctx.strokeStyle = '#5a3616'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + 22, y + 6); ctx.lineTo(x + 22, y - 54); ctx.lineTo(x + 48, y - 48); ctx.stroke();
  const sw = Math.sin(t * 1.3) * 4;
  ctx.lineWidth = 1; ctx.strokeStyle = '#e9ddc4';
  ctx.beginPath(); ctx.moveTo(x + 46, y - 48); ctx.lineTo(x + 46 + sw, y - 22); ctx.stroke();
  ctx.fillStyle = '#9a6a35'; ctx.fillRect(x + 40 + sw, y - 22, 12, 10);
  ctx.strokeStyle = '#3e2410'; ctx.strokeRect(x + 40 + sw, y - 22, 12, 10);
  // Timber stack.
  ctx.fillStyle = '#9a6a35';
  for (let k = 0; k < 3; k++) ctx.fillRect(x - 44, y + 8 - k * 4, 18, 3);
}

export function drawLighthouse(ctx, b, t, { cottage = true } = {}) {
  const { x, y } = b;
  shadow(ctx, x, y + 2, 20, 9);
  // Rocky base
  ctx.fillStyle = '#6b6c69'; ctx.beginPath(); ctx.ellipse(x, y, 20, 9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8c8b84'; ctx.beginPath(); ctx.ellipse(x - 3, y - 2, 14, 6, 0, 0, TAU); ctx.fill();
  // Tapered tower in stripes.
  const H = 62; const b0 = 11; const b1 = 7;
  for (let k = 0; k < 5; k++) {
    const y0 = y - (H * k) / 5; const y1 = y - (H * (k + 1)) / 5;
    const w0 = b0 + ((b1 - b0) * k) / 5; const w1 = b0 + ((b1 - b0) * (k + 1)) / 5;
    ctx.fillStyle = k % 2 ? '#f3efe6' : '#c9402f';
    ctx.beginPath(); ctx.moveTo(x - w0, y0); ctx.lineTo(x + w0, y0); ctx.lineTo(x + w1, y1); ctx.lineTo(x - w1, y1); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + b0, y); ctx.lineTo(x + b1, y - H); ctx.lineTo(x + 1, y - H); ctx.closePath(); ctx.fill();
  // Gallery, lamp room, cap.
  ctx.fillStyle = '#2b2a2e'; ctx.fillRect(x - 10, y - H - 2, 20, 3);
  const pulse = 0.75 + Math.sin(t * 3) * 0.25;
  const g = ctx.createRadialGradient(x, y - H - 8, 0, x, y - H - 8, 26);
  g.addColorStop(0, `rgba(255, 236, 160, ${0.85 * pulse})`); g.addColorStop(1, 'rgba(255, 236, 160, 0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - H - 8, 26, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe9a0'; ctx.fillRect(x - 6, y - H - 13, 12, 10);
  ctx.fillStyle = '#8f2f1f';
  ctx.beginPath(); ctx.moveTo(x - 8, y - H - 13); ctx.lineTo(x + 8, y - H - 13); ctx.lineTo(x, y - H - 22); ctx.closePath(); ctx.fill();
  // Keeper's cottage.
  if (!cottage) return;
  shadow(ctx, x + 26, y + 10, 14, 6);
  box(ctx, x + 26, y + 12, 22, 12, 9, '#e1d3b4', '#a89878', '#3f6f8f', '#2c5068');
}

function drawLighthouseBeam(ctx, b, t) {
  const { x, y } = b; const ly = y - 70 * BUILDING_SCALE;
  const a = t * 0.7;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const off of [0, Math.PI]) {
    const g = ctx.createRadialGradient(x, ly, 0, x, ly, 230);
    g.addColorStop(0, 'rgba(255, 240, 180, 0.22)'); g.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, ly); ctx.arc(x, ly, 230, a + off - 0.13, a + off + 0.13); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawShrine(ctx, b, t) {
  const { x, y } = b;
  const r = drawBuildingSprite(ctx, 'shrine', x, y);
  if (r) { shrineGlow(ctx, r.x + r.w * 0.6, r.y + r.h * 0.55, r.h * 0.3, t); return; }
  shadow(ctx, x, y + 4, 30, 11);
  ctx.fillStyle = '#6d6f6c'; ctx.beginPath(); ctx.ellipse(x, y + 2, 30, 11, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8e8f88'; ctx.beginPath(); ctx.ellipse(x - 2, y, 26, 8, 0, 0, TAU); ctx.fill();
  // Portal (behind the arch's pillars).
  const px = x; const py = y - 26;
  const pg = ctx.createRadialGradient(px, py, 2, px, py, 22);
  pg.addColorStop(0, '#f2d6ff'); pg.addColorStop(0.35, '#a66bff'); pg.addColorStop(1, 'rgba(60, 20, 120, 0.9)');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(px, py, 14, 22, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(230, 200, 255, 0.8)'; ctx.lineWidth = 1.4;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let u = 0; u <= 1.001; u += 0.1) {
      const a = -t * 2.2 + k * 2.1 + u * 3; const r = 2 + u * 12;
      const X = px + Math.cos(a) * r * 0.65; const Y = py + Math.sin(a) * r;
      if (u === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke();
  }
  // Arch: two mossy pillars and a curved lintel.
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#7c7e80'; ctx.fillRect(px + side * 19 - 5, y - 50, 10, 50);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(px + side * 19 + 1, y - 50, 4, 50);
    ctx.fillStyle = '#5f8f3a'; ctx.fillRect(px + side * 19 - 6, y - 52, 12, 5);
  }
  ctx.strokeStyle = '#7c7e80'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(px, y - 46, 19, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = '#5f8f3a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(px, y - 48, 21, Math.PI * 1.15, Math.PI * 1.7); ctx.stroke();
  // Rising motes.
  for (let k = 0; k < 6; k++) {
    const ph = (t * 0.35 + k / 6) % 1;
    ctx.fillStyle = `rgba(220, 180, 255, ${0.9 * (1 - ph)})`;
    ctx.beginPath(); ctx.arc(px + Math.sin(k * 2.3 + t) * 14, py + 14 - ph * 46, 1.4, 0, TAU); ctx.fill();
  }
}

// The painted shrine's portal pulses and sheds motes.
function shrineGlow(ctx, px, py, R, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const p = 0.75 + 0.25 * Math.sin(t * 2.4);
  const g = ctx.createRadialGradient(px, py, 0, px, py, R);
  g.addColorStop(0, `rgba(200, 130, 255, ${0.35 * p})`); g.addColorStop(1, 'rgba(120, 50, 220, 0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, R, 0, TAU); ctx.fill();
  for (let k = 0; k < 7; k++) {
    const ph = (t * 0.35 + k / 7) % 1;
    ctx.fillStyle = `rgba(225, 185, 255, ${0.85 * (1 - ph)})`;
    ctx.beginPath(); ctx.arc(px + Math.sin(k * 2.3 + t) * R * 0.5, py + R * 0.4 - ph * R * 2.2, 1.3, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawArmory(ctx, b, t) {
  const { x, y } = b;
  shadow(ctx, x, y + 2, 34, 12);
  // Stone blockhouse with a flat, crenellated roof.
  const w = 46; const h = 26;
  ctx.fillStyle = '#7c7f86'; ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.strokeStyle = 'rgba(40,40,46,0.35)'; ctx.lineWidth = 1;
  for (let row = 0; row < 4; row++) {
    const yy = y - h + row * 6.5;
    ctx.beginPath(); ctx.moveTo(x - w / 2, yy); ctx.lineTo(x + w / 2, yy); ctx.stroke();
    for (let col = (row % 2) * 5; col < w; col += 10) { ctx.beginPath(); ctx.moveTo(x - w / 2 + col, yy); ctx.lineTo(x - w / 2 + col, yy + 6.5); ctx.stroke(); }
  }
  ctx.fillStyle = '#9ea1a8'; ctx.fillRect(x - w / 2 - 2, y - h - 8, w + 4, 8);
  ctx.fillStyle = '#7c7f86';
  for (let k = 0; k < 5; k++) ctx.fillRect(x - w / 2 - 2 + k * 11, y - h - 13, 6, 5);
  ctx.fillStyle = '#2a2a2e'; ctx.fillRect(x - 6, y - 14, 12, 14);
  ctx.fillStyle = '#1a1a1e'; ctx.fillRect(x - 17, y - 20, 6, 3); ctx.fillRect(x + 11, y - 20, 6, 3);
  // Flag.
  ctx.strokeStyle = '#3e2410'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + 18, y - h - 8); ctx.lineTo(x + 18, y - h - 34); ctx.stroke();
  const f = Math.sin(t * 4) * 2;
  ctx.fillStyle = '#e8b54b';
  ctx.beginPath(); ctx.moveTo(x + 18, y - h - 34); ctx.quadraticCurveTo(x + 28, y - h - 32 + f, x + 36, y - h - 30); ctx.lineTo(x + 18, y - h - 24); ctx.fill();
  // Two cannons facing the lagoon, a shot pyramid and powder barrels.
  const toward = Math.atan2(b.lagoonY - y, b.lagoonX - x);
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(x + side * 22, y + 12); ctx.rotate(toward);
    ctx.fillStyle = '#6a4424'; ctx.fillRect(-6, -5, 12, 10);
    ctx.fillStyle = '#26282c'; ctx.fillRect(-2, -3, 18, 6);
    ctx.fillStyle = '#44474d'; ctx.fillRect(-2, -3, 18, 2);
    ctx.restore();
  }
  ctx.fillStyle = '#24262a';
  for (const [dx, dy] of [[-36, 6], [-30, 6], [-24, 6], [-33, 1], [-27, 1], [-30, -4]]) {
    ctx.beginPath(); ctx.arc(x + dx, y + dy, 3, 0, TAU); ctx.fill();
  }
  barrel(ctx, x + 34, y + 2); barrel(ctx, x + 40, y - 6, 0.85);
}

function drawWorkshop(ctx, b, t) {
  const { x, y } = b;
  shadow(ctx, x, y + 3, 32, 12);
  box(ctx, x, y, 46, 24, 20, '#8a6040', '#5c3d24', '#5b6068', '#3e4248');
  // Forge mouth with flickering glow.
  const fl = 0.7 + Math.sin(t * 11) * 0.15 + Math.sin(t * 17) * 0.1;
  const g = ctx.createRadialGradient(x - 8, y - 8, 0, x - 8, y - 8, 22);
  g.addColorStop(0, `rgba(255, 170, 60, ${0.7 * fl})`); g.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x - 8, y - 8, 22, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 16, y - 16, 16, 16);
  ctx.fillStyle = `rgba(255, 150, 50, ${fl})`; ctx.fillRect(x - 14, y - 9, 12, 7);
  // Chimney and smoke.
  ctx.fillStyle = '#6d5a4a'; ctx.fillRect(x + 10, y - 58, 9, 20);
  ctx.fillStyle = '#4a3b30'; ctx.fillRect(x + 9, y - 60, 11, 3);
  for (let k = 0; k < 5; k++) {
    const ph = (t * 0.28 + k / 5) % 1;
    ctx.fillStyle = `rgba(90, 90, 96, ${0.45 * (1 - ph)})`;
    ctx.beginPath(); ctx.arc(x + 14 + ph * 22 + Math.sin(ph * 6 + k) * 3, y - 62 - ph * 44, 4 + ph * 9, 0, TAU); ctx.fill();
  }
  // Anvil on its block, with the odd spark.
  ctx.fillStyle = '#6a4424'; ctx.fillRect(x + 22, y + 2, 10, 7);
  ctx.fillStyle = '#34363b';
  ctx.beginPath(); ctx.moveTo(x + 18, y + 2); ctx.lineTo(x + 36, y + 2); ctx.lineTo(x + 32, y - 3); ctx.lineTo(x + 22, y - 3); ctx.closePath(); ctx.fill();
  const sp = (t * 1.7) % 1;
  if (sp < 0.3) {
    ctx.fillStyle = '#ffd27a';
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + 27 + Math.cos(k * 1.7) * sp * 30, y - 4 - Math.sin(k * 1.3 + 0.4) * sp * 20, 1.1, 0, TAU); ctx.fill(); }
  }
  barrel(ctx, x - 34, y + 4, 0.9);
}

function drawHall(ctx, b, t, state) {
  const { x, y } = b;
  shadow(ctx, x, y + 3, 36, 12);
  // Keep: a tall stone hall with a steep roof and lit windows.
  box(ctx, x, y, 44, 34, 24, '#a58d6a', '#6e5a3e', '#34546b', '#243c4e');
  ctx.fillStyle = '#2b1c10'; ctx.fillRect(x - 6, y - 16, 12, 16);
  windowGlow(ctx, x - 14, y - 24, 6, 8, t); windowGlow(ctx, x + 14, y - 24, 6, 8, t);
  // Three banners, one per faction. The one you sail under flies highest.
  const ids = ['reavers', 'wyrdtide', 'iron_accord'];
  ids.forEach((id, k) => {
    const faction = FACTIONS[id];
    const bx = x - 30 + k * 30; const selected = state.selectedFaction === id;
    const top = y - (selected ? 92 : 76);
    ctx.strokeStyle = '#3e2410'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(bx, y + (k === 1 ? -58 : 4)); ctx.lineTo(bx, top); ctx.stroke();
    const wave = (u) => Math.sin(t * 3.4 + k * 1.3 + u * 5) * 2.2 * u;
    ctx.fillStyle = faction.color;
    ctx.beginPath(); ctx.moveTo(bx, top);
    for (let u = 0; u <= 1.001; u += 0.2) ctx.lineTo(bx + u * 18, top + wave(u));
    for (let u = 1; u >= -0.001; u -= 0.2) ctx.lineTo(bx + u * 18, top + 11 + wave(u));
    ctx.closePath(); ctx.fill();
    if (selected) { ctx.strokeStyle = '#e8b54b'; ctx.lineWidth = 1.5; ctx.stroke(); }
  });
}

// Tower Yard (Reef Defence, 2026-09-29): the lighthouse island, with a
// couple of the reef's towers standing guard at its foot, drawn by the
// same art the defences use.
function drawTowerYard(ctx, b, t) {
  const { x, y } = b;
  // A short stretch of wall behind the towers.
  ctx.fillStyle = '#8a8478'; ctx.fillRect(x + 12, y + 2, 38, 8);
  ctx.fillStyle = '#a7a194'; ctx.fillRect(x + 12, y - 1, 38, 4);
  ctx.fillStyle = '#77736a'; for (let k = 0; k < 5; k++) ctx.fillRect(x + 13 + k * 8, y - 4, 4, 3);
  const lr = drawBuildingSprite(ctx, 'lighthouse', x, y);
  if (lr) lampGlow(ctx, x, lr.y + lr.h * 0.25, t);
  else drawLighthouse(ctx, { x, y }, t, { cottage: false });
  const show = [
    { towerId: 'cannon', x: x + 22, y: y + 14, level: 3, angle: 0.6 + Math.sin(t * 0.6) * 0.5, id: 1 },
    { towerId: 'flame', x: x + 42, y: y + 8, level: 2, angle: 0, id: 3 },
    { towerId: 'chain', x: x - 26, y: y + 12, level: 2, angle: 2.6 + Math.sin(t * 0.5) * 0.4, id: 2 },
  ];
  for (const T of show) {
    ctx.save(); ctx.translate(T.x, T.y); ctx.scale(0.7, 0.7); ctx.translate(-T.x, -T.y);
    drawTower(ctx, { ...T, spec: null, recoil: 0, stunT: 0, slowT: 0, fireT: 0, inkT: 0, poisonT: 0 }, t);
    ctx.restore();
  }
}

function lampGlow(ctx, x, y, t) {
  const pulse = 0.75 + Math.sin(t * 3) * 0.25;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, 28);
  g.addColorStop(0, `rgba(255, 236, 160, ${0.7 * pulse})`); g.addColorStop(1, 'rgba(255, 236, 160, 0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 28, 0, TAU); ctx.fill();
  ctx.restore();
}

const DRAWERS = {
  shipyard: drawShipyard, lighthouse: drawTowerYard, shrine: drawShrine,
  armory: drawArmory, workshop: drawWorkshop, hall: drawHall,
};

// Draw every building back-to-front (by y), then the lighthouse's beam on
// top so it sweeps over the whole harbour.
export const BUILDING_SCALE = 1.45;

export function drawBaseBuildings(ctx, buildings, t, state = {}) {
  const sorted = [...buildings].sort((a, b) => a.y - b.y);
  for (const b of sorted) {
    ctx.save();
    ctx.translate(b.x, b.y); ctx.scale(BUILDING_SCALE, BUILDING_SCALE); ctx.translate(-b.x, -b.y);
    DRAWERS[b.id]?.(ctx, b, t, state);
    ctx.restore();
  }
  const lh = buildings.find((b) => b.id === 'lighthouse');
  if (lh) drawLighthouseBeam(ctx, lh, t);
}

// Gulls wheeling over the harbour, with their shadows on the water.
export function drawGulls(ctx, centre, t) {
  for (let k = 0; k < 4; k++) {
    const a = t * (0.12 + k * 0.03) + k * 1.7;
    const r = 180 + k * 70;
    const x = centre.x + Math.cos(a) * r; const y = centre.y + Math.sin(a) * r * 0.8;
    const h = a + Math.PI / 2;
    const flap = Math.sin(t * 7 + k) * 3;
    ctx.fillStyle = 'rgba(10, 30, 40, 0.18)';
    ctx.beginPath(); ctx.ellipse(x + 26, y + 34, 6, 2, h, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(h);
    ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8, -flap); ctx.quadraticCurveTo(-3, 0, 0, 1); ctx.quadraticCurveTo(3, 0, 8, -flap); ctx.stroke();
    ctx.restore();
  }
}

// Harbour life (engine/base.mjs `decor`): jetties, moored ships, buoys,
// wrecks and rocks, drawn on the water under the buildings.
export function drawHarbourDecor(ctx, decor, t, { drawShip, drawLandmark }) {
  for (const d of decor) {
    if (d.kind === 'jetty') drawJetty(ctx, d, t);
    else if (d.kind === 'rocks') drawRocks(ctx, d, t);
    else if (d.kind === 'buoy') drawBuoy(ctx, d, t);
  }
  for (const d of decor) {
    if (d.kind === 'moored') {
      const bob = Math.sin(t * 1.1 + d.x) * 0.04;
      drawShip(ctx, { x: d.x, y: d.y, heading: d.heading + bob, style: d.style, vx: 0, vy: 0 }, d.scale, t + d.x);
    } else if (d.kind === 'rowboat') drawRowboat(ctx, d, t);
    else if (d.kind === 'wreck') drawLandmark(ctx, 'wreck', d.x, d.y, t, d.scale, d.angle);
  }
}

function drawJetty(ctx, d, t) {
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.angle);
  const L = d.len; const W = 11;
  ctx.fillStyle = 'rgba(5, 25, 30, .3)'; ctx.fillRect(3, -W / 2 + 4, L, W);
  // Pilings, then the planked deck.
  ctx.fillStyle = '#3a2410';
  for (let x = 6; x < L; x += 14) for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x, s * (W / 2 + 0.5), 2.2, 0, TAU); ctx.fill(); }
  const g = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
  g.addColorStop(0, '#b98a52'); g.addColorStop(1, '#7c5428');
  ctx.fillStyle = g; ctx.fillRect(0, -W / 2, L, W);
  ctx.strokeStyle = 'rgba(50, 28, 10, .55)'; ctx.lineWidth = 0.7;
  for (let x = 3; x < L; x += 3.2) { ctx.beginPath(); ctx.moveTo(x, -W / 2); ctx.lineTo(x, W / 2); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255, 240, 200, .25)'; ctx.fillRect(0, -W / 2, L, 1);
  // Foam round the end posts.
  ctx.strokeStyle = `rgba(235, 250, 255, ${0.35 + 0.15 * Math.sin(t * 2 + d.x)})`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(L, 0, W * 0.75, -1.2, 1.2); ctx.stroke();
  // Crates, a coil of rope and a lantern post at the end.
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(L * 0.35, -W / 2 + 1, 5, 5);
  ctx.strokeStyle = '#3e2410'; ctx.lineWidth = 0.6; ctx.strokeRect(L * 0.35, -W / 2 + 1, 5, 5);
  ctx.strokeStyle = '#d9c08a'; for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.arc(L * 0.6, 2, k * 1.1, 0, TAU); ctx.stroke(); }
  ctx.restore();
  // The lantern stays upright in screen space.
  const ex = d.x + Math.cos(d.angle) * (d.len - 3); const ey = d.y + Math.sin(d.angle) * (d.len - 3);
  ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex, ey - 14); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const fl = 0.8 + 0.2 * Math.sin(t * 6 + d.x);
  const lg = ctx.createRadialGradient(ex, ey - 15, 0, ex, ey - 15, 16 * fl);
  lg.addColorStop(0, 'rgba(255, 210, 120, .7)'); lg.addColorStop(1, 'rgba(255, 150, 60, 0)');
  ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(ex, ey - 15, 16 * fl, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffe2a0'; ctx.fillRect(ex - 1.6, ey - 17, 3.2, 4);
}

function drawRocks(ctx, d, t) {
  for (const r of d.stones) {
    const x = d.x + r.dx; const y = d.y + r.dy;
    ctx.strokeStyle = `rgba(235, 250, 255, ${0.35 + 0.2 * Math.sin(t * 1.7 + x)})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(x, y + r.r * 0.3, r.r * 1.35, r.r * 0.9, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(5, 25, 30, .35)'; ctx.beginPath(); ctx.ellipse(x + r.r * 0.4, y + r.r * 0.5, r.r, r.r * 0.6, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(x - r.r * 0.4, y - r.r * 0.5, 0, x, y, r.r * 1.2);
    g.addColorStop(0, '#a7a49b'); g.addColorStop(0.6, '#6f6d68'); g.addColorStop(1, '#3d3c3a');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU; const rr = r.r * (0.8 + 0.25 * Math.sin(k * 2.7 + r.r));
      const px = x + Math.cos(a) * rr; const py = y + Math.sin(a) * rr * 0.8;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(110, 150, 70, .55)'; ctx.beginPath(); ctx.ellipse(x - r.r * 0.2, y - r.r * 0.45, r.r * 0.45, r.r * 0.22, 0, 0, TAU); ctx.fill();
  }
}

function drawBuoy(ctx, d, t) {
  const bob = Math.sin(t * 2 + d.x * 0.1) * 1.2;
  ctx.strokeStyle = 'rgba(235, 250, 255, .45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 6, 3, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(5, 25, 30, .3)'; ctx.beginPath(); ctx.ellipse(d.x + 2, d.y + 3, 4, 2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = d.color; ctx.beginPath(); ctx.moveTo(d.x - 4, d.y + bob); ctx.lineTo(d.x + 4, d.y + bob); ctx.lineTo(d.x, d.y - 11 + bob); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f4ead0'; ctx.fillRect(d.x - 2.6, d.y - 5 + bob, 5.2, 1.6);
  const on = Math.sin(t * 3 + d.x) > 0.6;
  if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255, 230, 150, .7)'; ctx.beginPath(); ctx.arc(d.x, d.y - 12 + bob, 3.5, 0, TAU); ctx.fill(); ctx.restore(); }
}

function drawRowboat(ctx, d, t) {
  ctx.save(); ctx.translate(d.x, d.y + Math.sin(t * 1.3 + d.x) * 0.6); ctx.rotate(d.heading);
  ctx.fillStyle = 'rgba(5, 25, 30, .3)'; ctx.beginPath(); ctx.ellipse(2, 3, 10, 4.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7a4a22'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 4.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#c99a5c'; ctx.beginPath(); ctx.ellipse(-0.5, 0, 8, 3, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7a4a22'; ctx.fillRect(-2, -3, 1.6, 6); ctx.fillRect(3, -3, 1.6, 6);
  ctx.strokeStyle = '#5a3616'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-1, -3); ctx.lineTo(-4, -8); ctx.moveTo(-1, 3); ctx.lineTo(-4, 8); ctx.stroke();
  ctx.restore();
}

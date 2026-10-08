// Reef Defence art (2026-09-29), drawn in code like the rest of the game:
// build spots, the six towers at every level and specialisation, the Heart
// of the Reef, tower shots, mines, burning pitch, range rings and the
// wave-entry markers. Same light as the harbour buildings (from the
// top-left, soft shadows down-right), towers in a slight three-quarter
// view so they read as buildings standing on the island.

import { shadow } from './baseRenderer.mjs';
import { drawTowerSprite, towerSpriteReady, towerSpriteScale, towerLampPoint, towerSpriteRect, TOWER_SPRITES } from './towerSprites.mjs';

const TAU = Math.PI * 2;

function stonePad(ctx, x, y, r, spec) {
  shadow(ctx, x, y + 1, r * 1.05, r * 0.5);
  ctx.fillStyle = '#5c5a55'; ctx.beginPath(); ctx.ellipse(x, y + 1.5, r, r * 0.52, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = spec ? '#b89a52' : '#8d8a80'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.94, r * 0.46, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.12, r * 0.5, r * 0.18, 0, 0, TAU); ctx.fill();
}

// A cylinder seen from the front-top: side wall + lit top ellipse.
function cylinder(ctx, x, y, r, h, side, sideDark, top) {
  ctx.fillStyle = side;
  ctx.beginPath(); ctx.moveTo(x - r, y - h); ctx.lineTo(x - r, y); ctx.ellipse(x, y, r, r * 0.45, 0, Math.PI, 0, true); ctx.lineTo(x + r, y - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = sideDark;
  ctx.beginPath(); ctx.moveTo(x + r * 0.2, y - h); ctx.lineTo(x + r * 0.2, y + r * 0.44); ctx.ellipse(x, y, r, r * 0.45, 0, Math.PI * 0.43, 0, true); ctx.lineTo(x + r, y - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = top; ctx.beginPath(); ctx.ellipse(x, y - h, r, r * 0.45, 0, 0, TAU); ctx.fill();
}

function barrelOut(ctx, x, y, angle, len, w, recoil, color = '#26282c') {
  const dx = Math.cos(angle); const dy = Math.sin(angle) * 0.62;
  const back = recoil * 3;
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - dx * (2 + back), y - dy * (2 + back)); ctx.lineTo(x + dx * (len - back), y + dy * (len - back)); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = Math.max(1, w * 0.3);
  ctx.beginPath(); ctx.moveTo(x - dx * back, y - dy * back - w * 0.25); ctx.lineTo(x + dx * (len - back - 1), y + dy * (len - back - 1) - w * 0.25); ctx.stroke();
}

function pennant(ctx, x, y, h, color, t, k = 0) {
  ctx.strokeStyle = '#3e2a16'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  const wv = Math.sin(t * 5 + k) * 1.5;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + 9, y - h + 2.5 + wv); ctx.lineTo(x, y - h + 5); ctx.closePath(); ctx.fill();
}

// ---------------------------------------------------------------- towers
function drawCannon(ctx, T, t) {
  const { x, y, level, spec } = T; const s = 1 + (level - 1) * 0.1;
  const r = 9.5 * s; const h = 9 + level * 2.5;
  cylinder(ctx, x, y, r, h, '#8f8a7e', '#6b675e', '#a9a397');
  // Crenellations.
  ctx.fillStyle = '#77736a';
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; ctx.fillRect(x + Math.cos(a) * r * 0.86 - 1.6, y - h + Math.sin(a) * r * 0.39 - 3.2, 3.2, 3.2); }
  ctx.fillStyle = '#5a564e'; ctx.beginPath(); ctx.ellipse(x, y - h, r * 0.62, r * 0.28, 0, 0, TAU); ctx.fill();
  if (level >= 3 || spec) { ctx.fillStyle = '#d9b34a'; ctx.fillRect(x - r, y - h * 0.45, r * 2, 1.6); }
  const len = spec === 'long_nines' ? 17 : spec === 'carronade' ? 9 : 11 + level;
  const w = spec === 'carronade' ? 7 : spec === 'long_nines' ? 4 : 4.5 + level * 0.3;
  const top = y - h - 1;
  if (level >= 3 && !spec) {
    const px = -Math.sin(T.angle) * 3; const py = Math.cos(T.angle) * 1.8;
    barrelOut(ctx, x + px, top + py, T.angle, len, w - 1, T.recoil);
    barrelOut(ctx, x - px, top - py, T.angle, len, w - 1, T.recoil);
  } else barrelOut(ctx, x, top, T.angle, len, w, T.recoil);
  if (level >= 2) pennant(ctx, x - r * 0.7, y - h - 1, 12, spec ? '#d9b34a' : '#c0392b', t, T.id);
}

function drawGrape(ctx, T, t) {
  const { x, y, level, spec } = T; const r = 10 + level;
  // A palisade of logs around a sandbagged gun pit.
  ctx.fillStyle = '#6a4424';
  ctx.beginPath(); ctx.ellipse(x, y - 2, r, r * 0.5, 0, 0, TAU); ctx.fill();
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU; const px = x + Math.cos(a) * r; const py = y - 2 + Math.sin(a) * r * 0.5;
    const hh = 6 + level + (Math.sin(a) > 0 ? 2 : 0);
    ctx.fillStyle = k % 2 ? '#8a5a2b' : '#7a4c22';
    ctx.fillRect(px - 1.5, py - hh, 3, hh);
    ctx.fillStyle = '#a8763c'; ctx.beginPath(); ctx.ellipse(px, py - hh, 1.5, 0.8, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#c9b184'; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.ellipse(x + k * 5, y - 5, 3.2, 2, 0, 0, TAU); ctx.fill(); }
  const n = spec === 'swivel_battery' ? 4 : spec === 'canister' ? 1 : Math.min(3, level);
  const w = spec === 'canister' ? 8 : 3.2;
  for (let k = 0; k < n; k++) {
    const off = (k - (n - 1) / 2) * 3.4;
    barrelOut(ctx, x - Math.sin(T.angle) * off, y - 9 + Math.cos(T.angle) * off * 0.6, T.angle + (k - (n - 1) / 2) * 0.12, spec === 'canister' ? 11 : 9, w, T.recoil, '#3a3530');
  }
  if (spec === 'canister') { ctx.fillStyle = '#d9b34a'; ctx.beginPath(); ctx.arc(x + Math.cos(T.angle) * 9, y - 9 + Math.sin(T.angle) * 5.6, 3.8, 0, TAU); ctx.fill(); }
  if (level >= 2) pennant(ctx, x + r - 2, y - 6, 12, spec ? '#d9b34a' : '#2f7fa8', t, T.id);
}

function drawChain(ctx, T, t) {
  const { x, y, level, spec } = T;
  const H = 26 + level * 4;
  // Timber base.
  ctx.fillStyle = '#6a4424'; ctx.fillRect(x - 8, y - 6, 16, 7);
  ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.ellipse(x, y - 6, 8, 3.4, 0, 0, TAU); ctx.fill();
  // Shrouds.
  ctx.strokeStyle = 'rgba(40,30,20,0.7)'; ctx.lineWidth = 0.8;
  for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + k * 8, y - 3); ctx.lineTo(x, y - H + 4); ctx.stroke(); }
  // Mast.
  ctx.fillStyle = '#5a3616'; ctx.fillRect(x - 1.8, y - H, 3.6, H - 4);
  // Crow's nest.
  ctx.fillStyle = '#7a4c22'; ctx.beginPath(); ctx.ellipse(x, y - H + 2, 6, 2.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x - 6, y - H + 2, 12, 3);
  // Launcher arm swinging to its target with a chain whirling.
  const ax = x; const ay = y - H + 1;
  const len = spec === 'harpoon_ballista' ? 14 : 10;
  barrelOut(ctx, ax, ay, T.angle, len, spec === 'harpoon_ballista' ? 3 : 2.6, T.recoil, '#4a4f58');
  if (spec === 'harpoon_ballista') {
    const dx = Math.cos(T.angle); const dy = Math.sin(T.angle) * 0.62;
    ctx.strokeStyle = '#6a4424'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax - dy * 8, ay + dx * 5); ctx.quadraticCurveTo(ax + dx * 4, ay + dy * 4, ax + dy * 8, ay - dx * 5); ctx.stroke();
  } else {
    const spin = t * (8 + level * 2) + T.id;
    const cx = ax + Math.cos(T.angle) * len; const cy = ay + Math.sin(T.angle) * len * 0.62;
    const rr = spec === 'bola_mast' ? 6 : 4.5;
    ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - Math.cos(spin) * rr, cy - Math.sin(spin) * rr * 0.6); ctx.lineTo(cx + Math.cos(spin) * rr, cy + Math.sin(spin) * rr * 0.6); ctx.stroke();
    ctx.fillStyle = '#5b6068';
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + Math.cos(spin) * rr * k, cy + Math.sin(spin) * rr * 0.6 * k, spec === 'bola_mast' ? 2.4 : 1.8, 0, TAU); ctx.fill(); }
  }
  pennant(ctx, x, y - H, 7, spec ? '#d9b34a' : '#e9ddc4', t, T.id);
}

function drawDepth(ctx, T, t) {
  const { x, y, level, spec } = T;
  // A stone pier with a crane and a stack of charges.
  ctx.fillStyle = '#6f6a60'; ctx.fillRect(x - 10, y - 7, 20, 8);
  ctx.fillStyle = '#8f8a7e'; ctx.fillRect(x - 10, y - 9, 20, 3);
  const stack = spec === 'mine_layer' ? 4 : 2 + level;
  for (let k = 0; k < stack; k++) {
    const bx = x - 7 + (k % 3) * 4.5; const by = y - 10 - Math.floor(k / 3) * 4;
    ctx.fillStyle = spec === 'mine_layer' ? '#2e3438' : '#3d5a4a';
    if (spec === 'mine_layer') { ctx.beginPath(); ctx.arc(bx, by, 2.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#c0392b'; ctx.fillRect(bx - 0.5, by - 3.5, 1, 1.5); }
    else { ctx.fillRect(bx - 2, by - 2.4, 4, 4.8); ctx.fillStyle = '#c9a54a'; ctx.fillRect(bx - 2, by - 0.6, 4, 0.8); }
  }
  // Crane swinging toward its target.
  const H = 18 + level * 2;
  ctx.strokeStyle = '#5a3616'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + 6, y - 8); ctx.lineTo(x + 6, y - H); ctx.stroke();
  const ex = x + 6 + Math.cos(T.angle) * (10 + level); const ey = y - H + Math.sin(T.angle) * 5;
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 6, y - H); ctx.lineTo(ex, ey); ctx.stroke();
  const hang = 6 + T.recoil * -4;
  ctx.strokeStyle = '#e9ddc4'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex, ey + hang); ctx.stroke();
  if (T.recoil < 0.5) { ctx.fillStyle = spec === 'heavy_charges' ? '#1e3a2e' : '#3d5a4a'; const sz = spec === 'heavy_charges' ? 4 : 3; ctx.fillRect(ex - sz / 2, ey + hang, sz, sz * 1.3); }
  if (level >= 2) pennant(ctx, x - 9, y - 8, 11, spec ? '#d9b34a' : '#3d8f6a', t, T.id);
}

function drawFlame(ctx, T, t) {
  const { x, y, level, spec } = T; const s = 1 + (level - 1) * 0.12;
  // Iron tripod and bowl.
  ctx.strokeStyle = '#2b2a2e'; ctx.lineWidth = 2;
  for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(x + k * 7 * s, y); ctx.lineTo(x + k * 2, y - 10 * s); ctx.stroke(); }
  ctx.fillStyle = spec === 'greek_fire' ? '#6a5a2a' : '#3b3a3f';
  ctx.beginPath(); ctx.moveTo(x - 9 * s, y - 12 * s); ctx.quadraticCurveTo(x, y - 3 * s, x + 9 * s, y - 12 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#55545a'; ctx.beginPath(); ctx.ellipse(x, y - 12 * s, 9 * s, 3 * s, 0, 0, TAU); ctx.fill();
  // Flames: licking, layered, leaning toward the target when firing.
  const lean = Math.cos(T.angle) * T.recoil * 4;
  const big = spec === 'dragons_breath' ? 1.35 : 1;
  for (let k = 0; k < 5; k++) {
    const f = (Math.sin(t * 9 + k * 1.7 + T.id) + 1) / 2;
    const fx = x + (k - 2) * 2.6 * s + lean * 0.5; const fy = y - 12 * s;
    const hh = (7 + f * 6 + level * 1.5) * big;
    ctx.fillStyle = k % 2 ? 'rgba(255, 120, 30, 0.9)' : 'rgba(255, 190, 60, 0.9)';
    ctx.beginPath(); ctx.moveTo(fx - 2.6, fy); ctx.quadraticCurveTo(fx - 2 + lean, fy - hh * 0.6, fx + lean, fy - hh); ctx.quadraticCurveTo(fx + 2 + lean, fy - hh * 0.6, fx + 2.6, fy); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 245, 190, 0.9)'; ctx.beginPath(); ctx.ellipse(x, y - 13 * s, 4 * s, 1.8 * s, 0, 0, TAU); ctx.fill();
  if (spec === 'dragons_breath') { // a dragon-head nozzle
    ctx.fillStyle = '#7a2a18'; ctx.beginPath(); ctx.ellipse(x + Math.cos(T.angle) * 9, y - 12 + Math.sin(T.angle) * 5, 4, 3, T.angle, 0, TAU); ctx.fill();
  }
}

function drawLightTower(ctx, T, t) {
  const { x, y, level, spec } = T;
  const H = 24 + level * 5; const b0 = 6.5; const b1 = 4.2;
  ctx.fillStyle = '#6b6c69'; ctx.beginPath(); ctx.ellipse(x, y - 1, 9, 4, 0, 0, TAU); ctx.fill();
  const stripes = spec === 'beacon_of_fortune' ? ['#f3efe6', '#d9b34a'] : spec === 'blinding_lamp' ? ['#f3efe6', '#3a4a8a'] : ['#f3efe6', '#c9402f'];
  for (let k = 0; k < 4; k++) {
    const y0 = y - (H * k) / 4; const y1 = y - (H * (k + 1)) / 4;
    const w0 = b0 + ((b1 - b0) * k) / 4; const w1 = b0 + ((b1 - b0) * (k + 1)) / 4;
    ctx.fillStyle = stripes[k % 2];
    ctx.beginPath(); ctx.moveTo(x - w0, y0); ctx.lineTo(x + w0, y0); ctx.lineTo(x + w1, y1); ctx.lineTo(x - w1, y1); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + b0, y); ctx.lineTo(x + b1, y - H); ctx.lineTo(x + 1, y - H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2b2a2e'; ctx.fillRect(x - 6, y - H - 1, 12, 2);
  const pulse = 0.8 + Math.sin(t * 3 + T.id) * 0.2;
  const lamp = spec === 'blinding_lamp' ? '255, 250, 230' : '255, 236, 160';
  const g = ctx.createRadialGradient(x, y - H - 5, 0, x, y - H - 5, 16);
  g.addColorStop(0, `rgba(${lamp}, ${0.9 * pulse})`); g.addColorStop(1, `rgba(${lamp}, 0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - H - 5, 16, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe9a0'; ctx.fillRect(x - 3.5, y - H - 8, 7, 6);
  ctx.fillStyle = spec === 'beacon_of_fortune' ? '#b8902a' : '#8f2f1f';
  ctx.beginPath(); ctx.moveTo(x - 5, y - H - 8); ctx.lineTo(x + 5, y - H - 8); ctx.lineTo(x, y - H - 14); ctx.closePath(); ctx.fill();
}

// The sweeping beam, drawn after everything else (it lights the water).
export function drawLighthouseBeams(ctx, towers, rangeOf, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const T of towers) {
    if (T.towerId !== 'lighthouse') continue;
    const r = rangeOf(T); const lp = towerLampPoint(T); const ly = lp ? lp.y : T.y - 24 - T.level * 5 - 5;
    const a = t * 0.8 + T.id;
    const blind = T.spec === 'blinding_lamp';
    for (const off of blind ? [0, Math.PI * 2 / 3, Math.PI * 4 / 3] : [0, Math.PI]) {
      const g = ctx.createRadialGradient(T.x, ly, 0, T.x, ly, r);
      g.addColorStop(0, blind ? 'rgba(255, 255, 240, 0.28)' : 'rgba(255, 240, 180, 0.2)'); g.addColorStop(1, 'rgba(255, 240, 180, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(T.x, ly); ctx.arc(T.x, ly, r, a + off - 0.16, a + off + 0.16); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

const DRAW = { cannon: drawCannon, grapeshot: drawGrape, chain: drawChain, depth: drawDepth, flame: drawFlame, lighthouse: drawLightTower };

export function drawTower(ctx, T, t) {
  const toy = towerSpriteReady(T.towerId);
  if (!toy) stonePad(ctx, T.x, T.y + 3, 13, !!T.spec);
  // A fresh tower rises out of the ground.
  const age = T.builtAge ?? 1;
  ctx.save();
  if (age < 1) { const k = 0.4 + 0.6 * easeOutBack(age); ctx.translate(T.x, T.y); ctx.scale(k, k); ctx.translate(-T.x, -T.y); }
  if (toy) {
    // Toy art: a gold ring under a specialised tower; a recoil bob on firing.
    if (T.spec) { ctx.strokeStyle = 'rgba(217, 179, 74, 0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(T.x, T.y + 4, 15, 6.5, 0, 0, TAU); ctx.stroke(); }
    drawTowerSprite(ctx, T.towerId, T.x, T.y + (T.recoil || 0) * 1.2, towerSpriteScale(T.level));
    if (T.towerId === 'lighthouse') {
      const p = towerLampPoint(T);
      const pulse = 0.8 + Math.sin(t * 3 + (T.id || 0)) * 0.2;
      const lamp = T.spec === 'blinding_lamp' ? '255, 250, 230' : '255, 236, 160';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
      g.addColorStop(0, `rgba(${lamp}, ${0.75 * pulse})`); g.addColorStop(1, `rgba(${lamp}, 0)`);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, TAU); ctx.fill(); ctx.restore();
    }
  } else DRAW[T.towerId](ctx, T, t);
  ctx.restore();
  // Rattled by enemy fire: a status mark over the tower.
  const mark = T.stunT > 0 ? '💫' : T.slowT > 0 ? '❄' : T.fireT > 0 ? '🔥' : T.inkT > 0 ? '🌑' : T.poisonT > 0 ? '☠' : null;
  if (mark) {
    ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(mark, T.x + 10, T.y - 34 + Math.sin(t * 6) * 1.5);
  }
  // Level pips.
  if (!T.spec) {
    for (let k = 0; k < T.level; k++) { ctx.fillStyle = '#ffd35c'; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(T.x - (T.level - 1) * 3 + k * 6, T.y + 11, 2, 0, TAU); ctx.fill(); ctx.stroke(); }
  } else {
    ctx.fillStyle = '#ffd35c'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
    star(ctx, T.x, T.y + 11, 4.2); ctx.fill(); ctx.stroke();
  }
}

function easeOutBack(u) { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2; }
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5; const rr = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
}

// An empty build spot: a cleared stone ring with a stake and a "+" glint.
export function drawSpot(ctx, sp, t, { selected = false, affordable = true } = {}) {
  ctx.fillStyle = 'rgba(10, 30, 20, 0.28)'; ctx.beginPath(); ctx.ellipse(sp.x + 2, sp.y + 3, 14, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7b6a4a'; ctx.beginPath(); ctx.ellipse(sp.x, sp.y + 1, 13, 6.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#a58f63'; ctx.beginPath(); ctx.ellipse(sp.x, sp.y, 11.5, 5.5, 0, 0, TAU); ctx.fill();
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU; ctx.fillStyle = k % 2 ? '#8d8a80' : '#77736a';
    ctx.beginPath(); ctx.ellipse(sp.x + Math.cos(a) * 12, sp.y + Math.sin(a) * 6, 2.6, 1.8, 0, 0, TAU); ctx.fill();
  }
  const p = (Math.sin(t * 2.4 + sp.id) + 1) / 2;
  ctx.strokeStyle = selected ? '#ffe28a' : affordable ? `rgba(255, 240, 200, ${0.55 + p * 0.35})` : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sp.x - 4, sp.y); ctx.lineTo(sp.x + 4, sp.y); ctx.moveTo(sp.x, sp.y - 4); ctx.lineTo(sp.x, sp.y + 4); ctx.stroke();
  if (selected) {
    ctx.strokeStyle = 'rgba(255, 226, 138, 0.9)'; ctx.setLineDash([4, 3]); ctx.lineDashOffset = -t * 12;
    ctx.beginPath(); ctx.ellipse(sp.x, sp.y, 17, 9, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
}

export function drawRange(ctx, x, y, r, t, color = '255, 236, 160') {
  ctx.fillStyle = `rgba(${color}, 0.10)`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(${color}, 0.75)`; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 14;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
}

// ---------------------------------------------------------------- the Heart
export function drawHeart(ctx, heart, t, { lives, maxLives, hurt = 0 }) {
  const { x, y } = heart;
  const f = Math.max(0, lives / maxLives);
  if (towerSpriteReady('heart')) { drawHeartSprite(ctx, x, y, t, f, hurt); return; }
  // A ring of coral around a glowing pearl.
  ctx.save();
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU + 0.2; const rr = 22 + (k % 3) * 2;
    const cx = x + Math.cos(a) * rr; const cy = y + Math.sin(a) * rr * 0.8;
    ctx.fillStyle = ['#ff7a8a', '#ffb07a', '#e85a9a'][k % 3];
    ctx.beginPath(); ctx.ellipse(cx, cy, 5, 3.4, a, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(cx - 1, cy - 1, 1.2, 0, TAU); ctx.fill();
  }
  const pulse = 0.75 + Math.sin(t * (f < 0.35 ? 7 : 2.4)) * 0.25;
  const glowC = f < 0.35 ? '255, 110, 110' : '140, 245, 255';
  const g = ctx.createRadialGradient(x, y, 0, x, y, 46);
  g.addColorStop(0, `rgba(${glowC}, ${0.55 * pulse + hurt * 0.4})`); g.addColorStop(1, `rgba(${glowC}, 0)`);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 46, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const pg = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, 11);
  pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.4, f < 0.35 ? '#ffc0c0' : '#c8fbff'); pg.addColorStop(1, f < 0.35 ? '#b04050' : '#3aa8c8');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(x, y - 2, 10 + hurt * 3, 0, TAU); ctx.fill();
  // Orbiting motes.
  for (let k = 0; k < 5; k++) {
    const a = t * 0.9 + (k / 5) * TAU;
    ctx.fillStyle = `rgba(${glowC}, 0.8)`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 16, y - 2 + Math.sin(a) * 9, 1.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- shots
export function drawTdProjectile(ctx, p, t) {
  if (p.kind === 'charge') {
    const u = Math.min(1, p.t / p.flight); const h = Math.sin(u * Math.PI) * 26;
    ctx.fillStyle = 'rgba(4, 30, 40, 0.35)'; ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 3, 4.5, 3, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(p.x, p.y - h); ctx.rotate(t * 6 + p.id);
    ctx.fillStyle = p.st?.splash > 50 ? '#1e3a2e' : '#3d5a4a'; ctx.fillRect(-4, -3, 8, 6);
    ctx.fillStyle = '#c9a54a'; ctx.fillRect(-4, -1, 8, 0.9);
    ctx.restore();
    // Where it will land.
    ctx.strokeStyle = `rgba(120, 220, 170, ${0.3 + u * 0.4})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.tx, p.ty, (p.st?.splash || 30) * (1.2 - u * 0.2), 0, TAU); ctx.stroke();
    return;
  }
  const vx = p.vx || 0; const vy = p.vy || 0; const sp = Math.hypot(vx, vy) || 1; const ux = vx / sp; const uy = vy / sp;
  if (p.kind === 'chain') {
    const a = t * 18 + p.id; const r = p.st?.pierce > 3 ? 0 : 4.5;
    if (r === 0) { // a harpoon
      ctx.strokeStyle = '#c9d4dc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - ux * 12, p.y - uy * 12); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = '#e8eef2'; ctx.beginPath(); ctx.moveTo(p.x + ux * 4, p.y + uy * 4); ctx.lineTo(p.x - uy * 3, p.y + ux * 3); ctx.lineTo(p.x + uy * 3, p.y - ux * 3); ctx.fill();
      return;
    }
    const cx = Math.cos(a) * r; const cy = Math.sin(a) * r;
    ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(p.x - cx, p.y - cy); ctx.lineTo(p.x + cx, p.y + cy); ctx.stroke();
    ctx.fillStyle = '#5b6068'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.arc(p.x + cx * k, p.y + cy * k, 2.2, 0, TAU); ctx.fill(); }
    return;
  }
  if (p.kind === 'grape') {
    ctx.fillStyle = '#e8e2d0';
    for (let k = 0; k < 4; k++) { const o = (k - 1.5) * 2.2; ctx.beginPath(); ctx.arc(p.x - uy * o - ux * k, p.y + ux * o - uy * k, 1.5, 0, TAU); ctx.fill(); }
    return;
  }
  if (p.kind === 'fire') {
    for (let k = 3; k >= 1; k--) { ctx.fillStyle = `rgba(255, ${120 + k * 30}, 40, ${0.2 * (4 - k)})`; ctx.beginPath(); ctx.arc(p.x - ux * k * 4, p.y - uy * k * 4, 3 + k, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.8, 0, TAU); ctx.fill();
    return;
  }
  ctx.fillStyle = 'rgba(200, 200, 190, 0.35)';
  for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(p.x - ux * k * 4, p.y - uy * k * 4, 2.6 - k * 0.5, 0, TAU); ctx.fill(); }
  const big = p.st?.damage > 60;
  ctx.fillStyle = '#23262a'; ctx.beginPath(); ctx.arc(p.x, p.y, big ? 4 : 3, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(p.x - 1, p.y - 1, 1, 0, TAU); ctx.fill();
}

export function drawMine(ctx, m, t) {
  const bob = Math.sin(t * 2 + m.id) * 0.8;
  ctx.fillStyle = 'rgba(4, 30, 40, 0.3)'; ctx.beginPath(); ctx.ellipse(m.x + 1.5, m.y + 2, 5, 3, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2e3438'; ctx.beginPath(); ctx.arc(m.x, m.y + bob, 4, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2e3438'; ctx.lineWidth = 1.2;
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; ctx.beginPath(); ctx.moveTo(m.x + Math.cos(a) * 4, m.y + bob + Math.sin(a) * 4); ctx.lineTo(m.x + Math.cos(a) * 6, m.y + bob + Math.sin(a) * 6); ctx.stroke(); }
  ctx.fillStyle = m.armT > 0 ? '#555' : (Math.sin(t * 8 + m.id) > 0 ? '#ff4a3a' : '#7a1a14');
  ctx.beginPath(); ctx.arc(m.x, m.y + bob - 1, 1.2, 0, TAU); ctx.fill();
}

export function drawPool(ctx, p, t) {
  const a = Math.min(1, p.t / 1.2);
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
  g.addColorStop(0, `rgba(255, 200, 80, ${0.55 * a})`); g.addColorStop(0.6, `rgba(255, 110, 30, ${0.35 * a})`); g.addColorStop(1, 'rgba(120, 30, 10, 0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
  for (let k = 0; k < 5; k++) {
    const ang = (k / 5) * TAU + p.x; const rr = p.r * 0.5 * ((Math.sin(t * 3 + k) + 1) / 2);
    const fx = p.x + Math.cos(ang) * rr; const fy = p.y + Math.sin(ang) * rr;
    const h = 4 + ((Math.sin(t * 11 + k * 2 + p.x) + 1) / 2) * 5;
    ctx.fillStyle = `rgba(255, ${150 + k * 15}, 40, ${0.8 * a})`;
    ctx.beginPath(); ctx.moveTo(fx - 2, fy); ctx.quadraticCurveTo(fx, fy - h, fx + 2, fy); ctx.fill();
  }
}

// A flame jet (Dragon's Breath), drawn for a moment after each puff.
export function drawBreath(ctx, b) {
  const a = b.life / b.maxLife;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, b.range);
  g.addColorStop(0, `rgba(255, 220, 120, ${0.55 * a})`); g.addColorStop(0.6, `rgba(255, 120, 30, ${0.35 * a})`); g.addColorStop(1, 'rgba(200, 40, 0, 0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, b.range, b.angle - b.cone, b.angle + b.cone); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// Where the next wave comes in: a pulsing chevron at each lane's mouth,
// with a bird if it brings flyers.
export function drawEntryMarkers(ctx, map, lanesUsed, t, flyers) {
  for (const l of map.lanes) {
    if (!lanesUsed.has(l.id)) continue;
    const p = l.ground.pts.find((q) => q.x > 8 && q.y > 8 && q.x < map.widthPx - 8 && q.y < map.heightPx - 8) || l.ground.pts[0];
    const i = l.ground.pts.indexOf(p); const n = l.ground.pts[Math.min(l.ground.pts.length - 1, i + 3)];
    const a = Math.atan2(n.y - p.y, n.x - p.x);
    const px = p.x + Math.cos(a) * 18; const py = p.y + Math.sin(a) * 18;
    const pulse = (Math.sin(t * 5) + 1) / 2;
    ctx.save(); ctx.translate(px, py); ctx.rotate(a);
    for (let k = 0; k < 3; k++) {
      const off = ((t * 1.6 + k / 3) % 1) * 22;
      ctx.strokeStyle = `rgba(255, 90, 70, ${0.9 * (1 - off / 22)})`; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(off - 5, -7); ctx.lineTo(off + 2, 0); ctx.lineTo(off - 5, 7); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = `rgba(255, 90, 70, ${0.25 + pulse * 0.25})`; ctx.beginPath(); ctx.arc(px, py, 14 + pulse * 3, 0, TAU); ctx.fill();
    ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.fillText(flyers ? '🪶' : '!', px, py + 0.5);
  }
}

// The flyers' route, faintly, while a wave with flyers is coming.
export function drawAirRoutes(ctx, map, lanesUsed, t) {
  ctx.save(); ctx.setLineDash([2, 7]); ctx.lineDashOffset = -t * 20; ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 2;
  for (const l of map.lanes) {
    if (!lanesUsed.has(l.id)) continue;
    ctx.beginPath(); l.air.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  }
  ctx.restore();
}

// The toy Heart: the crystal on its coral base, glowing teal (red when low),
// swelling when hit, with motes circling the crystal.
function drawHeartSprite(ctx, x, y, t, f, hurt) {
  const low = f < 0.35;
  const pulse = 0.75 + Math.sin(t * (low ? 7 : 2.4)) * 0.25;
  const glowC = low ? '255, 110, 110' : '140, 245, 255';
  const r0 = towerSpriteRect('heart', x, y, 1 + hurt * 0.06, { w: 220, h: 216 });
  const [gx, gy] = TOWER_SPRITES.heart.glow;
  const cx = r0.x + r0.w * gx; const cy = r0.y + r0.h * gy;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
  g.addColorStop(0, `rgba(${glowC}, ${0.5 * pulse + hurt * 0.4})`); g.addColorStop(1, `rgba(${glowC}, 0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 50, 0, TAU); ctx.fill();
  ctx.restore();
  drawTowerSprite(ctx, 'heart', x, y, 1 + hurt * 0.06);
  if (low) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
    rg.addColorStop(0, `rgba(255, 90, 90, ${0.45 * pulse})`); rg.addColorStop(1, 'rgba(255, 90, 90, 0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, TAU); ctx.fill(); ctx.restore();
  }
  for (let k = 0; k < 5; k++) {
    const a = t * 0.9 + (k / 5) * TAU;
    ctx.fillStyle = `rgba(${glowC}, 0.8)`; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 18, cy + Math.sin(a) * 10, 1.4, 0, TAU); ctx.fill();
  }
}

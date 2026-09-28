// Canvas 2D rendering for everything drawn on top of the terrain (the
// terrain itself is engine/terrainRenderer.mjs). All art is drawn in code —
// no image assets — per the 2026-09-28 art pass; each sprite function is
// the one place to swap in a real image later.

import { damageNumberStyle, DAMAGE_NUMBER_COLORS } from './juice.mjs';

export const PALETTE = {
  water: '#0b3a52',
  waterDeep: '#062435',
  rock: '#4a3b2c',
  rockEdge: '#2c2116',
  hull: '#c98a3f',
  hullDark: '#8a5a24',
  sail: '#e9ddc4',
  exit: '#e8b54b',
  healthBarBack: 'rgba(6, 36, 53, .8)',
  healthBarFill: '#c94f3f',
  invulnerable: 'rgba(120, 190, 230, .55)',
  burn: '#e8813f',
  pickupWeapon: '#e8b54b',
  pickupSalvage: '#7bc9e0',
};

// Exit (2026-09-28 art pass): a buoyed channel marker — a ring of red and
// white buoys bobbing around a glowing gold swirl. Reads as "sail here"
// from across the reef.
export function drawExit(ctx, worldX, worldY, radius, t) {
  ctx.save();
  ctx.translate(worldX, worldY);
  const R = radius * 1.5;
  // Glow
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.6);
  glow.addColorStop(0, 'rgba(255, 214, 110, 0.55)');
  glow.addColorStop(0.5, 'rgba(255, 190, 80, 0.18)');
  glow.addColorStop(1, 'rgba(255, 190, 80, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, R * 1.6, 0, Math.PI * 2); ctx.fill();
  // Swirl
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const a0 = t * 1.6 + (k * Math.PI * 2) / 3;
    ctx.strokeStyle = `rgba(255, 226, 140, ${0.95 - k * 0.15})`;
    ctx.lineWidth = 3 - k * 0.5;
    ctx.beginPath();
    for (let u = 0; u <= 1.001; u += 0.1) {
      const a = a0 + u * 2.4; const rr = R * (0.25 + u * 0.6);
      const x = Math.cos(a) * rr; const y = Math.sin(a) * rr;
      if (u === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Buoys
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const bob = Math.sin(t * 2.2 + k * 1.3) * 1.2;
    const bx = Math.cos(a) * R * 0.98; const by = Math.sin(a) * R * 0.98 + bob;
    ctx.fillStyle = 'rgba(6, 40, 50, 0.3)';
    ctx.beginPath(); ctx.ellipse(bx + 1.5, by + 2, 3.6, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = k % 2 ? '#f3efe6' : '#d8453a';
    ctx.beginPath(); ctx.arc(bx, by, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(bx - 1, by - 1.2, 1.1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Wake (2026-09-28): foam V trailing the boat. `wake` points are pushed
// by main.mjs as the boat moves; each fades out over its own life.
export function drawWake(ctx, wake) {
  ctx.lineCap = 'round';
  for (const w of wake) {
    const a = Math.max(0, w.life / w.maxLife);
    const spread = (1 - a) * 9 + 3;
    const nx = -Math.sin(w.heading); const ny = Math.cos(w.heading);
    ctx.fillStyle = `rgba(235, 252, 246, ${a * 0.55})`;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(w.x + nx * spread * side, w.y + ny * spread * side, 1.2 + (1 - a) * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(235, 252, 246, ${a * 0.18})`;
    ctx.beginPath(); ctx.arc(w.x, w.y, 2 + (1 - a) * 3, 0, Math.PI * 2); ctx.fill();
  }
}

// The player's ship (2026-09-28 art pass): a top-down sloop — planked
// hull, square sail billowing across the beam, a red pennant streaming
// aft. Drawn along +x (the heading).
export function drawBoat(ctx, boat, radius, t = 0) {
  const L = radius * 1.45; // half-length
  const B = radius * 0.72; // half-beam
  ctx.save();
  ctx.translate(boat.x, boat.y);
  // Drop shadow on the water (unrotated offset = consistent light).
  ctx.save();
  ctx.translate(3, 4);
  ctx.rotate(boat.heading);
  ctx.fillStyle = 'rgba(4, 30, 40, 0.35)';
  hullPath(ctx, L, B); ctx.fill();
  ctx.restore();

  ctx.rotate(boat.heading);
  // Hull
  const hg = ctx.createLinearGradient(0, -B, 0, B);
  hg.addColorStop(0, '#b8783a'); hg.addColorStop(0.5, '#96592a'); hg.addColorStop(1, '#6d3d1b');
  ctx.fillStyle = hg;
  hullPath(ctx, L, B); ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = '#3e2410'; ctx.stroke();
  // Deck
  ctx.fillStyle = '#d9a863';
  hullPath(ctx, L * 0.84, B * 0.72, -L * 0.04); ctx.fill();
  ctx.strokeStyle = 'rgba(110, 70, 30, 0.45)'; ctx.lineWidth = 0.6;
  for (const y of [-B * 0.36, 0, B * 0.36]) { ctx.beginPath(); ctx.moveTo(-L * 0.78, y); ctx.lineTo(L * 0.5, y); ctx.stroke(); }
  // Bowsprit
  ctx.strokeStyle = '#5a3616'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(L * 0.8, 0); ctx.lineTo(L * 1.28, 0); ctx.stroke();
  // Sail: a billowed yard across the beam, lit from the top-left.
  const billow = Math.sin(t * 3) * 0.6;
  ctx.fillStyle = 'rgba(40, 30, 20, 0.25)';
  ctx.beginPath(); ctx.ellipse(-L * 0.02 + 2, 2, L * 0.24, B * 1.32, 0, 0, Math.PI * 2); ctx.fill();
  const sg = ctx.createLinearGradient(-L * 0.3, -B, L * 0.3, B);
  sg.addColorStop(0, '#fbf5e6'); sg.addColorStop(1, '#d9ccb0');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(-L * 0.12, -B * 1.3);
  ctx.quadraticCurveTo(L * (0.32 + billow * 0.05), 0, -L * 0.12, B * 1.3);
  ctx.quadraticCurveTo(-L * 0.02, 0, -L * 0.12, -B * 1.3);
  ctx.fill();
  ctx.strokeStyle = '#5a3616'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-L * 0.12, -B * 1.35); ctx.lineTo(-L * 0.12, B * 1.35); ctx.stroke();
  // Mast top + pennant streaming aft
  ctx.fillStyle = '#4a2c12'; ctx.beginPath(); ctx.arc(-L * 0.05, 0, 1.8, 0, Math.PI * 2); ctx.fill();
  const flap = Math.sin(t * 9) * 1.5;
  ctx.fillStyle = '#d8453a';
  ctx.beginPath(); ctx.moveTo(-L * 0.05, -1.2); ctx.quadraticCurveTo(-L * 0.4, flap, -L * 0.62, flap * 0.6); ctx.quadraticCurveTo(-L * 0.4, flap + 1.5, -L * 0.05, 1.2); ctx.fill();
  ctx.restore();
}

function hullPath(ctx, L, B, ox = 0) {
  ctx.beginPath();
  ctx.moveTo(ox + L, 0);
  ctx.bezierCurveTo(ox + L * 0.6, -B * 1.05, ox - L * 0.2, -B * 1.05, ox - L * 0.85, -B * 0.8);
  ctx.quadraticCurveTo(ox - L * 1.02, 0, ox - L * 0.85, B * 0.8);
  ctx.bezierCurveTo(ox - L * 0.2, B * 1.05, ox + L * 0.6, B * 1.05, ox + L, 0);
  ctx.closePath();
}

// Enemy sprites (2026-09-28 art pass): one silhouette per enemy type, each
// keeping its data colour as the dominant tone, so "which enemy is this"
// (the counter-weapon read) is answered by shape AND colour. Drawn in the
// enemy's local space; facing comes from its velocity.
function facingOf(enemy) {
  const sp = Math.hypot(enemy.vx || 0, enemy.vy || 0);
  if (sp > 4) enemy._facing = Math.atan2(enemy.vy, enemy.vx);
  return enemy._facing ?? 0;
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function smallHull(ctx, L, B, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(L, 0);
  ctx.quadraticCurveTo(L * 0.2, -B * 1.2, -L * 0.85, -B * 0.7);
  ctx.lineTo(-L * 0.85, B * 0.7);
  ctx.quadraticCurveTo(L * 0.2, B * 1.2, L, 0);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = stroke; ctx.stroke();
}

function waterShadow(ctx, r, ox = 2.5, oy = 3.5, a = 0.32) {
  ctx.fillStyle = `rgba(4, 30, 40, ${a})`;
  ctx.beginPath(); ctx.ellipse(ox, oy, r * 1.15, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
}

export function drawEnemyBody(ctx, enemy, color, t) {
  const r = enemy.radius;
  const h = facingOf(enemy);
  const id = enemy.defId;
  if (id === 'gullswarm_harpy') {
    // Airborne: shadow far below, beating wings.
    ctx.fillStyle = 'rgba(4, 30, 40, 0.25)';
    ctx.beginPath(); ctx.ellipse(7, 11, r * 0.9, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.rotate(h);
    const flap = Math.sin(t * 14 + enemy.id) * 0.5 + 0.5;
    const span = r * (1.1 + flap * 0.5);
    ctx.fillStyle = color; ctx.strokeStyle = shade(color, 0.45); ctx.lineWidth = 1;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(r * 0.3, 0);
      ctx.quadraticCurveTo(-r * 0.1, side * span * 1.1, -r * 0.9, side * span);
      ctx.quadraticCurveTo(-r * 0.4, side * span * 0.45, -r * 0.5, side * r * 0.15);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = shade(color, 0.55);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.75, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e0a23a';
    ctx.beginPath(); ctx.moveTo(r * 0.95, 0); ctx.lineTo(r * 0.6, -r * 0.14); ctx.lineTo(r * 0.6, r * 0.14); ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.1, 1, 0, Math.PI * 2); ctx.arc(r * 0.55, r * 0.1, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  if (id === 'deep_crawler') {
    ctx.save(); ctx.rotate(h);
    if (enemy.invulnerable) {
      // Submerged: a dark shape under the surface and rising bubbles.
      ctx.fillStyle = 'rgba(8, 40, 40, 0.55)';
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(230, 250, 245, 0.8)';
      for (let k = 0; k < 3; k++) {
        const ph = (t * 1.3 + k * 0.33 + enemy.id * 0.1) % 1;
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath(); ctx.arc(Math.sin(k * 2 + enemy.id) * r * 0.6, -ph * r * 0.9, 1 + ph * 1.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 0.35;
      return;
    }
    waterShadow(ctx, r);
    // Legs/claws
    ctx.strokeStyle = shade(color, 0.6); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const wig = Math.sin(t * 8 + k + side) * 1.5;
        ctx.beginPath(); ctx.moveTo(-r * 0.3 + k * r * 0.35, side * r * 0.4);
        ctx.lineTo(-r * 0.5 + k * r * 0.35 + wig, side * r * 1.05); ctx.stroke();
      }
      ctx.fillStyle = shade(color, 1.35);
      ctx.beginPath(); ctx.ellipse(r * 1.0, side * r * 0.55, r * 0.38, r * 0.24, side * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    // Segmented shell
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(color, 0.55); ctx.lineWidth = 1;
    for (const x of [-r * 0.45, 0, r * 0.45]) { ctx.beginPath(); ctx.moveTo(x, -r * 0.62); ctx.quadraticCurveTo(x + r * 0.15, 0, x, r * 0.62); ctx.stroke(); }
    ctx.fillStyle = shade(color, 1.6);
    ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.25, r * 0.45, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2d24b';
    ctx.beginPath(); ctx.arc(r * 0.72, -r * 0.18, 1.3, 0, Math.PI * 2); ctx.arc(r * 0.72, r * 0.18, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  if (id === 'krakens_anchor') {
    waterShadow(ctx, r, 5, 7, 0.3);
    // Tentacles writhing out from under the anchor.
    ctx.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + Math.sin(t * 0.7) * 0.2;
      ctx.strokeStyle = k % 2 ? shade(color, 1.4) : shade(color, 1.1);
      ctx.lineWidth = 5 - (k % 3);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
      for (let u = 0.2; u <= 1.001; u += 0.2) {
        const w = Math.sin(t * 3 + k * 1.7 + u * 4) * r * 0.25 * u;
        ctx.lineTo(Math.cos(a) * r * 1.25 * u - Math.sin(a) * w, Math.sin(a) * r * 1.25 * u + Math.cos(a) * w);
      }
      ctx.stroke();
    }
    // The anchor itself: shank, stock, crown and flukes, rust-dark iron.
    ctx.save(); ctx.rotate(Math.sin(t * 0.8) * 0.08);
    ctx.strokeStyle = '#3d3544'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.85); ctx.lineTo(0, r * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.6); ctx.lineTo(r * 0.4, -r * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, r * 0.05, r * 0.62, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.strokeStyle = '#6d5d73'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-1.2, -r * 0.85); ctx.lineTo(-1.2, r * 0.5); ctx.stroke();
    ctx.fillStyle = '#2b2530';
    for (const side of [-1, 1]) {
      const fx = Math.cos(side > 0 ? Math.PI * 0.15 : Math.PI * 0.85) * r * 0.62; const fy = r * 0.05 + Math.sin(Math.PI * 0.15) * r * 0.62;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + side * 5, fy - 7); ctx.lineTo(fx + side * 1, fy - 2); ctx.fill();
    }
    ctx.strokeStyle = '#2b2530'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -r * 0.95, 3.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // Glowing eyes in the churn beneath.
    const glow = 0.6 + Math.sin(t * 4) * 0.4;
    ctx.fillStyle = `rgba(190, 120, 255, ${glow})`;
    ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.45, 2, 0, Math.PI * 2); ctx.arc(r * 0.3, r * 0.45, 2, 0, Math.PI * 2); ctx.fill();
    return;
  }
  // Ships: skimmer, rigger, brigand.
  waterShadow(ctx, r);
  ctx.save(); ctx.rotate(h);
  if (id === 'ironclad_brigand') {
    const L = r * 1.25; const B = r * 0.8;
    smallHull(ctx, L, B, '#5d6166', '#24272b');
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(-r * 0.05, 0, L * 0.62, B * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#80868c';
    for (let k = -1; k <= 1; k++) ctx.fillRect(-r * 0.25 + k * r * 0.45, -B * 0.62, r * 0.32, B * 1.24);
    ctx.fillStyle = '#1d1f22';
    for (let k = -1; k <= 1; k++) for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(k * r * 0.45 - r * 0.1, side * B * 0.82, 1.2, 0, Math.PI * 2); ctx.fill(); }
    // Smokestack + drifting smoke
    ctx.fillStyle = '#2e3135'; ctx.beginPath(); ctx.arc(-r * 0.35, 0, r * 0.26, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.7 + k / 3 + enemy.id * 0.13) % 1;
      ctx.fillStyle = `rgba(60, 60, 64, ${0.5 * (1 - ph)})`;
      ctx.beginPath(); ctx.arc(-r * 0.35 - ph * r * 1.6, Math.sin(ph * 6 + k) * 2, r * (0.2 + ph * 0.35), 0, Math.PI * 2); ctx.fill();
    }
  } else if (id === 'rigger') {
    const L = r * 1.45; const B = r * 0.55;
    smallHull(ctx, L, B, '#3a2418', '#1c100a');
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(r * 0.6, 0); ctx.lineTo(-r * 0.7, -r * 1.05); ctx.lineTo(-r * 0.45, 0); ctx.lineTo(-r * 0.7, r * 1.05); ctx.closePath(); ctx.fill();
    // Grappling blades on the beam
    ctx.strokeStyle = '#d7dde0'; ctx.lineWidth = 1.2;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, side * B * 0.8); ctx.lineTo(r * 0.5, side * B * 1.8); ctx.lineTo(r * 0.1, side * B * 1.6); ctx.stroke(); }
  } else {
    // Reef Skimmer: tiny raider with a lateen sail.
    const L = r * 1.3; const B = r * 0.5;
    smallHull(ctx, L, B, '#4a2f1c', '#1f130a');
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(r * 0.9, -r * 0.1); ctx.quadraticCurveTo(-r * 0.2, -r * 1.3, -r * 0.8, -r * 0.2); ctx.lineTo(r * 0.9, -r * 0.1); ctx.fill();
    ctx.strokeStyle = shade(color, 0.5); ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#d8453a'; ctx.fillRect(-r * 0.95, -0.8, r * 0.3, 1.6);
  }
  ctx.restore();
}

// Enemy overlays: body sprite (drawEnemyBody above), then status tells —
// a thin outer ring while invulnerable (submerged Deep Crawlers, the
// boss's submerged phase) and a flickering overlay while burning.
export function drawEnemy(ctx, enemy, color, t, name = null, badge = null) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);

  if (enemy.invulnerable) {
    ctx.globalAlpha = 0.35;
  }
  drawEnemyBody(ctx, enemy, color, t);
  ctx.globalAlpha = 1;

  if (enemy.invulnerable) {
    ctx.strokeStyle = PALETTE.invulnerable;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (enemy.burn) {
    ctx.globalAlpha = 0.5 + Math.sin(t * 20) * 0.15;
    ctx.fillStyle = PALETTE.burn;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Health bar, world-space, above the enemy — skipped at full health so a
  // healthy reef doesn't look like a wall of UI.
  if (enemy.health < enemy.maxHealth) {
    const barWidth = enemy.radius * 2.2;
    const barY = enemy.y - enemy.radius - 8;
    ctx.fillStyle = PALETTE.healthBarBack;
    ctx.fillRect(enemy.x - barWidth / 2, barY, barWidth, 3);
    ctx.fillStyle = PALETTE.healthBarFill;
    ctx.fillRect(enemy.x - barWidth / 2, barY, barWidth * Math.max(0, enemy.health / enemy.maxHealth), 3);
  }

  // A name label — currently only ever passed for a boss (main.mjs's
  // `nameFor` callback below), so a regular enemy's silhouette+color
  // stays the only identifier, per the counter-swap hook's whole point.
  if (name) {
    ctx.fillStyle = '#e9ddc4';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, enemy.x, enemy.y - enemy.radius - 14);
  }

  // Combat-triangle matchup pip (2026-09-28): lets the player read the
  // matchup BEFORE firing. 'prey' = cyan ▲ (the triangle favors you),
  // 'predator' = red ! in a ring (this one hits you harder and shrugs off
  // your shots). Reveals the faction relationship, never the counter
  // weapon — the weapon read stays the player's job. Drawn beside the
  // health bar's end so the two never overlap.
  if (badge) {
    const bx = enemy.x + enemy.radius + 5;
    const by = enemy.y - enemy.radius - 5;
    ctx.save();
    ctx.lineJoin = 'round';
    if (badge === 'prey') {
      ctx.beginPath();
      ctx.moveTo(bx, by - 5); ctx.lineTo(bx + 5, by + 4); ctx.lineTo(bx - 5, by + 4); ctx.closePath();
      ctx.lineWidth = 3; ctx.strokeStyle = DAMAGE_NUMBER_COLORS.outline; ctx.stroke();
      ctx.fillStyle = DAMAGE_NUMBER_COLORS.favored; ctx.fill();
    } else if (badge === 'predator') {
      ctx.beginPath(); ctx.arc(bx, by, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = DAMAGE_NUMBER_COLORS.outline; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = DAMAGE_NUMBER_COLORS.hurtDanger; ctx.stroke();
      ctx.fillStyle = DAMAGE_NUMBER_COLORS.hurtDanger;
      ctx.font = '900 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', bx, by + 0.5);
    }
    ctx.restore();
  }
}

export function drawEnemies(ctx, enemies, colorFor, t, nameFor = null, badgeFor = null) {
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    drawEnemy(ctx, enemy, colorFor(enemy), t, nameFor ? nameFor(enemy) : null, badgeFor ? badgeFor(enemy) : null);
  }
}

export function drawProjectile(ctx, projectile, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawProjectiles(ctx, projectiles, colorFor) {
  for (const p of projectiles) {
    if (p.spent) continue;
    drawProjectile(ctx, p, colorFor(p));
  }
}

// Placeholder pickup shapes: a diamond for a weapon cache (label carries
// which weapon), a small glinting dot for Salvage. Both bob gently so
// they read as pickups rather than static scenery.
// Pickups (2026-09-28 art pass): a weapon cache is a floating crate with
// gold-banded corners and its weapon code stencilled on the lid; Salvage
// is a floating barrel with a glint. Both bob and ripple.
export function drawPickup(ctx, pickup, label, t) {
  const bob = Math.sin(t * 2.4 + pickup.id) * 1.5;
  const tilt = Math.sin(t * 1.7 + pickup.id * 2) * 0.12;
  ctx.save();
  ctx.translate(pickup.x, pickup.y);
  // Ripple
  const rp = (t * 0.8 + pickup.id * 0.37) % 1;
  ctx.strokeStyle = `rgba(230, 250, 245, ${0.5 * (1 - rp)})`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, 2, 9 + rp * 8, 6 + rp * 5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(4, 30, 40, 0.35)';
  ctx.beginPath(); ctx.ellipse(3, 4, 9, 6.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(0, bob);
  ctx.rotate(tilt);

  if (pickup.kind === 'weapon_cache') {
    const S = 8;
    ctx.fillStyle = '#8c5a2b'; ctx.fillRect(-S, -S, S * 2, S * 2);
    ctx.fillStyle = '#b07a3e';
    ctx.fillRect(-S + 1.5, -S + 1.5, S * 2 - 3, S * 2 - 3);
    ctx.strokeStyle = 'rgba(80, 45, 18, 0.7)'; ctx.lineWidth = 0.8;
    for (const y of [-S / 3, S / 3]) { ctx.beginPath(); ctx.moveTo(-S + 1.5, y); ctx.lineTo(S - 1.5, y); ctx.stroke(); }
    ctx.fillStyle = PALETTE.pickupWeapon;
    for (const [x, y] of [[-S, -S], [S - 3, -S], [-S, S - 3], [S - 3, S - 3]]) ctx.fillRect(x, y, 3, 3);
    ctx.strokeStyle = '#3e2410'; ctx.lineWidth = 1.2; ctx.strokeRect(-S, -S, S * 2, S * 2);
    if (label) {
      ctx.font = '900 8px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#2a170a'; ctx.strokeText(label, 0, 0.5);
      ctx.fillStyle = '#ffe08a'; ctx.fillText(label, 0, 0.5);
    }
  } else {
    ctx.fillStyle = '#7a4a22';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a8703a';
    ctx.beginPath(); ctx.arc(-0.6, -0.6, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3b3f44'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(-0.6, -0.6, 2.6, 0, Math.PI * 2); ctx.stroke();
    const gl = (Math.sin(t * 3 + pickup.id) + 1) / 2;
    ctx.fillStyle = `rgba(255, 232, 150, ${0.4 + gl * 0.6})`;
    ctx.beginPath(); ctx.arc(-2.5, -2.5, 1.4 + gl, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawPickups(ctx, pickups, labelFor, t) {
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    drawPickup(ctx, pickup, pickup.kind === 'weapon_cache' ? labelFor(pickup) : null, t);
  }
}

// Step 8 juice (engine/juice.mjs) — particles and floating damage numbers.
// Both draw in world space, so they're called inside the same camera-
// transformed block as everything else above, not as a screen-space overlay.
export function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Draws floating damage numbers. All styling decisions (colours, glyphs,
// size, pop) live in engine/juice.mjs's damageNumberStyle — pure and
// unit-tested — so this only lays out the coloured parts side by side,
// outline first, then fill, centred on the number's position.
export function drawDamageNumbers(ctx, numbers) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const d of numbers) {
    const style = damageNumberStyle(d);
    ctx.globalAlpha = Math.max(0, Math.min(1, d.life / (d.maxLife * 0.5)));
    ctx.font = `800 ${style.size.toFixed(1)}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    const widths = style.parts.map((p) => ctx.measureText(p.text).width);
    const gap = style.size * 0.08;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (style.parts.length - 1);
    let x = d.x - total / 2;
    ctx.lineWidth = style.outlineWidth;
    ctx.strokeStyle = style.outline;
    style.parts.forEach((p, i) => { ctx.strokeText(p.text, x, d.y); x += widths[i] + gap; });
    x = d.x - total / 2;
    style.parts.forEach((p, i) => { ctx.fillStyle = p.color; ctx.fillText(p.text, x, d.y); x += widths[i] + gap; });
  }
  ctx.globalAlpha = 1;
}

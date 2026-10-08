// Art for the depth pass (2026-09-29): armament projectiles, the Sea
// Spirit's wisps, St Elmo's lightning, treasure chests, elite auras, the
// lair's warding seals and the ward they cast over the boss. Canvas only,
// world space; called from renderer.mjs / main.mjs.
import { drawPickupSprite } from './pickupSprites.mjs';

const TAU = Math.PI * 2;

// Armament projectiles (weapon ids arm_* from data/weapons.mjs). Returns
// true if it drew the projectile.
export function drawArmamentProjectile(ctx, p, t) {
  const sp = Math.hypot(p.vx, p.vy) || 1;
  const ux = p.vx / sp; const uy = p.vy / sp;
  switch (p.weaponId) {
    case 'arm_swivel':
      ctx.strokeStyle = 'rgba(255, 240, 200, 0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x - ux * 6, p.y - uy * 6); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = '#f4ecd6'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, TAU); ctx.fill();
      return true;
    case 'arm_harpoon': {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(uy, ux));
      ctx.strokeStyle = 'rgba(220, 230, 235, 0.45)'; ctx.lineWidth = 0.8; // trailing line
      ctx.beginPath(); ctx.moveTo(-26, Math.sin(t * 30) * 1.5); ctx.quadraticCurveTo(-18, 2, -12, 0); ctx.stroke();
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.fillStyle = '#d7e0e6';
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(2, -3.5); ctx.lineTo(4, 0); ctx.lineTo(2, 3.5); ctx.closePath(); ctx.fill();
      ctx.restore();
      return true;
    }
    case 'arm_mortar': {
      // A shell in a high arc: shadow on the water, shell above it.
      const total = p.fuseTotal || 1; const f = p.fuseRemaining != null ? 1 - Math.max(0, p.fuseRemaining) / total : 1;
      const h = Math.sin(Math.min(1, f) * Math.PI) * 26;
      ctx.fillStyle = 'rgba(4, 30, 40, 0.3)';
      ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 3, 4.5, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255, 180, 90, 0.35)';
      ctx.beginPath(); ctx.arc(p.x, p.y - h, 6.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2b2622'; ctx.beginPath(); ctx.arc(p.x, p.y - h, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.arc(p.x + 1.5, p.y - h - 3, 1.4 + Math.sin(t * 40) * 0.4, 0, TAU); ctx.fill();
      return true;
    }
    case 'arm_keg': {
      // A floating powder keg with a sputtering fuse; blinks red as it arms.
      const bob = Math.sin(t * 3 + p.id) * 1.2;
      ctx.save(); ctx.translate(p.x, p.y + bob);
      ctx.strokeStyle = 'rgba(230, 250, 245, 0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 3, 9, 5, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#7a4a22'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a06a34'; ctx.beginPath(); ctx.ellipse(-1, -1, 4, 5.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3b3b40'; ctx.fillRect(-6, -3.5, 12, 1.4); ctx.fillRect(-6, 2.2, 12, 1.4);
      const armed = !(p.armDelay > 0);
      const blink = armed && Math.sin(t * 14) > 0;
      ctx.fillStyle = blink ? '#ff4d3a' : '#ffcf6a';
      ctx.beginPath(); ctx.arc(2, -7.5, 1.8, 0, TAU); ctx.fill();
      ctx.restore();
      return true;
    }
    case 'arm_stern':
    case 'arm_broadside':
      ctx.fillStyle = 'rgba(210, 200, 180, 0.35)';
      for (let k = 1; k <= 2; k++) { ctx.beginPath(); ctx.arc(p.x - ux * k * 5, p.y - uy * k * 5, 2.4 - k * 0.5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#2d2a26'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, TAU); ctx.fill();
      ctx.fillStyle = p.weaponId === 'arm_broadside' ? 'rgba(255, 210, 120, 0.8)' : 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath(); ctx.arc(p.x - 0.8, p.y - 0.8, 0.9, 0, TAU); ctx.fill();
      return true;
    default: return false;
  }
}

// Sea Spirit: glowing wisps with short fading tails.
export function drawSpirits(ctx, positions, angle, t) {
  if (!positions.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of positions) {
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 12);
    g.addColorStop(0, 'rgba(200, 255, 245, 0.95)');
    g.addColorStop(0.35, 'rgba(110, 240, 220, 0.55)');
    g.addColorStop(1, 'rgba(60, 200, 200, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s.x, s.y, 2.2 + Math.sin(t * 9) * 0.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// St Elmo's Fire arcs: jagged bright lines that fade over `life`.
export function drawLightning(ctx, arcs) {
  if (!arcs.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  for (const a of arcs) {
    const k = Math.max(0, a.life / a.maxLife);
    const dx = a.x2 - a.x1; const dy = a.y2 - a.y1; const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len; const ny = dx / len;
    const pts = [[a.x1, a.y1]];
    const n = Math.max(3, Math.round(len / 12));
    for (let i = 1; i < n; i++) {
      const j = (a.jag[i % a.jag.length] - 0.5) * 12;
      pts.push([a.x1 + (dx * i) / n + nx * j, a.y1 + (dy * i) / n + ny * j]);
    }
    pts.push([a.x2, a.y2]);
    for (const [w, col] of [[5, `rgba(120, 180, 255, ${0.35 * k})`], [1.6, `rgba(235, 245, 255, ${k})`]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    }
  }
  ctx.restore();
}

// A treasure chest bobbing in a dead end, with a gold glow and glints so it
// reads from across the reef.
export function drawChest(ctx, pickup, t) {
  const bob = Math.sin(t * 2.2 + pickup.id) * 1.4;
  ctx.save();
  ctx.translate(pickup.x, pickup.y);
  const pulse = 0.6 + 0.4 * Math.sin(t * 3 + pickup.id);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 38);
  g.addColorStop(0, `rgba(255, 225, 120, ${0.7 * pulse + 0.15})`);
  g.addColorStop(0.5, `rgba(255, 200, 80, ${0.3 * pulse + 0.1})`);
  g.addColorStop(1, 'rgba(255, 200, 80, 0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.fill();
  // A light beam straight up: visible from anywhere on screen.
  const beam = ctx.createLinearGradient(0, 0, 0, -70);
  beam.addColorStop(0, `rgba(255, 230, 140, ${0.35 * pulse + 0.1})`);
  beam.addColorStop(1, 'rgba(255, 230, 140, 0)');
  ctx.fillStyle = beam; ctx.fillRect(-5, -70, 10, 70);
  ctx.scale(1.4, 1.4);
  ctx.fillStyle = 'rgba(4, 30, 40, 0.35)';
  ctx.beginPath(); ctx.ellipse(3, 6, 12, 6, 0, 0, TAU); ctx.fill();
  ctx.translate(0, bob);
  if (drawPickupSprite(ctx, 'chest')) { chestGlints(ctx, pickup, t); ctx.restore(); return; }
  // Body
  ctx.fillStyle = '#5a3418'; ctx.fillRect(-10, -3, 20, 11);
  ctx.fillStyle = '#7d4a22'; ctx.fillRect(-9, -2, 18, 9);
  // Lid (domed)
  ctx.fillStyle = '#8f5628';
  ctx.beginPath(); ctx.moveTo(-10, -3); ctx.quadraticCurveTo(0, -13, 10, -3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath(); ctx.moveTo(-8, -4); ctx.quadraticCurveTo(0, -11, 8, -4); ctx.lineTo(6, -4); ctx.quadraticCurveTo(0, -9, -6, -4); ctx.closePath(); ctx.fill();
  // Gold bands and lock
  ctx.fillStyle = '#e8b83a';
  ctx.fillRect(-7, -9.5, 2.2, 17.5); ctx.fillRect(4.8, -9.5, 2.2, 17.5);
  ctx.fillRect(-10, -3.6, 20, 1.6);
  ctx.fillStyle = '#ffe08a'; ctx.fillRect(-2, -2.5, 4, 4.5);
  ctx.fillStyle = '#4a2a10'; ctx.fillRect(-0.6, -1.2, 1.2, 2);
  ctx.strokeStyle = '#2e1a0a'; ctx.lineWidth = 1; ctx.strokeRect(-10, -3, 20, 11);
  chestGlints(ctx, pickup, t);
  ctx.restore();
}

function chestGlints(ctx, pickup, t) {
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.9 + i / 3 + pickup.id * 0.13) % 1;
    const a = i * 2.1 + pickup.id;
    const r = 8 + ph * 10;
    ctx.fillStyle = `rgba(255, 245, 200, ${1 - ph})`;
    const x = Math.cos(a) * r; const y = -6 + Math.sin(a) * r * 0.6 - ph * 6;
    ctx.fillRect(x - 0.6, y - 2, 1.2, 4); ctx.fillRect(x - 2, y - 0.6, 4, 1.2);
  }
}

// Elite: a rotating gold crown of light under the enemy.
export function drawEliteAura(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const r = e.radius + 7;
  ctx.strokeStyle = `rgba(255, 205, 80, ${0.55 + 0.25 * Math.sin(t * 4)})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 20;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffd24a';
  for (let i = 0; i < 3; i++) {
    const a = t * 1.2 + (i * TAU) / 3;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// A warding seal: a carved standing stone on a rocky islet, a rune ring
// turning above it and a glowing core. Registered in enemySprites SPRITES.
export function drawSeal(ctx, e, color, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 3 + e.id);
  // Islet + foam
  ctx.fillStyle = 'rgba(230, 250, 245, 0.35)';
  ctx.beginPath(); ctx.ellipse(0, 4, 16, 9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4b4f58'; ctx.beginPath(); ctx.ellipse(0, 4, 13, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#62676f'; ctx.beginPath(); ctx.ellipse(-1, 3, 10, 5, 0, 0, TAU); ctx.fill();
  // Glow
  const g = ctx.createRadialGradient(0, -6, 1, 0, -6, 22);
  g.addColorStop(0, `rgba(170, 140, 255, ${0.55 * pulse + 0.2})`);
  g.addColorStop(1, 'rgba(120, 90, 255, 0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -6, 22, 0, TAU); ctx.fill();
  // Standing stone
  ctx.fillStyle = '#2f3240';
  ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(-5, -12); ctx.lineTo(0, -17); ctx.lineTo(5, -12); ctx.lineTo(6, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#434859';
  ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(-4, -11); ctx.lineTo(0, -15); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
  // Rune
  ctx.strokeStyle = `rgba(215, 200, 255, ${0.6 + 0.4 * pulse})`; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -1); ctx.moveTo(-3, -9); ctx.lineTo(3, -5); ctx.moveTo(3, -9); ctx.lineTo(-3, -5); ctx.stroke();
  // Turning rune ring
  ctx.save(); ctx.translate(0, -6); ctx.scale(1, 0.45); ctx.rotate(t * 1.4);
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.stroke();
  ctx.restore();
  // Wind-up: the rune flares before it spits.
  if (e.gunWindup > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath(); ctx.arc(0, -8, 3 + Math.sin(t * 40) * 1, 0, TAU); ctx.fill();
  }
}

// The ward: a shimmering bubble on the boss, fed by beams from each
// standing seal.
export function drawWard(ctx, boss, seals, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of seals) {
    const dx = boss.x - s.x; const dy = boss.y - s.y; const len = Math.hypot(dx, dy) || 1;
    ctx.strokeStyle = 'rgba(150, 120, 255, 0.18)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(s.x, s.y - 8); ctx.lineTo(boss.x, boss.y); ctx.stroke();
    // Motes flowing toward the boss.
    ctx.fillStyle = 'rgba(210, 195, 255, 0.8)';
    for (let i = 0; i < 6; i++) {
      const f = (t * 0.35 + i / 6) % 1;
      ctx.beginPath(); ctx.arc(s.x + dx * f, s.y - 8 + (dy + 8) * f, 1.6, 0, TAU); ctx.fill();
    }
    void len;
  }
  const r = boss.radius + 12 + Math.sin(t * 3) * 1.5;
  const g = ctx.createRadialGradient(boss.x, boss.y, r * 0.6, boss.x, boss.y, r);
  g.addColorStop(0, 'rgba(120, 90, 255, 0)');
  g.addColorStop(0.85, 'rgba(150, 120, 255, 0.28)');
  g.addColorStop(1, 'rgba(200, 180, 255, 0.55)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(boss.x, boss.y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(220, 210, 255, 0.7)'; ctx.lineWidth = 1.2;
  ctx.setLineDash([6, 6]); ctx.lineDashOffset = t * 25;
  ctx.beginPath(); ctx.arc(boss.x, boss.y, r, 0, TAU); ctx.stroke();
  ctx.restore();
}

// Enraged boss: a flickering red heat ring.
export function drawEnrage(ctx, boss, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const r = boss.radius + 6 + Math.sin(t * 12) * 2;
  ctx.strokeStyle = `rgba(255, 70, 40, ${0.45 + 0.25 * Math.sin(t * 17)})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(boss.x, boss.y, r, 0, TAU); ctx.stroke();
  ctx.restore();
}

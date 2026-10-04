// Drawing for warlords' and bosses' signature moves (engine/warlord.mjs):
// the crowned aura, the nova wind-up, the charge lane and the ward. World
// space, drawn over the enemies.

import { LORD_TRAITS } from './warlord.mjs';

const TAU = Math.PI * 2;

export function drawLords(ctx, enemies, t) {
  for (const e of enemies) if (e.lord && e.health > 0) drawLord(ctx, e, t);
}

function drawLord(ctx, e, t) {
  const L = e.lord;
  const r = e.radius;
  ctx.save();
  ctx.translate(e.x, e.y);

  // Aura: two counter-turning gilt rings and a soft red under-glow.
  const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r + 26);
  g.addColorStop(0, 'rgba(255, 70, 40, 0)');
  g.addColorStop(0.6, `rgba(255, 70, 40, ${0.16 + 0.06 * Math.sin(t * 4)})`);
  g.addColorStop(1, 'rgba(255, 70, 40, 0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r + 26, 0, TAU); ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 214, 92, .85)';
  ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 30;
  ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 120, 80, .55)';
  ctx.setLineDash([3, 9]); ctx.lineDashOffset = t * 24;
  ctx.beginPath(); ctx.arc(0, 0, r + 14, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);

  // A crown riding above.
  const cy = -r - 36 + Math.sin(t * 3) * 2;
  ctx.save();
  ctx.translate(0, cy);
  ctx.shadowColor = 'rgba(255, 200, 60, .9)'; ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffcf4a'; ctx.strokeStyle = '#7a4a08'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-9, 4); ctx.lineTo(-10, -5); ctx.lineTo(-5, -1); ctx.lineTo(0, -8); ctx.lineTo(5, -1); ctx.lineTo(10, -5); ctx.lineTo(9, 4);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#d42a2a';
  ctx.beginPath(); ctx.arc(0, 0.5, 1.8, 0, TAU); ctx.fill();
  ctx.restore();

  // Nova wind-up: a red ring tightens onto the hull, spikes show where
  // every ball will fly.
  if (L.novaWindup > 0) {
    const u = 1 - L.novaWindup / (L.novaMax || 1);
    const n = LORD_TRAITS.nova.count + (L.extraShots || 0) + (e.enraged ? 4 : 0);
    const rr = r + 8 + (1 - u) * 90;
    ctx.strokeStyle = `rgba(255, 70, 50, ${0.35 + u * 0.6})`;
    ctx.lineWidth = 2 + u * 3;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255, 190, 120, ${0.25 + u * 0.5})`;
    ctx.lineWidth = 1.5;
    const spin = L.novaSpin + 0.37;
    for (let i = 0; i < n; i++) {
      const a = spin + (i / n) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r + 4), Math.sin(a) * (r + 4));
      ctx.lineTo(Math.cos(a) * (r + 14 + u * 22), Math.sin(a) * (r + 14 + u * 22));
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255, 120, 60, ${u * 0.25})`;
    ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, TAU); ctx.fill();
  }

  // Ward: a gilded bubble with a turning rune band.
  if (L.shieldTime > 0) {
    const R = r + 18;
    const flick = L.shieldTime < 0.8 ? (Math.sin(t * 40) > 0 ? 1 : 0.35) : 1;
    const sg = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R);
    sg.addColorStop(0, 'rgba(255, 230, 140, 0)');
    sg.addColorStop(0.85, `rgba(255, 220, 110, ${0.22 * flick})`);
    sg.addColorStop(1, `rgba(255, 245, 200, ${0.55 * flick})`);
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255, 236, 160, ${0.9 * flick})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = t * 0.8 + (i / 6) * TAU;
      const x = Math.cos(a) * R; const y = Math.sin(a) * R;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([2, 5]); ctx.lineDashOffset = t * 20;
    ctx.beginPath(); ctx.arc(0, 0, R - 5, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  // Charge: a lane marked on the water, flashing faster as it locks.
  const C = L.charge;
  if (C && C.state === 'aim') {
    const T = LORD_TRAITS.charge;
    const dx = C.ax - e.x; const dy = C.ay - e.y;
    const a = Math.atan2(dy, dx);
    const len = T.speed * T.time + e.radius;
    const lock = C.t <= 0.35;
    const pulse = 0.5 + 0.5 * Math.sin(t * (lock ? 40 : 14));
    ctx.save();
    ctx.translate(e.x, e.y); ctx.rotate(a);
    ctx.fillStyle = `rgba(255, 50, 40, ${0.14 + pulse * 0.16})`;
    ctx.fillRect(0, -T.width, len, T.width * 2);
    ctx.strokeStyle = `rgba(255, 90, 70, ${0.6 + pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]); ctx.lineDashOffset = -t * 60;
    ctx.strokeRect(0, -T.width, len, T.width * 2);
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255, 210, 190, ${0.5 + pulse * 0.4})`;
    for (let x = 30; x < len - 10; x += 34) {
      ctx.beginPath(); ctx.moveTo(x, -9); ctx.lineTo(x + 12, 0); ctx.lineTo(x, 9); ctx.lineTo(x + 5, 0); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  } else if (C && C.state === 'run') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 240, 220, .55)'; ctx.lineWidth = 2;
    const bx = -C.dx; const by = -C.dy;
    for (let i = -2; i <= 2; i++) {
      const ox = -by * i * 6; const oy = bx * i * 6;
      ctx.beginPath();
      ctx.moveTo(e.x + bx * e.radius + ox, e.y + by * e.radius + oy);
      ctx.lineTo(e.x + bx * (e.radius + 30 + (i & 1) * 10) + ox, e.y + by * (e.radius + 30 + (i & 1) * 10) + oy);
      ctx.stroke();
    }
    ctx.restore();
  }
}

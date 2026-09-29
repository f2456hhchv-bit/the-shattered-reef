// Weather art (2026-09-29). World-space hazards (whirlpools, strike marks,
// falling rock, the rogue wave, waterspouts, floes, ghost lights) and
// screen-space atmosphere (rain, snow, gusts, darkness, lightning flashes,
// fog with a clear pocket around your ship). Reads engine/weather.mjs state.

const TAU = Math.PI * 2;
const hash = (i, k = 1) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

// Under the ships: whirlpool, marks on the water, the wave, floes, lights.
export function drawWeatherWorld(ctx, w, t) {
  if (!w || !w.active) return;
  const def = w.active.def;
  if (w.whirl) drawWhirl(ctx, w.whirl, t, def.palette?.whirl);
  if (w.wave) drawWave(ctx, w.wave, def, t, w);
  for (const fl of w.floes) drawFloe(ctx, fl);
  for (const l of w.lights) if (!l.taken) drawLight(ctx, l, t, def.palette?.light);
  for (const s of w.strikes) drawStrikeMark(ctx, s, t);
  for (const d of w.drops) drawDropMark(ctx, d, def, t);
}

// Over the ships: spouts and falling rocks (they're tall).
export function drawWeatherAbove(ctx, w, t) {
  if (!w || !w.active) return;
  const def = w.active.def;
  for (const sp of w.spouts) drawSpout(ctx, sp, def, t);
  for (const d of w.drops) drawFallingRock(ctx, d, def);
}

function drawWhirl(ctx, wh, t, tint = null) {
  const k = wh.strength ?? 1; if (k <= 0) return;
  ctx.save(); ctx.translate(wh.x, wh.y);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, wh.r);
  const [tr, tg, tb] = tint || [6, 40, 70];
  g.addColorStop(0, `rgba(${tr * 0.2}, ${tg * 0.3}, ${tb * 0.35}, ${0.92 * k})`); g.addColorStop(0.3, `rgba(${tr}, ${tg}, ${tb}, ${0.6 * k})`); g.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, wh.r, 0, TAU); ctx.fill();
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 5; arm++) {
    ctx.strokeStyle = `rgba(230, 250, 255, ${0.75 * k})`; ctx.lineWidth = 3.2;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const u = i / 40; const r = wh.r * (1 - u) * 0.95 + 4;
      const a = (arm / 5) * TAU + u * 5.5 * wh.spin + t * 2.2 * wh.spin;
      const x = Math.cos(a) * r; const y = Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  // Churning foam ring at the rim.
  ctx.strokeStyle = `rgba(240, 252, 255, ${0.35 * k})`; ctx.lineWidth = 5;
  ctx.setLineDash([10, 8]); ctx.lineDashOffset = t * 30 * wh.spin;
  ctx.beginPath(); ctx.arc(0, 0, wh.r * 0.92, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

function drawWave(ctx, wv, def, t, w) {
  const { dir } = wv; const nx = -dir.y; const ny = dir.x;
  const L = 4000;
  if (wv.warn > 0) {
    // Warning: chevrons marching along the line it'll come from.
    const s = wv.s + 60;
    ctx.strokeStyle = `rgba(255, 90, 60, ${0.5 + 0.4 * Math.sin(t * 10)})`; ctx.lineWidth = 3;
    for (let k = -30; k <= 30; k++) {
      const cx = dir.x * s + nx * k * 60; const cy = dir.y * s + ny * k * 60;
      ctx.beginPath(); ctx.moveTo(cx - dir.x * 10 + nx * 10, cy - dir.y * 10 + ny * 10); ctx.lineTo(cx + dir.x * 6, cy + dir.y * 6);
      ctx.lineTo(cx - dir.x * 10 - nx * 10, cy - dir.y * 10 - ny * 10); ctx.stroke();
    }
    return;
  }
  const cx = dir.x * wv.s; const cy = dir.y * wv.s; const half = def.width / 2;
  ctx.save();
  const g = ctx.createLinearGradient(cx - dir.x * half * 2, cy - dir.y * half * 2, cx + dir.x * half, cy + dir.y * half);
  g.addColorStop(0, 'rgba(20, 110, 150, 0)'); g.addColorStop(0.7, 'rgba(40, 150, 190, 0.45)'); g.addColorStop(1, 'rgba(245, 255, 255, 0.85)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - dir.x * half * 2 + nx * L, cy - dir.y * half * 2 + ny * L);
  ctx.lineTo(cx - dir.x * half * 2 - nx * L, cy - dir.y * half * 2 - ny * L);
  ctx.lineTo(cx + dir.x * half - nx * L, cy + dir.y * half - ny * L);
  ctx.lineTo(cx + dir.x * half + nx * L, cy + dir.y * half + ny * L);
  ctx.fill();
  // Foam crest.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 4;
  ctx.beginPath();
  for (let k = -60; k <= 60; k++) {
    const px = cx + dir.x * half + nx * k * 30 + dir.x * Math.sin(k * 1.3 + t * 8) * 4;
    const py = cy + dir.y * half + ny * k * 30 + dir.y * Math.sin(k * 1.3 + t * 8) * 4;
    k === -60 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
  void w;
}

function drawFloe(ctx, fl) {
  ctx.save(); ctx.translate(fl.x, fl.y); ctx.rotate(fl.rot);
  const path = () => {
    ctx.beginPath();
    fl.pts.forEach((k, i) => { const a = (i / fl.pts.length) * TAU; const x = Math.cos(a) * fl.r * k; const y = Math.sin(a) * fl.r * k; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
  };
  ctx.fillStyle = 'rgba(4, 30, 40, 0.3)'; ctx.save(); ctx.translate(3, 4); path(); ctx.fill(); ctx.restore();
  ctx.fillStyle = 'rgba(230, 250, 255, 0.5)'; ctx.save(); ctx.scale(1.12, 1.12); path(); ctx.fill(); ctx.restore();
  ctx.fillStyle = fl.color; path(); ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath(); ctx.ellipse(-fl.r * 0.25, -fl.r * 0.25, fl.r * 0.35, fl.r * 0.2, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawLight(ctx, l, t, tint = null) {
  const bob = Math.sin(l.phase * 3) * 3;
  const [r, gg, b] = tint || [110, 240, 190];
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(l.x, l.y - bob, 0, l.x, l.y - bob, 22);
  g.addColorStop(0, `rgba(${Math.min(255, r + 90)}, ${Math.min(255, gg + 15)}, ${Math.min(255, b + 40)}, 0.95)`); g.addColorStop(0.3, `rgba(${r}, ${gg}, ${b}, 0.5)`); g.addColorStop(1, `rgba(${r}, ${gg}, ${b}, 0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y - bob, 22, 0, TAU); ctx.fill();
  ctx.restore();
  void t;
}

// A lightning mark: the exact danger circle from the moment it appears,
// filling like a clock as the strike charges (3s), pulsing faster near
// the end. Always readable, always avoidable.
function drawStrikeMark(ctx, s, t) {
  const u = Math.min(1, 1 - s.warn / s.max);
  const pulse = 0.5 + 0.5 * Math.sin(t * (6 + u * 18));
  ctx.save();
  ctx.translate(s.x, s.y);
  // Danger zone tint.
  ctx.fillStyle = `rgba(255, 215, 90, ${0.16 + u * 0.16})`;
  ctx.beginPath(); ctx.arc(0, 0, s.r, 0, TAU); ctx.fill();
  // Countdown: a wedge sweeping round.
  ctx.fillStyle = `rgba(255, 240, 170, ${0.3 + u * 0.35})`;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s.r, -Math.PI / 2, -Math.PI / 2 + u * TAU); ctx.closePath(); ctx.fill();
  // Hard edge: exactly where it will hit.
  ctx.lineWidth = 2.5 + u * 1.5;
  ctx.strokeStyle = `rgba(20, 30, 60, 0.6)`;
  ctx.beginPath(); ctx.arc(0, 0, s.r + 1.5, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(255, ${210 + u * 45}, ${80 + u * 175}, ${0.75 + pulse * 0.25})`;
  ctx.beginPath(); ctx.arc(0, 0, s.r, 0, TAU); ctx.stroke();
  // A lightning glyph in the middle.
  ctx.save(); ctx.scale(1.5, 1.5);
  ctx.beginPath(); ctx.moveTo(2, -9); ctx.lineTo(-4, 1); ctx.lineTo(0, 1); ctx.lineTo(-2, 9); ctx.lineTo(4, -1); ctx.lineTo(0, -1); ctx.closePath();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(30, 20, 5, 0.7)'; ctx.stroke();
  ctx.fillStyle = `rgba(255, 235, 110, ${0.8 + u * 0.2})`; ctx.fill();
  ctx.restore();
  // Crackle in the last moments.
  if (u > 0.75) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${(u - 0.75) * 4})`; ctx.lineWidth = 1.3;
    for (let i = 0; i < 4; i++) {
      const a = t * 24 + i * 1.6; ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s.r * 0.5, Math.sin(a) * s.r * 0.5); ctx.lineTo(Math.cos(a + 0.5) * s.r * 0.95, Math.sin(a + 0.5) * s.r * 0.95); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawDropMark(ctx, d, def, t) {
  const u = 1 - d.warn / d.max;
  ctx.save();
  // A growing shadow where it'll land.
  ctx.fillStyle = `rgba(10, 20, 30, ${0.15 + u * 0.4})`;
  ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * (0.4 + u * 0.6), d.r * (0.3 + u * 0.45), 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(255, 90, 60, ${0.3 + u * 0.5})`; ctx.lineWidth = 1.6;
  ctx.setLineDash([4, 4]); ctx.lineDashOffset = -t * 20;
  ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.stroke();
  ctx.restore();
  void def;
}

function drawFallingRock(ctx, d, def) {
  const u = 1 - d.warn / d.max;
  if (u < 0.35) return;
  const h = (1 - u) * 160;
  const [c1, c2] = def.rock || ['#8b8a82', '#55575a'];
  if (def.fiery) {
    // A lava bomb / burning gas: a glowing blob with a flame trail.
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = `rgba(255, ${120 + k * 20}, 40, ${0.5 - k * 0.08})`;
      ctx.beginPath(); ctx.arc(d.x, d.y - h - k * 7, d.r * 0.4 - k * 1.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  ctx.save(); ctx.translate(d.x, d.y - h); ctx.rotate(d.spin + u * 4);
  const s = d.r * 0.55;
  ctx.fillStyle = c2; ctx.beginPath();
  ctx.moveTo(-s, -s * 0.3); ctx.lineTo(-s * 0.3, -s); ctx.lineTo(s * 0.7, -s * 0.7); ctx.lineTo(s, s * 0.2); ctx.lineTo(s * 0.2, s); ctx.lineTo(-s * 0.8, s * 0.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c1; ctx.beginPath();
  ctx.moveTo(-s * 0.8, -s * 0.3); ctx.lineTo(-s * 0.3, -s * 0.85); ctx.lineTo(s * 0.55, -s * 0.6); ctx.lineTo(s * 0.2, s * 0.1); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawSpout(ctx, sp, def, t) {
  ctx.save(); ctx.translate(sp.x, sp.y);
  // Spray skirt on the water, then the twisting column leaning into the wind.
  ctx.fillStyle = 'rgba(230, 245, 250, 0.35)';
  ctx.beginPath(); ctx.ellipse(0, 0, def.radius * 1.5, def.radius * 1.1, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 10; i++) {
    const a = t * 6 + i * 0.63; const r = def.radius * (0.9 + 0.4 * Math.sin(t * 3 + i));
    ctx.fillStyle = 'rgba(245, 252, 255, 0.7)';
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.7, 2.2, 0, TAU); ctx.fill();
  }
  // Shadow of the column, then a dark twisting funnel rising out of view.
  ctx.fillStyle = 'rgba(10, 25, 40, 0.3)'; ctx.beginPath(); ctx.ellipse(8, 4, def.radius * 1.2, def.radius * 0.7, 0, 0, TAU); ctx.fill();
  for (let k = 0; k < 16; k++) {
    const u = k / 15; const r = def.radius * (0.55 + u * 0.9) + Math.sin(t * 5 + k) * 1.5;
    const off = Math.sin(t * 1.3 + u * 2.5 + sp.id) * 10 * u;
    const sc = def.palette?.spout;
    ctx.strokeStyle = sc ? `rgba(${sc[0] * (0.6 + u * 0.4)}, ${sc[1] * (0.6 + u * 0.4)}, ${sc[2] * (0.6 + u * 0.4)}, ${0.85 - u * 0.45})` : `rgba(${95 + u * 80}, ${110 + u * 75}, ${125 + u * 70}, ${0.85 - u * 0.45})`; ctx.lineWidth = 4 - u * 1.5;
    ctx.beginPath(); ctx.ellipse(off, -u * 120, r, r * 0.38, 0, t * 5 + k, t * 5 + k + 4.2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(120, 135, 150, 0.45)';
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(Math.sin(t + i) * 14 + (i - 2) * 12, -126 + Math.cos(t * 1.3 + i) * 4, 16, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// Screen space: rain, snow, gusts, darkness, flashes, fog.
export function drawWeatherScreen(ctx, w, mods, t, W, H, boatScreen) {
  if (!w) return;
  if (w.flash > 0) {
    ctx.fillStyle = `rgba(235, 242, 255, ${Math.min(0.55, w.flash * 3)})`; ctx.fillRect(0, 0, W, H);
  }
  if (!w.active) return;
  const wind = w.wind; const wa = Math.atan2(wind.y || 0.001, wind.x || 0.001); const wm = Math.hypot(wind.x, wind.y);
  if (mods.dark > 0) { ctx.fillStyle = `rgba(8, 14, 30, ${mods.dark})`; ctx.fillRect(0, 0, W, H); }
  if (mods.fog > 0) {
    const [r, g, b] = mods.fogColor || [200, 210, 215];
    if (mods.view && boatScreen) {
      const inner = Math.min(mods.view, Math.max(W, H)) * 0.55; const outer = Math.min(mods.view * 1.25, Math.max(W, H) * 1.5);
      const gr = ctx.createRadialGradient(boatScreen.x, boatScreen.y, inner, boatScreen.x, boatScreen.y, outer);
      gr.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`); gr.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${0.93 * mods.fog})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      // Drifting fog wisps.
      for (let i = 0; i < 8; i++) {
        const x = ((hash(i) * W * 1.4 + t * (8 + hash(i, 2) * 10)) % (W * 1.4)) - W * 0.2; const y = hash(i, 3) * H;
        const gg = ctx.createRadialGradient(x, y, 0, x, y, 120);
        gg.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.22 * mods.fog})`); gg.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = gg; ctx.fillRect(x - 120, y - 120, 240, 240);
      }
    } else {
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.22 * mods.fog})`; ctx.fillRect(0, 0, W, H);
    }
  }
  if (mods.rain > 0) {
    const n = Math.round(160 * mods.rain); const fall = 900;
    const dx = Math.cos(wa) * Math.min(1, wm / 60) * 0.45;
    ctx.strokeStyle = 'rgba(200, 225, 255, 0.45)'; ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const y = ((hash(i, 5) * H + t * fall) % (H + 40)) - 20;
      const x = ((hash(i, 6) * W + y * dx + t * dx * fall * 0.3) % W + W) % W;
      ctx.moveTo(x, y); ctx.lineTo(x - dx * 18, y - 18);
    }
    ctx.stroke();
  }
  if (mods.snow > 0) {
    const n = Math.round(140 * mods.snow);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < n; i++) {
      const sp = 40 + hash(i, 7) * 50;
      const y = ((hash(i, 8) * H + t * sp) % (H + 20)) - 10;
      const x = (((hash(i, 9) * W + t * Math.cos(wa) * wm * 0.8 + Math.sin(t + i) * 12) % W) + W) % W;
      ctx.beginPath(); ctx.arc(x, y, 1 + hash(i, 10) * 1.8, 0, TAU); ctx.fill();
    }
  }
  if (wm > 20 && mods.snow === 0) {
    // Gust streaks in the wind's direction.
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.18 * Math.min(1, wm / 70) * (mods.fade || 1)})`; ctx.lineWidth = 1.4;
    const cx = Math.cos(wa); const cy = Math.sin(wa);
    for (let i = 0; i < 18; i++) {
      const L = 40 + hash(i, 11) * 60; const sp = 220 + hash(i, 12) * 160;
      const p = (hash(i, 13) * (W + H) + t * sp) % (W + H + 200) - 100;
      const q = hash(i, 14) * (W + H) - H * 0.5;
      const x = (cx * p - cy * q + W * 10) % W; const y = (cy * p + cx * q + H * 10) % H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - cx * L, y - cy * L); ctx.stroke();
    }
  }
}

// A lightning bolt from the sky to the strike point (world space, brief).
export function drawBolt(ctx, x, y, life) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
  const pts = [[x, y]]; let px = x; let py = y;
  for (let i = 0; i < 9; i++) { px += (Math.random() - 0.5) * 26; py -= 34; pts.push([px, py]); }
  for (const [lw, col] of [[7, `rgba(140, 180, 255, ${0.35 * life})`], [2.2, `rgba(255, 255, 255, ${life})`]]) {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.stroke();
  }
  ctx.restore();
}

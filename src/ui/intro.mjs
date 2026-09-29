// Opening sequence (2026-09-29): a short painted scene while the harbour
// loads. Dawn over the reef, a galleon sails in, something stirs in the
// deep, the title lands, and a wave washes over into the harbour.
// Everything is drawn in code, in the game's palette. Tap to skip.

const DURATION = 7.2; // seconds before it moves on by itself (once loaded)

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }
function ease(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
function easeOutBack(t) { t = clamp01(t); const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; }

function seeded(n) { let s = n; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// Side-on galleon, bow to the right. (x, y) is the waterline centre.
function drawGalleon(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 1.4) * 0.035);
  ctx.scale(s, s);
  // Hull
  const hg = ctx.createLinearGradient(0, -18, 0, 12);
  hg.addColorStop(0, '#7a4a24'); hg.addColorStop(1, '#3b2211');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(-70, -22); ctx.lineTo(-58, -22); ctx.lineTo(-54, -14); ctx.lineTo(52, -14);
  ctx.quadraticCurveTo(70, -16, 84, -26); ctx.lineTo(78, -8);
  ctx.quadraticCurveTo(60, 12, 0, 12); ctx.quadraticCurveTo(-52, 12, -66, 0); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#26160b'; ctx.lineWidth = 1.5; ctx.stroke();
  // Gold trim and gunports
  ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-60, -6); ctx.quadraticCurveTo(0, 0, 76, -12); ctx.stroke();
  ctx.fillStyle = '#1a0f07';
  for (let i = 0; i < 6; i++) ctx.fillRect(-40 + i * 16, -3 + Math.abs(i - 2.5) * 0.4, 5, 4);
  // Stern lantern
  ctx.fillStyle = `rgba(255, 210, 110, ${0.7 + Math.sin(t * 6) * 0.2})`;
  ctx.beginPath(); ctx.arc(-66, -26, 2.5, 0, Math.PI * 2); ctx.fill();
  // Bowsprit
  ctx.strokeStyle = '#3b2211'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, -22); ctx.lineTo(112, -36); ctx.stroke();
  // Masts + sails, lit gold from the sunrise on their left edges.
  const masts = [[-34, 78], [8, 96], [48, 74]];
  for (const [mx, mh] of masts) {
    ctx.strokeStyle = '#3b2211'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(mx, -14); ctx.lineTo(mx, -14 - mh); ctx.stroke();
    for (let k = 0; k < 3; k++) {
      const top = -14 - mh + 8 + k * (mh / 3.2); const hgt = mh / 3.6; const wdt = 26 - k * -3;
      const billow = 5 + Math.sin(t * 2 + k + mx) * 1.5;
      const sg = ctx.createLinearGradient(mx - wdt, 0, mx + wdt, 0);
      sg.addColorStop(0, '#fff3d6'); sg.addColorStop(0.5, '#f1e2c0'); sg.addColorStop(1, '#bfae8e');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(mx - wdt, top);
      ctx.lineTo(mx + wdt, top);
      ctx.quadraticCurveTo(mx + wdt + billow, top + hgt / 2, mx + wdt - 2, top + hgt);
      ctx.lineTo(mx - wdt + 2, top + hgt);
      ctx.quadraticCurveTo(mx - wdt + billow, top + hgt / 2, mx - wdt, top);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90, 60, 30, 0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    // Flag
    const fx = mx; const fy = -14 - mh;
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx - 10, fy + 2 + Math.sin(t * 8 + mx) * 2, fx - 20, fy + 1); ctx.lineTo(fx - 20, fy + 7); ctx.quadraticCurveTo(fx - 10, fy + 8 + Math.sin(t * 8 + mx) * 2, fx, fy + 6); ctx.fill();
  }
  // Rigging
  ctx.strokeStyle = 'rgba(40, 25, 12, 0.6)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(112, -36); ctx.lineTo(48, -88); ctx.lineTo(8, -110); ctx.lineTo(-34, -92); ctx.lineTo(-66, -24); ctx.stroke();
  ctx.restore();
}

function drawTentacle(ctx, x, y, h, t, curl) {
  // A thick tapering tentacle rising from the sea, curling at the tip.
  const pts = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const bend = Math.sin(u * 3 + t * 2) * 10 * u + curl * u * u * 60;
    pts.push([x + bend, y - u * h]);
  }
  ctx.save();
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const w = lerp(22, 3, u) * (pass ? 0.55 : 1);
      ctx.strokeStyle = pass ? '#8a5aa8' : '#4b2a63';
      ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
    }
  }
  // Suckers
  ctx.fillStyle = '#d8b4e8';
  for (let i = 2; i < n - 3; i += 2) {
    const u = i / n;
    ctx.beginPath(); ctx.arc(pts[i][0] + lerp(8, 2, u), pts[i][1], lerp(3, 1, u), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function createIntro(root, { prepare, onDone, onFirstTap }) {
  const wrap = document.createElement('div');
  wrap.id = 'intro';
  wrap.innerHTML = '<canvas></canvas><div class="intro-skip">Tap to skip</div>';
  root.appendChild(wrap);
  const cv = wrap.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const skipHint = wrap.querySelector('.intro-skip');
  const titleLayer = document.createElement('canvas');
  let w = 0; let h = 0; let dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth; h = window.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  }
  resize();
  window.addEventListener('resize', resize);

  const rng = seeded(1234);
  const clouds = Array.from({ length: 7 }, () => ({ x: rng(), y: 0.08 + rng() * 0.28, s: 0.6 + rng() * 0.9, v: 0.004 + rng() * 0.008 }));
  const gulls = Array.from({ length: 5 }, () => ({ x: rng() * 1.2 - 0.2, y: 0.18 + rng() * 0.2, v: 0.03 + rng() * 0.03, ph: rng() * 6 }));
  const stars = Array.from({ length: 50 }, () => ({ x: rng(), y: rng() * 0.45, r: rng() * 1.2 + 0.3 }));

  let start = null; let loaded = false; let leaving = null; let done = false; let rafId = 0;
  // Build the harbour behind the scenes once the first frames are up.
  setTimeout(() => {
    Promise.resolve().then(() => prepare && prepare()).catch(() => {}).finally(() => { loaded = true; });
  }, 250);

  function leave() {
    if (leaving != null || done) return;
    leaving = performance.now();
  }
  wrap.addEventListener('pointerdown', () => {
    if (onFirstTap) { onFirstTap(); }
    if (start && performance.now() - start > 400) {
      if (loaded) leave(); else skipRequested = true;
    }
  });
  let skipRequested = false;

  function frame(now) {
    if (start == null) start = now;
    const T = (now - start) / 1000;
    if (!leaving && loaded && (T > DURATION || skipRequested)) leave();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const horizon = h * 0.58;
    // --- Sky: night lifting into dawn ---
    const dawn = ease(T / 3.2);
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, `rgb(${lerp(8, 24, dawn)}, ${lerp(14, 44, dawn)}, ${lerp(38, 92, dawn)})`);
    sky.addColorStop(0.55, `rgb(${lerp(28, 170, dawn)}, ${lerp(30, 90, dawn)}, ${lerp(70, 120, dawn)})`);
    sky.addColorStop(1, `rgb(${lerp(60, 255, dawn)}, ${lerp(40, 170, dawn)}, ${lerp(70, 90, dawn)})`);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon + 2);
    for (const s of stars) {
      ctx.fillStyle = `rgba(255, 255, 240, ${(1 - dawn) * 0.8})`;
      ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2); ctx.fill();
    }
    // Sun rising behind the reef
    const sunX = w * 0.68; const sunY = lerp(horizon + 40, horizon - h * 0.12, ease(T / 5));
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, Math.max(w, h) * 0.6);
    glow.addColorStop(0, 'rgba(255, 230, 160, 0.9)'); glow.addColorStop(0.15, 'rgba(255, 180, 90, 0.45)'); glow.addColorStop(1, 'rgba(255, 140, 80, 0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = '#fff1c4'; ctx.beginPath(); ctx.arc(sunX, sunY, Math.min(w, h) * 0.07, 0, Math.PI * 2); ctx.fill();
    // Clouds, lit from below
    for (const c of clouds) {
      const cx = ((c.x + T * c.v) % 1.3 - 0.15) * w; const cy = c.y * h; const s = c.s * Math.min(w, h) * 0.09;
      ctx.fillStyle = `rgba(${lerp(60, 255, dawn)}, ${lerp(50, 200, dawn)}, ${lerp(90, 170, dawn)}, 0.55)`;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(cx + (k - 1.5) * s * 0.7, cy + Math.sin(k * 2) * s * 0.15, s * 0.6, s * 0.28, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    // Far reef silhouettes: jagged "shattered" spires and palm islets
    ctx.fillStyle = `rgb(${lerp(20, 70, dawn)}, ${lerp(20, 40, dawn)}, ${lerp(50, 80, dawn)})`;
    const spire = (x, bw, bh) => { ctx.beginPath(); ctx.moveTo(x - bw, horizon); ctx.lineTo(x - bw * 0.3, horizon - bh); ctx.lineTo(x - bw * 0.05, horizon - bh * 0.7); ctx.lineTo(x + bw * 0.25, horizon - bh * 1.1); ctx.lineTo(x + bw, horizon); ctx.fill(); };
    spire(w * 0.12, w * 0.07, h * 0.1); spire(w * 0.2, w * 0.05, h * 0.06); spire(w * 0.86, w * 0.08, h * 0.13); spire(w * 0.95, w * 0.05, h * 0.07);
    ctx.beginPath(); ctx.ellipse(w * 0.45, horizon, w * 0.09, h * 0.022, 0, Math.PI, 0); ctx.fill();
    for (const px of [0.42, 0.47]) {
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w * px, horizon - h * 0.02); ctx.quadraticCurveTo(w * px + 4, horizon - h * 0.05, w * px + 2, horizon - h * 0.07); ctx.stroke();
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.55; ctx.beginPath(); ctx.ellipse(w * px + 2 + Math.cos(a) * 7, horizon - h * 0.07 + Math.sin(a) * 4 + 3, 8, 2.2, a, 0, Math.PI * 2); ctx.fill(); }
    }
    // --- Sea ---
    const sea = ctx.createLinearGradient(0, horizon, 0, h);
    sea.addColorStop(0, `rgb(${lerp(30, 90, dawn)}, ${lerp(50, 120, dawn)}, ${lerp(90, 150, dawn)})`);
    sea.addColorStop(0.3, '#12708f'); sea.addColorStop(1, '#0a3f5e');
    ctx.fillStyle = sea; ctx.fillRect(0, horizon, w, h - horizon);
    // Sun path glitter
    for (let i = 0; i < 40; i++) {
      const yy = horizon + (i / 40) ** 1.6 * (h - horizon);
      const spread = 6 + (yy - horizon) * 0.25;
      const xx = sunX + Math.sin(i * 12.9 + T * 3) * spread;
      ctx.fillStyle = `rgba(255, 225, 150, ${0.55 * dawn * (1 - i / 45)})`;
      ctx.fillRect(xx - 6 - i * 0.3, yy, 12 + i * 0.6, 1.6 + i * 0.05);
    }
    // Wave bands
    for (let band = 0; band < 7; band++) {
      const yy = horizon + (band + 1) ** 1.7 * (h - horizon) * 0.03;
      ctx.strokeStyle = `rgba(200, 245, 255, ${0.08 + band * 0.025})`; ctx.lineWidth = 1 + band * 0.4;
      ctx.beginPath();
      for (let x = -10; x <= w + 10; x += 12) {
        const y2 = yy + Math.sin(x * 0.02 + T * (1 + band * 0.2) + band) * (2 + band);
        x === -10 ? ctx.moveTo(x, y2) : ctx.lineTo(x, y2);
      }
      ctx.stroke();
    }
    // --- Something stirs: a tentacle rises behind the reef, then sinks ---
    const tu = (T - 2.4) / 2.2;
    if (tu > 0 && tu < 1) {
      const rise = Math.sin(tu * Math.PI);
      const tx = w * 0.82; const ty = horizon + h * 0.04;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, ty); ctx.clip();
      drawTentacle(ctx, tx, ty, h * 0.26 * rise, T, 0.5 + rise * 0.5);
      ctx.restore();
      ctx.fillStyle = `rgba(230, 250, 255, ${0.6 * rise})`;
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(tx + (k - 2.5) * 9, ty + Math.sin(T * 8 + k) * 1.5, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    // --- The galleon sails in ---
    const shipScale = Math.min(w / 520, h / 620) * 1.1 + 0.2;
    const shipX = lerp(-w * 0.35, w * 0.4, ease(T / 4.4)) + Math.max(0, T - 4.4) * 8;
    const shipY = horizon + h * 0.14 + Math.sin(T * 1.6) * 3;
    // Wake
    ctx.fillStyle = 'rgba(235, 252, 255, 0.35)';
    for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.ellipse(shipX - k * 26 * shipScale - 60 * shipScale, shipY + 8 * shipScale, (16 + k * 4) * shipScale, 3 * shipScale, 0, 0, Math.PI * 2); ctx.fill(); }
    drawGalleon(ctx, shipX, shipY, shipScale, T);
    ctx.fillStyle = 'rgba(10, 60, 90, 0.35)';
    ctx.fillRect(0, shipY + 10 * shipScale, w, 3);
    // Gulls
    for (const g of gulls) {
      const gx = ((g.x + T * g.v) % 1.3) * w; const gy = g.y * h + Math.sin(T * 2 + g.ph) * 6;
      const flap = Math.sin(T * 9 + g.ph) * 5;
      ctx.strokeStyle = 'rgba(30, 25, 40, 0.8)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(gx - 8, gy - flap * 0.5); ctx.quadraticCurveTo(gx - 3, gy - 3, gx, gy); ctx.quadraticCurveTo(gx + 3, gy - 3, gx + 8, gy - flap * 0.5); ctx.stroke();
    }
    // --- Title ---
    const tt = (T - 3.4) / 0.9;
    if (tt > 0) {
      const big = Math.min(w * 0.17, h * 0.13, 120);
      const cy = h * 0.22;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const s1 = easeOutBack(tt);
      ctx.globalAlpha = clamp01(tt * 2);
      ctx.font = `700 ${big * 0.32}px Georgia, 'Times New Roman', serif`;
      ctx.lineWidth = big * 0.06; ctx.strokeStyle = 'rgba(20, 10, 4, 0.85)'; ctx.lineJoin = 'round';
      ctx.save(); ctx.translate(w / 2, cy - big * 0.62); ctx.scale(s1, s1);
      ctx.strokeText('THE SHATTERED', 0, 0);
      ctx.fillStyle = '#ffe9b0'; ctx.fillText('THE SHATTERED', 0, 0);
      ctx.restore();
      const s2 = easeOutBack((T - 3.65) / 0.9);
      if (s2 > 0) {
        // The word is drawn on its own layer so the gleam only lights the
        // letters, not the sky behind them.
        const lw = Math.ceil(big * 3.4); const lh = Math.ceil(big * 1.5);
        titleLayer.width = lw * dpr; titleLayer.height = lh * dpr;
        const tc = titleLayer.getContext('2d');
        tc.setTransform(dpr, 0, 0, dpr, lw * dpr / 2, lh * dpr / 2);
        tc.textAlign = 'center'; tc.textBaseline = 'middle'; tc.lineJoin = 'round';
        tc.font = `900 ${big}px Georgia, 'Times New Roman', serif`;
        tc.lineWidth = big * 0.11; tc.strokeStyle = 'rgba(30, 14, 4, 0.9)';
        tc.strokeText('REEF', 0, 0);
        const gold = tc.createLinearGradient(0, -big / 2, 0, big / 2);
        gold.addColorStop(0, '#fff3c0'); gold.addColorStop(0.45, '#ffc94d'); gold.addColorStop(1, '#b8741c');
        tc.fillStyle = gold; tc.fillText('REEF', 0, 0);
        const gx = lerp(-big * 1.6, big * 1.6, clamp01((T - 4.6) / 0.8));
        tc.globalCompositeOperation = 'source-atop';
        const sheen = tc.createLinearGradient(gx - 30, 0, gx + 30, 0);
        sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0.8)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
        tc.fillStyle = sheen; tc.fillRect(-lw / 2, -lh / 2, lw, lh);
        tc.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.translate(w / 2, cy + big * 0.1); ctx.scale(s2, s2);
        ctx.drawImage(titleLayer, -lw / 2, -lh / 2, lw, lh);
        ctx.restore();
      }
      const st = clamp01((T - 4.8) / 0.6);
      if (st > 0) {
        ctx.globalAlpha = st;
        ctx.font = `600 ${Math.max(12, big * 0.16)}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = '#f6e6c2';
        ctx.strokeStyle = 'rgba(10, 20, 30, 0.7)'; ctx.lineWidth = 3;
        const line = 'Sink the pirates · Brave the deep · Chart the reefs';
        ctx.strokeText(line, w / 2, cy + big * 0.78); ctx.fillText(line, w / 2, cy + big * 0.78);
      }
      ctx.restore();
    }
    // --- Loading bar ---
    const progress = loaded ? 1 : Math.min(0.9, T / 2.5);
    const bw = Math.min(260, w * 0.6); const bx = (w - bw) / 2; const by = h - Math.max(46, h * 0.07);
    ctx.fillStyle = 'rgba(4, 20, 30, 0.55)'; ctx.fillRect(bx - 2, by - 2, bw + 4, 8);
    const bar = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    bar.addColorStop(0, '#e8b54b'); bar.addColorStop(1, '#ffe28a');
    ctx.fillStyle = bar; ctx.fillRect(bx, by, bw * progress, 4);
    ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(246, 230, 194, 0.85)';
    ctx.fillText(loaded ? 'The harbour awaits' : 'Charting the reefs…', w / 2, by - 10);
    skipHint.classList.toggle('show', T > 1.2);

    // --- Leaving: a wave washes up over everything, then the harbour ---
    if (leaving != null) {
      const lt = (now - leaving) / 1000;
      const k = ease(lt / 0.7);
      const top = lerp(h + 40, -60, k);
      ctx.fillStyle = '#0f5f82';
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w + 20; x += 20) ctx.lineTo(x, top + Math.sin(x * 0.03 + lt * 10) * 14);
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(240, 252, 255, 0.9)'; ctx.lineWidth = 5;
      ctx.beginPath();
      for (let x = 0; x <= w + 20; x += 20) { const y2 = top + Math.sin(x * 0.03 + lt * 10) * 14; x ? ctx.lineTo(x, y2) : ctx.moveTo(x, y2); }
      ctx.stroke();
      if (lt > 0.7) wrap.style.opacity = String(Math.max(0, 1 - (lt - 0.7) / 0.45));
      if (lt > 1.15) { finish(); return; }
    }
    rafId = requestAnimationFrame(frame);
  }
  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    wrap.remove();
    if (onDone) onDone();
  }
  rafId = requestAnimationFrame(frame);
  return { skip: () => { skipRequested = true; if (loaded) leave(); }, isDone: () => done };
}

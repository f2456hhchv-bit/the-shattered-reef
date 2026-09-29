// Opening sequence (2026-09-29): a short painted scene while the harbour
// loads. Dawn over the reef, a galleon sails in, something stirs in the
// deep, the title lands, and a wave washes over into the harbour.
// Everything is drawn in code, in the game's palette. Tap to skip.

import { viewH } from './viewport.mjs';

const DURATION = 7.2; // seconds before it moves on by itself (once loaded)

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }
function ease(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
function easeOutBack(t) { t = clamp01(t); const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; }

function seeded(n) { let s = n; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// Side-on galleon, bow to the right. (x, y) is the waterline centre.
// Redone 2026-09-29 (project owner: the first one looked "a bit poor"):
// a raised stern castle and forecastle, planked and gilded hull with open
// gunports and lit stern windows, three masts with yards, billowing sails
// shaded against the rising sun, jibs and a spanker, shrouds and stays,
// and a reflection in the water below.
const SUN_SIDE = 1; // the sun is ahead-right of the ship: lit edges face +x

function hullPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-86, -46); // stern castle top
  ctx.lineTo(-52, -46);
  ctx.lineTo(-50, -34); // step down to the quarterdeck
  ctx.quadraticCurveTo(-10, -26, 44, -28); // the waist, low amidships
  ctx.lineTo(48, -36); // forecastle
  ctx.quadraticCurveTo(70, -37, 82, -42); // rising to the bow
  ctx.quadraticCurveTo(90, -24, 92, 2); // cutwater
  ctx.quadraticCurveTo(40, 8, -10, 8);
  ctx.quadraticCurveTo(-60, 8, -78, 2);
  ctx.quadraticCurveTo(-82, -20, -86, -46); // raked transom
  ctx.closePath();
}

function sail(ctx, cx, top, w, h, belly, t, k) {
  // A square sail on its yard, bellied forward by the wind.
  const flutter = Math.sin(t * 2.2 + k) * 1.2;
  const l = cx - w / 2; const r = cx + w / 2; const bot = top + h;
  const g = ctx.createLinearGradient(l, 0, r, 0);
  g.addColorStop(0, '#c7b08a'); g.addColorStop(0.45, '#f1e2c2'); g.addColorStop(0.8, '#fff6de'); g.addColorStop(1, '#ffe7b0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(l, top);
  ctx.quadraticCurveTo(cx, top - 2, r, top);
  ctx.bezierCurveTo(r + belly + flutter, top + h * 0.3, r + belly * 0.8 + flutter, top + h * 0.75, r - 1, bot);
  ctx.quadraticCurveTo(cx + belly * 0.5, bot + 5 + flutter, l + 1, bot);
  ctx.bezierCurveTo(l + belly * 0.6, top + h * 0.7, l + belly * 0.5, top + h * 0.3, l, top);
  ctx.fill();
  // Belly shadow and a sunlit rim.
  const bs = ctx.createRadialGradient(cx - w * 0.18, top + h * 0.6, 1, cx - w * 0.18, top + h * 0.6, w * 0.45);
  bs.addColorStop(0, 'rgba(120, 88, 50, 0.22)'); bs.addColorStop(1, 'rgba(120, 88, 50, 0)');
  ctx.fillStyle = bs; ctx.fillRect(l, top, w, h + 4);
  ctx.strokeStyle = 'rgba(255, 214, 140, 0.9)'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(r, top); ctx.bezierCurveTo(r + belly + flutter, top + h * 0.3, r + belly * 0.8 + flutter, top + h * 0.75, r - 1, bot); ctx.stroke();
  // Seams and reef bands.
  ctx.strokeStyle = 'rgba(110, 80, 45, 0.28)'; ctx.lineWidth = 0.6;
  for (let i = 1; i < 5; i++) {
    const sx = l + (w * i) / 5;
    ctx.beginPath(); ctx.moveTo(sx, top + 1); ctx.quadraticCurveTo(sx + belly * 0.45, top + h * 0.5, sx + belly * 0.2, bot + 2); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(l + 2, top + h * 0.22); ctx.quadraticCurveTo(cx + belly * 0.4, top + h * 0.26, r + belly * 0.4, top + h * 0.22); ctx.stroke();
  // The yard.
  ctx.strokeStyle = '#3b2211'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(l - 4, top); ctx.quadraticCurveTo(cx, top - 2, r + 4, top); ctx.stroke();
}

function drawGalleonShape(ctx, t) {
  // --- Masts, back to front so the fore rigging overlaps ---
  const masts = [
    { x: -44, h: 138, sails: [[62, 30], [52, 26], [40, 20]] },
    { x: 4, h: 176, sails: [[82, 38], [70, 32], [56, 26], [40, 18]] },
    { x: 50, h: 150, sails: [[70, 34], [60, 28], [46, 22]] },
  ];
  const deckY = (x) => (x < -50 ? -46 : x > 48 ? -36 : -30);
  // Stays and shrouds behind the sails.
  ctx.strokeStyle = 'rgba(40, 25, 12, 0.55)'; ctx.lineWidth = 0.8;
  for (const m of masts) {
    const top = deckY(m.x) - m.h;
    for (const dx of [-26, -16, -8]) { ctx.beginPath(); ctx.moveTo(m.x, top + 18); ctx.lineTo(m.x + dx, deckY(m.x) + 2); ctx.stroke(); }
  }
  ctx.beginPath();
  ctx.moveTo(136, -70); ctx.lineTo(masts[2].x, deckY(50) - masts[2].h + 6);
  ctx.lineTo(masts[1].x, deckY(4) - masts[1].h + 6); ctx.lineTo(masts[0].x, deckY(-44) - masts[0].h + 6);
  ctx.lineTo(-92, -52); ctx.stroke();
  // Spanker (fore-and-aft sail on the mizzen).
  {
    const mx = -44; const top = deckY(mx) - 96;
    const g = ctx.createLinearGradient(-90, 0, mx, 0);
    g.addColorStop(0, '#d9c49e'); g.addColorStop(1, '#fff1d0');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(mx - 2, top); ctx.lineTo(-96, top + 22); ctx.quadraticCurveTo(-80, top + 50, -92, deckY(mx) - 18); ctx.lineTo(mx - 2, deckY(mx) - 14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3b2211'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(mx, top); ctx.lineTo(-98, top + 22); ctx.moveTo(mx, deckY(mx) - 14); ctx.lineTo(-100, deckY(mx) - 18); ctx.stroke();
  }
  for (const [mi, m] of masts.entries()) {
    const base = deckY(m.x); const top = base - m.h;
    // Mast with a lit edge.
    ctx.strokeStyle = '#3b2211'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(m.x, base); ctx.lineTo(m.x, top); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 200, 120, 0.5)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(m.x + 1.2, base); ctx.lineTo(m.x + 1, top); ctx.stroke();
    // Sails from the course up.
    let y = base - 10;
    m.sails.forEach(([w, h], k) => {
      y -= h + 4;
      sail(ctx, m.x, y, w, h, 7 - k, t, mi * 3 + k);
    });
    // Tops and a crow's nest on the main.
    ctx.fillStyle = '#4a2c14';
    ctx.fillRect(m.x - 8, base - m.sails[0][1] - 18, 16, 3);
    if (mi === 1) { ctx.fillStyle = '#5a3616'; ctx.fillRect(m.x - 6, top + 24, 12, 7); ctx.fillStyle = '#7a4a24'; ctx.fillRect(m.x - 6, top + 24, 12, 2); }
    // Long pennant from the truck.
    const wv = (k) => Math.sin(t * 7 + k + mi) * 2.5;
    ctx.fillStyle = mi === 1 ? '#b8322a' : '#c9402f';
    ctx.beginPath(); ctx.moveTo(m.x, top);
    const len = mi === 1 ? 44 : 28;
    ctx.quadraticCurveTo(m.x - len * 0.5, top + 1 + wv(0), m.x - len, top + 2 + wv(1));
    ctx.lineTo(m.x - len * 0.55, top + 5 + wv(2)); ctx.quadraticCurveTo(m.x - len * 0.3, top + 6 + wv(0), m.x, top + 7); ctx.fill();
    ctx.fillStyle = '#e8b83a'; ctx.fillRect(m.x - 5, top + 2, 3, 3);
  }
  // Jibs from the foremast to the bowsprit.
  for (const [k, [fy, bx, by]] of [[-104, 132, -66], [-80, 112, -54]].entries()) {
    const g = ctx.createLinearGradient(50, 0, bx, 0);
    g.addColorStop(0, '#e6d3ae'); g.addColorStop(1, '#fff5dc');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(52, fy); ctx.quadraticCurveTo(bx - 8 + Math.sin(t * 2 + k) * 2, (fy + by) / 2 + 6, bx, by);
    ctx.lineTo(56, -40 - k * 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 214, 140, 0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(52, fy); ctx.quadraticCurveTo(bx - 8, (fy + by) / 2 + 6, bx, by); ctx.stroke();
  }
  // Bowsprit + jib-boom.
  ctx.strokeStyle = '#3b2211'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(80, -40); ctx.lineTo(140, -70); ctx.stroke();

  // --- Hull ---
  const hg = ctx.createLinearGradient(0, -46, 0, 8);
  hg.addColorStop(0, '#8d5a2e'); hg.addColorStop(0.45, '#6a3f1f'); hg.addColorStop(1, '#2e1a0b');
  ctx.fillStyle = hg; hullPath(ctx); ctx.fill();
  ctx.save(); hullPath(ctx); ctx.clip();
  // Planking following the sheer.
  ctx.strokeStyle = 'rgba(30, 16, 6, 0.45)'; ctx.lineWidth = 0.7;
  for (let i = 0; i < 9; i++) {
    const o = -24 + i * 4;
    ctx.beginPath(); ctx.moveTo(-90, o - 6); ctx.quadraticCurveTo(0, o + 2, 96, o - 12); ctx.stroke();
  }
  // Black wales and gilded rails.
  ctx.fillStyle = '#1e140c';
  ctx.beginPath(); ctx.moveTo(-90, -14); ctx.quadraticCurveTo(0, -4, 96, -22); ctx.lineTo(96, -18); ctx.quadraticCurveTo(0, 0, -90, -10); ctx.fill();
  ctx.strokeStyle = '#e0ad48'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-90, -28); ctx.quadraticCurveTo(0, -18, 96, -34); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-90, -8); ctx.quadraticCurveTo(0, 2, 96, -16); ctx.stroke();
  // Gunports: open, red-lidded, with a cannon muzzle in each.
  for (let i = 0; i < 8; i++) {
    const gx = -52 + i * 15; const gy = -20 + Math.pow((gx - 8) / 90, 2) * 6 - (gx > 40 ? (gx - 40) * 0.06 : 0);
    ctx.fillStyle = '#9a2a1e'; ctx.fillRect(gx - 0.5, gy - 7.5, 7, 3); // raised lid
    ctx.fillStyle = '#140b05'; ctx.fillRect(gx, gy - 4, 6, 5);
    ctx.fillStyle = '#3a3d42'; ctx.beginPath(); ctx.arc(gx + 3, gy - 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Stern castle windows, glowing, and gilt carving.
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = `rgba(255, 214, 120, ${0.75 + Math.sin(t * 5 + i) * 0.15})`;
    ctx.fillRect(-80 + i * 8, -40, 5, 6);
  }
  ctx.strokeStyle = '#e0ad48'; ctx.lineWidth = 1;
  ctx.strokeRect(-82, -42, 26, 10);
  // Stern lantern.
  const lg = ctx.createRadialGradient(-88, -54, 0, -88, -54, 10);
  lg.addColorStop(0, `rgba(255, 220, 130, ${0.8 + Math.sin(t * 6) * 0.15})`); lg.addColorStop(1, 'rgba(255, 220, 130, 0)');
  ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(-88, -54, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe28a'; ctx.fillRect(-90, -57, 4, 5);
  // Figurehead.
  ctx.fillStyle = '#e0ad48';
  ctx.beginPath(); ctx.moveTo(84, -40); ctx.quadraticCurveTo(96, -44, 98, -36); ctx.quadraticCurveTo(92, -34, 86, -30); ctx.fill();
  // Rails: a crisp dark outline and a sunlit top edge.
  ctx.strokeStyle = '#1e1008'; ctx.lineWidth = 1.4; hullPath(ctx); ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 200, 120, 0.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-50, -34); ctx.quadraticCurveTo(-10, -26, 44, -28); ctx.moveTo(48, -36); ctx.quadraticCurveTo(70, -37, 82, -42); ctx.stroke();
  void SUN_SIDE;
}

function drawGalleon(ctx, x, y, s, t) {
  const roll = Math.sin(t * 1.4) * 0.03;
  // Reflection: the ship upside down, squashed and broken by the swell.
  ctx.save();
  ctx.translate(x, y + 4 * s);
  ctx.beginPath(); ctx.rect(-140 * s, 0, 300 * s, 95 * s); ctx.clip();
  ctx.globalAlpha = 0.13;
  ctx.scale(s, -s * 0.62); ctx.rotate(-roll);
  drawGalleonShape(ctx, t);
  ctx.restore();
  // Ripples across the reflection.
  ctx.save();
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const yy = y + (8 + i * 9) * s;
    // Each ripple is short and fades at its ends, so there's no hard box.
    const half = (70 + ((i * 37) % 50)) * (1 - i * 0.06); const off = ((i * 53) % 60) - 20;
    const rg = ctx.createLinearGradient(x + (off - half) * s, 0, x + (off + half) * s, 0);
    rg.addColorStop(0, 'rgba(12, 80, 110, 0)'); rg.addColorStop(0.5, 'rgba(12, 80, 110, 0.5)'); rg.addColorStop(1, 'rgba(12, 80, 110, 0)');
    ctx.strokeStyle = rg;
    ctx.beginPath();
    for (let xx = off - half; xx <= off + half; xx += 10) {
      const py = yy + Math.sin(xx * 0.08 + t * 3 + i) * 1.4;
      xx === off - half ? ctx.moveTo(x + xx * s, py) : ctx.lineTo(x + xx * s, py);
    }
    ctx.stroke();
  }
  ctx.restore();
  // The ship.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(roll);
  ctx.scale(s, s);
  drawGalleonShape(ctx, t);
  // Bow spray and a foam line along the waterline.
  ctx.fillStyle = 'rgba(240, 252, 255, 0.85)';
  for (let i = 0; i < 7; i++) {
    const ph = (t * 1.6 + i / 7) % 1;
    ctx.beginPath(); ctx.arc(92 + ph * 14 + i, 0 - Math.sin(ph * Math.PI) * 10, 1.6 * (1 - ph) + 0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(235, 250, 255, 0.55)';
  ctx.beginPath(); ctx.ellipse(10, 4, 90, 3.2, 0, 0, Math.PI * 2); ctx.fill();
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
    w = window.innerWidth; h = viewH();
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
      // Lit from below by the rising sun: warm underside, cooler crown.
      const cg = ctx.createLinearGradient(0, cy - s * 0.45, 0, cy + s * 0.3);
      cg.addColorStop(0, `rgba(${lerp(40, 150, dawn)}, ${lerp(40, 110, dawn)}, ${lerp(80, 150, dawn)}, 0.75)`);
      cg.addColorStop(1, `rgba(${lerp(70, 255, dawn)}, ${lerp(50, 196, dawn)}, ${lerp(90, 150, dawn)}, 0.85)`);
      ctx.fillStyle = cg;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const kx = cx + (k - 2) * s * 0.55; const ky = cy - Math.sin((k / 4) * Math.PI) * s * 0.28;
        ctx.moveTo(kx + s * 0.5, ky); ctx.ellipse(kx, ky, s * 0.5, s * 0.34, 0, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    // Far reef silhouettes: jagged "shattered" spires and palm islets
    // A hazy far range first, then the shattered spires.
    ctx.fillStyle = `rgba(${lerp(40, 190, dawn)}, ${lerp(40, 110, dawn)}, ${lerp(80, 130, dawn)}, 0.55)`;
    ctx.beginPath(); ctx.moveTo(0, horizon);
    for (let x = 0; x <= w; x += w / 24) ctx.lineTo(x, horizon - h * 0.02 - Math.abs(Math.sin(x * 0.013 + 1.3)) * h * 0.045);
    ctx.lineTo(w, horizon); ctx.fill();
    const mg = ctx.createLinearGradient(0, horizon - h * 0.14, 0, horizon);
    mg.addColorStop(0, `rgb(${lerp(20, 88, dawn)}, ${lerp(20, 48, dawn)}, ${lerp(50, 92, dawn)})`);
    mg.addColorStop(1, `rgb(${lerp(14, 52, dawn)}, ${lerp(14, 30, dawn)}, ${lerp(36, 66, dawn)})`);
    ctx.fillStyle = mg;
    const spire = (x, bw, bh) => { ctx.beginPath(); ctx.moveTo(x - bw, horizon); ctx.lineTo(x - bw * 0.3, horizon - bh); ctx.lineTo(x - bw * 0.05, horizon - bh * 0.7); ctx.lineTo(x + bw * 0.25, horizon - bh * 1.1); ctx.lineTo(x + bw, horizon); ctx.fill(); };
    spire(w * 0.12, w * 0.07, h * 0.1); spire(w * 0.2, w * 0.05, h * 0.06); spire(w * 0.86, w * 0.08, h * 0.13); spire(w * 0.95, w * 0.05, h * 0.07);
    // Sunlit rims on the faces toward the sun.
    ctx.strokeStyle = `rgba(255, 190, 120, ${0.55 * dawn})`; ctx.lineWidth = 1.5;
    for (const [x0, bw, bh] of [[w * 0.12, w * 0.07, h * 0.1], [w * 0.86, w * 0.08, h * 0.13]]) {
      ctx.beginPath(); ctx.moveTo(x0 + bw * 0.25, horizon - bh * 1.1); ctx.lineTo(x0 + bw, horizon); ctx.stroke();
    }
    ctx.fillStyle = mg;
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
    const shipScale = Math.min(w / 560, h / 640) * 1.05 + 0.18;
    const shipX = lerp(-w * 0.35, w * 0.4, ease(T / 4.4)) + Math.max(0, T - 4.4) * 8;
    const shipY = horizon + h * 0.14 + Math.sin(T * 1.6) * 3;
    // Wake
    ctx.fillStyle = 'rgba(235, 252, 255, 0.35)';
    for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.ellipse(shipX - k * 26 * shipScale - 60 * shipScale, shipY + 8 * shipScale, (16 + k * 4) * shipScale, 3 * shipScale, 0, 0, Math.PI * 2); ctx.fill(); }
    drawGalleon(ctx, shipX, shipY, shipScale, T);
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

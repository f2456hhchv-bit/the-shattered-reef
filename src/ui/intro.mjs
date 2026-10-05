// Opening sequence: a short scene while the harbour loads, then a wave
// washes over into the harbour. Tap to skip. Since 2026-10-05 the scene
// itself (ui/introScene.mjs) is a chase drawn with the game's own art:
// the reef terrain, the painted ships and the creature sprites. This file
// keeps the title, loading bar, gulls and the exit wave.

import { viewH } from './viewport.mjs';
import { buildIntroScene, drawIntroScene } from './introScene.mjs';

const DURATION = 8.6; // seconds before it moves on by itself (once loaded)

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }
function ease(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
function easeOutBack(t) { t = clamp01(t); const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; }

function seeded(n) { let s = n; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

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
  const gulls = Array.from({ length: 5 }, () => ({ x: rng() * 1.2 - 0.2, y: 0.18 + rng() * 0.2, v: 0.03 + rng() * 0.03, ph: rng() * 6 }));

  let scene = null; let sceneStart = 0; let sceneFailed = false;
  const S0 = () => (scene ? (performance.now() - sceneStart) / 1000 : 0);
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
    if (!leaving && loaded && ((scene || sceneFailed) && (S0() > DURATION || sceneFailed && T > 4) || skipRequested)) leave();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // --- The scene (ui/introScene.mjs): built after the first frame ---
    if (!scene && !sceneFailed && T > 0.05) {
      try { scene = buildIntroScene(dpr); sceneStart = now; } catch (err) { sceneFailed = true; console.error(err); }
    }
    const S = scene ? (now - sceneStart) / 1000 : 0;
    if (scene) {
      const cam = drawIntroScene(ctx, scene, w, h, S, now);
      scene.renderer.prewarm(cam.x, cam.y, 4);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#061224'); g.addColorStop(1, '#0a3550');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    // A soft dark band behind the title so it reads over any water.
    const band = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    band.addColorStop(0, 'rgba(4, 12, 24, 0.55)'); band.addColorStop(1, 'rgba(4, 12, 24, 0)');
    ctx.fillStyle = band; ctx.fillRect(0, 0, w, h * 0.45);
    for (const g of gulls) {
      const gx = ((g.x + T * g.v) % 1.3) * w; const gy = g.y * h + Math.sin(T * 2 + g.ph) * 6;
      const flap = Math.sin(T * 9 + g.ph) * 5;
      ctx.fillStyle = 'rgba(4, 30, 40, 0.18)';
      ctx.beginPath(); ctx.ellipse(gx + 18, gy + 46, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(250, 250, 245, 0.92)'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(gx - 8, gy - flap * 0.5); ctx.quadraticCurveTo(gx - 3, gy - 3, gx, gy); ctx.quadraticCurveTo(gx + 3, gy - 3, gx + 8, gy - flap * 0.5); ctx.stroke();
    }
    // --- Title ---
    const tt = (S - 1.2) / 0.9;
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
      const s2 = easeOutBack((S - 1.45) / 0.9);
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
        const gx = lerp(-big * 1.6, big * 1.6, clamp01((S - 2.4) / 0.8));
        tc.globalCompositeOperation = 'source-atop';
        const sheen = tc.createLinearGradient(gx - 30, 0, gx + 30, 0);
        sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0.8)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
        tc.fillStyle = sheen; tc.fillRect(-lw / 2, -lh / 2, lw, lh);
        tc.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.translate(w / 2, cy + big * 0.1); ctx.scale(s2, s2);
        ctx.drawImage(titleLayer, -lw / 2, -lh / 2, lw, lh);
        ctx.restore();
      }
      const st = clamp01((S - 2.6) / 0.6);
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
    const progress = loaded && scene ? 1 : Math.min(0.9, T / 2.5);
    const bw = Math.min(260, w * 0.6); const bx = (w - bw) / 2; const by = h - Math.max(46, h * 0.07);
    ctx.fillStyle = 'rgba(4, 20, 30, 0.55)'; ctx.fillRect(bx - 2, by - 2, bw + 4, 8);
    const bar = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    bar.addColorStop(0, '#e8b54b'); bar.addColorStop(1, '#ffe28a');
    ctx.fillStyle = bar; ctx.fillRect(bx, by, bw * progress, 4);
    ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(246, 230, 194, 0.85)';
    ctx.fillText(loaded && scene ? 'The harbour awaits' : 'Charting the reefs…', w / 2, by - 10);
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

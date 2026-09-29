// Darkness and ambient atmosphere, drawn (2026-09-29; logic in
// engine/ambient.mjs). The darkness is a low-resolution offscreen layer
// covering the visible world, with soft holes cut out wherever there is
// light, drawn over the terrain and the hunters but UNDER every attack
// telegraph and shot: in the dark you always see what is coming at you.

const TAU = Math.PI * 2;
const hash = (i, k = 1) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

let layer = null; let lctx = null;
const SCALE = 0.5; // the layer's resolution relative to world px

// lights: [{ x, y, r, k? }] in world px (k = strength 0..1, default 1).
export function drawDarkness(ctx, visible, amb, lights, t) {
  if (!amb.dark || amb.light == null) return;
  const pad = 24;
  const x0 = visible.left - pad; const y0 = visible.top - pad;
  const w = visible.right - visible.left + pad * 2; const h = visible.bottom - visible.top + pad * 2;
  const W = Math.max(8, Math.ceil(w * SCALE)); const H = Math.max(8, Math.ceil(h * SCALE));
  if (!layer) { layer = document.createElement('canvas'); lctx = layer.getContext('2d'); }
  if (layer.width !== W || layer.height !== H) { layer.width = W; layer.height = H; }
  const [r, g, b] = amb.color;
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, W, H);
  lctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${amb.dark})`;
  lctx.fillRect(0, 0, W, H);
  lctx.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    const lx = (L.x - x0) * SCALE; const ly = (L.y - y0) * SCALE; const lr = L.r * SCALE;
    if (lx < -lr || ly < -lr || lx > W + lr || ly > H + lr || lr < 1) continue;
    const k = L.k ?? 1;
    const gr = lctx.createRadialGradient(lx, ly, lr * 0.15, lx, ly, lr);
    gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(0.55, `rgba(0,0,0,${0.75 * k})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = gr; lctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
  }
  lctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(layer, 0, 0, W, H, x0, y0, W / SCALE, H / SCALE);
  void t;
}

// Soft coloured halos over glowing things (additive), drawn after the
// darkness so mushrooms, jellies and lava actually shine.
export function drawGlows(ctx, glows, visible, t, strength = 1) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const gl of glows) {
    if (gl.x < visible.left - gl.r || gl.x > visible.right + gl.r || gl.y < visible.top - gl.r || gl.y > visible.bottom + gl.r) continue;
    const [r, g, b] = gl.rgb;
    const pulse = 0.75 + 0.25 * Math.sin(t * 1.6 + (gl.phase || 0));
    const gr = ctx.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, gl.r);
    gr.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.35 * pulse * strength})`); gr.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = gr; ctx.fillRect(gl.x - gl.r, gl.y - gl.r, gl.r * 2, gl.r * 2);
  }
  ctx.restore();
}

// Eyes in the dark: a pair of glints for every hunter just past your light,
// so you know something is out there and which way it's facing.
export function drawEyes(ctx, enemies, boat, light, colorOf, t) {
  if (light == null) return;
  for (const e of enemies) {
    if (e.health <= 0 || e.invulnerable) continue;
    const d = Math.hypot(e.x - boat.x, e.y - boat.y);
    if (d < light * 0.7 || d > light * 2.6) continue;
    const blink = Math.sin(t * 1.3 + e.id * 2.1) > 0.94 ? 0.1 : 1;
    const a = Math.min(1, (d - light * 0.7) / (light * 0.3)) * blink * (e.aggro ? 1 : 0.55);
    const h = e.heading || 0; const nx = -Math.sin(h); const ny = Math.cos(h);
    const fx = e.x + Math.cos(h) * e.radius * 0.6; const fy = e.y + Math.sin(h) * e.radius * 0.6;
    ctx.fillStyle = colorOf(e); ctx.globalAlpha = a;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(fx + nx * s * e.radius * 0.3, fy + ny * s * e.radius * 0.3, 1.6, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

// Screen-space atmosphere: a colour tint, drifting embers (volcano), spores
// (caverns, abyss), fireflies (bayou), blowing sand (dunes), glints (crystal).
export function drawAmbientScreen(ctx, biome, t, W, H) {
  const a = biome?.ambient; if (!a) return;
  if (a.tint) { const [r, g, b] = a.tint; ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a.tintAlpha || 0.06})`; ctx.fillRect(0, 0, W, H); }
  const motes = (rgb, n, fn) => {
    const [r, g, b] = rgb;
    for (let i = 0; i < n; i++) { const p = fn(i); ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill(); }
  };
  if (a.embers) motes(a.embers, 34, (i) => { const sp = 20 + hash(i, 2) * 30; const y = H - ((hash(i, 3) * H + t * sp) % (H + 20)) + 10; return { x: (hash(i, 4) * W + Math.sin(t * 0.8 + i) * 14 + W) % W, y, s: 1 + hash(i, 5) * 1.6, a: 0.35 + 0.45 * Math.abs(Math.sin(t * 3 + i)) }; });
  if (a.spores) motes(a.spores, 26, (i) => ({ x: (hash(i, 6) * W + Math.sin(t * 0.3 + i) * 30 + W) % W, y: (hash(i, 7) * H + Math.cos(t * 0.25 + i * 1.7) * 24 + H) % H, s: 0.8 + hash(i, 8) * 1.4, a: 0.25 + 0.35 * Math.abs(Math.sin(t * 0.9 + i)) }));
  if (a.fireflies) motes(a.fireflies, 18, (i) => ({ x: (hash(i, 9) * W + Math.sin(t * 0.5 + i * 3) * 40 + W) % W, y: (hash(i, 10) * H + Math.cos(t * 0.45 + i) * 30 + H) % H, s: 1.4, a: Math.max(0, Math.sin(t * 1.7 + i * 2.3)) * 0.8 }));
  if (a.sand) motes(a.sand, 40, (i) => { const sp = 60 + hash(i, 11) * 80; return { x: (hash(i, 12) * W + t * sp) % W, y: (hash(i, 13) * H + Math.sin(t + i) * 6 + H) % H, s: 0.8 + hash(i, 14), a: 0.25 }; });
  if (a.glints) motes(a.glints, 16, (i) => ({ x: hash(i, 15) * W, y: hash(i, 16) * H, s: 1.2 + hash(i, 17), a: Math.max(0, Math.sin(t * 2.2 + i * 4.1)) ** 6 * 0.9 }));
}

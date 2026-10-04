// The player's ships, painted in code (2026-10-04 art pass, project owner:
// "make the player boat options graphically more enhanced and
// artistically WOW"). Replaces the flat sketches in boatSprites.mjs.
//
// One painter, seven designs. Everything is drawn in the boat's local
// frame (bow toward +x), but lit from the world's top-left: the caller
// passes the heading and the light is turned into the boat's frame, so
// the lit side of the hull and sails stays put as the ship turns. Layers,
// bottom to top: foam and bow wave, oars/paddles, hull (strakes, wale,
// gilt rail, gunports and cannons), deck (planks, hatches, castles),
// sail shadows, masts and rigging, sails (seams, reef bands, emblems),
// flags, lanterns.

const TAU = Math.PI * 2;
// The livery being painted (set by drawShipArt): { sail, trim, flag } or null.
let LIV = null;
const LIGHT = { x: -0.6, y: -0.8 }; // toward the light, world space

// ---------------------------------------------------------------------------
// Shapes

// The hull outline: a fine bow, full shoulders, a transom stern.
function hullPath(ctx, L, B, stern = 0.85, ox = 0, oy = 0, bowSharp = 1) {
  ctx.beginPath();
  ctx.moveTo(ox + L, oy);
  ctx.bezierCurveTo(ox + L * (0.62 - 0.1 * bowSharp), oy - B * 1.06, ox - L * 0.25, oy - B * 1.04, ox - L * stern, oy - B * 0.78);
  ctx.quadraticCurveTo(ox - L * (stern + 0.12), oy, ox - L * stern, oy + B * 0.78);
  ctx.bezierCurveTo(ox - L * 0.25, oy + B * 1.04, ox + L * (0.62 - 0.1 * bowSharp), oy + B * 1.06, ox + L, oy);
  ctx.closePath();
}

// Half-beam of the hull at x (an approximation of hullPath, for fittings).
function beamAt(L, B, stern, x) {
  if (x >= L) return 0;
  if (x > 0.2 * L) { const u = (x - 0.2 * L) / (0.8 * L); return B * Math.sqrt(Math.max(0, 1 - u * u)) * 0.98; }
  const u = (0.2 * L - x) / (L * (stern + 0.2));
  return B * (1 - 0.22 * u * u) * 0.98;
}

function lightIn(heading) {
  const c = Math.cos(-heading); const s = Math.sin(-heading);
  return { x: c * LIGHT.x - s * LIGHT.y, y: s * LIGHT.x + c * LIGHT.y };
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

// ---------------------------------------------------------------------------
// Hull

function drawFoam(ctx, H, env, t) {
  const sp = Math.min(1, env.speed / 120);
  // A ring of foam where the hull meets the water, brighter under way.
  ctx.save();
  ctx.strokeStyle = `rgba(235, 250, 255, ${0.1 + sp * 0.3})`;
  ctx.lineWidth = 0.9 + sp * 1.1;
  hullPath(ctx, H.L * 1.05, H.B * 1.12, H.stern, 0, 0, H.bowSharp); ctx.stroke();
  if (sp > 0.08) {
    // Bow wave: two curling crests peeling off the stem.
    const w = Math.sin(t * 10) * 0.6;
    ctx.lineWidth = 1.3;
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const o = k * 4;
        ctx.strokeStyle = `rgba(255, 255, 255, ${(0.75 - k * 0.3) * sp})`;
        ctx.beginPath();
        ctx.moveTo(H.L * 1.02 - o * 0.4, 0);
        ctx.quadraticCurveTo(H.L * 0.65 - o, side * (H.B * 1.25 + o + w), H.L * 0.15 - o * 1.5, side * (H.B * 1.55 + o * 1.4 + w));
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawHull(ctx, H, env) {
  const { L, B, stern } = H;
  const lx = env.lx; const ly = env.ly;
  // Side shading across the beam, lit side from the world light.
  const g = ctx.createLinearGradient(lx * B * 1.2, ly * B * 1.2, -lx * B * 1.2, -ly * B * 1.2);
  g.addColorStop(0, shade(H.wood, 0.28));
  g.addColorStop(0.45, H.wood);
  g.addColorStop(1, shade(H.wood, -0.45));
  ctx.fillStyle = g;
  hullPath(ctx, L, B, stern, 0, 0, H.bowSharp); ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = H.outline || '#2a1709'; ctx.stroke();
  // Strakes: inset outlines, the planking of the topsides.
  ctx.save();
  hullPath(ctx, L, B, stern, 0, 0, H.bowSharp); ctx.clip();
  ctx.lineWidth = 0.55;
  for (const k of [0.94, 0.88]) {
    ctx.strokeStyle = 'rgba(30, 16, 6, .45)';
    hullPath(ctx, L * k, B * k, stern, -L * (1 - k) * 0.25, 0, H.bowSharp); ctx.stroke();
  }
  // The wale: a dark band (painted for the fancy ships).
  ctx.lineWidth = B * 0.12;
  ctx.strokeStyle = H.wale || 'rgba(20, 12, 6, .7)';
  hullPath(ctx, L * 0.9, B * 0.91, stern, -L * 0.03, 0, H.bowSharp); ctx.stroke();
  ctx.restore();
  // Gilt / pale rail on the gunwale, catching the light.
  ctx.lineWidth = 1;
  const rg = ctx.createLinearGradient(lx * B, ly * B, -lx * B, -ly * B);
  rg.addColorStop(0, H.rail ? shade(H.rail, 0.35) : 'rgba(255, 236, 190, .9)');
  rg.addColorStop(1, H.rail ? shade(H.rail, -0.35) : 'rgba(120, 80, 40, .9)');
  ctx.strokeStyle = rg;
  hullPath(ctx, L * 0.84, B * 0.8, stern, -L * 0.04, 0, H.bowSharp); ctx.stroke();
}

function drawDeck(ctx, H, env) {
  const { L, B, stern } = H;
  const dg = ctx.createLinearGradient(env.lx * B, env.ly * B, -env.lx * B, -env.ly * B);
  dg.addColorStop(0, shade(H.deck, 0.18)); dg.addColorStop(1, shade(H.deck, -0.12));
  ctx.fillStyle = dg;
  hullPath(ctx, L * 0.82, B * 0.76, stern, -L * 0.05, 0, H.bowSharp); ctx.fill();
  ctx.save();
  hullPath(ctx, L * 0.82, B * 0.76, stern, -L * 0.05, 0, H.bowSharp); ctx.clip();
  // Deck planks with staggered butt joints.
  ctx.strokeStyle = 'rgba(90, 55, 22, .38)'; ctx.lineWidth = 0.45;
  const n = Math.max(4, Math.round(B * 0.9));
  for (let i = -n; i <= n; i++) {
    const y = (i / n) * B * 0.78;
    ctx.beginPath(); ctx.moveTo(-L, y); ctx.lineTo(L, y); ctx.stroke();
    for (let x = -L + ((i & 1) ? 3 : 0); x < L; x += 7) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + (B * 0.78) / n); ctx.stroke(); }
  }
  // Inner shadow under the bulwarks.
  ctx.lineWidth = B * 0.18;
  ctx.strokeStyle = 'rgba(40, 22, 8, .28)';
  hullPath(ctx, L * 0.82, B * 0.76, stern, -L * 0.05, 0, H.bowSharp); ctx.stroke();
  ctx.restore();
}

function hatch(ctx, x, y, w, h) {
  ctx.fillStyle = '#4a2e14'; ctx.fillRect(x - w / 2 - 0.6, y - h / 2 - 0.6, w + 1.2, h + 1.2);
  ctx.fillStyle = '#2a190a'; ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = 'rgba(160, 110, 60, .8)'; ctx.lineWidth = 0.4;
  for (let gx = x - w / 2 + 1; gx < x + w / 2; gx += 1.3) { ctx.beginPath(); ctx.moveTo(gx, y - h / 2); ctx.lineTo(gx, y + h / 2); ctx.stroke(); }
  for (let gy = y - h / 2 + 1; gy < y + h / 2; gy += 1.3) { ctx.beginPath(); ctx.moveTo(x - w / 2, gy); ctx.lineTo(x + w / 2, gy); ctx.stroke(); }
}

// Cannons run out through the ports, lit along the barrel.
function drawGuns(ctx, H, n, from, to, env, size = 1) {
  for (let i = 0; i < n; i++) {
    const x = -H.L * from + (i + 0.5) * ((H.L * (from + to)) / n);
    const yb = beamAt(H.L, H.B, H.stern, x);
    for (const side of [-1, 1]) {
      const y = side * yb;
      ctx.fillStyle = '#120a05';
      ctx.fillRect(x - 1.5 * size, y - side * 1.4 * size - 1.1 * size, 3 * size, 2.2 * size); // port
      ctx.fillStyle = '#b8392b';
      ctx.fillRect(x - 1.7 * size, y - side * 0.2 * size - (side > 0 ? 0 : 0.7 * size), 3.4 * size, 0.7 * size); // red lid
      const lit = side * env.ly < 0 ? '#8a8f96' : '#555a60';
      ctx.fillStyle = '#26292d';
      ctx.fillRect(x - 0.85 * size, y, 1.7 * size, side * 3 * size);
      ctx.fillStyle = lit;
      ctx.fillRect(x - 0.85 * size, y, 0.55 * size, side * 2.8 * size);
    }
  }
}

function sternWindows(ctx, H, t, rows = 1) {
  const x = -H.L * (H.stern + 0.1);
  for (let r = 0; r < rows; r++) {
    for (let k = -2; k <= 2; k++) {
      const y = k * H.B * 0.22;
      const fl = 0.75 + 0.25 * Math.sin(t * 5 + k * 1.7);
      ctx.fillStyle = `rgba(255, ${190 + 40 * fl}, 110, ${fl})`;
      ctx.fillRect(x - 0.6 - r * 1.8, y - 0.9, 1.4, 1.8);
    }
  }
}

function lantern(ctx, x, y, t, r = 7) {
  r *= 0.7;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const fl = 0.8 + 0.2 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * fl);
  g.addColorStop(0, 'rgba(255, 210, 120, .75)');
  g.addColorStop(0.4, 'rgba(255, 150, 60, .25)');
  g.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * fl, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffe6a0'; ctx.beginPath(); ctx.arc(x, y, 1.1, 0, TAU); ctx.fill();
}

// A raised castle (poop or forecastle): its own deck, a gilt edge, and a
// shadow on the main deck below it.
function castle(ctx, H, x0, x1, inset, env, tone) {
  const { L, B, stern } = H;
  ctx.save();
  hullPath(ctx, L * 0.82, B * 0.76, stern, -L * 0.05, 0, H.bowSharp); ctx.clip();
  const w = x1 - x0;
  ctx.fillStyle = 'rgba(20, 10, 4, .35)';
  ctx.fillRect(x0 - env.lx * 2.5, -B + inset - env.ly * 2.5, w, (B - inset) * 2);
  const g = ctx.createLinearGradient(env.lx * B, env.ly * B, -env.lx * B, -env.ly * B);
  g.addColorStop(0, shade(tone, 0.2)); g.addColorStop(1, shade(tone, -0.2));
  ctx.fillStyle = g;
  ctx.fillRect(x0, -B + inset, w, (B - inset) * 2);
  ctx.strokeStyle = 'rgba(70, 40, 16, .5)'; ctx.lineWidth = 0.4;
  for (let y = -B + inset + 1.5; y < B - inset; y += 1.6) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = H.rail || '#e8b54b'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(x1, -B * 0.82); ctx.lineTo(x1, B * 0.82); ctx.stroke();
}

// ---------------------------------------------------------------------------
// Rig

function mastTop(ctx, x, r = 1.8, nest = false) {
  if (nest) {
    ctx.fillStyle = '#3a2410'; ctx.beginPath(); ctx.arc(x, 0, r * 1.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 0.7; ctx.stroke();
  }
  const g = ctx.createRadialGradient(x - r * 0.4, -r * 0.4, 0, x, 0, r);
  g.addColorStop(0, '#b07a42'); g.addColorStop(1, '#3a2210');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, 0, r, 0, TAU); ctx.fill();
}

function shrouds(ctx, H, x, spread = 0.35) {
  ctx.strokeStyle = 'rgba(30, 18, 8, .55)'; ctx.lineWidth = 0.45;
  for (const side of [-1, 1]) {
    for (let k = -1; k <= 1; k++) {
      const hx = x + k * H.L * spread * 0.25 - H.L * 0.05;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(hx, side * beamAt(H.L, H.B, H.stern, hx) * 0.95); ctx.stroke();
    }
  }
}

function stay(ctx, x0, x1) {
  ctx.strokeStyle = 'rgba(30, 18, 8, .5)'; ctx.lineWidth = 0.45;
  ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke();
}

// A square sail seen from above: the yard across the beam, the cloth
// bellying forward. `cloth` = [base colour, stripe or null].
function squareSail(ctx, x, span, depth, t, env, cloth, { emblem = null, phase = 0, shadow = true } = {}) {
  const b = depth * (1 + Math.sin(t * 2.6 + phase) * 0.06);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x, -span);
    ctx.bezierCurveTo(x + b * 0.9, -span * 0.8, x + b * 1.15, -span * 0.25, x + b * 1.15, 0);
    ctx.bezierCurveTo(x + b * 1.15, span * 0.25, x + b * 0.9, span * 0.8, x, span);
    ctx.quadraticCurveTo(x + b * 0.25, 0, x, -span);
    ctx.closePath();
  };
  if (shadow) {
    ctx.save(); ctx.translate(-env.lx * 5, -env.ly * 5);
    ctx.fillStyle = 'rgba(20, 14, 8, .28)'; path(); ctx.fill();
    ctx.restore();
  }
  const base = LIV?.sail || cloth[0];
  if (LIV && cloth[1]) cloth = [base, LIV.trim];
  // Lit along the belly toward the light, shadowed in the hollow.
  const g = ctx.createLinearGradient(x + env.lx * span, env.ly * span, x - env.lx * span, -env.ly * span);
  g.addColorStop(0, shade(base, 0.35)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, -0.3));
  ctx.fillStyle = g; path(); ctx.fill();
  ctx.save(); path(); ctx.clip();
  // Belly highlight.
  const hg = ctx.createRadialGradient(x + b * 0.9 + env.lx * 2, env.ly * span * 0.35, 0, x + b * 0.8, 0, span * 0.9);
  hg.addColorStop(0, 'rgba(255, 255, 255, .35)'); hg.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = hg; ctx.fillRect(x - 2, -span, b * 1.3 + 4, span * 2);
  // Stripes.
  if (cloth[1]) {
    ctx.fillStyle = cloth[1];
    for (let k = -2; k <= 2; k += 2) ctx.fillRect(x - 1, (k / 5) * span - span * 0.1, b * 1.3, span * 0.2);
  }
  // Seams (vertical cloths) and a reef band.
  ctx.strokeStyle = 'rgba(80, 60, 40, .3)'; ctx.lineWidth = 0.45;
  for (let k = -4; k <= 4; k++) {
    const y = (k / 4.6) * span;
    const u = y / span;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + b * 1.15 * (1 - u * u * 0.85), y * 0.97); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(80, 60, 40, .35)'; ctx.setLineDash([0.8, 1.4]);
  ctx.beginPath(); ctx.moveTo(x + b * 0.18, -span * 0.95); ctx.quadraticCurveTo(x + b * 0.65, 0, x + b * 0.18, span * 0.95); ctx.stroke();
  ctx.setLineDash([]);
  if (emblem) emblem(ctx, x + b * 0.7, 0, span);
  ctx.restore();
  // Bolt-rope rim on the lit edge.
  ctx.strokeStyle = 'rgba(255, 250, 235, .6)'; ctx.lineWidth = 0.6;
  path(); ctx.stroke();
  // The yard, with tips beyond the cloth.
  ctx.strokeStyle = '#5a3818'; ctx.lineWidth = 1.05; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, -span * 1.08); ctx.lineTo(x, span * 1.08); ctx.stroke();
  ctx.strokeStyle = 'rgba(200, 150, 90, .6)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(x - 0.4, -span * 1.04); ctx.lineTo(x - 0.4, span * 1.04); ctx.stroke();
  ctx.lineCap = 'butt';
}

// A fore-and-aft sail (gaff, lateen, catamaran main): from the mast aft
// along a boom swung out to `side`, bellied to leeward.
function foreAftSail(ctx, mx, len, swing, belly, t, env, cloth, { peak = 0, phase = 0, battens = 0 } = {}) {
  if (LIV) cloth = [LIV.sail, cloth[1] ? LIV.trim : null];
  const wob = Math.sin(t * 2.4 + phase) * 0.08;
  const ex = mx - len; const ey = swing;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(mx + peak, 0);
    ctx.quadraticCurveTo((mx + ex) / 2 + swing * 0.15, ey / 2 + belly * (1 + wob), ex, ey);
    ctx.quadraticCurveTo((mx + ex) / 2, ey * 0.4, mx + peak, 0);
    ctx.closePath();
  };
  ctx.save(); ctx.translate(-env.lx * 5, -env.ly * 5);
  ctx.fillStyle = 'rgba(20, 14, 8, .26)'; path(); ctx.fill();
  ctx.restore();
  const g = ctx.createLinearGradient(mx + env.lx * len * 0.3, env.ly * len * 0.3, mx - env.lx * len * 0.3, -env.ly * len * 0.3);
  g.addColorStop(0, shade(cloth[0], 0.32)); g.addColorStop(1, shade(cloth[0], -0.28));
  ctx.fillStyle = g; path(); ctx.fill();
  ctx.save(); path(); ctx.clip();
  if (cloth[1]) {
    ctx.strokeStyle = cloth[1]; ctx.lineWidth = Math.abs(belly) * 0.14;
    ctx.beginPath(); ctx.moveTo(mx, 0); ctx.quadraticCurveTo((mx + ex) / 2 + swing * 0.15, ey / 2 + belly * 0.7, ex, ey); ctx.stroke();
  }
  ctx.strokeStyle = battens ? 'rgba(60, 20, 10, .6)' : 'rgba(80, 60, 40, .3)'; ctx.lineWidth = battens ? 0.8 : 0.45;
  const n = battens || 5;
  for (let k = 1; k < n; k++) {
    const u = k / n;
    const bx = mx + (ex - mx) * u; const by = ey * u;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + belly * 0.2, by + belly * (1 - Math.abs(2 * u - 1)) * 0.9); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 250, 235, .55)'; ctx.lineWidth = 0.6; path(); ctx.stroke();
  // Boom.
  ctx.strokeStyle = '#4a2c12'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.lineCap = 'butt';
}

function jib(ctx, mx, tip, belly, t, env, color = '#f3ead6') {
  if (LIV) color = LIV.sail;
  const w = Math.sin(t * 3.1) * 0.5;
  ctx.fillStyle = 'rgba(20, 14, 8, .22)';
  ctx.beginPath(); ctx.moveTo(tip - env.lx * 3, -env.ly * 3); ctx.quadraticCurveTo((mx + tip) / 2 - env.lx * 3, belly + w - env.ly * 3, mx - env.lx * 3, belly * 0.4 - env.ly * 3); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(mx, -belly, mx, belly);
  g.addColorStop(0, shade(color, env.ly < 0 ? 0.25 : -0.15)); g.addColorStop(1, shade(color, env.ly < 0 ? -0.15 : 0.25));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(tip, 0); ctx.quadraticCurveTo((mx + tip) / 2, belly + w, mx, belly * 0.4); ctx.lineTo(mx, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(80, 60, 40, .5)'; ctx.lineWidth = 0.5; ctx.stroke();
}

function bowsprit(ctx, H, len) {
  ctx.strokeStyle = '#4a2c12'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(H.L * 0.75, 0); ctx.lineTo(H.L + len, 0); ctx.stroke();
  ctx.lineCap = 'butt';
}

function figurehead(ctx, H, color = '#e8b54b') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(H.L + 2.6, 0); ctx.quadraticCurveTo(H.L + 1, -1.8, H.L - 1.2, -1.2); ctx.lineTo(H.L - 1.2, 1.2); ctx.quadraticCurveTo(H.L + 1, 1.8, H.L + 2.6, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, .6)'; ctx.fillRect(H.L, -0.8, 1.2, 0.5);
}

// A long streaming pennant from a masthead (`len` px), rippling.
function pennant(ctx, x, t, color, len = 10, w = 1.6, swallow = false) {
  len *= 0.7; w *= 0.55;
  ctx.save();
  ctx.fillStyle = LIV?.flag || color;
  ctx.beginPath();
  ctx.moveTo(x, -w);
  const segs = 6;
  for (let i = 1; i <= segs; i++) {
    const u = i / segs;
    ctx.lineTo(x - len * u, Math.sin(t * 9 - u * 5) * 1.6 * u - w * (1 - u));
  }
  if (swallow) ctx.lineTo(x - len * 0.82, Math.sin(t * 9 - 4.1) * 1.3);
  for (let i = segs; i >= 0; i--) {
    const u = i / segs;
    ctx.lineTo(x - len * u, Math.sin(t * 9 - u * 5) * 1.6 * u + w * (1 - u));
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// Emblems painted on a mainsail.
const cross = (color) => (ctx, x, y, span) => {
  ctx.fillStyle = color;
  ctx.fillRect(x - 1, y - span * 0.5, 2.2, span);
  ctx.fillRect(x - 3, y - 1.1, 6, 2.2);
};
const skull = (ctx, x, y, span) => {
  const s = span * 0.22;
  ctx.fillStyle = 'rgba(20, 16, 14, .85)';
  ctx.beginPath(); ctx.arc(x, y - s * 0.2, s, 0, TAU); ctx.fill();
  ctx.fillRect(x - s * 0.5, y + s * 0.5, s, s * 0.6);
  ctx.strokeStyle = 'rgba(20, 16, 14, .85)'; ctx.lineWidth = s * 0.45;
  ctx.beginPath(); ctx.moveTo(x - s * 1.6, y - s * 1.3); ctx.lineTo(x + s * 1.6, y + s * 1.6); ctx.moveTo(x + s * 1.6, y - s * 1.3); ctx.lineTo(x - s * 1.6, y + s * 1.6); ctx.stroke();
  ctx.fillStyle = '#f4ead0';
  ctx.beginPath(); ctx.arc(x - s * 0.38, y - s * 0.25, s * 0.28, 0, TAU); ctx.arc(x + s * 0.38, y - s * 0.25, s * 0.28, 0, TAU); ctx.fill();
};
const sun = (ctx, x, y, span) => {
  const s = span * 0.3;
  ctx.fillStyle = 'rgba(232, 181, 75, .9)';
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * s * 0.4, y + Math.sin(a) * s * 0.4); ctx.lineTo(x + Math.cos(a + 0.2) * s, y + Math.sin(a + 0.2) * s); ctx.lineTo(x + Math.cos(a - 0.2) * s, y + Math.sin(a - 0.2) * s); ctx.fill(); }
  ctx.beginPath(); ctx.arc(x, y, s * 0.42, 0, TAU); ctx.fill();
};

// ---------------------------------------------------------------------------
// The seven ships. Each takes (ctx, r, t, env); r is the collision radius.

function sloop(ctx, r, t, env) {
  const H = { L: r * 1.5, B: r * 0.66, stern: 0.82, wood: '#9a5e2c', deck: '#d8aa68', rail: '#e8c27a', bowSharp: 1.2 };
  drawFoam(ctx, H, env, t);
  drawHull(ctx, H, env);
  drawDeck(ctx, H, env);
  drawGuns(ctx, H, 2, 0.45, 0.15, env, 0.85);
  hatch(ctx, -H.L * 0.45, 0, 4, 3.2);
  castle(ctx, H, -H.L * 0.92, -H.L * 0.62, H.B * 0.28, env, '#b98448');
  sternWindows(ctx, H, t);
  bowsprit(ctx, H, r * 0.75);
  figurehead(ctx, H);
  const mx = H.L * 0.18;
  shrouds(ctx, H, mx, 0.3);
  stay(ctx, mx, H.L + r * 0.75);
  jib(ctx, mx, H.L + r * 0.72, H.B * 0.95, t, env);
  foreAftSail(ctx, mx, H.L * 1.25, H.B * 0.55, H.B * 1.55, t, env, ['#f6efdd', null]);
  // A red reef band near the boom.
  ctx.strokeStyle = 'rgba(200, 64, 46, .85)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(mx - H.L * 0.2, H.B * 0.2); ctx.quadraticCurveTo(mx - H.L * 0.65, H.B * 1.35, mx - H.L * 1.1, H.B * 0.55); ctx.stroke();
  mastTop(ctx, mx, 1.5, true);
  pennant(ctx, mx, t, '#c8402e', 11, 1.5, true);
  lantern(ctx, -H.L * 0.95, 0, t, 6);
}

function skiff(ctx, r, t, env) {
  const H = { L: r * 1.45, B: r * 0.5, stern: 0.78, wood: '#c08548', deck: '#e2bd84', rail: '#f2dca8', bowSharp: 1.6 };
  drawFoam(ctx, H, env, t);
  // Outrigger float on a pair of booms.
  ctx.strokeStyle = '#5a3616'; ctx.lineWidth = 1.1;
  for (const x of [H.L * 0.25, -H.L * 0.35]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 1, H.B * 2.2); ctx.stroke(); }
  ctx.fillStyle = '#7a4a20';
  ctx.beginPath(); ctx.ellipse(-H.L * 0.05, H.B * 2.25, H.L * 0.55, 1.8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255, 230, 180, .5)'; ctx.fillRect(-H.L * 0.5, H.B * 2.25 - 1.4, H.L * 0.8, 0.6);
  drawHull(ctx, H, env);
  drawDeck(ctx, H, env);
  // Coiled rope and a sea chest.
  ctx.strokeStyle = '#c9a26a'; ctx.lineWidth = 0.6;
  for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.arc(-H.L * 0.55, 0, k * 0.7, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#5a3418'; ctx.fillRect(H.L * 0.3, -1.6, 3, 3.2);
  ctx.fillStyle = '#e8b54b'; ctx.fillRect(H.L * 0.3 + 1.2, -1.6, 0.6, 3.2);
  const mx = H.L * 0.42;
  // A big lateen: the long yard angled aft, sea-blue stripes.
  foreAftSail(ctx, mx + r * 0.35, H.L * 1.6, -H.B * 1.2, -H.B * 2.1, t, env, ['#f5efdf', '#2f7fb8'], { peak: 0 });
  mastTop(ctx, mx, 1.5);
  pennant(ctx, mx, t, '#2f7fb8', 9, 1.2);
}

function longboat(ctx, r, t, env) {
  const H = { L: r * 1.75, B: r * 0.55, stern: 0.95, wood: '#8a5424', deck: '#c69456', rail: '#d9b679', bowSharp: 1.4 };
  drawFoam(ctx, H, env, t);
  // Oars sweeping in time, blades dipping.
  const stroke = t * 5;
  for (let i = 0; i < 5; i++) {
    const x = -H.L * 0.55 + i * H.L * 0.24;
    const sw = Math.sin(stroke - i * 0.25) * 0.42;
    const dip = Math.cos(stroke - i * 0.25);
    for (const side of [-1, 1]) {
      const y0 = side * beamAt(H.L, H.B, H.stern, x) * 0.85;
      const ex = x - Math.sin(sw) * r * 0.7; const ey = side * (H.B + r * 0.95);
      ctx.strokeStyle = '#6b4523'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = dip > 0 ? '#5a3a1c' : '#7a5a34';
      ctx.beginPath(); ctx.ellipse(ex, ey, 1.6, 0.9, Math.atan2(ey - y0, ex - x), 0, TAU); ctx.fill();
      if (dip > 0.6) { ctx.fillStyle = 'rgba(240, 252, 255, .5)'; ctx.beginPath(); ctx.arc(ex, ey + side * 1.2, 1.4, 0, TAU); ctx.fill(); }
    }
  }
  drawHull(ctx, H, env);
  drawDeck(ctx, H, env);
  // Round shields on the gunwale, painted halves.
  for (let i = 0; i < 6; i++) {
    const x = -H.L * 0.62 + i * H.L * 0.24;
    for (const side of [-1, 1]) {
      const y = side * beamAt(H.L, H.B, H.stern, x) * 0.86;
      const c1 = (i + (side > 0)) % 2 ? '#c8402e' : '#eadcbc'; const c2 = (i + (side > 0)) % 2 ? '#eadcbc' : '#2a4f7a';
      ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(x, y, 2.1, 0, Math.PI); ctx.fill();
      ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(x, y, 2.1, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#c9ccd0'; ctx.beginPath(); ctx.arc(x, y, 0.7, 0, TAU); ctx.fill();
    }
  }
  // Dragon prow and curled tail.
  ctx.fillStyle = '#5e3515'; ctx.strokeStyle = '#e8b54b'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(H.L - 1, -1.4); ctx.quadraticCurveTo(H.L + 4, -3.5, H.L + 6, -1); ctx.lineTo(H.L + 4, 0); ctx.lineTo(H.L + 6, 1); ctx.quadraticCurveTo(H.L + 4, 3.5, H.L - 1, 1.4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.arc(H.L + 3.3, -1.5, 0.6, 0, TAU); ctx.arc(H.L + 3.3, 1.5, 0.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#5e3515'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(-H.L * 1.02, 0, 2.2, -1.2, 2.6); ctx.stroke();
  const mx = -H.L * 0.02;
  shrouds(ctx, H, mx, 0.25);
  squareSail(ctx, mx, H.B * 1.75, r * 0.5, t, env, ['#efe0c0', '#b8392b']);
  mastTop(ctx, mx, 1.7);
  pennant(ctx, mx, t, '#b8392b', 12, 1.8, true);
}

function catamaran(ctx, r, t, env) {
  const off = r * 0.66;
  const H = { L: r * 1.55, B: r * 0.28, stern: 0.8, wood: '#e7e0cf', deck: '#f2ead8', rail: '#38b6a8', bowSharp: 1.8, outline: '#4a4436' };
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(0, side * off);
    drawFoam(ctx, H, env, t);
    ctx.restore();
  }
  // Cross beams and the trampoline.
  ctx.fillStyle = 'rgba(28, 46, 54, .6)';
  ctx.fillRect(-H.L * 0.4, -off + 1, H.L * 0.9, off * 2 - 2);
  ctx.strokeStyle = 'rgba(230, 236, 225, .45)'; ctx.lineWidth = 0.4;
  for (let x = -H.L * 0.4; x <= H.L * 0.5; x += 2.2) { ctx.beginPath(); ctx.moveTo(x, -off + 1); ctx.lineTo(x, off - 1); ctx.stroke(); }
  for (let y = -off + 2; y < off - 1; y += 2.2) { ctx.beginPath(); ctx.moveTo(-H.L * 0.4, y); ctx.lineTo(H.L * 0.5, y); ctx.stroke(); }
  for (const x of [H.L * 0.5, -H.L * 0.42]) {
    ctx.fillStyle = '#8a6a44'; ctx.fillRect(x - 1.3, -off, 2.6, off * 2);
    ctx.fillStyle = 'rgba(255, 230, 190, .5)'; ctx.fillRect(x - 1.3, -off, 0.7, off * 2);
  }
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(0, side * off);
    drawHull(ctx, H, env);
    ctx.fillStyle = shade('#f2ead8', -0.05);
    hullPath(ctx, H.L * 0.8, H.B * 0.55, H.stern, -H.L * 0.05, 0, H.bowSharp); ctx.fill();
    ctx.fillStyle = '#38b6a8'; ctx.fillRect(-H.L * 0.6, -0.4, H.L * 1.1, 0.8);
    ctx.restore();
  }
  const mx = H.L * 0.12;
  stay(ctx, mx, H.L * 0.95);
  jib(ctx, mx, H.L * 0.98, -off * 0.8, t, env, '#e8f6f2');
  foreAftSail(ctx, mx, H.L * 1.3, off * 0.2, off * 1.5, t, env, ['#33b8a9', '#f4efe2'], { battens: 6 });
  mastTop(ctx, mx, 1.6);
  pennant(ctx, mx, t, '#ffcf4a', 10, 1.3);
}

function junk(ctx, r, t, env) {
  const H = { L: r * 1.55, B: r * 0.76, stern: 0.98, wood: '#8e3d1e', deck: '#c58a55', rail: '#e8b54b', bowSharp: 0.4, wale: '#e8b54b' };
  drawFoam(ctx, H, env, t);
  drawHull(ctx, H, env);
  drawDeck(ctx, H, env);
  // High stern deckhouse with a curved roof and lanterns.
  castle(ctx, H, -H.L * 1.02, -H.L * 0.5, H.B * 0.2, env, '#7a2f16');
  ctx.strokeStyle = 'rgba(232, 181, 75, .9)'; ctx.lineWidth = 0.6;
  for (let y = -H.B * 0.55; y <= H.B * 0.56; y += H.B * 0.22) { ctx.beginPath(); ctx.moveTo(-H.L * 0.98, y); ctx.lineTo(-H.L * 0.55, y); ctx.stroke(); }
  // Painted eyes on the bow.
  for (const side of [-1, 1]) {
    const x = H.L * 0.6; const y = side * beamAt(H.L, H.B, H.stern, x) * 0.92;
    ctx.fillStyle = '#f4efe2'; ctx.beginPath(); ctx.ellipse(x, y, 2.6, 1.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + 0.5, y, 1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c8402e'; ctx.beginPath(); ctx.ellipse(x - 1.6, y, 1, 1.5, 0, 0, TAU); ctx.fill();
  }
  drawGuns(ctx, H, 2, 0.3, 0.3, env, 0.8);
  // Battened sails, two-masted, deep red with gold battens.
  for (const [x, span, ph] of [[H.L * 0.35, H.B * 1.55, 0], [-H.L * 0.2, H.B * 1.75, 1.3]]) {
    shrouds(ctx, H, x, 0.2);
    squareSail(ctx, x, span, r * 0.4, t, env, ['#b8322a', null], { phase: ph, emblem: ph ? sun : null });
    ctx.strokeStyle = 'rgba(70, 14, 8, .8)'; ctx.lineWidth = 0.9;
    for (let k = -3; k <= 3; k++) { const y = (k / 3.6) * span; const u = y / span; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r * 0.4 * 1.12 * (1 - u * u * 0.85), y); ctx.stroke(); }
    mastTop(ctx, x, 1.7);
  }
  pennant(ctx, -H.L * 0.2, t, '#ffcf4a', 12, 1.8);
  lantern(ctx, -H.L * 1.05, -H.B * 0.5, t, 6); lantern(ctx, -H.L * 1.05, H.B * 0.5, t + 1, 6);
}

function steamer(ctx, r, t, env) {
  const H = { L: r * 1.6, B: r * 0.72, stern: 0.9, wood: '#5e6870', deck: '#b99a6a', rail: '#c9ced3', bowSharp: 1.3, outline: '#1d2125', wale: '#b8392b' };
  drawFoam(ctx, H, env, t);
  // Paddle boxes with turning paddles and a churn of white water.
  for (const side of [-1, 1]) {
    const y = side * H.B * 1.02;
    for (let k = 0; k < 4; k++) { const ph = (t * 2 + k / 4) % 1; ctx.fillStyle = `rgba(240, 250, 255, ${0.4 * (1 - ph)})`; ctx.beginPath(); ctx.arc(-r * 0.45 - ph * r * 1.1, y + side * 1.5, 0.8 + ph * 1.4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#2b3035';
    ctx.beginPath(); ctx.ellipse(0, y, r * 0.48, 3.2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#9aa2aa'; ctx.lineWidth = 0.9;
    for (let k = 0; k < 6; k++) {
      const a = t * 6 + (k / 6) * TAU; const px = Math.cos(a) * r * 0.42;
      if (Math.sin(a) < 0) continue;
      ctx.beginPath(); ctx.moveTo(px, y - 2.6); ctx.lineTo(px, y + 2.6); ctx.stroke();
    }
    ctx.fillStyle = '#b8392b'; ctx.beginPath(); ctx.ellipse(0, y - side * 1.6, r * 0.5, 1.2, 0, 0, TAU); ctx.fill();
  }
  drawHull(ctx, H, env);
  // Rivet lines.
  ctx.fillStyle = 'rgba(20, 24, 28, .8)';
  for (let i = 0; i < 9; i++) {
    const x = -H.L * 0.8 + i * H.L * 0.2;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(x, side * beamAt(H.L, H.B, H.stern, x) * 0.9, 0.55, 0, TAU); ctx.fill(); }
  }
  drawDeck(ctx, H, env);
  // Deckhouse with portholes.
  castle(ctx, H, -H.L * 0.62, H.L * 0.12, H.B * 0.38, env, '#e6dccb');
  ctx.fillStyle = '#2a4f6a';
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(-H.L * 0.52 + i * H.L * 0.17, side * H.B * 0.5, 0.8, 0, TAU); ctx.fill(); }
  // Bridge at the front of the house.
  ctx.fillStyle = '#c9ced3'; ctx.fillRect(H.L * 0.12, -H.B * 0.7, 2, H.B * 1.4);
  // The funnel: red with a black top, venting smoke that drifts aft.
  const fx = -H.L * 0.2;
  for (let k = 0; k < 6; k++) {
    const ph = (t * 0.7 + k / 6) % 1;
    ctx.fillStyle = `rgba(52, 52, 58, ${0.42 * (1 - ph)})`;
    ctx.beginPath(); ctx.arc(fx - ph * r * 2.6 - env.lx * ph * 4, Math.sin(ph * 5 + k) * 2.5 - env.ly * ph * 4, r * (0.22 + ph * 0.5), 0, TAU); ctx.fill();
  }
  const fg = ctx.createRadialGradient(fx + env.lx * 2, env.ly * 2, 0, fx, 0, r * 0.36);
  fg.addColorStop(0, '#e2554a'); fg.addColorStop(1, '#7a1a14');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, 0, r * 0.36, 0, TAU); ctx.fill();
  ctx.fillStyle = '#16181b'; ctx.beginPath(); ctx.arc(fx, 0, r * 0.24, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255, 140, 60, .35)'; ctx.beginPath(); ctx.arc(fx, 0, r * 0.12, 0, TAU); ctx.fill();
  // Iron ram and a bow gun.
  ctx.fillStyle = '#2b3035';
  ctx.beginPath(); ctx.moveTo(H.L + 4, 0); ctx.lineTo(H.L - 2, -2.6); ctx.lineTo(H.L - 2, 2.6); ctx.fill();
  ctx.fillStyle = '#3a3f45'; ctx.beginPath(); ctx.arc(H.L * 0.55, 0, 2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7d858d'; ctx.fillRect(H.L * 0.55, -0.6, 4.5, 1.2);
  mastTop(ctx, H.L * 0.35, 1.2);
  pennant(ctx, H.L * 0.35, t, '#1f4e8c', 9, 1.3);
}

function galleon(ctx, r, t, env) {
  const H = { L: r * 1.8, B: r * 0.85, stern: 0.95, wood: '#6b3f1c', deck: '#c99a5c', rail: '#e8b54b', bowSharp: 0.9, wale: '#16222e' };
  drawFoam(ctx, H, env, t);
  drawHull(ctx, H, env);
  // Gilded carvings along the wale.
  ctx.save(); hullPath(ctx, H.L, H.B, H.stern, 0, 0, H.bowSharp); ctx.clip();
  ctx.strokeStyle = 'rgba(232, 181, 75, .75)'; ctx.lineWidth = 0.5; ctx.setLineDash([1.2, 1.6]);
  hullPath(ctx, H.L * 0.96, H.B * 0.97, H.stern, -H.L * 0.01, 0, H.bowSharp); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
  drawDeck(ctx, H, env);
  drawGuns(ctx, H, 6, 0.7, 0.45, env, 0.9);
  hatch(ctx, H.L * 0.2, 0, 4.5, 3.6); hatch(ctx, -H.L * 0.22, 0, 4.5, 3.6);
  castle(ctx, H, -H.L * 1.0, -H.L * 0.55, H.B * 0.2, env, '#8a5a2e');
  castle(ctx, H, -H.L * 1.0, -H.L * 0.78, H.B * 0.32, env, '#9a6a3a');
  castle(ctx, H, H.L * 0.5, H.L * 0.78, H.B * 0.32, env, '#8a5a2e');
  sternWindows(ctx, H, t, 2);
  bowsprit(ctx, H, r * 0.9);
  figurehead(ctx, H);
  const masts = [[H.L * 0.47, H.B * 1.4, r * 0.42, 0], [H.L * 0.02, H.B * 1.65, r * 0.52, 1], [-H.L * 0.45, H.B * 1.35, r * 0.4, 2]];
  for (const [x] of masts) shrouds(ctx, H, x, 0.22);
  stay(ctx, H.L * 0.45, H.L + r * 0.9);
  jib(ctx, H.L * 0.45, H.L + r * 0.85, H.B * 0.8, t, env);
  for (const [x, span, d, i] of masts) {
    squareSail(ctx, x, span, d, t, env, ['#f6efdc', null], { phase: i, emblem: i === 1 ? cross('#b8322a') : null });
    // A topsail riding forward of the course.
    squareSail(ctx, x + d * 0.55, span * 0.66, d * 0.55, t, env, ['#fbf6e8', null], { phase: i + 0.5, shadow: false });
    mastTop(ctx, x, 2, i === 1);
  }
  pennant(ctx, H.L * 0.0, t, '#b8322a', 15, 1.8, true);
  pennant(ctx, H.L * 0.45, t + 0.3, '#1f4e8c', 9, 1.2);
  pennant(ctx, -H.L * 1.02, t + 0.6, '#1f4e8c', 12, 2.2);
  lantern(ctx, -H.L * 1.08, -H.B * 0.55, t, 7); lantern(ctx, -H.L * 1.08, H.B * 0.55, t + 0.7, 7); lantern(ctx, -H.L * 1.12, 0, t + 1.3, 8);
}

export const SHIP_ART = { sloop, skiff, longboat, catamaran, junk, steamer, galleon };

// How big each ship is drawn, relative to the collision radius (bigger
// ships just look bigger; every hull collides the same).
export const SHIP_ART_SCALE = { sloop: 1, skiff: 0.95, longboat: 1.0, catamaran: 1.0, junk: 1.05, steamer: 1.05, galleon: 1.08 };

// Draws `style` at the origin facing +x. `heading` is the boat's world
// heading (for the light); `speed` drives the foam and bow wave.
export function drawShipArt(ctx, style, r, t, heading = 0, speed = 0, livery = null) {
  const fn = SHIP_ART[style] || sloop;
  const l = lightIn(heading);
  LIV = livery;
  try { fn(ctx, r, t, { lx: l.x, ly: l.y, speed }); } finally { LIV = null; }
}

export { skull };

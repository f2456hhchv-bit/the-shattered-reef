// The player's ship styles (2026-09-29): one code-drawn look per hull in
// data/meta.mjs. Drawn in the boat's local frame (bow toward +x) after the
// caller has translated/rotated. renderer.mjs's drawBoat keeps the Sloop;
// every other style is here, keyed by hull id.

function hullShape(ctx, L, B, ox = 0, bluntStern = 0.85) {
  ctx.beginPath();
  ctx.moveTo(ox + L, 0);
  ctx.bezierCurveTo(ox + L * 0.6, -B * 1.05, ox - L * 0.2, -B * 1.05, ox - L * bluntStern, -B * 0.8);
  ctx.quadraticCurveTo(ox - L * (bluntStern + 0.17), 0, ox - L * bluntStern, B * 0.8);
  ctx.bezierCurveTo(ox - L * 0.2, B * 1.05, ox + L * 0.6, B * 1.05, ox + L, 0);
  ctx.closePath();
}

function woodHull(ctx, L, B, tones = ['#b8783a', '#96592a', '#6d3d1b'], stern = 0.85) {
  const g = ctx.createLinearGradient(0, -B, 0, B);
  g.addColorStop(0, tones[0]); g.addColorStop(0.5, tones[1]); g.addColorStop(1, tones[2]);
  ctx.fillStyle = g; hullShape(ctx, L, B, 0, stern); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#3e2410'; ctx.stroke();
  ctx.fillStyle = '#d9a863'; hullShape(ctx, L * 0.84, B * 0.72, -L * 0.04, stern); ctx.fill();
  ctx.strokeStyle = 'rgba(110, 70, 30, 0.45)'; ctx.lineWidth = 0.6;
  for (const y of [-B * 0.36, 0, B * 0.36]) { ctx.beginPath(); ctx.moveTo(-L * 0.75, y); ctx.lineTo(L * 0.5, y); ctx.stroke(); }
}

function sailShadow(ctx, x, w, h) {
  ctx.fillStyle = 'rgba(40, 30, 20, 0.22)';
  ctx.beginPath(); ctx.ellipse(x + 2, 2, w, h, 0, 0, Math.PI * 2); ctx.fill();
}

function pennant(ctx, x, t, color = '#d8453a', len = 7) {
  const flap = Math.sin(t * 9) * 1.5;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, -1.1); ctx.quadraticCurveTo(x - len * 0.55, flap, x - len, flap * 0.6); ctx.quadraticCurveTo(x - len * 0.55, flap + 1.4, x, 1.1); ctx.fill();
}

function squareSail(ctx, x, span, depth, t, fill = ['#fbf5e6', '#d9ccb0']) {
  const billow = Math.sin(t * 3 + x) * 0.6;
  const g = ctx.createLinearGradient(x - depth, -span, x + depth, span);
  g.addColorStop(0, fill[0]); g.addColorStop(1, fill[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, -span);
  ctx.quadraticCurveTo(x + depth * (1 + billow * 0.1), 0, x, span);
  ctx.quadraticCurveTo(x + depth * 0.25, 0, x, -span);
  ctx.fill();
  ctx.strokeStyle = '#5a3616'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, -span * 1.05); ctx.lineTo(x, span * 1.05); ctx.stroke();
}

function skiff(ctx, r, t) {
  const L = r * 1.35; const B = r * 0.55;
  woodHull(ctx, L, B, ['#c98e4c', '#a86c34', '#7a4a20']);
  // Lateen sail: one long triangle, blue-striped.
  ctx.fillStyle = '#f4efe2';
  ctx.beginPath(); ctx.moveTo(L * 0.7, -1); ctx.quadraticCurveTo(0, -r * 1.55, -L * 0.75, -r * 0.2); ctx.lineTo(L * 0.7, -1); ctx.fill();
  ctx.strokeStyle = '#3b7fb5'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(L * 0.2, -r * 0.35); ctx.quadraticCurveTo(-L * 0.1, -r * 0.8, -L * 0.45, -r * 0.35); ctx.stroke();
  ctx.strokeStyle = '#5a3616'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(L * 0.7, -1); ctx.lineTo(-L * 0.75, -r * 0.2); ctx.stroke();
  pennant(ctx, -L * 0.1, t, '#3b7fb5', 6);
}

function longboat(ctx, r, t) {
  const L = r * 1.7; const B = r * 0.55;
  // Oars first, under the hull, sweeping in time.
  const sweep = Math.sin(t * 5) * 0.35;
  ctx.strokeStyle = '#6b4523'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = -L * 0.45 + i * L * 0.28;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x, side * B * 0.6);
      ctx.lineTo(x - Math.sin(sweep) * r * 0.6, side * (B + r * 0.7)); ctx.stroke();
    }
  }
  woodHull(ctx, L, B, ['#a86c34', '#8a5424', '#5e3515']);
  // Shields along the gunwale, alternating colours.
  for (let i = 0; i < 5; i++) {
    const x = -L * 0.55 + i * L * 0.26;
    for (const side of [-1, 1]) {
      ctx.fillStyle = (i + (side > 0)) % 2 ? '#d8453a' : '#e9dcc0';
      ctx.beginPath(); ctx.arc(x, side * B * 0.82, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  sailShadow(ctx, 0, r * 0.3, B * 1.5);
  squareSail(ctx, 0, B * 1.45, r * 0.7, t, ['#f2e0c0', '#d8b98a']);
  ctx.strokeStyle = '#b8452f'; ctx.lineWidth = 1.5;
  for (const y of [-B * 0.7, 0, B * 0.7]) { ctx.beginPath(); ctx.moveTo(r * 0.02, y - 1.5); ctx.lineTo(r * 0.18, y + 1.5); ctx.stroke(); }
  // Dragon prow
  ctx.fillStyle = '#6d3d1b';
  ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(L + 4, -2.5); ctx.lineTo(L + 2, 0); ctx.lineTo(L + 4, 2.5); ctx.fill();
}

function catamaran(ctx, r, t) {
  const L = r * 1.45; const B = r * 0.28; const off = r * 0.62;
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(0, side * off);
    woodHull(ctx, L, B, ['#e8e2d4', '#c9c0ae', '#9d937f']);
    ctx.restore();
  }
  // Trampoline net between the hulls.
  ctx.fillStyle = 'rgba(40, 60, 70, 0.55)';
  ctx.fillRect(-L * 0.35, -off + B * 0.6, L * 0.8, off * 2 - B * 1.2);
  ctx.strokeStyle = 'rgba(230, 230, 220, 0.5)'; ctx.lineWidth = 0.5;
  for (let x = -L * 0.35; x < L * 0.45; x += 3) { ctx.beginPath(); ctx.moveTo(x, -off + B * 0.6); ctx.lineTo(x, off - B * 0.6); ctx.stroke(); }
  // Tall triangular mainsail, teal.
  sailShadow(ctx, 0, r * 0.25, r * 0.9);
  ctx.fillStyle = '#2fb5a6';
  ctx.beginPath(); ctx.moveTo(r * 0.1, 0); ctx.quadraticCurveTo(-r * 0.2, -r * 1.2, -L * 0.7, -r * 0.1); ctx.lineTo(r * 0.1, 0); ctx.fill();
  ctx.fillStyle = '#f4efe2';
  ctx.beginPath(); ctx.moveTo(r * 0.1, 0); ctx.quadraticCurveTo(-r * 0.2, r * 1.0, -L * 0.6, r * 0.1); ctx.lineTo(r * 0.1, 0); ctx.fill();
  ctx.fillStyle = '#4a2c12'; ctx.beginPath(); ctx.arc(r * 0.1, 0, 1.6, 0, Math.PI * 2); ctx.fill();
}

function junk(ctx, r, t) {
  const L = r * 1.5; const B = r * 0.75;
  woodHull(ctx, L, B, ['#a4552f', '#843f22', '#5b2814'], 0.95);
  // Raised stern, painted eye on the bow.
  ctx.fillStyle = '#6b2f16'; ctx.fillRect(-L * 0.95, -B * 0.62, L * 0.3, B * 1.24);
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#f4efe2'; ctx.beginPath(); ctx.ellipse(L * 0.62, side * B * 0.62, 2.2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * 0.64, side * B * 0.62, 0.9, 0, Math.PI * 2); ctx.fill();
  }
  // Two battened sails (ribbed fans), red.
  for (const [x, span] of [[L * 0.2, B * 1.4], [-L * 0.35, B * 1.2]]) {
    sailShadow(ctx, x, r * 0.22, span);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.moveTo(x, -span); ctx.quadraticCurveTo(x + r * 0.5, 0, x, span); ctx.lineTo(x - r * 0.15, span * 0.9); ctx.lineTo(x - r * 0.15, -span * 0.9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6e1a12'; ctx.lineWidth = 0.9;
    for (let k = -3; k <= 3; k++) { const y = (k / 3.5) * span; ctx.beginPath(); ctx.moveTo(x - r * 0.15, y); ctx.lineTo(x + r * 0.35 * (1 - Math.abs(k) / 4), y); ctx.stroke(); }
    ctx.strokeStyle = '#4a2c12'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x, -span * 1.05); ctx.lineTo(x, span * 1.05); ctx.stroke();
  }
}

function steamer(ctx, r, t) {
  const L = r * 1.5; const B = r * 0.7;
  // Paddlewheels turning on each beam.
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#3a3f45';
    ctx.fillRect(-r * 0.35, side * B - (side > 0 ? 0 : 4), r * 0.7, 4);
    ctx.strokeStyle = '#8c949c'; ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const x = -r * 0.3 + ((t * 30 + k * r * 0.18) % (r * 0.6));
      ctx.beginPath(); ctx.moveTo(x, side * B - (side > 0 ? 0 : 4)); ctx.lineTo(x, side * B + (side > 0 ? 4 : 0)); ctx.stroke();
    }
  }
  const g = ctx.createLinearGradient(0, -B, 0, B);
  g.addColorStop(0, '#8a939b'); g.addColorStop(0.5, '#6b737a'); g.addColorStop(1, '#474e54');
  ctx.fillStyle = g; hullShape(ctx, L, B, 0, 0.9); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#23272b'; ctx.stroke();
  // Rivets
  ctx.fillStyle = '#2d3237';
  for (let i = 0; i < 7; i++) for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(-L * 0.7 + i * L * 0.24, side * B * 0.78, 0.8, 0, Math.PI * 2); ctx.fill(); }
  // Deckhouse and funnel with smoke.
  ctx.fillStyle = '#b89a6a'; ctx.fillRect(-L * 0.45, -B * 0.5, L * 0.6, B);
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(-L * 0.05, 0, r * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d1f22'; ctx.beginPath(); ctx.arc(-L * 0.05, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.8 + k / 4) % 1;
    ctx.fillStyle = `rgba(70, 70, 74, ${0.45 * (1 - ph)})`;
    ctx.beginPath(); ctx.arc(-L * 0.05 - ph * r * 2, Math.sin(ph * 6 + k) * 2, r * (0.22 + ph * 0.4), 0, Math.PI * 2); ctx.fill();
  }
  // Ram at the bow
  ctx.fillStyle = '#3a3f45';
  ctx.beginPath(); ctx.moveTo(L + 3, 0); ctx.lineTo(L - 2, -2.5); ctx.lineTo(L - 2, 2.5); ctx.fill();
}

function galleon(ctx, r, t) {
  const L = r * 1.75; const B = r * 0.85;
  woodHull(ctx, L, B, ['#8a5a2e', '#6b4220', '#472913'], 0.95);
  // Stern castle with lanterns, gunports along both sides.
  ctx.fillStyle = '#5a3a1e'; ctx.fillRect(-L * 0.98, -B * 0.68, L * 0.34, B * 1.36);
  ctx.fillStyle = '#ffcf6b';
  for (const y of [-B * 0.4, 0, B * 0.4]) ctx.fillRect(-L * 1.0, y - 1, 1.8, 2);
  ctx.fillStyle = '#1a120c';
  for (let i = 0; i < 5; i++) for (const side of [-1, 1]) ctx.fillRect(-L * 0.5 + i * L * 0.24 - 1.2, side * B * 0.88 - 1.1, 2.4, 2.2);
  // Three masts of white square sails with a gold cross.
  for (const [x, span] of [[L * 0.42, B * 1.35], [0, B * 1.55], [-L * 0.45, B * 1.3]]) {
    sailShadow(ctx, x, r * 0.35, span);
    squareSail(ctx, x, span, r * 0.8, t);
    ctx.strokeStyle = 'rgba(200, 150, 40, 0.85)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x + r * 0.28, -span * 0.45); ctx.lineTo(x + r * 0.28, span * 0.45); ctx.moveTo(x + r * 0.12, 0); ctx.lineTo(x + r * 0.44, 0); ctx.stroke();
  }
  pennant(ctx, -L * 0.98, t, '#1f4e8c', 9);
}

export const BOAT_STYLES = { skiff, longboat, catamaran, junk, steamer, galleon };

// Relative size each style is drawn at (the collision radius is the same
// for every hull; bigger ships just look bigger).
export const BOAT_STYLE_SCALE = { skiff: 0.95, longboat: 1.05, catamaran: 1.0, junk: 1.08, steamer: 1.08, galleon: 1.15 };

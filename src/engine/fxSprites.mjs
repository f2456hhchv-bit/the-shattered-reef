// Frame-by-frame effect sprites (2026-10-08): toy-style image strips in
// assets/fx/, one row of equal square cells, played over a particle's life.
// A particle with `sprite: '<id>'` is drawn from its strip by drawParticles
// (renderer.mjs); every frame shares one scale, so growth is in the art.

export const FX_SPRITES = {
  explosion: { file: 'explosion', frames: 12, cell: 192 },
  splash: { file: 'splash', frames: 12, cell: 192 },
  // Single toy image played as a 'pop': grow fast, hold, fade out.
  hitspark: { file: 'hitspark', frames: 1, cell: 160, mode: 'pop' },
};

// Scale and opacity of a 'pop' at `t` (0..1 of its life): grows from 35%
// to 110% over the first third, then fades through the second half.
export function popShape(t) {
  const g = Math.min(1, t / 0.33);
  const scale = 0.35 + 0.75 * (1 - (1 - g) * (1 - g));
  const alpha = t < 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) / 0.5);
  return { scale, alpha };
}

const images = {};
export function loadFxSprites(base = 'assets/fx/') {
  if (typeof Image === 'undefined') return;
  for (const { file } of Object.values(FX_SPRITES)) {
    if (images[file]) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = `${base}${file}.png`;
    images[file] = img;
  }
}

// Frame index for a particle `t` of the way through its life (0..1).
export function fxFrame(def, t) {
  return Math.min(def.frames - 1, Math.max(0, Math.floor(t * def.frames)));
}

// Draws particle `p` from its strip; false if the strip isn't ready yet.
export function drawFxSprite(ctx, p) {
  const def = FX_SPRITES[p.sprite];
  const img = def && images[def.file];
  if (!img || !img.complete || !img.naturalWidth) return false;
  const t = 1 - p.life / p.maxLife;
  const f = fxFrame(def, t);
  let d = p.size * 2;
  ctx.save();
  if (def.mode === 'pop') {
    const s = popShape(t);
    d *= s.scale;
    ctx.globalAlpha = s.alpha;
  }
  ctx.translate(p.x, p.y);
  if (p.rot) ctx.rotate(p.rot);
  ctx.drawImage(img, f * def.cell, 0, def.cell, def.cell, -d / 2, -d / 2, d, d);
  ctx.restore();
  return true;
}

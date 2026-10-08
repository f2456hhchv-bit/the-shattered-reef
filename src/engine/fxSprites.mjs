// Frame-by-frame effect sprites (2026-10-08): toy-style image strips in
// assets/fx/, one row of equal square cells, played over a particle's life.
// A particle with `sprite: '<id>'` is drawn from its strip by drawParticles
// (renderer.mjs); every frame shares one scale, so growth is in the art.

export const FX_SPRITES = {
  explosion: { file: 'explosion', frames: 12, cell: 192 },
};

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
  const f = fxFrame(def, 1 - p.life / p.maxLife);
  const d = p.size * 2;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.rot) ctx.rotate(p.rot);
  ctx.drawImage(img, f * def.cell, 0, def.cell, def.cell, -d / 2, -d / 2, d, d);
  ctx.restore();
  return true;
}

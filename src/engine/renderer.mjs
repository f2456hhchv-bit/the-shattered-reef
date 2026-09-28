// Canvas 2D rendering. No sprites/assets yet (vertical slice — placeholder
// shapes on purpose, per the project's own quality bar these get replaced
// with real art direction once the loop is proven, not before). Colors
// live here as constants so the eventual art pass has one place to retune.

export const PALETTE = {
  water: '#0b3a52',
  waterDeep: '#062435',
  rock: '#4a3b2c',
  rockEdge: '#2c2116',
  hull: '#c98a3f',
  hullDark: '#8a5a24',
  sail: '#e9ddc4',
  exit: '#e8b54b',
};

export function drawTileGrid(ctx, grid, tileSize, viewLeft, viewTop, viewRight, viewBottom) {
  const minTx = Math.max(0, Math.floor(viewLeft / tileSize));
  const maxTx = Math.min(grid.width - 1, Math.ceil(viewRight / tileSize));
  const minTy = Math.max(0, Math.floor(viewTop / tileSize));
  const maxTy = Math.min(grid.height - 1, Math.ceil(viewBottom / tileSize));

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const solid = grid.tiles[ty][tx] === 1;
      ctx.fillStyle = solid ? PALETTE.rock : ((tx + ty) % 2 === 0 ? PALETTE.water : PALETTE.waterDeep);
      ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
      if (solid) {
        ctx.strokeStyle = PALETTE.rockEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(tx * tileSize + 0.5, ty * tileSize + 0.5, tileSize - 1, tileSize - 1);
      }
    }
  }
}

export function drawExit(ctx, worldX, worldY, radius, t) {
  const pulse = radius + Math.sin(t * 3) * 3;
  ctx.save();
  ctx.translate(worldX, worldY);
  ctx.fillStyle = PALETTE.exit;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(0, 0, pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#241c0c';
  ctx.font = `bold ${Math.round(radius)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚓', 0, 1); // anchor glyph — placeholder for a real exit sprite
  ctx.restore();
}

export function drawBoat(ctx, boat, radius) {
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(boat.heading);
  ctx.fillStyle = PALETTE.hull;
  ctx.strokeStyle = PALETTE.hullDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(radius * 1.3, 0);
  ctx.lineTo(-radius * 0.9, radius * 0.8);
  ctx.lineTo(-radius * 0.6, 0);
  ctx.lineTo(-radius * 0.9, -radius * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.sail;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.1, -radius * 0.5);
  ctx.lineTo(-radius * 0.1, radius * 0.5);
  ctx.lineTo(radius * 0.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

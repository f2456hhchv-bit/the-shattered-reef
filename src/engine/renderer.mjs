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
  healthBarBack: 'rgba(6, 36, 53, .8)',
  healthBarFill: '#c94f3f',
  invulnerable: 'rgba(120, 190, 230, .55)',
  burn: '#e8813f',
  pickupWeapon: '#e8b54b',
  pickupSalvage: '#7bc9e0',
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

// Placeholder shapes, per the same "no art pass yet" rule as drawBoat —
// each enemy is a colored disc (its data-driven `color`) so archetypes
// stay visually distinct even before real sprites exist. A thin outer ring
// while invulnerable (submerged Deep Crawlers) and a flickering overlay
// while burning give the two status effects a readable tell.
export function drawEnemy(ctx, enemy, color, t, name = null) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);

  if (enemy.invulnerable) {
    ctx.globalAlpha = 0.35;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (enemy.invulnerable) {
    ctx.strokeStyle = PALETTE.invulnerable;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (enemy.burn) {
    ctx.globalAlpha = 0.5 + Math.sin(t * 20) * 0.15;
    ctx.fillStyle = PALETTE.burn;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Health bar, world-space, above the enemy — skipped at full health so a
  // healthy reef doesn't look like a wall of UI.
  if (enemy.health < enemy.maxHealth) {
    const barWidth = enemy.radius * 2.2;
    const barY = enemy.y - enemy.radius - 8;
    ctx.fillStyle = PALETTE.healthBarBack;
    ctx.fillRect(enemy.x - barWidth / 2, barY, barWidth, 3);
    ctx.fillStyle = PALETTE.healthBarFill;
    ctx.fillRect(enemy.x - barWidth / 2, barY, barWidth * Math.max(0, enemy.health / enemy.maxHealth), 3);
  }

  // A name label — currently only ever passed for a boss (main.mjs's
  // `nameFor` callback below), so a regular enemy's silhouette+color
  // stays the only identifier, per the counter-swap hook's whole point.
  if (name) {
    ctx.fillStyle = '#e9ddc4';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, enemy.x, enemy.y - enemy.radius - 14);
  }
}

export function drawEnemies(ctx, enemies, colorFor, t, nameFor = null) {
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    drawEnemy(ctx, enemy, colorFor(enemy), t, nameFor ? nameFor(enemy) : null);
  }
}

export function drawProjectile(ctx, projectile, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawProjectiles(ctx, projectiles, colorFor) {
  for (const p of projectiles) {
    if (p.spent) continue;
    drawProjectile(ctx, p, colorFor(p));
  }
}

// Placeholder pickup shapes: a diamond for a weapon cache (label carries
// which weapon), a small glinting dot for Salvage. Both bob gently so
// they read as pickups rather than static scenery.
export function drawPickup(ctx, pickup, label, t) {
  const bob = Math.sin(t * 2.4 + pickup.id) * 2;
  ctx.save();
  ctx.translate(pickup.x, pickup.y + bob);

  if (pickup.kind === 'weapon_cache') {
    ctx.fillStyle = PALETTE.pickupWeapon;
    ctx.strokeStyle = '#241c0c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(9, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (label) {
      ctx.fillStyle = '#241c0c';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
    }
  } else {
    ctx.fillStyle = PALETTE.pickupSalvage;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function drawPickups(ctx, pickups, labelFor, t) {
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    drawPickup(ctx, pickup, pickup.kind === 'weapon_cache' ? labelFor(pickup) : null, t);
  }
}

// Step 8 juice (engine/juice.mjs) — particles and floating damage numbers.
// Both draw in world space, so they're called inside the same camera-
// transformed block as everything else above, not as a screen-space overlay.
export function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Crit (on-counter) controls size; the combat-triangle status controls
// color, independent of and stacked with crit — a triangle-advantaged
// on-counter hit is a big gold number with a ▲ suffix, a
// triangle-disadvantaged one is small and dull red with a ▼, and a plain
// hit with no triangle effect keeps the original cream color.
export function drawDamageNumbers(ctx, numbers) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const d of numbers) {
    ctx.globalAlpha = Math.max(0, d.life / d.maxLife);
    ctx.font = d.crit ? 'bold 15px sans-serif' : 'bold 11px sans-serif';
    if (d.incoming) {
      // Damage taken: always reads as a loss (red, minus sign); the
      // triangle only changes the glyph — ▲ your predator hit harder, ▼
      // your prey hit softer.
      ctx.fillStyle = d.triangle === 'danger' ? '#ff5a4a' : d.triangle === 'resist' ? '#d98a7a' : '#e0705f';
      const glyph = d.triangle === 'danger' ? ' ▲' : d.triangle === 'resist' ? ' ▼' : '';
      ctx.fillText(`-${d.amount}${glyph}`, d.x, d.y);
      continue;
    }
    if (d.triangle === 'advantage') {
      ctx.fillStyle = d.crit ? '#6be0c9' : '#4fb3a0';
    } else if (d.triangle === 'disadvantage') {
      ctx.fillStyle = d.crit ? '#c97a6a' : '#8a5a52';
    } else {
      ctx.fillStyle = d.crit ? '#e8b54b' : '#e9ddc4';
    }
    const suffix = d.triangle === 'advantage' ? ' ▲' : d.triangle === 'disadvantage' ? ' ▼' : '';
    ctx.fillText(String(d.amount) + suffix, d.x, d.y);
  }
  ctx.globalAlpha = 1;
}

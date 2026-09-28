// Canvas 2D rendering. No sprites/assets yet (vertical slice — placeholder
// shapes on purpose, per the project's own quality bar these get replaced
// with real art direction once the loop is proven, not before). Colors
// live here as constants so the eventual art pass has one place to retune.

import { damageNumberStyle, DAMAGE_NUMBER_COLORS } from './juice.mjs';

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
export function drawEnemy(ctx, enemy, color, t, name = null, badge = null) {
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

  // Combat-triangle matchup pip (2026-09-28): lets the player read the
  // matchup BEFORE firing. 'prey' = cyan ▲ (the triangle favors you),
  // 'predator' = red ! in a ring (this one hits you harder and shrugs off
  // your shots). Reveals the faction relationship, never the counter
  // weapon — the weapon read stays the player's job. Drawn beside the
  // health bar's end so the two never overlap.
  if (badge) {
    const bx = enemy.x + enemy.radius + 5;
    const by = enemy.y - enemy.radius - 5;
    ctx.save();
    ctx.lineJoin = 'round';
    if (badge === 'prey') {
      ctx.beginPath();
      ctx.moveTo(bx, by - 5); ctx.lineTo(bx + 5, by + 4); ctx.lineTo(bx - 5, by + 4); ctx.closePath();
      ctx.lineWidth = 3; ctx.strokeStyle = DAMAGE_NUMBER_COLORS.outline; ctx.stroke();
      ctx.fillStyle = DAMAGE_NUMBER_COLORS.favored; ctx.fill();
    } else if (badge === 'predator') {
      ctx.beginPath(); ctx.arc(bx, by, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = DAMAGE_NUMBER_COLORS.outline; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = DAMAGE_NUMBER_COLORS.hurtDanger; ctx.stroke();
      ctx.fillStyle = DAMAGE_NUMBER_COLORS.hurtDanger;
      ctx.font = '900 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', bx, by + 0.5);
    }
    ctx.restore();
  }
}

export function drawEnemies(ctx, enemies, colorFor, t, nameFor = null, badgeFor = null) {
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    drawEnemy(ctx, enemy, colorFor(enemy), t, nameFor ? nameFor(enemy) : null, badgeFor ? badgeFor(enemy) : null);
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

// Draws floating damage numbers. All styling decisions (colours, glyphs,
// size, pop) live in engine/juice.mjs's damageNumberStyle — pure and
// unit-tested — so this only lays out the coloured parts side by side,
// outline first, then fill, centred on the number's position.
export function drawDamageNumbers(ctx, numbers) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const d of numbers) {
    const style = damageNumberStyle(d);
    ctx.globalAlpha = Math.max(0, Math.min(1, d.life / (d.maxLife * 0.5)));
    ctx.font = `800 ${style.size.toFixed(1)}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    const widths = style.parts.map((p) => ctx.measureText(p.text).width);
    const gap = style.size * 0.08;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (style.parts.length - 1);
    let x = d.x - total / 2;
    ctx.lineWidth = style.outlineWidth;
    ctx.strokeStyle = style.outline;
    style.parts.forEach((p, i) => { ctx.strokeText(p.text, x, d.y); x += widths[i] + gap; });
    x = d.x - total / 2;
    style.parts.forEach((p, i) => { ctx.fillStyle = p.color; ctx.fillText(p.text, x, d.y); x += widths[i] + gap; });
  }
  ctx.globalAlpha = 1;
}

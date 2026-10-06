// Renders every image sprite in use (ships, creatures, enemy-ship looks,
// buildings) for the art inventory, after the images load. Read by
// spritedata.mjs as window.__spriteTiles.
import { ENEMIES } from '../../src/data/enemies.mjs';
import { BASE_BUILDINGS } from '../../src/data/base.mjs';
import { createEnemy } from '../../src/engine/enemies.mjs';
import { drawEnemy } from '../../src/engine/renderer.mjs';
import { SHIP_SPRITE_FRAMES, loadShipSprites, shipSpriteReady, drawShipSprite } from '../../src/engine/shipSprites.mjs';
import { loadCreatureSprites } from '../../src/engine/creatureSprites.mjs';
import { BUILDING_SPRITES, loadBuildingSprites, buildingSpriteReady, drawBuildingSprite } from '../../src/engine/buildingSprites.mjs';

loadShipSprites('../../assets/ships/'); loadCreatureSprites('../../assets/creatures/'); loadBuildingSprites('../../assets/buildings/');
const H = (112.5 * Math.PI) / 180; // bow-quarter view
const W = 168;
function tile(draw, zoom) {
  const c = document.createElement('canvas'); c.width = W; c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = '#5a9bb0'; x.fillRect(0, 0, W, 128);
  x.translate(W / 2, 64); x.scale(zoom, zoom); draw(x); return c.toDataURL('image/webp', 0.85);
}
await new Promise((r) => setTimeout(r, 1500));
const out = [];
for (const s of Object.keys(SHIP_SPRITE_FRAMES)) if (shipSpriteReady(s)) out.push({ kind: 'ship', name: s[0].toUpperCase() + s.slice(1), img: tile((x) => drawShipSprite(x, s, H, 44), 2.4) });
let id = 1;
for (const def of Object.values(ENEMIES)) {
  let e; try { e = createEnemy(def.id, 0, 0, () => 0.5); } catch { continue; }
  Object.assign(e, { x: 0, y: 0, id: id++, heading: H, vx: Math.cos(H) * 30, vy: Math.sin(H) * 30, health: e.maxHealth || 50, hitFlash: 0, aggro: true, invulnerable: false, submergedState: null, phased: false, camo: false });
  const r = e.radius || 12;
  out.push({ kind: 'enemy', name: def.name, img: tile((x) => drawEnemy(x, e, def.color || '#888', 1.3), Math.min(3, (def.isBoss ? 40 : 46) / r)) });
}
for (const b of BASE_BUILDINGS) if (BUILDING_SPRITES[b.id] && buildingSpriteReady(b.id)) out.push({ kind: 'building', name: b.name, img: tile((x) => { x.translate(0, 40); drawBuildingSprite(x, b.id, 0, 0); }, 0.95) });
window.__spriteTiles = out;

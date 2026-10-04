// Biome light and atmosphere (2026-09-29, stages 5-10). Pure logic: how
// dark the level is, how far your lantern reaches, and what you can see.
// engine/lightArt.mjs draws it.
//
// Caverns and the Abyss are dark: a pool of light around your ship, and
// anything that glows (mushrooms, jellies, lures, lava, every shot in the
// air) lights its own patch. You see the attacks and the eyes, not the
// hunters. A boss phase can `darken` the light, a weather event can `dim`
// it, and squid ink blinds you for a few seconds anywhere.

import { getEnemy } from '../data/enemies.mjs';
import { currentPhase } from './enemies.mjs';
import { hasAffliction } from './boat.mjs';

export const INK = Object.freeze({ dark: 0.86, light: 105, color: [4, 2, 10] });

// { dark: 0..1, light: px radius or null (no darkness), color: [r,g,b] }
export function ambientLight(run, biome) {
  const a = biome?.ambient || {};
  let dark = a.dark || 0;
  let light = a.light || null;
  let color = a.color || [3, 5, 12];
  // Survival arenas (2026-10-04): a brighter lantern — the crowd comes from
  // every side, so you need to see further than in a maze's corridors.
  if (light && run.lanternMult) light *= run.lanternMult;
  if (light) {
    for (const e of run.enemies || []) {
      if (!e.isBoss || e.health <= 0 || !e.aggro) continue;
      const ph = currentPhase(e);
      if (ph?.darken) light *= ph.darken;
    }
    const w = run.weather;
    if (w?.active?.def?.dim) {
      const fade = Math.min(1, w.time / 2, Math.max(0, (w.active.total - w.time) / 2));
      light *= 1 - (1 - w.active.def.dim) * fade;
    }
  }
  if (run.boat && hasAffliction(run.boat, 'ink')) {
    dark = Math.max(dark, INK.dark);
    light = Math.min(light ?? Infinity, INK.light);
    if (!a.dark) color = INK.color;
  }
  return { dark, light, color };
}

// How far your gunners can see: the fog pocket or the lantern, whichever
// is smaller (null = no limit). Glowing enemies can be seen further off.
export function viewRadius(run, biome, weatherView = null) {
  const { light } = ambientLight(run, biome);
  if (light == null) return weatherView;
  return weatherView == null ? light : Math.min(light, weatherView);
}

export function canSee(run, enemy, radius) {
  if (radius == null) return true;
  const d = Math.hypot(enemy.x - run.boat.x, enemy.y - run.boat.y);
  const glow = getEnemy(enemy.defId).glow || 0;
  return d <= radius * 0.9 + glow * 1.5;
}

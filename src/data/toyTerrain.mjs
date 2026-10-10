// Toy-style arena terrain (2026-10-10): survival arenas drawn in the same
// "toy board piece" look as the island images and the harbour — a raised
// rounded rim round every coast, a groove, then a flat-coloured top.
// Colours were sampled from each biome's island art (assets/islands).
// Applied as overrides on top of the biome in data/biomes.mjs, so lava,
// glow, ambient and the biome's own decoration styles carry over.

import { HARBOUR_BIOME_OVERRIDES } from './base.mjs';
import { hexToRgb } from './biomes.mjs';

// rim = raised beach band, top = the flat land, bush = [dark, light].
export const TOY_PALETTES = Object.freeze({
  tropical: { rim: '#f2dca0', top: '#6cc04f', bush: ['#3f9a37', '#7fd45a'] },
  cliff_cove: { rim: '#bdb6a9', top: '#7fae4a', bush: ['#4f8a32', '#93c75c'] },
  glacial: { rim: '#9bd3f0', top: '#eef3f9', bush: ['#6fa9c6', '#d9eef9'] },
  shipwreck: { rim: '#aaa5a1', top: '#6f8a4e', bush: ['#4d6a36', '#8aa762'] },
  volcanic: { rim: '#78747a', top: '#3e3a3b', bush: ['#2a2626', '#55504f'] },
  caverns: { rim: '#625e74', top: '#6f6585', bush: ['#4b4560', '#8a7fa6'] },
  mangrove: { rim: '#5e4739', top: '#5f6a3a', bush: ['#3f4a25', '#7a8a48'] },
  abyss: { rim: '#9fa0a3', top: '#34425a', bush: ['#26324a', '#4e5f7e'] },
  bone_sands: { rim: '#efd6af', top: '#e8963f', bush: ['#b86d24', '#f0b46a'] },
  crystal: { rim: '#f8bcba', top: '#a28bcb', bush: ['#7c66a8', '#c6b3e6'] },
});

const GLOWING = new Set(['glowcoral', 'mushroom', 'ember']);

const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const shadeHex = (h, k) => hex(hexToRgb(h).map((v) => v * k));
export const mixHex = (a, b, t) => { const x = hexToRgb(a); const y = hexToRgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };

// Land colour by signed distance inland (px): a dark lip at the waterline,
// a lit rounded rim, a shaded groove, then the flat top.
export function toyLandStops(p) {
  return [
    [0, shadeHex(p.rim, 0.78)],
    [1.5, p.rim],
    [3.5, mixHex(p.rim, '#ffffff', 0.22)],
    [6.5, p.rim],
    [8.5, shadeHex(p.rim, 0.8)],
    [10, shadeHex(p.top, 0.88)],
    [12, p.top],
    [60, p.top],
  ];
}

export function toyArenaBiome(biome) {
  const p = TOY_PALETTES[biome.id];
  if (!p) return biome;
  const toy = {
    ...biome,
    land: toyLandStops(p),
    jungleDark: shadeHex(p.top, 0.95), // barely-there mottling: flat top
    relief: 0.3, grain: 2.5, // mostly flat, like moulded plastic
    rockStart: 9999, // no rock outcrops: the top stays one flat colour
    bush: p.bush,
    boulder: [mixHex(p.rim, '#ffffff', 0.25), shadeHex(p.rim, 0.7)],
    // Clean flat tops like the island art: only chunky toy rocks, plus the
    // glowing decorations dark biomes need for light. Biome props come
    // back as toy images (art batch P).
    decor: Object.fromEntries(['palm', 'bush', 'coral', 'shell', 'boulder'].map((k) => {
      const own = biome.decor?.[k];
      return [k, k === 'boulder' ? 'toyrock' : (GLOWING.has(own) ? own : 'none')];
    })),
  };
  if (biome.id === 'tropical') Object.assign(toy, { water: HARBOUR_BIOME_OVERRIDES.water, foam: HARBOUR_BIOME_OVERRIDES.foam, outside: HARBOUR_BIOME_OVERRIDES.outside });
  return toy;
}

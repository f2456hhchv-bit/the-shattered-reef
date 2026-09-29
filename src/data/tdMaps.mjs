// Reef Defence maps (2026-09-29): one per biome, in voyage-stage order.
// Enemies sail in from the open sea along channels through the reef to the
// Heart of the Reef; flyers cut straight across the land. The map itself
// is generated (engine/tdMap.mjs) from `seed` and `lanes`; its waves
// (engine/tdWaves.mjs) are drawn from the same biome's voyage roster
// (data/stages.mjs, `stage`), ending on that biome's boss.
//
// lanes: where each channel enters, as { from: 'top'|'left'|'right',
//   at: 0..1 along that edge, turns: switchbacks before the Heart }.
// hp: enemy hull multiplier on top of the stage's own scaling.

export const TD_MAPS = [
  { id: 'palm_lagoon', name: 'Palm Lagoon', stage: 1, seed: 0x7d01, waves: 10, startGold: 220, hp: 1.0,
    lanes: [{ from: 'top', at: 0.5, turns: 4 }], spots: 14 },
  { id: 'sharkstooth_narrows', name: 'Sharkstooth Narrows', stage: 2, seed: 0x7d02, waves: 11, startGold: 230, hp: 1.05,
    lanes: [{ from: 'top', at: 0.3, turns: 4 }], spots: 15 },
  { id: 'frostfang_sound', name: 'Frostfang Sound', stage: 3, seed: 0x7d03, waves: 12, startGold: 250, hp: 1.1,
    lanes: [{ from: 'top', at: 0.25, turns: 3 }, { from: 'right', at: 0.3, turns: 2 }], spots: 17 },
  { id: 'wreckers_reach', name: "Wreckers' Reach", stage: 4, seed: 0x7d04, waves: 12, startGold: 260, hp: 1.15,
    lanes: [{ from: 'top', at: 0.7, turns: 3 }, { from: 'left', at: 0.35, turns: 2 }], spots: 17 },
  { id: 'cinder_straits', name: 'Cinder Straits', stage: 5, seed: 0x7d05, waves: 13, startGold: 270, hp: 1.15,
    lanes: [{ from: 'top', at: 0.2, turns: 3 }, { from: 'top', at: 0.8, turns: 3 }], spots: 18 },
  { id: 'hollow_grotto', name: 'Hollow Grotto', stage: 6, seed: 0x7d06, waves: 13, startGold: 340, hp: 0.95,
    lanes: [{ from: 'top', at: 0.5, turns: 5 }], spots: 16 },
  { id: 'blackroot_channels', name: 'Blackroot Channels', stage: 7, seed: 0x7d07, waves: 14, startGold: 290, hp: 1.2,
    lanes: [{ from: 'left', at: 0.2, turns: 3 }, { from: 'right', at: 0.2, turns: 3 }], spots: 18 },
  { id: 'lantern_trench', name: 'Lantern Trench', stage: 8, seed: 0x7d08, waves: 14, startGold: 370, hp: 1.2,
    lanes: [{ from: 'top', at: 0.35, turns: 4 }, { from: 'right', at: 0.45, turns: 2 }], spots: 18 },
  { id: 'ossuary_wadi', name: 'Ossuary Wadi', stage: 9, seed: 0x7d09, waves: 15, startGold: 310, hp: 1.25,
    lanes: [{ from: 'top', at: 0.5, turns: 3 }, { from: 'left', at: 0.3, turns: 2 }, { from: 'right', at: 0.5, turns: 1 }], spots: 20 },
  { id: 'prism_gate', name: 'Prism Gate', stage: 10, seed: 0x7d0a, waves: 15, startGold: 320, hp: 1.3,
    lanes: [{ from: 'top', at: 0.2, turns: 3 }, { from: 'top', at: 0.8, turns: 3 }, { from: 'left', at: 0.55, turns: 1 }], spots: 20 },
];

export const TD_MAP_BY_ID = Object.fromEntries(TD_MAPS.map((m, i) => [m.id, { ...m, index: i }]));

export function getTdMap(id) {
  const m = TD_MAP_BY_ID[id];
  if (!m) throw new Error(`Unknown defence map: ${id}`);
  return m;
}

// The Heart of the Reef: how many hits it takes, and what that means for stars.
export const TD_LIVES = 20;
export function starsFor(lives, maxLives = TD_LIVES) {
  if (lives <= 0) return 0;
  const f = lives / maxLives;
  return f >= 0.9 ? 3 : f >= 0.5 ? 2 : 1;
}

// Salvage for a finished defence. Stars are only paid once each: a replay
// that earns no new star pays a small flat amount. A first 3-star clear
// also pays a Kraken Scale (the Workshop's rare currency), so the two
// modes feed each other.
export function defenceReward(mapIndex, oldStars, newStars) {
  const per = 22 + mapIndex * 6;
  const fresh = Math.max(0, newStars - oldStars);
  const salvage = fresh > 0 ? fresh * per : (newStars > 0 ? 8 + mapIndex * 2 : 0);
  const scales = newStars === 3 && oldStars < 3 ? 1 : 0;
  return { salvage, scales, freshStars: fresh };
}

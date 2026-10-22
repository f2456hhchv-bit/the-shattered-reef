// The Keys (2026-10-22): the Locke & Key half of the story, and the game's
// special attack (after HoloCure's specials). Every Marlowe starts with the
// Anchor Key; each stage boss holds one of the ten keys lost when the Reef
// broke, and sinking it the first time brings that key home. You carry one
// key on a voyage. It charges as you sink enemies; tap the key button (Q on
// a keyboard) to turn it.
//
// `charge`: sinks' worth of charge to fill (horde 1, specialist 3, elite
// 12, warlord/boss hits don't charge). `power` numbers are level 1; the
// Keysmith raises them (engine/keys.mjs keyStats).

export const KEYS = {
  anchor: {
    id: 'anchor', name: 'Anchor Key', icon: '⚓', colour: '#d8483a', stage: 0,
    power: 'Anchor Drop', desc: 'Slam the sea: a shockwave hurls back everything near you.',
    lore: 'Your grandfather\'s key. It always brings a Marlowe home.',
    charge: 55, fx: { kind: 'shock', radius: 210, damage: 70, push: 260 },
  },
  tide: {
    id: 'tide', name: 'Tide Key', icon: '🌊', colour: '#2f9ad6', stage: 1,
    power: 'Rogue Tide', desc: 'A great wave rolls out ahead of you, crushing and sweeping away the fleet.',
    lore: 'Taken back from the Black Gale. It tugs toward the open sea.',
    charge: 70, fx: { kind: 'wave', radius: 460, arc: 1.2, damage: 110, push: 420 },
  },
  storm: {
    id: 'storm', name: 'Storm Key', icon: '⚡', colour: '#f2d14a', stage: 2,
    power: 'Calling Thunder', desc: 'Lightning strikes the twelve nearest enemies.',
    lore: 'Cut from the belly of the Bloodfin Matriarch. Crackles in damp weather.',
    charge: 70, fx: { kind: 'storm', count: 12, radius: 520, damage: 150 },
  },
  frost: {
    id: 'frost', name: 'Frost Key', icon: '❄️', colour: '#8fd8f0', stage: 3,
    power: 'Hard Freeze', desc: 'Freeze everything near you solid for 4s. Frozen enemies take 50% more damage.',
    lore: 'Thawed out of the Frostfang ice. Frost blooms on anything it touches.',
    charge: 85, fx: { kind: 'freeze', radius: 420, seconds: 4, taken: 1.5, damage: 30 },
  },
  ghost: {
    id: 'ghost', name: 'Ghost Key', icon: '👻', colour: '#9fe3d0', stage: 4,
    power: 'Ghost Ship', desc: 'Slip between worlds for 5s: nothing can touch you, and every shot passes through two more enemies.',
    lore: 'Held by the Drowned Admiral. Your hand goes a little see-through holding it.',
    charge: 80, fx: { kind: 'ghost', seconds: 5, pierce: 2 },
  },
  ember: {
    id: 'ember', name: 'Ember Key', icon: '🔥', colour: '#f26a2e', stage: 5,
    power: 'Ring of Fire', desc: 'Set the sea ablaze in a ring of fire pools around you.',
    lore: 'Pried from under the Caldera Wyrm. Warm enough to boil a kettle.',
    charge: 70, fx: { kind: 'fire', count: 10, ring: 90, pool: 34, seconds: 6, burn: 18 },
  },
  lantern: {
    id: 'lantern', name: 'Lantern Key', icon: '🏮', colour: '#f4c24a', stage: 6,
    power: 'Lamplight', desc: 'For 8s every gun reloads 40% faster and hits 40% harder.',
    lore: 'The Hollow King\'s stolen sun. Moth can almost see by it.',
    charge: 90, fx: { kind: 'buff', seconds: 8, reload: 0.6, damage: 1.4 },
  },
  mire: {
    id: 'mire', name: 'Mire Key', icon: '🍄', colour: '#7bbf4a', stage: 7,
    power: 'Bog Breath', desc: 'A poison cloud follows your ship for 7s, eating at everything nearby.',
    lore: 'Brewed in Old Mother Mire\'s cauldron. Smells of frogs. Everything in the bayou does.',
    charge: 75, fx: { kind: 'aura', seconds: 7, radius: 120, dps: 45 },
  },
  deep: {
    id: 'deep', name: 'Deep Key', icon: '🌀', colour: '#3b4fc4', stage: 8,
    power: 'Maelstrom', desc: 'Open a whirlpool that drags enemies in for 3s, then bursts.',
    lore: 'From the Deep Mother\'s nest. It whispers, if you hold it to your ear. Don\'t.',
    charge: 90, fx: { kind: 'vortex', radius: 340, seconds: 3, pull: 150, blast: 150, damage: 220 },
  },
  bone: {
    id: 'bone', name: 'Bone Key', icon: '💀', colour: '#e8dcb8', stage: 9,
    power: 'Sandstorm', desc: 'A storm of sand slows every enemy near you by 60% for 6s and scours them.',
    lore: 'Coughed up by the Dunemaw. Still gritty.',
    charge: 80, fx: { kind: 'slow', radius: 520, seconds: 6, slow: 0.4, dps: 25 },
  },
  prism: {
    id: 'prism', name: 'Prism Key', icon: '🔷', colour: '#b48cf0', stage: 10,
    power: 'Prism Split', desc: 'For 6s every shot you fire splits into three.',
    lore: 'The heart of the Prism Colossus. The last key. All ten hum together now.',
    charge: 95, fx: { kind: 'split', seconds: 6, spread: 0.2 },
  },
};

export const KEY_IDS = Object.keys(KEYS);
export const KEY_MAX_LEVEL = 5;
// What a sink adds to the key's charge.
export const KEY_CHARGE = { horde: 1, special: 3, elite: 12 };

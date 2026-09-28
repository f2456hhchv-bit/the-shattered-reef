// Faction identities for the post-slice combat triangle (PRD "Post-Slice
// Direction: Factions & The Combat Triangle", confirmed 2026-09-28). This is
// a SECOND, SEPARATE multiplier stacked on top of the existing weapon-
// niche-counter system (data/weapons.mjs) — not a replacement. The
// moment-to-moment "read the enemy, swap weapon" puzzle stays primary;
// faction is the strategic layer around it (which faction you fight, and
// which you play as, shapes a whole run).
//
// Triangle: Reavers > Iron Accord > Wyrdtide > Reavers. Every regular enemy
// belongs to exactly one faction (data/enemies.mjs); The Kraken's Anchor is
// deliberately faction-less ("an Ancient-tier threat, not faction-aligned"
// per the PRD) and is never triangle-affected — see triangleMultiplier.

export const FACTION_IDS = Object.freeze({
  REAVERS: 'reavers',
  WYRDTIDE: 'wyrdtide',
  IRON_ACCORD: 'iron_accord',
});

// `beats`: the one faction this faction has the triangle advantage against.
export const FACTIONS = {
  [FACTION_IDS.REAVERS]: {
    id: FACTION_IDS.REAVERS,
    name: 'Blacksail Reavers',
    identity: 'Aggro/Speed',
    flavor: 'Fast, aggressive, low-armor raiders — speed overwhelms heavy armor before it can react.',
    beats: FACTION_IDS.IRON_ACCORD,
    color: '#b0453a',
  },
  [FACTION_IDS.WYRDTIDE]: {
    id: FACTION_IDS.WYRDTIDE,
    name: 'Wyrdtide',
    identity: 'Mystic/Deep',
    flavor: 'Submerged, cursed, unpredictable — the deep punishes reckless aggression.',
    beats: FACTION_IDS.REAVERS,
    color: '#3a6b8a',
  },
  [FACTION_IDS.IRON_ACCORD]: {
    id: FACTION_IDS.IRON_ACCORD,
    name: 'Iron Accord',
    identity: 'Armor/Discipline',
    flavor: 'A heavy naval faction — discipline and cold iron resist curses.',
    beats: FACTION_IDS.WYRDTIDE,
    color: '#8a8a78',
  },
};

export const FACTION_LIST = Object.values(FACTIONS);

export function getFaction(id) {
  const faction = FACTIONS[id];
  if (!faction) throw new Error(`Unknown faction id: ${id}`);
  return faction;
}

// Kept as clean, easy-to-reason-about numbers rather than derived from any
// other system's tuning — first-pass balance, same status as every other
// meta-progression number in data/meta.mjs (expect retuning once played).
export const TRIANGLE_ADVANTAGE_MULTIPLIER = 1.3;
export const TRIANGLE_DISADVANTAGE_MULTIPLIER = 0.75;

// The multiplier damage dealt BY `attackerFactionId` TO `defenderFactionId`
// should receive. Either side missing (no playable faction chosen yet, or a
// faction-less target like the boss) is a deliberate no-op — 1x, falling
// back to the weapon-counter system alone, exactly matching the PRD's "the
// boss sits above the triangle... not faction-aligned."
export function triangleMultiplier(attackerFactionId, defenderFactionId) {
  if (!attackerFactionId || !defenderFactionId) return 1;
  if (attackerFactionId === defenderFactionId) return 1;
  const attacker = getFaction(attackerFactionId);
  const defender = getFaction(defenderFactionId);
  if (attacker.beats === defenderFactionId) return TRIANGLE_ADVANTAGE_MULTIPLIER;
  if (defender.beats === attackerFactionId) return TRIANGLE_DISADVANTAGE_MULTIPLIER;
  return 1;
}

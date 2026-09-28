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

// Incoming (enemy -> player) magnitudes — the triangle applies both ways
// (decided 2026-09-28). A mutable object so tools/faction-compare.mjs can
// sweep it without editing code. Deliberately NOT fully symmetric, chosen
// with data (600 bot voyages per faction per setting): your predator's
// bite matches your own advantage (x1.3), but your prey only softens to
// x0.9, not x0.75. The roster is skewed — Wyrdtide's dive-bombing Harpies
// deal ~65% of all contact damage — so a full x0.75 "prey hits softer"
// turned into a shield for whichever faction preys on Wyrdtide (Iron
// Accord hit ~86% voyage survival vs ~70% for everyone else). At 1.3/0.9
// the factions land at ~69-79% with unaligned ~70%.
export const INCOMING_TRIANGLE = {
  advantage: 1.3,    // an enemy whose faction beats yours hits you harder
  disadvantage: 0.9, // an enemy whose faction yours beats hits you a little softer
};

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

// Damage an enemy of `enemyFactionId` deals to a player of
// `playerFactionId`. Same shape and no-op rules as triangleMultiplier, but
// reads INCOMING_TRIANGLE so the two directions can be tuned separately.
export function incomingTriangleMultiplier(enemyFactionId, playerFactionId) {
  const m = triangleMultiplier(enemyFactionId, playerFactionId);
  if (m > 1) return INCOMING_TRIANGLE.advantage;
  if (m < 1) return INCOMING_TRIANGLE.disadvantage;
  return 1;
}

// Player-facing matchup for a faction: which faction it beats (its prey,
// the triangle favors you) and which beats it (its predator). Used by the
// Hub, the run-start toast and the enemy matchup pips, so the player can
// read the triangle before firing rather than inferring it from numbers.
export function matchupFor(factionId) {
  if (!factionId) return null;
  const self = getFaction(factionId);
  const predator = FACTION_LIST.find((f) => f.beats === factionId);
  return { prey: getFaction(self.beats), predator };
}

// 'prey' | 'predator' | null — how an enemy of `enemyFactionId` relates to
// a player of `playerFactionId`. Null for unaligned players, faction-less
// enemies (the boss) and mirror matches.
export function relationTo(playerFactionId, enemyFactionId) {
  const m = triangleMultiplier(playerFactionId, enemyFactionId);
  if (m > 1) return 'prey';
  if (m < 1) return 'predator';
  return null;
}

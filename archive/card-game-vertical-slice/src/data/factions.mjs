// Faction metadata. A minion's `faction` field references one of these ids,
// or 'neutral' for cards that fit any board but never receive faction buffs.
//
// Vertical slice ships two factions only (Blacksail Reavers, Wyrdtide).
// The other four (see docs/design/factions-full.md when it exists) are
// Content-phase (phase 5) work — do not add their cards here yet.

export const FACTIONS = {
  'blacksail-reavers': {
    id: 'blacksail-reavers',
    name: 'Blacksail Reavers',
    archetype: 'Aggro',
    summary: 'Cheap, high-attack pirates. Swarm the board, then buff the swarm.',
    color: '#8a2e2e',
  },
  'wyrdtide': {
    id: 'wyrdtide',
    name: 'Wyrdtide',
    archetype: 'Gamble',
    summary: 'Feeds a shared board entity, the Fathom, through Reef Shard risk.',
    color: '#2e6e8a',
  },
  'neutral': {
    id: 'neutral',
    name: 'Neutral',
    archetype: 'Flex',
    summary: 'Fits any board. Never receives a faction buff.',
    color: '#5a5548',
  },
};

export const FACTION_IDS = Object.keys(FACTIONS);

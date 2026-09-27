// The vertical-slice minion pool: Blacksail Reavers + Wyrdtide + a small
// neutral pool, tiers 1-3 only. See docs/design/reef-shards.md for how the
// Reef Shard / Fathom mechanic referenced below actually works, and
// CLAUDE.md for what's built vs. still data-only.
//
// cost = tier + 2 (tier 1 = 3g, tier 2 = 4g, tier 3 = 5g), matching the
// tavern-tier pattern the genre is built on.

const costForTier = (tier) => tier + 2;

export const MINIONS = [
  // ---------------------------------------------------------------------
  // BLACKSAIL REAVERS — aggro. Cheap, high-attack, swarm-and-buff-the-swarm.
  // ---------------------------------------------------------------------
  {
    id: 'reaver-deckhand',
    name: 'Deckhand',
    faction: 'blacksail-reavers',
    tier: 1,
    attack: 2,
    health: 2,
    cost: costForTier(1),
    keywords: [],
    effects: [
      { trigger: 'battlecry', action: { type: 'buff_random_friendly_faction', attack: 1, health: 0, count: 1 } },
    ],
    flavor: 'First one up the rigging, first one to the prize.',
  },
  {
    id: 'reaver-powder-rat',
    name: 'Powder Rat',
    faction: 'blacksail-reavers',
    tier: 1,
    attack: 1,
    health: 3,
    cost: costForTier(1),
    keywords: [],
    effects: [
      { trigger: 'deathrattle', action: { type: 'damage_random_enemy', amount: 1 } },
    ],
    flavor: 'Small hands, short fuses.',
  },
  {
    id: 'reaver-bilge-rigger',
    name: 'Bilge Rigger',
    faction: 'blacksail-reavers',
    tier: 1,
    attack: 3,
    health: 2,
    cost: costForTier(1),
    keywords: [],
    effects: [],
    flavor: 'No ability. Just very good at hitting things.',
  },
  {
    id: 'reaver-cutlass-hand',
    name: 'Cutlass Hand',
    faction: 'blacksail-reavers',
    tier: 2,
    attack: 3,
    health: 3,
    cost: costForTier(2),
    keywords: [],
    effects: [
      { trigger: 'battlecry', action: { type: 'buff_all_friendly_faction', attack: 1, health: 0 } },
    ],
    flavor: 'Raises her blade; the whole crew raises theirs.',
  },
  {
    id: 'reaver-first-mate-sorrel',
    name: 'First Mate Sorrel',
    faction: 'blacksail-reavers',
    tier: 2,
    attack: 2,
    health: 4,
    cost: costForTier(2),
    keywords: ['taunt'],
    effects: [
      { trigger: 'end_of_combat_won', action: { type: 'buff_self', attack: 1, health: 1 } },
    ],
    flavor: 'Every fight she walks away from, she walks away stronger.',
  },
  {
    id: 'reaver-plunder-skiff',
    name: 'Plunder Skiff',
    faction: 'blacksail-reavers',
    tier: 2,
    attack: 2,
    health: 2,
    cost: costForTier(2),
    keywords: [],
    effects: [
      { trigger: 'deathrattle', action: { type: 'summon', minionId: 'reaver-deckhand', count: 2 } },
    ],
    flavor: 'Sinks fast, but not before the crew jumps clear.',
  },
  {
    id: 'reaver-captain-vex',
    name: 'Captain Vex',
    faction: 'blacksail-reavers',
    tier: 3,
    attack: 4,
    health: 4,
    cost: costForTier(3),
    keywords: [],
    effects: [
      { trigger: 'battlecry', action: { type: 'buff_random_friendly_faction', attack: 2, health: 1, count: 2 } },
    ],
    flavor: 'She doesn’t give orders twice.',
  },
  {
    id: 'reaver-krakens-due',
    name: "The Kraken's Due",
    faction: 'blacksail-reavers',
    tier: 3,
    attack: 5,
    health: 3,
    cost: costForTier(3),
    keywords: [],
    // Faction-wide passive, not a per-minion trigger: whenever ANY Reef
    // Shard is fed to another friendly Reaver (locking that Reaver out of
    // faction buffs), this minion grows instead. Engine-level rule — see
    // docs/design/reef-shards.md. Recorded here as a flag the engine reads.
    passive: { onFriendlyReaverShardFed: { attack: 2, health: 2 } },
    effects: [],
    flavor: 'What the sea takes from your crew, it pays to her.',
  },

  // ---------------------------------------------------------------------
  // WYRDTIDE — gamble. Every Reef Shard fed anywhere grows the Fathom.
  // ---------------------------------------------------------------------
  {
    id: 'wyrdtide-tideling',
    name: 'Tideling',
    faction: 'wyrdtide',
    tier: 1,
    attack: 1,
    health: 2,
    cost: costForTier(1),
    keywords: [],
    effects: [
      { trigger: 'battlecry', action: { type: 'buff_self_if_shard_used', attack: 1, health: 1 } },
    ],
    flavor: 'It remembers the first shard fed to it.',
  },
  {
    id: 'wyrdtide-shard-diver',
    name: 'Shard Diver',
    faction: 'wyrdtide',
    tier: 1,
    attack: 2,
    health: 1,
    cost: costForTier(1),
    keywords: [],
    effects: [
      { trigger: 'battlecry', action: { type: 'fathom_grow', attack: 1, health: 1 } },
    ],
    flavor: 'Goes down for shards nobody else will touch.',
  },
  {
    id: 'wyrdtide-driftwood-golem',
    name: 'Driftwood Golem',
    faction: 'wyrdtide',
    tier: 1,
    attack: 3,
    health: 3,
    cost: costForTier(1),
    keywords: [],
    effects: [],
    flavor: 'No ability. Just very good at standing there.',
  },
  {
    id: 'wyrdtide-fathom-priestess',
    name: 'Fathom Priestess',
    faction: 'wyrdtide',
    tier: 2,
    attack: 2,
    health: 3,
    cost: costForTier(2),
    keywords: [],
    effects: [
      { trigger: 'battlecry', action: { type: 'gain_reef_shard' } },
    ],
    flavor: 'She can always find one more shard.',
  },
  {
    id: 'wyrdtide-tidecaller',
    name: 'Tidecaller',
    faction: 'wyrdtide',
    tier: 2,
    attack: 3,
    health: 2,
    cost: costForTier(2),
    keywords: ['taunt'],
    effects: [
      { trigger: 'on_fathom_growth', action: { type: 'buff_self', attack: 1, health: 1 } },
    ],
    flavor: 'Grows however the deep grows.',
  },
  {
    id: 'wyrdtide-barnacle-warden',
    name: 'Barnacle Warden',
    faction: 'wyrdtide',
    tier: 2,
    attack: 1,
    health: 5,
    cost: costForTier(2),
    keywords: ['taunt'],
    effects: [
      { trigger: 'deathrattle', action: { type: 'fathom_grow', attack: 2, health: 2 } },
    ],
    flavor: 'Even in death, it feeds the deep.',
  },
  {
    id: 'wyrdtide-drowned-oracle',
    name: 'The Drowned Oracle',
    faction: 'wyrdtide',
    tier: 3,
    attack: 4,
    health: 5,
    cost: costForTier(3),
    keywords: [],
    effects: [
      { trigger: 'battlecry', action: { type: 'fathom_double' } },
    ],
    flavor: 'Speaks once. The tide answers twice.',
  },
  {
    id: 'wyrdtide-reefbound-leviathan',
    name: 'Reefbound Leviathan',
    faction: 'wyrdtide',
    tier: 3,
    attack: 5,
    health: 6,
    cost: costForTier(3),
    keywords: [],
    effects: [
      { trigger: 'deathrattle', action: { type: 'fathom_to_board' } },
    ],
    flavor: 'Its death is the Fathom made flesh.',
  },

  // ---------------------------------------------------------------------
  // NEUTRAL — fits any board, never receives a faction buff.
  // ---------------------------------------------------------------------
  {
    id: 'neutral-driftwood-scavenger',
    name: 'Driftwood Scavenger',
    faction: 'neutral',
    tier: 1,
    attack: 2,
    health: 2,
    cost: costForTier(1),
    keywords: [],
    effects: [
      { trigger: 'battlecry', action: { type: 'gain_gold', amount: 1 } },
    ],
    flavor: 'One coin’s as good as the next.',
  },
  {
    id: 'neutral-old-sea-dog',
    name: 'Old Sea Dog',
    faction: 'neutral',
    tier: 1,
    attack: 3,
    health: 3,
    cost: costForTier(1),
    keywords: ['taunt'],
    effects: [],
    flavor: 'Been wrecked twice. Still first off the boat.',
  },
  {
    id: 'neutral-barrelback-turtle',
    name: 'Barrelback Turtle',
    faction: 'neutral',
    tier: 1,
    attack: 1,
    health: 4,
    cost: costForTier(1),
    keywords: [],
    effects: [
      { trigger: 'deathrattle', action: { type: 'buff_random_friendly_faction', attack: 1, health: 1, count: 1 } },
    ],
    flavor: 'Slow to fall, generous on the way down.',
  },
  {
    id: 'neutral-wandering-merchant',
    name: 'Wandering Merchant',
    faction: 'neutral',
    tier: 2,
    attack: 2,
    health: 3,
    cost: costForTier(2),
    keywords: [],
    effects: [
      { trigger: 'end_of_combat_won', action: { type: 'refresh_shop_free' } },
    ],
    flavor: 'Always has something new, if you survive to ask.',
  },
  {
    id: 'neutral-ghost-light',
    name: 'Ghost Light',
    faction: 'neutral',
    tier: 1,
    attack: 1,
    health: 1,
    cost: costForTier(1),
    keywords: [],
    effects: [
      { trigger: 'deathrattle', action: { type: 'damage_random_enemy', amount: 2 } },
    ],
    flavor: 'A warning, briefly, before it goes out.',
  },
];

export const MINION_BY_ID = Object.fromEntries(MINIONS.map((m) => [m.id, m]));

// Tuning numbers for the AI decision engine (src/engine/ai.mjs). Kept as
// plain data, separate from the engine logic, so retuning the AI's behavior
// never means touching the engine itself — same philosophy as
// src/data/minions.mjs for board content. Expect these to move during
// step 7 (Testing) once there's real play data to retune against.

// Per-keyword flat value added to a minion's heuristic score.
export const KEYWORD_VALUE = {
  taunt: 2,
};

// Per-action-type value functions for a minion's effects. Each receives the
// effect's `action` object and returns a heuristic value; multiplied by
// TRIGGER_WEIGHT below for how often that trigger actually pays off.
export const EFFECT_ACTION_VALUE = {
  buff_self: (a) => a.attack + a.health,
  buff_random_friendly_faction: (a) => (a.attack + a.health) * (a.count ?? 1) * 0.8,
  buff_all_friendly_faction: (a) => (a.attack + a.health) * 2.5, // scales with board size, flat-approximated
  summon: (a) => a.count * 2.5,
  damage_random_enemy: (a) => a.amount,
  gain_gold: (a) => a.amount * 1.5,
  trigger_bonus_shard_event: () => 2,
  fathom_grow: (a) => (a.attack + a.health) * 1.2,
  fathom_double: () => 3, // scales with existing Fathom; flat-approximated
  fathom_to_board: () => 4,
  refresh_shop_free: () => 1,
  buff_self_if_shard_used: (a) => (a.attack + a.health) * 0.5, // conditional, so discounted
};

// How much of an action's value actually gets realized, by trigger. A
// battlecry pays off in full the instant it's bought; a deathrattle only
// pays off if the minion dies; end_of_combat_won and on_fathom_growth
// recur across many rounds, so they're worth more per instance.
export const TRIGGER_WEIGHT = {
  battlecry: 1.0,
  deathrattle: 0.9,
  end_of_combat_won: 1.6,
  on_reef_shard_fed: 0.5,
  on_fathom_growth: 1.3,
};

// Reward for committing to a board's dominant (non-neutral) faction, per
// copy already on board, capped — mirrors the genre's "pick a lane" pull
// without letting it swamp raw stats entirely.
export const SYNERGY_PER_COPY = 1.5;
export const SYNERGY_CAP_COPIES = 4;

// Minimum heuristic value (score, not per-gold) a shop option needs before
// the AI will spend gold buying it outright.
export const MIN_BUY_VALUE = 3;
// How much better a shop option's value must be than the board's weakest
// minion before the AI sells that minion to make room for it.
export const SWAP_MARGIN = 2;
// A currently-unaffordable shop option is worth freezing the shop for (to
// buy next round) once its value clears this bar.
export const FREEZE_WORTHY_VALUE = 6;
// Safety caps so a pool running dry, or a degenerate shop, can't loop forever.
export const MAX_REROLLS_PER_TURN = 4;
export const MAX_BUY_ITERATIONS_PER_TURN = 30;

// Tavern-upgrade curve: the tier the AI aims to be sitting at BY this round
// (it upgrades opportunistically as soon as gold allows, once the round
// reaches the threshold). Anything past the last listed round targets the
// slice's max tier.
export const TAVERN_TARGET_TIER_BY_ROUND = [
  { round: 1, tier: 1 },
  { round: 3, tier: 2 },
  { round: 6, tier: 3 },
];
// Gold reserve the AI insists on keeping in hand after an upgrade — 0 is
// fine here since gold never carries over between rounds anyway, so
// spending it all (upgrade included) is never actually a cost.
export const UPGRADE_GOLD_RESERVE = 0;

// How well a Reef Shard ability fits a given board minion — used both to
// pick the best target for a chosen ability and to break ties between the
// three offered abilities. `m` is a board minion instance.
export const SHARD_ABILITY_FIT = {
  vampiric: (m) => m.attack * 1.5, // best on a high-attack minion that'll keep landing kills
  barnacled: (m) => (m.keywords.includes('taunt') ? 6 : 1), // best on something that keeps getting hit
  riptide: (m) => m.attack, // best on an attacker — splash value scales with how often it swings
  undying: (m) => m.health, // best on a beefy minion likely to eventually eat a killing blow
  twinned: (m) => (hasDeathrattle(m) ? 8 : 0), // dead weight without a deathrattle to double
  titanic: (m) => m.attack + m.health, // flat doubling — best on the single best minion on board
  maelstrom: (m) => (hasDeathrattle(m) ? 6 : 0), // needs a deathrattle worth copying
  // Shop-type abilities don't act on the fed minion at all — their value is
  // constant regardless of who's chosen as the (otherwise arbitrary) feed.
  shoal_call: () => 3,
  bargain_tide: () => 3,
  drowned_favor: () => 3,
};

// Heuristic penalty for locking a minion out of its faction's future buffs
// (the universal Reef Shard cost), scaled by how invested the board already
// is in that faction — losing synergy stings more the more you've committed.
export function factionLockoutPenalty(minion, board) {
  if (minion.faction === 'neutral') return 0;
  const committed = board.filter((m) => m.faction === minion.faction).length;
  return committed >= 3 ? 2 : 0.5;
}

// A Reef Shard choice below this net value (fit minus lockout penalty)
// isn't worth taking — the AI declines instead (always a free choice).
export const SHARD_DECLINE_THRESHOLD = -1;

function hasDeathrattle(minion) {
  return minion.effects.some((e) => e.trigger === 'deathrattle');
}

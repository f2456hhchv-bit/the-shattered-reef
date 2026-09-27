// Vocabulary shared by every minion's `effects` array. The combat/economy
// engine (built next, see CLAUDE.md phase log) interprets these; this file
// is the single source of truth for valid trigger and action-type strings
// so data and engine never drift apart.

export const TRIGGERS = /** @type {const} */ ([
  'battlecry',         // fires once when bought/played to the board
  'deathrattle',       // fires when this minion dies
  'end_of_combat_won', // fires after a combat this minion's board won, if it survived
  'on_reef_shard_fed', // fires on the minion a Reef Shard is fed to
  'on_fathom_growth',  // fires on every Wyrdtide minion with this trigger whenever the Fathom's stats increase
]);

export const KEYWORDS = /** @type {const} */ ([
  'taunt', // must be attacked first if any Taunt minion is on the board
]);

// Action-type vocabulary for the `action` object inside an effect.
// Each type's extra fields are documented inline where minions use them.
export const ACTION_TYPES = /** @type {const} */ ([
  'buff_self',                    // { attack, health }
  'buff_random_friendly_faction', // { attack, health, count? } — count defaults to 1
  'buff_all_friendly_faction',    // { attack, health }
  'summon',                       // { minionId, count }
  'damage_random_enemy',          // { amount }
  'gain_gold',                    // { amount }
  'gain_reef_shard',              // adds a Reef Shard to the shop/hand — no extra fields
  'fathom_grow',                  // { attack, health } — grows the caster's Fathom by this much
  'fathom_double',                // doubles the caster's current Fathom stats — no extra fields
  'fathom_to_board',               // spawns a minion with the Fathom's current stats — no extra fields
  'refresh_shop_free',             // next shop refresh this turn costs no gold — no extra fields
  'buff_self_if_shard_used',       // { attack, health } — only if the player has fed a Reef Shard this game
]);

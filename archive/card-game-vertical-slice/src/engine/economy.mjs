// Shop/economy engine. Owns everything that happens outside a fight:
// income, the shop, buying/selling/rerolling/upgrading, and Reef Shard
// events (see docs/design/reef-shards.md for the locked design this
// implements). Combat itself lives in combat.mjs and knows nothing about
// gold or the shop — the two only meet through a minion instance handed
// from one to the other.
//
// The five Board-type shard abilities (Vampiric, Barnacled, Riptide, Undying,
// Twinned, Maelstrom) are recorded here as tags on the instance
// (`instance.shardAbilities`) and interpreted during a fight by combat.mjs.
// Titanic is the exception — it doubles base stats immediately, below.

import { MINIONS, MINION_BY_ID, instantiate } from '../data/minions.mjs';

let idCounter = 0;
const nextInstanceId = (defId) => `${defId}-${++idCounter}`;

// --- Tavern tier tuning (approximate, matched to genre feel, not measured
// against a live game — expect to retune once step 7, Testing, has real
// play data) ---
const TAVERN_ODDS = {
  1: { 1: 1 },
  2: { 1: 0.7, 2: 0.3 },
  3: { 1: 0.4, 2: 0.4, 3: 0.2 },
};
const UPGRADE_COST = { 1: 5, 2: 7 }; // cost to go FROM this tier to the next
export const MAX_TAVERN_TIER = 3; // slice cap — tiers 4-6 don't exist yet (Content phase)
export const BOARD_CAP = 7;
const SHOP_SIZE = 3;
const REROLL_BASE_COST = 1;
const SELL_VALUE = 1;
const TRIPLE_COPIES_REQUIRED = 3;
// The "prize" for tripling: a small permanent reward on top of the golden
// minion itself, landing on a random OTHER friendly minion so tripling
// pays off even when the golden slot itself is already great. Falls back
// to a gold bonus if there's nothing else on the board to buff.
const TRIPLE_PRIZE_BUFF = { attack: 1, health: 1 };
const TRIPLE_PRIZE_GOLD_FALLBACK = 2;

// Exported so callers (the AI engine, tests) never have to re-derive these
// from the raw constants above — single source of truth.
export function rerollCost(state) {
  return Math.max(REROLL_BASE_COST - state.rerollDiscount, 0);
}
// What a reroll will actually cost right now, accounting for a banked free
// refresh (Wandering Merchant) — distinct from rerollCost() because the
// bank is spent on the very next refreshShop() call regardless of gold, so
// any caller deciding "can/should I reroll" needs this, not the raw cost.
export function effectiveRerollCost(state) {
  return state.freeRerollBanked > 0 ? 0 : rerollCost(state);
}
export function nextUpgradeCost(state) {
  return UPGRADE_COST[state.tavernTier];
}

const incomeForRound = (round) => Math.min(round + 2, 10);
export const isReefShardRound = (round) => round >= 3 && (round - 3) % 4 === 0;
const shardTierForRound = (round) => (round <= 10 ? 'lesser' : 'greater');

// --- Shared pool: every minion definition has a fixed number of copies,
// contested by every player at the table (AI included, once step 4 wires
// them in). Counts are a simplification for the slice's 2-faction scope —
// real Battlegrounds scales copy counts by minion tier for an 8-player
// lobby; these are in that spirit, not copied exactly. ---
const COPIES_BY_TIER = { 1: 16, 2: 14, 3: 12 };

export function createSharedPool() {
  const counts = {};
  for (const m of MINIONS) counts[m.id] = COPIES_BY_TIER[m.tier];
  return { counts };
}

function takeFromPool(pool, defId) {
  if (pool.counts[defId] > 0) pool.counts[defId] -= 1;
}
function returnToPool(pool, defId) {
  pool.counts[defId] += 1;
}

function minionsOfTier(tier) {
  return MINIONS.filter((m) => m.tier === tier);
}

// --- Player state ---

export function createPlayerState() {
  return {
    health: 25,
    gold: 0,
    maxGold: 0,
    tavernTier: 1,
    board: [],
    shop: [], // array of { defId } | null (null = empty/bought slot until next refresh)
    frozen: false,
    fathom: { attack: 0, health: 0 },
    shopBonusSlots: 0,     // from Shoal Call
    shopBiasFaction: null, // from Shoal Call, set at feed time
    rerollDiscount: 0,     // from Bargain Tide
    guaranteedFactionActive: false, // from Drowned Favor
    pendingBonusShardEvents: 0, // queued by Fathom Priestess's battlecry
    freeRerollBanked: 0, // from Wandering Merchant's end_of_combat_won (refresh_shop_free)
    lastTripleEvents: [], // set by buyMinion when a buy completes a triple — see checkAndApplyTriples
  };
}

// --- Triples: Battlegrounds' core progression mechanic. Cards don't die on
// their own between rounds — they sit on the board until sold or lost in a
// fight — and buying a 3rd copy of a minion you already have 2 of merges
// all three into one Golden minion (double base stats, one board slot
// instead of three) plus a small permanent prize buff elsewhere on the
// board, so investing in a card pays off beyond just "a bigger stat line".
// Golden copies never re-triple (there's no 4th tier in the slice).
function goldenInstance(defId) {
  const def = MINION_BY_ID[defId];
  const instance = instantiate(defId, nextInstanceId(defId));
  instance.attack = def.attack * 2;
  instance.health = def.health * 2;
  instance.maxHealth = def.health * 2;
  instance.golden = true;
  return instance;
}

// Scans the board for any defId with 3+ non-golden copies and merges them.
// Runs in a loop so multiple simultaneous triples (e.g. two different
// buys landing at once via a future bulk-add) all resolve. Returns a list
// of { defId, name, prizeTargetName | prizeGold } describing what happened,
// for the UI to celebrate.
export function checkAndApplyTriples(state) {
  const events = [];
  let again = true;
  while (again) {
    again = false;
    const counts = {};
    for (const m of state.board) {
      if (m.golden) continue;
      (counts[m.defId] ??= []).push(m);
    }
    const tripled = Object.entries(counts).find(([, copies]) => copies.length >= TRIPLE_COPIES_REQUIRED);
    if (!tripled) break;
    const [defId, copies] = tripled;
    const merging = copies.slice(0, TRIPLE_COPIES_REQUIRED);
    const mergingIds = new Set(merging.map((m) => m.instanceId));
    const earliestIndex = state.board.findIndex((m) => mergingIds.has(m.instanceId));

    // Carry forward any Reef Shard board abilities already earned by the
    // merging copies rather than discarding them — losing an ability you
    // fed a shard into would feel punishing for the "wrong" reason (the
    // triple should always feel like a reward, never a cost).
    const carriedAbilities = [...new Set(merging.flatMap((m) => m.shardAbilities ?? []))];
    const golden = goldenInstance(defId);
    if (carriedAbilities.length) golden.shardAbilities = carriedAbilities;

    state.board = state.board.filter((m) => !mergingIds.has(m.instanceId));
    state.board.splice(Math.min(earliestIndex, state.board.length), 0, golden);

    const others = state.board.filter((m) => m !== golden);
    const event = { defId, name: MINION_BY_ID[defId].name, instanceId: golden.instanceId };
    if (others.length) {
      const target = others[Math.floor(Math.random() * others.length)];
      target.attack += TRIPLE_PRIZE_BUFF.attack;
      target.health += TRIPLE_PRIZE_BUFF.health;
      target.maxHealth += TRIPLE_PRIZE_BUFF.health;
      event.prizeTargetName = MINION_BY_ID[target.defId].name;
    } else {
      state.gold += TRIPLE_PRIZE_GOLD_FALLBACK;
      event.prizeGold = TRIPLE_PRIZE_GOLD_FALLBACK;
    }
    events.push(event);
    again = true; // in case this merge somehow exposed another (defensive; not expected at 7-slot board scale)
  }
  return events;
}

function mostCommonFaction(board) {
  const counts = {};
  for (const m of board) {
    if (m.faction === 'neutral') continue;
    counts[m.faction] = (counts[m.faction] ?? 0) + 1;
  }
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function weightedTierPick(tavernTier, rng) {
  const odds = TAVERN_ODDS[tavernTier];
  const roll = rng();
  let acc = 0;
  for (const [tier, weight] of Object.entries(odds)) {
    acc += weight;
    if (roll < acc) return Number(tier);
  }
  return Number(Object.keys(odds)[0]); // fallback, floating point safety
}

// Draws one shop slot: picks a tier per the odds table, then a random
// minion of that tier with stock remaining. `biasFaction`/`forceFaction`
// narrow the candidate list before picking, for Shoal Call/Drowned Favor.
function drawShopSlot(state, pool, rng, { forceFaction = null } = {}) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const tier = weightedTierPick(Math.min(state.tavernTier, 3), rng);
    let candidates = minionsOfTier(tier).filter((m) => pool.counts[m.id] > 0);
    if (forceFaction) {
      const narrowed = candidates.filter((m) => m.faction === forceFaction);
      if (narrowed.length) candidates = narrowed;
    } else if (state.shopBiasFaction && rng() < 0.5) {
      const narrowed = candidates.filter((m) => m.faction === state.shopBiasFaction);
      if (narrowed.length) candidates = narrowed;
    }
    if (!candidates.length) continue;
    const pick = candidates[Math.floor(rng() * candidates.length)];
    takeFromPool(pool, pick.id);
    return pick.id;
  }
  return null; // pool exhausted across every tier — extremely unlikely at slice scale
}

export function refreshShop(state, pool, rng, { free = false } = {}) {
  if (!free && state.freeRerollBanked > 0) {
    state.freeRerollBanked -= 1; // Wandering Merchant's banked free refresh, spent here
  } else if (!free) {
    const cost = rerollCost(state);
    if (state.gold < cost) throw new Error('Not enough gold to reroll');
    state.gold -= cost;
  }
  // Return every unsold slot to the pool before drawing new ones.
  for (const slot of state.shop) {
    if (slot) returnToPool(pool, slot.defId);
  }
  const size = SHOP_SIZE + state.shopBonusSlots;
  const newShop = [];
  let forcedFactionThisRefresh = state.guaranteedFactionActive
    ? mostCommonFaction(state.board)
    : null;
  for (let i = 0; i < size; i++) {
    const forceFaction = forcedFactionThisRefresh;
    const defId = drawShopSlot(state, pool, rng, { forceFaction });
    if (defId && forceFaction) forcedFactionThisRefresh = null; // only guarantee one slot
    newShop.push(defId ? { defId } : null);
  }
  state.shop = newShop;
  state.frozen = false;
}

export function freezeShop(state) {
  state.frozen = true;
}

// --- Battlecry handling (shop-phase triggers; deathrattle/end-of-combat
// live in combat.mjs) ---
function runBattlecry(state, minion) {
  for (const e of minion.effects) {
    if (e.trigger !== 'battlecry') continue;
    const a = e.action;
    if (a.type === 'buff_random_friendly_faction') {
      const pool = state.board.filter((m) =>
        m !== minion && (minion.faction === 'neutral' ? true : m.faction === minion.faction)
      );
      for (let i = 0; i < (a.count ?? 1) && pool.length; i++) {
        const t = pool[Math.floor(Math.random() * pool.length)];
        t.attack += a.attack;
        t.health += a.health;
        t.maxHealth += a.health; // permanent buff — keep Vampiric's "full health" in sync
      }
    } else if (a.type === 'buff_all_friendly_faction') {
      for (const m of state.board) {
        if (m !== minion && m.faction === minion.faction) {
          m.attack += a.attack;
          m.health += a.health;
          m.maxHealth += a.health;
        }
      }
    } else if (a.type === 'buff_self_if_shard_used') {
      if (state.fathom.attack > 0 || state.fathom.health > 0) {
        minion.attack += a.attack;
        minion.health += a.health;
        minion.maxHealth += a.health;
      }
    } else if (a.type === 'fathom_grow') {
      state.fathom.attack += a.attack;
      state.fathom.health += a.health;
    } else if (a.type === 'gain_gold') {
      state.gold += a.amount;
    } else if (a.type === 'trigger_bonus_shard_event') {
      state.pendingBonusShardEvents += 1;
    }
  }
}

export function buyMinion(state, shopIndex) {
  const slot = state.shop[shopIndex];
  if (!slot) throw new Error('That shop slot is empty');
  const def = MINION_BY_ID[slot.defId];
  if (state.gold < def.cost) throw new Error('Not enough gold');
  if (state.board.length >= BOARD_CAP) throw new Error('Board is full');
  state.gold -= def.cost;
  state.shop[shopIndex] = null;
  const instance = instantiate(def.id, nextInstanceId(def.id));
  state.board.push(instance);
  runBattlecry(state, instance);
  state.lastTripleEvents = checkAndApplyTriples(state);
  return instance;
}

export function sellMinion(state, pool, instanceId) {
  const idx = state.board.findIndex((m) => m.instanceId === instanceId);
  if (idx === -1) throw new Error('That minion is not on your board');
  const [minion] = state.board.splice(idx, 1);
  returnToPool(pool, minion.defId);
  state.gold += SELL_VALUE;
  return minion;
}

export function upgradeTavern(state) {
  if (state.tavernTier >= MAX_TAVERN_TIER) throw new Error('Already at the vertical slice\'s tavern cap');
  const cost = nextUpgradeCost(state);
  if (state.gold < cost) throw new Error('Not enough gold to upgrade');
  state.gold -= cost;
  state.tavernTier += 1;
}

// Call once at the start of every round, before the player acts.
export function startRound(state, pool, round, rng) {
  state.maxGold = incomeForRound(round);
  state.gold = state.maxGold;
  if (!state.frozen) {
    refreshShop(state, pool, rng, { free: true });
  } else {
    state.frozen = false; // freeze is single-use: keeps this round's shop, then releases
  }
}

// --- Reef Shard events ---

export const SHARD_ABILITIES = {
  lesser: [
    { id: 'vampiric', type: 'board', label: 'Vampiric', text: 'Heals to full whenever it kills an enemy minion.' },
    { id: 'barnacled', type: 'board', label: 'Barnacled', text: '+1/+1 permanently, every combat it’s attacked and survives.' },
    { id: 'riptide', type: 'board', label: 'Riptide', text: 'Attacking also splashes 1 damage to a second random enemy.' },
    { id: 'shoal_call', type: 'shop', label: 'Shoal Call', text: 'Shop gains one extra slot, biased to your most-common faction, for the rest of the run.' },
    { id: 'bargain_tide', type: 'shop', label: 'Bargain Tide', text: 'Shop rerolls cost 1 less gold for the rest of the run.' },
  ],
  greater: [
    { id: 'twinned', type: 'board', label: 'Twinned', text: 'Deathrattle fires twice.' },
    { id: 'titanic', type: 'board', label: 'Titanic', text: 'Doubles this minion’s attack and health, immediately.' },
    { id: 'undying', type: 'board', label: 'Undying', text: 'Survives its first lethal hit each combat, at 1 health.' },
    { id: 'drowned_favor', type: 'shop', label: 'Drowned Favor', text: 'Shop always includes a minion of your most-common faction, for the rest of the run.' },
    { id: 'maelstrom', type: 'board', label: 'Maelstrom', text: 'Deathrattle also copies itself onto two random friendly minions, permanently.' },
  ],
};

// Offers a choice of 3 for the given round, without repeats. Pure — call
// applyReefShardChoice() with the player's pick to actually resolve it.
export function offerReefShardChoices(round, rng) {
  const tier = shardTierForRound(round);
  const source = [...SHARD_ABILITIES[tier]];
  const choices = [];
  for (let i = 0; i < 3 && source.length; i++) {
    const idx = Math.floor(rng() * source.length);
    choices.push(source.splice(idx, 1)[0]);
  }
  return choices;
}

// Applies a chosen ability to a chosen board minion. `ability` is one of
// the objects offerReefShardChoices() returned (or looked up by id from
// SHARD_ABILITIES). Handles the universal cost (faction-buff lockout),
// the universal Fathom growth, and The Kraken's Due's exception.
export function applyReefShardChoice(state, instanceId, ability) {
  const minion = state.board.find((m) => m.instanceId === instanceId);
  if (!minion) throw new Error('That minion is not on your board');

  if (ability.type === 'board') {
    minion.shardAbilities = minion.shardAbilities ?? [];
    if (ability.id === 'titanic') {
      minion.attack *= 2;
      minion.health *= 2;
      minion.maxHealth *= 2;
    } else {
      minion.shardAbilities.push(ability.id);
    }
  } else if (ability.id === 'shoal_call') {
    state.shopBonusSlots += 1;
    state.shopBiasFaction = mostCommonFaction(state.board);
  } else if (ability.id === 'bargain_tide') {
    state.rerollDiscount += 1;
  } else if (ability.id === 'drowned_favor') {
    state.guaranteedFactionActive = true;
  }

  minion.shardLocked = true;
  state.fathom.attack += 1;
  state.fathom.health += 1;

  // The Kraken's Due: any OTHER friendly Reaver on the board grows it.
  if (minion.faction === 'blacksail-reavers') {
    for (const other of state.board) {
      if (other === minion) continue;
      const def = MINION_BY_ID[other.defId];
      if (def.passive?.onFriendlyReaverShardFed) {
        other.attack += def.passive.onFriendlyReaverShardFed.attack;
        other.health += def.passive.onFriendlyReaverShardFed.health;
        other.maxHealth += def.passive.onFriendlyReaverShardFed.health;
      }
    }
  }

  return minion;
}

// The AI decision engine. Sits on top of economy.mjs (shop/buy/sell/upgrade)
// exactly the way a human player's inputs would — it never reaches into
// player state directly except through economy.mjs's own exported
// functions, so an AI-controlled player and a human-controlled player are
// indistinguishable to every other system (combat, the shared pool, other
// AI opponents at the table).
//
// Key economic fact this engine is built around: gold does NOT carry over
// between rounds (see economy.mjs's startRound — gold resets to maxGold
// every round). So there is no "banking" strategy here, unlike some genre
// entries where saving gold across turns is viable — hoarding is strictly
// wasteful. The engine's guiding rule is therefore simple: spend the whole
// budget, every round, on whatever converts it to the most future value
// (upgrading, buying, or — if the current shop has nothing worth it —
// rerolling to look for something that is), and freeze only when there's a
// good card in the shop the AI can't yet afford, so it survives to next
// round's bigger budget instead of being rerolled away for nothing.

import {
  buyMinion, sellMinion, refreshShop, freezeShop, upgradeTavern,
  effectiveRerollCost, nextUpgradeCost, BOARD_CAP, MAX_TAVERN_TIER,
} from './economy.mjs';
import { MINION_BY_ID } from '../data/minions.mjs';
import {
  KEYWORD_VALUE, EFFECT_ACTION_VALUE, TRIGGER_WEIGHT,
  SYNERGY_PER_COPY, SYNERGY_CAP_COPIES,
  MIN_BUY_VALUE, SWAP_MARGIN, FREEZE_WORTHY_VALUE,
  MAX_REROLLS_PER_TURN, MAX_BUY_ITERATIONS_PER_TURN,
  TAVERN_TARGET_TIER_BY_ROUND, UPGRADE_GOLD_RESERVE,
  SHARD_ABILITY_FIT, factionLockoutPenalty, SHARD_DECLINE_THRESHOLD,
} from '../data/ai-tuning.mjs';

// Raw heuristic value of a minion's stat line + keywords + effects, with no
// board context. Works on either a board instance or a raw MINIONS
// definition — both share the same attack/health/keywords/effects shape,
// so a shop slot's def can be scored without instantiating it.
export function scoreMinion(minionOrDef) {
  let score = minionOrDef.attack + minionOrDef.health;
  for (const kw of minionOrDef.keywords) score += KEYWORD_VALUE[kw] ?? 0;
  for (const e of minionOrDef.effects) {
    const actionValue = EFFECT_ACTION_VALUE[e.action.type];
    if (!actionValue) continue;
    const weight = TRIGGER_WEIGHT[e.trigger] ?? 1;
    score += actionValue(e.action) * weight;
  }
  return score;
}

// Reward for adding to (or already having) a board's committed faction —
// the pull toward "pick a lane" synergy rather than a pile of unrelated
// good stats.
export function synergyBonus(faction, board) {
  if (faction === 'neutral') return 0;
  const copies = board.filter((m) => m.faction === faction).length;
  return Math.min(copies, SYNERGY_CAP_COPIES) * SYNERGY_PER_COPY;
}

function totalValue(minionOrDef, board) {
  return scoreMinion(minionOrDef) + synergyBonus(minionOrDef.faction, board);
}

function weakestOnBoard(board) {
  if (!board.length) return null;
  return board.reduce((worst, m) => (totalValue(m, board) < totalValue(worst, board) ? m : worst));
}

// Every shop slot, scored, whether or not the AI can currently afford it —
// callers filter as needed (buying only looks at affordable ones; the
// freeze decision specifically looks at the unaffordable ones).
function shopOptions(state) {
  const options = [];
  state.shop.forEach((slot, index) => {
    if (!slot) return;
    const def = MINION_BY_ID[slot.defId];
    options.push({
      index,
      defId: def.id,
      cost: def.cost,
      affordable: state.gold >= def.cost,
      value: totalValue(def, state.board),
    });
  });
  return options;
}

function tavernTargetTier(round) {
  let target = 1;
  for (const step of TAVERN_TARGET_TIER_BY_ROUND) {
    if (round >= step.round) target = step.tier;
  }
  return Math.min(target, MAX_TAVERN_TIER);
}

function tryUpgradeTavern(state, round, log) {
  while (state.tavernTier < tavernTargetTier(round) && state.tavernTier < MAX_TAVERN_TIER) {
    const cost = nextUpgradeCost(state);
    if (state.gold - cost < UPGRADE_GOLD_RESERVE) break;
    upgradeTavern(state);
    log.push({ type: 'upgrade', tavernTier: state.tavernTier });
  }
}

// One AI-controlled player's full shopping phase for a round. Mutates
// `state` via economy.mjs's own functions (never directly) and returns a
// log of what it did, for tests and for a future UI to narrate.
export function runAiTurn(state, pool, round, rng) {
  const log = [];
  tryUpgradeTavern(state, round, log);

  let rerolls = 0;
  for (let iteration = 0; iteration < MAX_BUY_ITERATIONS_PER_TURN; iteration++) {
    const options = shopOptions(state);
    const affordable = options.filter((o) => o.affordable).sort((a, b) => b.value - a.value);
    const best = affordable[0];

    if (best && best.value >= MIN_BUY_VALUE) {
      if (state.board.length < BOARD_CAP) {
        buyMinion(state, best.index);
        log.push({ type: 'buy', defId: best.defId, value: best.value });
        continue;
      }
      const weakest = weakestOnBoard(state.board);
      if (weakest && best.value > totalValue(weakest, state.board) + SWAP_MARGIN) {
        sellMinion(state, pool, weakest.instanceId);
        buyMinion(state, best.index);
        log.push({ type: 'swap', sold: weakest.defId, bought: best.defId });
        continue;
      }
    }

    // Nothing worth buying (or swapping in) right now. If the shop is
    // holding something good we simply can't afford yet, freeze it for
    // next round's bigger budget instead of throwing it away on a reroll.
    const unaffordableKeeper = options.find((o) => !o.affordable && o.value >= FREEZE_WORTHY_VALUE);
    if (unaffordableKeeper && !state.frozen) {
      freezeShop(state);
      log.push({ type: 'freeze', defId: unaffordableKeeper.defId, value: unaffordableKeeper.value });
      break;
    }

    // Otherwise the current shop is worth nothing to us — since unspent
    // gold is wasted at round end, reroll and try again rather than sit on it.
    const cost = effectiveRerollCost(state);
    if (rerolls < MAX_REROLLS_PER_TURN && state.gold >= cost) {
      refreshShop(state, pool, rng);
      rerolls += 1;
      log.push({ type: 'reroll' });
      continue;
    }
    break;
  }

  return log;
}

// Decides how to handle a Reef Shard offer for an AI-controlled player.
// `choices` is whatever offerReefShardChoices() returned. Returns
// { ability, instanceId } to feed, or null to decline (always a valid,
// free choice — see docs/design/reef-shards.md).
export function chooseReefShardPick(state, choices) {
  if (!state.board.length) return null;

  let best = null;
  for (const ability of choices) {
    const fitFn = SHARD_ABILITY_FIT[ability.id] ?? (() => 1);
    for (const minion of state.board) {
      const net = fitFn(minion) - factionLockoutPenalty(minion, state.board);
      if (!best || net > best.net) best = { ability, instanceId: minion.instanceId, net };
    }
  }

  if (!best || best.net < SHARD_DECLINE_THRESHOLD) return null;
  return { ability: best.ability, instanceId: best.instanceId };
}

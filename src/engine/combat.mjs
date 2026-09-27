// The combat simulator. Pure function: two boards (+ each player's current
// Fathom) go in, a full resolution comes out. Never touches the DOM, never
// touches economy/shop state directly — anything that reaches outside the
// fight itself (growing a persistent Fathom, a free shop refresh) is
// returned as an `externalEffects` entry for the caller to apply, so this
// module stays testable headless and has no hidden dependencies.
//
// Simplifications explicitly accepted for the vertical slice (revisit only
// if a future card needs otherwise — see CLAUDE.md decisions log):
//   - Deathrattle summons are appended to the end of the board array, not
//     inserted at the dead minion's exact slot.
//   - No Divine Shield / Windfury / Stealth — the slice's 21 cards don't
//     use them, so there are no handlers for them yet.
//   - Reef Shard lockout (a shard-fed minion skipped by faction buffs) is
//     not enforced here yet — none of the slice's deathrattle/end-of-combat
//     effects are faction buffs that would need it (buff_random_friendly_
//     faction only fires from Barrelback Turtle, a neutral). Add the check
//     to applyBuffRandomFriendlyFaction() when a card needs it.

import { instantiate } from '../data/minions.mjs';

let summonCounter = 0;
const nextSummonId = (defId) => `${defId}-summon-${++summonCounter}`;

function cloneInstance(m) {
  return { ...m, keywords: [...m.keywords], effects: m.effects.map((e) => ({ ...e, action: { ...e.action } })) };
}

function aliveOf(board) {
  return board.filter((m) => m.health > 0);
}

function decideFirstAttacker(boardA, boardB, rng) {
  const a = aliveOf(boardA).length;
  const b = aliveOf(boardB).length;
  if (a > b) return 'A';
  if (b > a) return 'B';
  return rng() < 0.5 ? 'A' : 'B';
}

function pickNextAttacker(board, cursor) {
  if (board.length === 0) return null;
  for (let step = 0; step < board.length; step++) {
    const idx = (cursor.idx + step) % board.length;
    if (board[idx].health > 0) {
      cursor.idx = idx + 1;
      return board[idx];
    }
  }
  return null;
}

function pickDefender(board, rng) {
  const alive = aliveOf(board);
  const taunts = alive.filter((m) => m.keywords.includes('taunt'));
  const pool = taunts.length ? taunts : alive;
  return pool[Math.floor(rng() * pool.length)];
}

function applyDamageRandomEnemy(sourceSide, boards, amount, rng, log) {
  const enemySide = sourceSide === 'A' ? 'B' : 'A';
  const alive = aliveOf(boards[enemySide]);
  if (!alive.length) return;
  const target = alive[Math.floor(rng() * alive.length)];
  target.health -= amount;
  log.push({ type: 'deathrattle_damage', side: enemySide, targetId: target.instanceId, amount });
}

function applyBuffRandomFriendlyFaction(sourceSide, sourceMinion, boards, attack, health, count, rng, log) {
  const pool = aliveOf(boards[sourceSide]).filter((m) =>
    sourceMinion.faction === 'neutral' ? true : m.faction === sourceMinion.faction
  );
  for (let i = 0; i < count && pool.length; i++) {
    const target = pool[Math.floor(rng() * pool.length)];
    target.attack += attack;
    target.health += health;
    log.push({ type: 'deathrattle_buff', side: sourceSide, targetId: target.instanceId, attack, health });
  }
}

function applyFathomGrowth(side, boards, fathom, attack, health, externalEffects, log) {
  fathom[side].attack += attack;
  fathom[side].health += health;
  externalEffects.push({ owner: side, type: 'fathom_grow', attack, health });
  log.push({ type: 'fathom_grow', side, attack, health, total: { ...fathom[side] } });
  for (const m of aliveOf(boards[side])) {
    for (const e of m.effects) {
      if (e.trigger === 'on_fathom_growth' && e.action.type === 'buff_self') {
        m.attack += e.action.attack;
        m.health += e.action.health;
        log.push({ type: 'fathom_reaction_buff', side, targetId: m.instanceId, attack: e.action.attack, health: e.action.health });
      }
    }
  }
}

function runDeathrattle(minion, side, boards, fathom, rng, externalEffects, log) {
  for (const e of minion.effects) {
    if (e.trigger !== 'deathrattle') continue;
    const a = e.action;
    if (a.type === 'damage_random_enemy') {
      applyDamageRandomEnemy(side, boards, a.amount, rng, log);
    } else if (a.type === 'summon') {
      for (let i = 0; i < a.count; i++) {
        boards[side].push(instantiate(a.minionId, nextSummonId(a.minionId)));
      }
      log.push({ type: 'summon', side, minionId: a.minionId, count: a.count });
    } else if (a.type === 'buff_random_friendly_faction') {
      applyBuffRandomFriendlyFaction(side, minion, boards, a.attack, a.health, a.count ?? 1, rng, log);
    } else if (a.type === 'fathom_grow') {
      applyFathomGrowth(side, boards, fathom, a.attack, a.health, externalEffects, log);
    }
  }
}

// Sweeps both boards for minions at 0 health, removes them and fires their
// deathrattles, repeating until a full pass finds nothing new — so a chain
// reaction (a deathrattle damage killing a second minion) fully resolves
// before combat continues.
function processDeaths(boards, fathom, rng, externalEffects, log) {
  let foundAny = true;
  while (foundAny) {
    foundAny = false;
    for (const side of ['A', 'B']) {
      const dead = boards[side].filter((m) => m.health <= 0);
      if (!dead.length) continue;
      boards[side] = boards[side].filter((m) => m.health > 0);
      for (const m of dead) {
        log.push({ type: 'death', side, instanceId: m.instanceId, defId: m.defId });
        runDeathrattle(m, side, boards, fathom, rng, externalEffects, log);
        foundAny = true;
      }
    }
  }
}

function runEndOfCombatWon(winnerSide, boards, externalEffects, log) {
  for (const m of aliveOf(boards[winnerSide])) {
    for (const e of m.effects) {
      if (e.trigger !== 'end_of_combat_won') continue;
      const a = e.action;
      if (a.type === 'buff_self') {
        m.attack += a.attack;
        m.health += a.health;
        log.push({ type: 'end_of_combat_buff', side: winnerSide, targetId: m.instanceId, attack: a.attack, health: a.health });
      } else if (a.type === 'refresh_shop_free') {
        externalEffects.push({ owner: winnerSide, type: 'refresh_shop_free' });
      }
    }
  }
}

/**
 * @param {object[]} boardA minion instances (see instantiate()), full health for this round
 * @param {object[]} boardB minion instances, full health for this round
 * @param {object} [options]
 * @param {() => number} [options.rng] injectable RNG for deterministic tests; defaults to Math.random
 * @param {{attack:number, health:number}} [options.fathomA] player A's current Fathom
 * @param {{attack:number, health:number}} [options.fathomB] player B's current Fathom
 */
export function simulateCombat(boardA, boardB, options = {}) {
  const rng = options.rng ?? Math.random;
  const boards = {
    A: boardA.map(cloneInstance),
    B: boardB.map(cloneInstance),
  };
  const fathom = {
    A: { ...(options.fathomA ?? { attack: 0, health: 0 }) },
    B: { ...(options.fathomB ?? { attack: 0, health: 0 }) },
  };
  const externalEffects = [];
  const log = [];
  const cursor = { A: { idx: 0 }, B: { idx: 0 } };

  if (boards.A.length === 0 || boards.B.length === 0) {
    // An empty board fights nothing — resolve immediately as a loss/draw.
    const winner = boards.A.length === boards.B.length ? 'draw' : boards.A.length ? 'A' : 'B';
    return finish(winner);
  }
  processDeaths(boards, fathom, rng, externalEffects, log); // in case either input board arrived at 0 health

  let attackerSide = decideFirstAttacker(boards.A, boards.B, rng);
  let guard = 0; // safety valve against an unforeseen infinite loop in future content
  while (aliveOf(boards.A).length > 0 && aliveOf(boards.B).length > 0 && guard++ < 500) {
    const defenderSide = attackerSide === 'A' ? 'B' : 'A';
    const attacker = pickNextAttacker(boards[attackerSide], cursor[attackerSide]);
    if (!attacker) break;
    const defender = pickDefender(boards[defenderSide], rng);
    if (!defender) break;
    defender.health -= attacker.attack;
    attacker.health -= defender.attack;
    log.push({
      type: 'attack', attackerSide, attackerId: attacker.instanceId,
      defenderId: defender.instanceId, damageToDefender: attacker.attack, damageToAttacker: defender.attack,
    });
    processDeaths(boards, fathom, rng, externalEffects, log);
    attackerSide = defenderSide;
  }

  const aliveA = aliveOf(boards.A).length;
  const aliveB = aliveOf(boards.B).length;
  const winner = aliveA === aliveB ? 'draw' : aliveA > 0 ? 'A' : 'B';
  return finish(winner);

  function finish(winner) {
    let damageToLoser = 0;
    if (winner !== 'draw') {
      runEndOfCombatWon(winner, boards, externalEffects, log);
      const survivors = aliveOf(boards[winner]);
      damageToLoser = survivors.reduce((sum, m) => sum + m.tier, 0);
    }
    return {
      winner,
      damageToLoser,
      boardA: aliveOf(boards.A),
      boardB: aliveOf(boards.B),
      fathomA: fathom.A,
      fathomB: fathom.B,
      externalEffects,
      log,
    };
  }
}

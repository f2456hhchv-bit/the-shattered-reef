// The round loop: the piece that turns "a shop engine, a combat simulator,
// and an AI" into an actual multiplayer match. Pure-ish and headless-
// testable, per the build order — nothing here touches the DOM.
//
// One round, for every lobby, is:
//   1. Shop phase — every alive player buys/sells/rerolls/upgrades from the
//      SAME shared pool (economy.createSharedPool — this is one contested
//      pool for the whole lobby, not one per player, matching the genre).
//      AI players resolve instantly via ai.runAiTurn; the human player acts
//      through the UI and calls economy.mjs's functions directly, so this
//      module never has to know a human is even in the lobby.
//   2. Reef Shard phase, only on isReefShardRound(round) — AI players
//      resolve instantly via ai.chooseReefShardPick; the human player's
//      choice is supplied by the caller (the UI presents the picker and
//      passes the result in), because this module has no UI of its own.
//   3. Combat phase — alive players are paired up (see pairPlayers below)
//      and every pair fights via combat.simulateCombat. Losers take
//      damageToLoser; Fathom/refresh-shop external effects are applied
//      back onto each player's own state; a lone unpaired player gets a
//      bye (no fight, no damage) rather than being forced to sit out
//      permanently.
//   4. Elimination — any player at 0 health is marked dead and drops out
//      of all future pairings. The match ends once one player remains.
//
// Health persistence rule (a design decision this module owns, since
// neither the PRD nor reef-shards.md specifies it yet): a minion that
// survives a fight heals back to its maxHealth at the start of the next
// round — permanent buffs (which also raise maxHealth) persist, only the
// damage taken during that one fight is wiped. A minion that dies is gone
// for good; a deathrattle summon that survives its birth fight persists
// like any other minion from then on.

import { simulateCombat } from './combat.mjs';
import { startRound, isReefShardRound, offerReefShardChoices, applyReefShardChoice } from './economy.mjs';
import { runAiTurn, chooseReefShardPick } from './ai.mjs';

export function createLobby(playerDefs, pool) {
  // playerDefs: [{ id, name, isHuman, state }] — state from
  // economy.createPlayerState(), already constructed by the caller so it
  // can tell a human's state apart from an AI's.
  return {
    pool,
    players: playerDefs.map((p) => ({ ...p, lastOpponentId: null, eliminatedRound: null })),
    round: 0,
  };
}

export function alivePlayers(lobby) {
  return lobby.players.filter((p) => p.state.health > 0);
}

// Heals every surviving minion back to full and starts the shop round for
// every still-alive player (income, shop refresh unless frozen). Shop
// order is shuffled each round — the shared pool means whoever shops first
// gets first pick of contested copies, so always going in the same order
// would quietly favor one seat.
export function beginRound(lobby, round, rng) {
  lobby.round = round;
  const order = shuffle(alivePlayers(lobby), rng);
  for (const player of order) {
    for (const m of player.state.board) m.health = m.maxHealth;
    startRound(player.state, lobby.pool, round, rng);
  }
  return order;
}

// Runs every AI player's shop turn. The human player is left untouched —
// the caller (UI) drives the human's shop actions directly through
// economy.mjs before calling this.
export function runAiShopPhase(lobby, round, rng) {
  for (const player of alivePlayers(lobby)) {
    if (player.isHuman) continue;
    runAiTurn(player.state, lobby.pool, round, rng);
  }
}

// Resolves the Reef Shard event for every AI player this round. Returns
// the choices offered, in case the UI wants to show what an AI picked, or
// null if this isn't a Reef Shard round.
export function runAiReefShardPhase(lobby, round, rng) {
  if (!isReefShardRound(round)) return null;
  const choices = offerReefShardChoices(round, rng);
  for (const player of alivePlayers(lobby)) {
    if (player.isHuman) continue;
    const pick = chooseReefShardPick(player.state, choices);
    if (pick) applyReefShardChoice(player.state, pick.instanceId, pick.ability);
  }
  return choices;
}

// Resolves the human's Reef Shard choice (or decline) with whatever the UI
// already presented and the player picked. Safe to call with pick=null.
export function resolveHumanReefShardChoice(humanState, pick) {
  if (pick) applyReefShardChoice(humanState, pick.instanceId, pick.ability);
}

// Shuffles alive players and pairs them up, preferring not to repeat last
// round's matchup when an alternative exists. An odd player out gets a bye
// (no fight, no damage) rather than being skipped from the match entirely.
// This is a greedy approximation, not an optimal round-robin scheduler —
// fine at 8-seat scale, and documented here rather than silently assumed.
export function pairPlayers(players, rng) {
  const pool = shuffle(players, rng);
  const used = new Set();
  const pairs = [];
  for (const p of pool) {
    if (used.has(p.id)) continue;
    let partner = pool.find((q) => q.id !== p.id && !used.has(q.id) && q.id !== p.lastOpponentId);
    if (!partner) partner = pool.find((q) => q.id !== p.id && !used.has(q.id));
    if (partner) {
      pairs.push([p, partner]);
      used.add(p.id);
      used.add(partner.id);
    }
  }
  const bye = pool.find((p) => !used.has(p.id)) ?? null;
  return { pairs, bye };
}

function applyExternalEffects(state, effects) {
  for (const effect of effects) {
    // fathom_grow is already reflected in the fathom object combat.mjs
    // returns (assigned directly onto state.fathom by the caller below) —
    // nothing further to do with it here.
    if (effect.type === 'refresh_shop_free') {
      state.freeRerollBanked += 1; // spent by refreshShop() next time this player rerolls
    }
  }
}

// Runs every fight for this round and applies its outcome. Returns a
// per-pair report for the UI to narrate/animate.
export function runCombatPhase(lobby, round, rng) {
  const { pairs, bye } = pairPlayers(alivePlayers(lobby), rng);
  const reports = [];

  for (const [a, b] of pairs) {
    const result = simulateCombat(a.state.board, b.state.board, {
      rng, fathomA: a.state.fathom, fathomB: b.state.fathom,
    });
    a.state.board = result.boardA;
    b.state.board = result.boardB;
    a.state.fathom = result.fathomA;
    b.state.fathom = result.fathomB;
    applyExternalEffects(a.state, result.externalEffects.filter((e) => e.owner === 'A'));
    applyExternalEffects(b.state, result.externalEffects.filter((e) => e.owner === 'B'));

    if (result.winner === 'A') b.state.health = Math.max(0, b.state.health - result.damageToLoser);
    else if (result.winner === 'B') a.state.health = Math.max(0, a.state.health - result.damageToLoser);

    a.lastOpponentId = b.id;
    b.lastOpponentId = a.id;

    for (const player of [a, b]) {
      if (player.state.health <= 0 && player.eliminatedRound == null) player.eliminatedRound = round;
    }

    reports.push({
      aId: a.id, bId: b.id, winner: result.winner, damage: result.damageToLoser,
      aHealthAfter: a.state.health, bHealthAfter: b.state.health, log: result.log,
    });
  }

  if (bye) reports.push({ aId: bye.id, bId: null, winner: null, damage: 0, aHealthAfter: bye.state.health, bHealthAfter: null, log: [] });

  return reports;
}

// { over, winnerId, placements } — placements is every player ordered by
// final finishing position, 1st (the winner) first, last-place (earliest
// eliminated) last. Used to tell the human their final position even when
// they're knocked out long before the match actually ends.
export function checkGameOver(lobby) {
  const alive = alivePlayers(lobby);
  if (alive.length > 1) return { over: false };
  const winner = alive[0] ?? null;
  const eliminated = lobby.players
    .filter((p) => p !== winner)
    .sort((x, y) => (y.eliminatedRound ?? 0) - (x.eliminatedRound ?? 0)); // later-eliminated = better placement
  return { over: true, winnerId: winner?.id ?? null, placements: [...(winner ? [winner] : []), ...eliminated] };
}

function shuffle(list, rng) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

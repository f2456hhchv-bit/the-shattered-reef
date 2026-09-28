import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLobby, alivePlayers, beginRound, runAiShopPhase, runAiReefShardPhase,
  pairPlayers, runCombatPhase, checkGameOver,
} from '../src/engine/roundloop.mjs';
import { createSharedPool, createPlayerState } from '../src/engine/economy.mjs';
import { instantiate } from '../src/data/minions.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

function makeLobby(n, rng) {
  const pool = createSharedPool();
  const defs = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`, name: `Player ${i}`, isHuman: i === 0, state: createPlayerState(),
  }));
  return createLobby(defs, pool);
}

test('pairPlayers pairs everyone with no bye when the count is even', () => {
  const rng = makeSeededRng(1);
  const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, lastOpponentId: null }));
  const { pairs, bye } = pairPlayers(players, rng);
  assert.equal(pairs.length, 4);
  assert.equal(bye, null);
  const seen = new Set();
  for (const [a, b] of pairs) { seen.add(a.id); seen.add(b.id); }
  assert.equal(seen.size, 8);
});

test('pairPlayers gives exactly one bye when the count is odd', () => {
  const rng = makeSeededRng(2);
  const players = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, lastOpponentId: null }));
  const { pairs, bye } = pairPlayers(players, rng);
  assert.equal(pairs.length, 3);
  assert.ok(bye);
  const seen = new Set([bye.id]);
  for (const [a, b] of pairs) { seen.add(a.id); seen.add(b.id); }
  assert.equal(seen.size, 7);
});

test('pairPlayers avoids an immediate rematch when an alternative exists', () => {
  const rng = makeSeededRng(3);
  const players = [
    { id: 'a', lastOpponentId: 'b' },
    { id: 'b', lastOpponentId: 'a' },
    { id: 'c', lastOpponentId: 'd' },
    { id: 'd', lastOpponentId: 'c' },
  ];
  const { pairs } = pairPlayers(players, rng);
  for (const [x, y] of pairs) {
    assert.notEqual(x.id, x.lastOpponentId === y.id ? y.id : null, 'should not force a and b back together when c/d are free');
  }
  // Concretely: a should not be paired with b, since c/d are available.
  const aPair = pairs.find(([x, y]) => x.id === 'a' || y.id === 'a');
  const aOpponent = aPair[0].id === 'a' ? aPair[1].id : aPair[0].id;
  assert.notEqual(aOpponent, 'b');
});

test('beginRound heals every survivor back to maxHealth and refreshes shops', () => {
  const rng = makeSeededRng(4);
  const lobby = makeLobby(2, rng);
  const [human, ai] = lobby.players;
  const wounded = instantiate('reaver-bilge-rigger', 'x');
  wounded.health = 1; // took damage in a previous fight
  human.state.board.push(wounded);
  beginRound(lobby, 1, rng);
  assert.equal(wounded.health, wounded.maxHealth);
  assert.equal(human.state.shop.length, 3);
  assert.equal(ai.state.shop.length, 3);
});

test('runAiShopPhase acts for AI players only, never touching the human', () => {
  const rng = makeSeededRng(5);
  const lobby = makeLobby(3, rng);
  beginRound(lobby, 4, rng); // decent income
  const humanGoldBefore = lobby.players[0].state.gold;
  runAiShopPhase(lobby, 4, rng);
  assert.equal(lobby.players[0].state.gold, humanGoldBefore); // untouched
  // At least one AI should have spent something or bought something.
  const aiActed = lobby.players.slice(1).some((p) => p.state.gold < p.state.maxGold || p.state.board.length > 0);
  assert.ok(aiActed);
});

test('runAiReefShardPhase resolves the event for AI only, and only on shard rounds', () => {
  const rng = makeSeededRng(6);
  const lobby = makeLobby(2, rng);
  const ai = lobby.players[1];
  ai.state.board.push(instantiate('reaver-bilge-rigger', 'ai-minion'));
  const notShardRound = runAiReefShardPhase(lobby, 4, rng);
  assert.equal(notShardRound, null);
  const choices = runAiReefShardPhase(lobby, 3, rng); // round 3 is a shard round
  assert.equal(choices.length, 3);
  assert.equal(ai.state.fathom.attack, 1); // the AI fed a shard to its only minion
});

test('runCombatPhase applies damage to the loser and heals nothing until beginRound', () => {
  const rng = makeSeededRng(7);
  const lobby = makeLobby(2, rng);
  const [strong, weak] = lobby.players;
  strong.state.board.push(instantiate('reaver-captain-vex', 'vex')); // 4/4
  weak.state.board.push(instantiate('neutral-ghost-light', 'ghost')); // 1/1
  const healthBefore = weak.state.health;
  const reports = runCombatPhase(lobby, 1, rng);
  assert.equal(reports.length, 1);
  assert.ok(weak.state.health < healthBefore || strong.state.health < 25);
});

test('runCombatPhase eliminates a player who reaches 0 health', () => {
  const rng = makeSeededRng(8);
  const lobby = makeLobby(2, rng);
  const [strong, weak] = lobby.players;
  strong.state.board.push(instantiate('reaver-captain-vex', 'vex'));
  weak.state.health = 1; // one hit from death
  weak.state.board.push(instantiate('neutral-ghost-light', 'ghost'));
  runCombatPhase(lobby, 5, rng);
  const stillAlive = alivePlayers(lobby);
  assert.ok(stillAlive.length <= 2);
  if (weak.state.health <= 0) {
    assert.equal(weak.eliminatedRound, 5);
    assert.ok(!stillAlive.includes(weak));
  }
});

test('checkGameOver reports the winner and a full placement order', () => {
  const rng = makeSeededRng(9);
  const lobby = makeLobby(3, rng);
  const [a, b, c] = lobby.players;
  a.state.health = 0; a.eliminatedRound = 2;
  b.state.health = 0; b.eliminatedRound = 5;
  // c is the sole survivor
  const result = checkGameOver(lobby);
  assert.equal(result.over, true);
  assert.equal(result.winnerId, 'p2');
  assert.equal(result.placements.map((p) => p.id).join(','), 'p2,p1,p0'); // winner, then later-eliminated, then earliest-eliminated
});

test('checkGameOver reports not-over while two or more players remain', () => {
  const rng = makeSeededRng(10);
  const lobby = makeLobby(3, rng);
  assert.equal(checkGameOver(lobby).over, false);
});

test('a full seeded 8-player match runs to completion without throwing', () => {
  const rng = makeSeededRng(42);
  const lobby = makeLobby(8, rng);
  let round = 0;
  let over = false;
  let guard = 0;
  while (!over && guard++ < 60) {
    round += 1;
    beginRound(lobby, round, rng);
    runAiShopPhase(lobby, round, rng); // human (p0) just never shops in this test — fine, it only tests the loop
    runAiReefShardPhase(lobby, round, rng);
    runCombatPhase(lobby, round, rng);
    over = checkGameOver(lobby).over;
  }
  assert.ok(over, 'match should terminate well within 60 rounds for 8 players');
  const result = checkGameOver(lobby);
  assert.equal(result.placements.length, 8);
  assert.ok(result.winnerId);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSharedPool, createPlayerState, startRound, offerReefShardChoices, MAX_TAVERN_TIER } from '../src/engine/economy.mjs';
import { runAiTurn, chooseReefShardPick, scoreMinion, synergyBonus } from '../src/engine/ai.mjs';
import { instantiate } from '../src/data/minions.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

test('scoreMinion values stats, keywords and effects, not just raw stats', () => {
  const vanilla = scoreMinion(instantiate('wyrdtide-driftwood-golem', 'a')); // 3/3, no keywords/effects
  const taunt = scoreMinion(instantiate('neutral-old-sea-dog', 'b')); // 3/3, taunt
  const withEffect = scoreMinion(instantiate('reaver-cutlass-hand', 'c')); // 3/3, battlecry buff
  assert.equal(vanilla, 6);
  assert.ok(taunt > vanilla, 'taunt should add value over an otherwise identical statline');
  assert.ok(withEffect > vanilla, 'a battlecry should add value over no effect at all');
});

test('synergyBonus rewards committing to a board\'s dominant faction, capped', () => {
  const board = [
    instantiate('reaver-bilge-rigger', 'r1'),
    instantiate('reaver-bilge-rigger', 'r2'),
  ];
  assert.equal(synergyBonus('blacksail-reavers', board), 2 * 1.5);
  assert.equal(synergyBonus('neutral', board), 0); // neutrals never get a faction bonus
  const bigBoard = Array.from({ length: 10 }, (_, i) => instantiate('reaver-bilge-rigger', `big${i}`));
  assert.equal(synergyBonus('blacksail-reavers', bigBoard), 4 * 1.5); // capped, not 10x
});

test('runAiTurn spends the whole budget: buys, and rerolls rather than leaving gold unspent', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  const rng = makeSeededRng(100);
  startRound(state, pool, 1, rng);
  const log = runAiTurn(state, pool, 1, rng);
  assert.ok(log.length > 0, 'expected the AI to take at least one action');
  assert.ok(state.gold <= 1, 'expected the AI to spend down to at most a fractional-reroll leftover');
  assert.ok(state.board.length > 0, 'expected the AI to have bought at least one minion by round 1');
});

test('runAiTurn upgrades the tavern opportunistically toward the round-based target', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  const rng = makeSeededRng(101);
  startRound(state, pool, 4, rng); // round 4: target tier is 2, plenty of gold (6g)
  const log = runAiTurn(state, pool, 4, rng);
  assert.equal(state.tavernTier, 2);
  assert.ok(log.some((e) => e.type === 'upgrade'));
});

test('runAiTurn never buys past the board cap without selling first', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  state.gold = 999;
  for (let i = 0; i < 7; i++) state.board.push(instantiate('reaver-bilge-rigger', `filler${i}`));
  const rng = makeSeededRng(102);
  state.shop = [{ defId: 'reaver-captain-vex' }, null, null]; // a clearly better minion
  runAiTurn(state, pool, 5, rng);
  assert.ok(state.board.length <= 7);
});

test('runAiTurn swaps in a clearly better minion when the board is full', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  state.gold = 999;
  // Seven identical, low-value fillers with no keywords/effects.
  for (let i = 0; i < 7; i++) state.board.push(instantiate('wyrdtide-driftwood-golem', `filler${i}`));
  // Same faction as the board (so the swap isn't fighting its own synergy
  // bonus) but a much stronger statline plus a deathrattle.
  state.shop = [{ defId: 'wyrdtide-reefbound-leviathan' }, null, null];
  const rng = makeSeededRng(103);
  const log = runAiTurn(state, pool, 5, rng);
  assert.ok(log.some((e) => e.type === 'swap' && e.bought === 'wyrdtide-reefbound-leviathan'));
  assert.ok(state.board.some((m) => m.defId === 'wyrdtide-reefbound-leviathan'));
  assert.equal(state.board.length, 7);
});

test('runAiTurn freezes a shop it can\'t yet afford instead of rerolling it away', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  state.gold = 0; // can't afford anything at all
  state.shop = [{ defId: 'reaver-captain-vex' }, null, null]; // a keeper, tier 3, 5g
  const rng = makeSeededRng(104);
  const log = runAiTurn(state, pool, 8, rng);
  assert.ok(log.some((e) => e.type === 'freeze'));
  assert.equal(state.frozen, true);
  assert.equal(state.shop[0].defId, 'reaver-captain-vex'); // untouched, not rerolled away
});

test('chooseReefShardPick declines when the board is empty', () => {
  const state = createPlayerState();
  const rng = makeSeededRng(105);
  const choices = offerReefShardChoices(3, rng);
  assert.equal(chooseReefShardPick(state, choices), null);
});

test('chooseReefShardPick picks a well-fitting minion for the ability, e.g. Vampiric on the highest-attack minion', () => {
  const state = createPlayerState();
  const bruiser = instantiate('reaver-captain-vex', 'bruiser'); // 4 attack
  const weak = instantiate('neutral-ghost-light', 'weak'); // 1 attack
  state.board.push(weak, bruiser);
  const vampiric = { id: 'vampiric', type: 'board', label: 'Vampiric', text: '...' };
  const pick = chooseReefShardPick(state, [vampiric]);
  assert.ok(pick);
  assert.equal(pick.instanceId, 'bruiser');
  assert.equal(pick.ability.id, 'vampiric');
});

test('chooseReefShardPick prefers Barnacled on a taunt minion over a non-taunt one', () => {
  const state = createPlayerState();
  const taunt = instantiate('neutral-old-sea-dog', 'tank'); // taunt
  const nonTaunt = instantiate('wyrdtide-driftwood-golem', 'plain');
  state.board.push(nonTaunt, taunt);
  const barnacled = { id: 'barnacled', type: 'board', label: 'Barnacled', text: '...' };
  const pick = chooseReefShardPick(state, [barnacled]);
  assert.equal(pick.instanceId, 'tank');
});

test('chooseReefShardPick prefers Twinned on a minion that actually has a deathrattle', () => {
  const state = createPlayerState();
  const noDeathrattle = instantiate('wyrdtide-driftwood-golem', 'plain');
  const hasDeathrattle = instantiate('reaver-powder-rat', 'rat'); // deathrattle: damage_random_enemy
  state.board.push(noDeathrattle, hasDeathrattle);
  const twinned = { id: 'twinned', type: 'board', label: 'Twinned', text: '...' };
  const pick = chooseReefShardPick(state, [twinned]);
  assert.equal(pick.instanceId, 'rat');
});

test('AI-controlled state stays within the vertical slice\'s tavern cap', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  const rng = makeSeededRng(106);
  for (let round = 1; round <= 15; round++) {
    startRound(state, pool, round, rng);
    runAiTurn(state, pool, round, rng);
  }
  assert.ok(state.tavernTier <= MAX_TAVERN_TIER);
});

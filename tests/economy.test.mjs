import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSharedPool, createPlayerState, startRound, refreshShop, freezeShop,
  buyMinion, sellMinion, upgradeTavern, isReefShardRound,
  offerReefShardChoices, applyReefShardChoice, SHARD_ABILITIES,
} from '../src/engine/economy.mjs';
import { instantiate, MINION_BY_ID } from '../src/data/minions.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

test('income grows by round and caps at 10', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  startRound(state, pool, 1, makeSeededRng(1));
  assert.equal(state.maxGold, 3);
  startRound(state, pool, 5, makeSeededRng(1));
  assert.equal(state.maxGold, 7);
  startRound(state, pool, 8, makeSeededRng(1));
  assert.equal(state.maxGold, 10);
  startRound(state, pool, 20, makeSeededRng(1));
  assert.equal(state.maxGold, 10);
});

test('gold resets to maxGold at the start of every round (no carryover)', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  startRound(state, pool, 4, makeSeededRng(2));
  state.gold = 0; // spent everything
  startRound(state, pool, 5, makeSeededRng(2));
  assert.equal(state.gold, 7);
});

test('tavern tier 1 shop only offers tier 1 minions', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  startRound(state, pool, 1, makeSeededRng(3));
  assert.equal(state.shop.length, 3);
  for (const slot of state.shop) {
    assert.ok(slot);
    assert.equal(MINION_BY_ID[slot.defId].tier, 1);
  }
});

test('a free reroll (round start) costs no gold; a manual reroll does', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  startRound(state, pool, 4, makeSeededRng(4)); // free
  const goldAfterFree = state.gold;
  assert.equal(goldAfterFree, state.maxGold);
  refreshShop(state, pool, makeSeededRng(5));
  assert.equal(state.gold, goldAfterFree - 1);
});

test('Bargain Tide reduces reroll cost, never below 0', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  startRound(state, pool, 4, makeSeededRng(6));
  state.rerollDiscount = 1;
  const before = state.gold;
  refreshShop(state, pool, makeSeededRng(7));
  assert.equal(state.gold, before); // 1 - 1 = 0 cost
});

test('freezing keeps the same shop through the next round, then releases', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  startRound(state, pool, 3, makeSeededRng(8));
  const frozenShop = state.shop.map((s) => s?.defId);
  freezeShop(state);
  startRound(state, pool, 4, makeSeededRng(9));
  assert.deepEqual(state.shop.map((s) => s?.defId), frozenShop);
  assert.equal(state.frozen, false); // single-use
});

test('buying deducts gold, adds to board, and empties the shop slot', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  startRound(state, pool, 1, makeSeededRng(10));
  const defId = state.shop[0].defId;
  const cost = MINION_BY_ID[defId].cost;
  const goldBefore = state.gold;
  const bought = buyMinion(state, 0);
  assert.equal(bought.defId, defId);
  assert.equal(state.gold, goldBefore - cost);
  assert.equal(state.shop[0], null);
  assert.equal(state.board.length, 1);
});

test('cannot buy without enough gold', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  startRound(state, pool, 1, makeSeededRng(11));
  state.gold = 0;
  assert.throws(() => buyMinion(state, 0));
});

test('board cap of 7 is enforced', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  state.gold = 999;
  for (let i = 0; i < 7; i++) {
    state.board.push(instantiate('reaver-bilge-rigger', `filler-${i}`));
  }
  startRound(state, pool, 1, makeSeededRng(12));
  assert.throws(() => buyMinion(state, 0));
});

test('Deckhand battlecry buffs another random friendly Reaver, not itself', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  state.gold = 99;
  state.board.push(instantiate('reaver-bilge-rigger', 'ally'));
  state.shop = [{ defId: 'reaver-deckhand' }, null, null];
  buyMinion(state, 0);
  const ally = state.board.find((m) => m.instanceId === 'ally');
  assert.equal(ally.attack, 4); // 3 base + 1 from Deckhand's battlecry
});

test('Cutlass Hand buffs every friendly Reaver, not neutrals', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  state.gold = 99;
  state.board.push(instantiate('reaver-bilge-rigger', 'reaver1'));
  state.board.push(instantiate('neutral-old-sea-dog', 'dog'));
  state.shop = [{ defId: 'reaver-cutlass-hand' }, null, null];
  buyMinion(state, 0);
  assert.equal(state.board.find((m) => m.instanceId === 'reaver1').attack, 4);
  assert.equal(state.board.find((m) => m.instanceId === 'dog').attack, 3); // unchanged
});

test('Tideling only buffs itself if a shard has been used this game', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  state.gold = 99;
  state.shop = [{ defId: 'wyrdtide-tideling' }, null, null];
  buyMinion(state, 0);
  let tideling = state.board.find((m) => m.defId === 'wyrdtide-tideling');
  assert.equal(tideling.attack, 1); // no shard used yet, no buff

  state.fathom.attack = 1; // simulate a shard having been fed
  state.gold = 99;
  state.shop = [{ defId: 'wyrdtide-tideling' }, null, null];
  buyMinion(state, 0);
  const second = state.board.filter((m) => m.defId === 'wyrdtide-tideling')[1];
  assert.equal(second.attack, 2); // 1 base + 1 from the battlecry
});

test('Fathom Priestess battlecry queues a bonus shard event', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  state.gold = 99;
  state.shop = [{ defId: 'wyrdtide-fathom-priestess' }, null, null];
  buyMinion(state, 0);
  assert.equal(state.pendingBonusShardEvents, 1);
});

test('selling returns gold and a copy to the pool', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  const before = pool.counts['reaver-bilge-rigger'];
  const m = instantiate('reaver-bilge-rigger', 'x');
  state.board.push(m);
  pool.counts['reaver-bilge-rigger'] -= 1; // simulate it having been drawn
  const goldBefore = state.gold;
  sellMinion(state, pool, 'x');
  assert.equal(state.board.length, 0);
  assert.equal(state.gold, goldBefore + 1);
  assert.equal(pool.counts['reaver-bilge-rigger'], before);
});

test('upgrading the tavern costs gold and is capped at tier 3 for the slice', () => {
  const state = createPlayerState();
  state.gold = 5;
  upgradeTavern(state);
  assert.equal(state.tavernTier, 2);
  assert.equal(state.gold, 0);
  assert.throws(() => upgradeTavern(state)); // not enough gold
  state.gold = 7;
  upgradeTavern(state);
  assert.equal(state.tavernTier, 3);
  state.gold = 999;
  assert.throws(() => upgradeTavern(state)); // slice cap
});

test('Reef Shard rounds land on 3, 7, 11... and nowhere else', () => {
  assert.ok(isReefShardRound(3));
  assert.ok(isReefShardRound(7));
  assert.ok(isReefShardRound(11));
  assert.ok(!isReefShardRound(4));
  assert.ok(!isReefShardRound(10));
});

test('shard choices are 3 distinct abilities from the correct tier', () => {
  const rng = makeSeededRng(13);
  const early = offerReefShardChoices(3, rng);
  assert.equal(early.length, 3);
  assert.equal(new Set(early.map((a) => a.id)).size, 3);
  for (const a of early) assert.ok(SHARD_ABILITIES.lesser.includes(a));

  const late = offerReefShardChoices(15, rng);
  for (const a of late) assert.ok(SHARD_ABILITIES.greater.includes(a));
});

test('a board-type shard ability tags the minion, locks its faction buffs, and grows the Fathom', () => {
  const state = createPlayerState();
  const m = instantiate('reaver-bilge-rigger', 'x');
  state.board.push(m);
  const vampiric = SHARD_ABILITIES.lesser.find((a) => a.id === 'vampiric');
  applyReefShardChoice(state, 'x', vampiric);
  assert.ok(m.shardAbilities.includes('vampiric'));
  assert.equal(m.shardLocked, true);
  assert.equal(state.fathom.attack, 1);
  assert.equal(state.fathom.health, 1);
});

test('Titanic doubles stats immediately instead of tagging', () => {
  const state = createPlayerState();
  const m = instantiate('wyrdtide-driftwood-golem', 'x'); // 3/3
  state.board.push(m);
  const titanic = SHARD_ABILITIES.greater.find((a) => a.id === 'titanic');
  applyReefShardChoice(state, 'x', titanic);
  assert.equal(m.attack, 6);
  assert.equal(m.health, 6);
});

test('a shop-type shard ability updates player state, not just the minion', () => {
  const state = createPlayerState();
  const m = instantiate('wyrdtide-driftwood-golem', 'x');
  state.board.push(m);
  const bargainTide = SHARD_ABILITIES.lesser.find((a) => a.id === 'bargain_tide');
  applyReefShardChoice(state, 'x', bargainTide);
  assert.equal(state.rerollDiscount, 1);
  assert.equal(m.shardLocked, true); // the cost still applies even on a shop roll
});

test("The Kraken's Due grows when another friendly Reaver is shard-fed, not itself", () => {
  const state = createPlayerState();
  const due = instantiate('reaver-krakens-due', 'due');
  const ally = instantiate('reaver-bilge-rigger', 'ally');
  state.board.push(due, ally);
  const vampiric = SHARD_ABILITIES.lesser.find((a) => a.id === 'vampiric');
  applyReefShardChoice(state, 'ally', vampiric);
  assert.equal(due.attack, 7); // 5 base + 2 from its passive
  assert.equal(due.health, 5);

  // Now feed a shard to the Kraken's Due itself — its own passive must not
  // fire off its own feed.
  applyReefShardChoice(state, 'due', vampiric);
  assert.equal(due.attack, 7); // unchanged by its own feed
});

test('Drowned Favor guarantees a most-common-faction slot on the next refresh', () => {
  const pool = createSharedPool();
  const state = createPlayerState();
  state.board.push(instantiate('reaver-bilge-rigger', 'r1'));
  state.board.push(instantiate('reaver-cutlass-hand', 'r2'));
  state.guaranteedFactionActive = true;
  state.gold = 10;
  refreshShop(state, pool, makeSeededRng(14), { free: true });
  const factions = state.shop.filter(Boolean).map((s) => MINION_BY_ID[s.defId].faction);
  assert.ok(factions.includes('blacksail-reavers'));
});

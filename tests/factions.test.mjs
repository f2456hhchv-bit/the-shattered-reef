import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FACTION_IDS, FACTIONS, FACTION_LIST, getFaction,
  triangleMultiplier, TRIANGLE_ADVANTAGE_MULTIPLIER, TRIANGLE_DISADVANTAGE_MULTIPLIER,
  incomingTriangleMultiplier, INCOMING_TRIANGLE, matchupFor, relationTo,
} from '../src/data/factions.mjs';

test('every faction has exactly one distinct beats target, forming a 3-cycle', () => {
  assert.equal(FACTION_LIST.length, 3);
  const beatsTargets = new Set(FACTION_LIST.map((f) => f.beats));
  assert.equal(beatsTargets.size, 3, 'each faction should beat a different one — a real triangle, not two ganging up on one');
  for (const f of FACTION_LIST) {
    assert.notEqual(f.beats, f.id, 'a faction cannot beat itself');
    // Walking `beats` 3 times from any faction should return to itself.
    let cur = f.id;
    for (let i = 0; i < 3; i++) cur = getFaction(cur).beats;
    assert.equal(cur, f.id, 'beats relationships should form one 3-cycle, not two separate 1.5-cycles');
  }
});

test('triangleMultiplier gives the advantage multiplier to the faction that beats the other', () => {
  assert.equal(
    triangleMultiplier(FACTION_IDS.REAVERS, FACTION_IDS.IRON_ACCORD),
    TRIANGLE_ADVANTAGE_MULTIPLIER
  );
  assert.equal(
    triangleMultiplier(FACTION_IDS.IRON_ACCORD, FACTION_IDS.WYRDTIDE),
    TRIANGLE_ADVANTAGE_MULTIPLIER
  );
  assert.equal(
    triangleMultiplier(FACTION_IDS.WYRDTIDE, FACTION_IDS.REAVERS),
    TRIANGLE_ADVANTAGE_MULTIPLIER
  );
});

test('triangleMultiplier gives the disadvantage multiplier to the faction that loses', () => {
  assert.equal(
    triangleMultiplier(FACTION_IDS.IRON_ACCORD, FACTION_IDS.REAVERS),
    TRIANGLE_DISADVANTAGE_MULTIPLIER
  );
});

test('triangleMultiplier is 1x for a mirror match and for any missing faction (no-op)', () => {
  assert.equal(triangleMultiplier(FACTION_IDS.REAVERS, FACTION_IDS.REAVERS), 1);
  assert.equal(triangleMultiplier(null, FACTION_IDS.REAVERS), 1);
  assert.equal(triangleMultiplier(FACTION_IDS.REAVERS, null), 1);
  assert.equal(triangleMultiplier(null, null), 1);
  assert.equal(triangleMultiplier(undefined, undefined), 1);
});

test('getFaction throws on an unknown id', () => {
  assert.throws(() => getFaction('not_a_faction'));
});

// --- Incoming direction (2026-09-28: the triangle applies both ways) ----

test('incomingTriangleMultiplier: your predator hits you harder, your prey a little softer', () => {
  // Wyrdtide beats Reavers: a Wyrdtide enemy vs a Reavers player is the predator.
  assert.equal(incomingTriangleMultiplier(FACTION_IDS.WYRDTIDE, FACTION_IDS.REAVERS), INCOMING_TRIANGLE.advantage);
  // Reavers beat Iron Accord: an Iron Accord enemy vs a Reavers player is prey.
  assert.equal(incomingTriangleMultiplier(FACTION_IDS.IRON_ACCORD, FACTION_IDS.REAVERS), INCOMING_TRIANGLE.disadvantage);
  assert.ok(INCOMING_TRIANGLE.advantage > 1 && INCOMING_TRIANGLE.disadvantage < 1);
});

test('incomingTriangleMultiplier is a no-op for mirror matches, unaligned players and faction-less enemies', () => {
  assert.equal(incomingTriangleMultiplier(FACTION_IDS.REAVERS, FACTION_IDS.REAVERS), 1);
  assert.equal(incomingTriangleMultiplier(FACTION_IDS.WYRDTIDE, null), 1);
  assert.equal(incomingTriangleMultiplier(null, FACTION_IDS.REAVERS), 1);
});

test('the triangle is consistent in both directions: whoever you beat, you out-damage AND out-last', () => {
  for (const player of FACTION_LIST) {
    for (const enemy of FACTION_LIST) {
      const out = triangleMultiplier(player.id, enemy.id);
      const inc = incomingTriangleMultiplier(enemy.id, player.id);
      if (out > 1) assert.ok(inc < 1, `${player.id} beats ${enemy.id}, so ${enemy.id} should hit ${player.id} softer`);
      if (out < 1) assert.ok(inc > 1, `${enemy.id} beats ${player.id}, so ${enemy.id} should hit ${player.id} harder`);
      if (out === 1) assert.equal(inc, 1);
    }
  }
});

test('matchupFor names each faction\'s prey and predator consistently with the triangle', () => {
  for (const f of FACTION_LIST) {
    const m = matchupFor(f.id);
    assert.ok(triangleMultiplier(f.id, m.prey.id) > 1);
    assert.ok(triangleMultiplier(f.id, m.predator.id) < 1);
  }
  assert.equal(matchupFor(null), null);
});

test('relationTo drives the enemy pips: prey / predator / null (mirror, unaligned, boss)', () => {
  assert.equal(relationTo(FACTION_IDS.IRON_ACCORD, FACTION_IDS.WYRDTIDE), 'prey');
  assert.equal(relationTo(FACTION_IDS.IRON_ACCORD, FACTION_IDS.REAVERS), 'predator');
  assert.equal(relationTo(FACTION_IDS.IRON_ACCORD, FACTION_IDS.IRON_ACCORD), null);
  assert.equal(relationTo(null, FACTION_IDS.REAVERS), null);
  assert.equal(relationTo(FACTION_IDS.REAVERS, null), null);
});

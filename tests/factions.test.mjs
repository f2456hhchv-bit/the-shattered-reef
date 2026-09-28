import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FACTION_IDS, FACTIONS, FACTION_LIST, getFaction,
  triangleMultiplier, TRIANGLE_ADVANTAGE_MULTIPLIER, TRIANGLE_DISADVANTAGE_MULTIPLIER,
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

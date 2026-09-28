import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINIONS } from '../src/data/minions.mjs';
import { FACTION_IDS } from '../src/data/factions.mjs';
import { TRIGGERS, KEYWORDS, ACTION_TYPES } from '../src/data/keywords.mjs';

test('every minion id is unique', () => {
  const ids = MINIONS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every minion references a real faction', () => {
  for (const m of MINIONS) {
    assert.ok(FACTION_IDS.includes(m.faction), `${m.id} has unknown faction "${m.faction}"`);
  }
});

test('every minion has positive attack and health', () => {
  for (const m of MINIONS) {
    assert.ok(m.attack >= 0, `${m.id} has negative attack`);
    assert.ok(m.health > 0, `${m.id} has non-positive health`);
  }
});

test('every minion tier is 1-3 (vertical slice scope)', () => {
  for (const m of MINIONS) {
    assert.ok(m.tier >= 1 && m.tier <= 3, `${m.id} has out-of-slice tier ${m.tier}`);
  }
});

test('cost matches the tier+2 formula', () => {
  for (const m of MINIONS) {
    assert.equal(m.cost, m.tier + 2, `${m.id} has cost ${m.cost}, expected ${m.tier + 2}`);
  }
});

test('every keyword used in data is a recognised keyword', () => {
  for (const m of MINIONS) {
    for (const k of m.keywords ?? []) {
      assert.ok(KEYWORDS.includes(k), `${m.id} uses unknown keyword "${k}"`);
    }
  }
});

test('every effect trigger and action type is recognised', () => {
  for (const m of MINIONS) {
    for (const e of m.effects ?? []) {
      assert.ok(TRIGGERS.includes(e.trigger), `${m.id} uses unknown trigger "${e.trigger}"`);
      assert.ok(ACTION_TYPES.includes(e.action.type), `${m.id} uses unknown action type "${e.action.type}"`);
    }
  }
});

test('every summon effect references a real minion id', () => {
  const ids = new Set(MINIONS.map((m) => m.id));
  for (const m of MINIONS) {
    for (const e of m.effects ?? []) {
      if (e.action.type === 'summon') {
        assert.ok(ids.has(e.action.minionId), `${m.id} summons unknown minion "${e.action.minionId}"`);
      }
    }
  }
});

test('faction card counts match the vertical-slice plan (8 Reavers, 8 Wyrdtide, 5 neutral)', () => {
  const byFaction = (f) => MINIONS.filter((m) => m.faction === f).length;
  assert.equal(byFaction('blacksail-reavers'), 8);
  assert.equal(byFaction('wyrdtide'), 8);
  assert.equal(byFaction('neutral'), 5);
});

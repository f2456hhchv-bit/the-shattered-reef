// The depth pass (2026-10-22): story, keys, crew, the levelled shop tracks
// and the unlock pace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSurvivalRun } from '../src/engine/survivalRun.mjs';
import { stepSurvivalFrame } from '../src/engine/survivalLoop.mjs';
import { weaponStats } from '../src/engine/survival.mjs';
import { createEnemy } from '../src/engine/enemies.mjs';
import { applyDamageToEnemy } from '../src/engine/combat.mjs';
import {
  keyStats, createKeyState, keyReady, chargeKey, useKey, stepKeyEffects, keyBuffs,
} from '../src/engine/keys.mjs';
import {
  defaultDepth, sanitizeDepth, recordDepth, crewEffects, toggleCrew, bondLevel, purchaseCrewQuarters,
  nextRefitPrice, purchaseRefit, purchaseMastery, nextMasteryPrice, purchaseKeyLevel, purchaseWake,
  nanaLine, storyUnseen, markStory,
} from '../src/engine/depth.mjs';
import { createDefaultMeta, loadMeta, resolveLoadout, purchaseHull, purchaseCharm } from '../src/engine/meta.mjs';
import { KEYS, KEY_IDS } from '../src/data/keys.mjs';
import { CREW, CREW_IDS } from '../src/data/crew.mjs';
import { CHARACTERS, CHAPTERS, PROLOGUE, KEY_FOR_STAGE, RECRUIT_FOR_STAGE } from '../src/data/story.mjs';
import { shopCatalogue, unlockHours } from '../tools/economy.mjs';

function flatRun(seed = 1, loadout) {
  const run = createSurvivalRun(seed, loadout);
  const N = run.grid.width;
  run.grid = { width: N, height: N, tiles: Array.from({ length: N }, () => Array(N).fill(0)) };
  run.coast = null; run.pickups = []; run.enemies = [];
  return run;
}
function add(run, defId, dx, dy, hp = 500) {
  const e = createEnemy(defId, run.boat.x + dx, run.boat.y + dy);
  e.health = e.maxHealth = hp; e.hunting = true; e.aggro = true;
  run.enemies.push(e);
  return e;
}
const memStore = (o = {}) => ({ getItem: (k) => o[k] ?? null, setItem: (k, v) => { o[k] = v; } });

test('story: ten chapters, each with a key, a recruit and lines only known characters speak', () => {
  assert.equal(CHAPTERS.length, 10);
  const keys = new Set(); const recruits = new Set();
  for (const c of CHAPTERS) {
    assert.ok(KEYS[c.key], `stage ${c.stage} key`); assert.ok(CREW[c.recruit], `stage ${c.stage} recruit`);
    keys.add(c.key); recruits.add(c.recruit);
    for (const [who, text] of [...c.intro, ...c.outro]) { assert.ok(CHARACTERS[who], `${c.stage}: ${who}`); assert.ok(text.length > 4); }
  }
  for (const [who] of PROLOGUE) assert.ok(CHARACTERS[who]);
  assert.equal(keys.size, 10, 'every stage holds a different key');
  assert.equal(recruits.size, 10, 'every stage brings a different crewmate');
  assert.equal(KEY_IDS.length, 11, 'ten lost keys plus the Anchor');
  assert.equal(CREW_IDS.length, 11, 'ten recruits plus Barnaby');
  assert.deepEqual(Object.keys(KEY_FOR_STAGE).map(Number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const meta = createDefaultMeta();
  assert.ok(storyUnseen(meta, 'prologue')); markStory(meta, 'prologue'); assert.ok(!storyUnseen(meta, 'prologue'));
});

test('keys: the Keysmith makes them stronger and quicker to charge', () => {
  for (const id of KEY_IDS) {
    const a = keyStats(id, 1); const b = keyStats(id, 5);
    assert.ok(b.power > a.power && b.need < a.need, id);
  }
});

test('keys: sinks charge the key (horde 1, specialists 3, elites 12, lords nothing)', () => {
  const run = flatRun(2);
  run.key = createKeyState('anchor', 1);
  const horde = createEnemy('raider_longboat', 0, 0); const cutter = createEnemy('pirate_cutter', 0, 0);
  const elite = createEnemy('pirate_cutter', 0, 0); elite.elite = true;
  const lord = createEnemy('pirate_cutter', 0, 0); lord.warlord = true;
  assert.equal(chargeKey(run, [horde, cutter, lord]), 0);
  assert.equal(run.key.charge, 4);
  assert.equal(chargeKey(run, [elite, elite, elite, elite]), 0);
  assert.equal(run.key.charge, 52);
  assert.ok(!keyReady(run));
  assert.equal(chargeKey(run, [cutter]), 1, 'reports the frame it fills');
  assert.equal(run.key.charge, run.key.need, 'capped');
  assert.equal(chargeKey(run, [cutter]), 0, 'only once');
});

test('keys: the Anchor Key hurts and hurls back what is near, and needs a full charge', () => {
  const run = flatRun(3);
  run.key = createKeyState('anchor', 1);
  const near = add(run, 'pirate_cutter', 120, 0); const far = add(run, 'pirate_cutter', 600, 0);
  assert.equal(useKey(run, []), null, 'empty key does nothing');
  run.key.charge = run.key.need;
  const hits = []; const fx = useKey(run, hits);
  assert.equal(fx.kind, 'shock');
  assert.ok(near.health < 500 && near.x > run.boat.x + 120, 'hit and pushed away');
  assert.equal(far.health, 500);
  assert.equal(run.key.charge, 0); assert.equal(run.key.uses, 1);
  assert.ok(hits.some((h) => h.enemy === near && h.keyHit));
});

test('keys: the Frost Key freezes the crowd (not the boss) and frozen ships take more damage', () => {
  const run = flatRun(4);
  run.key = createKeyState('frost', 1); run.key.charge = run.key.need;
  const e = add(run, 'pirate_cutter', 100, 0); const boss = add(run, 'pirate_cutter', -100, 0); boss.isBoss = true;
  useKey(run, []);
  assert.ok(e.frozenT > 0); assert.ok(!(boss.frozenT > 0));
  const before = e.health; applyDamageToEnemy(e, 10);
  assert.ok(Math.abs(before - e.health - 15) < 1e-6, 'x1.5 while frozen');
  for (let i = 0; i < 6 * 30; i++) stepKeyEffects(run, 1 / 30);
  assert.equal(e.frozenT, 0, 'thaws');
});

test('keys: the Ghost, Lantern and Prism keys are timed buffs', () => {
  const run = flatRun(5);
  run.key = createKeyState('ghost', 1); run.key.charge = run.key.need;
  useKey(run, []);
  assert.ok(run.dash.iframes >= 5); assert.equal(keyBuffs(run).pierce, 2);
  run.key = createKeyState('lantern', 1); run.key.charge = run.key.need; useKey(run, []);
  const kb = keyBuffs(run); assert.ok(kb.reload < 1 && kb.damage > 1);
  run.keyBuff = kb;
  const buffed = weaponStats(run, 'cannonballs'); run.keyBuff = null;
  assert.ok(buffed.damage > weaponStats(run, 'cannonballs').damage);
  for (let i = 0; i < 9 * 10; i++) stepKeyEffects(run, 0.1);
  assert.equal(keyBuffs(run).damage, 1, 'wears off');
});

test('keys: the Deep Key drags enemies in, then bursts', () => {
  const run = flatRun(6);
  run.key = createKeyState('deep', 1); run.key.charge = run.key.need;
  const e = add(run, 'pirate_cutter', 250, 0, 1000);
  useKey(run, []);
  const d0 = Math.hypot(e.x - run.boat.x, e.y - run.boat.y);
  let burst = 0; const hits = [];
  for (let i = 0; i < 4 * 30; i++) { const o = stepKeyEffects(run, 1 / 30); burst += o.fx.length; hits.push(...o.hits); }
  assert.ok(Math.hypot(e.x - run.boat.x, e.y - run.boat.y) < d0 - 100, 'pulled in');
  assert.equal(burst, 1); assert.ok(hits.some((h) => h.enemy === e));
});

test('keys: the frame loop turns the key on input and the run carries the equipped key', () => {
  const meta = createDefaultMeta(); meta.keysOwned.push('storm'); meta.keyEquipped = 'storm'; meta.keyLevels.storm = 3;
  const run = createSurvivalRun(7, resolveLoadout(meta));
  assert.equal(run.key.id, 'storm'); assert.equal(run.key.level, 3);
  run.enemies = []; add(run, 'pirate_cutter', 150, 0);
  run.key.charge = run.key.need;
  const ev = stepSurvivalFrame(run, 1 / 30, { x: 0, y: 0, key: true }, { spawnDist: 520, rng: () => 0.5 });
  assert.equal(ev.keyUsed?.kind, 'storm'); assert.ok(ev.keyUsed.arcs.length >= 1);
});

test('crew: passives grow with bond, berths are limited, Hollis cheats death once', () => {
  const meta = createDefaultMeta();
  assert.ok(Math.abs(crewEffects(meta).weapon.grapeshot - 1.15) < 1e-9);
  meta.crewBond.barnaby = 45; assert.equal(bondLevel(meta, 'barnaby'), 5);
  assert.ok(Math.abs(crewEffects(meta).weapon.grapeshot - 1.225) < 1e-9, '+10% of the gift per bond level');
  meta.crewOwned.push('juno', 'hollis');
  toggleCrew(meta, 'juno'); toggleCrew(meta, 'hollis');
  assert.deepEqual(meta.crewAboard, ['juno', 'hollis'], 'two berths: the first aboard stepped off');
  assert.equal(purchaseCrewQuarters(meta).reason, 'locked');
  const run = createSurvivalRun(8, resolveLoadout(meta));
  assert.equal(run.cheatDeath, 1);
  run.enemies = []; run.boat.health = 0;
  const ev = stepSurvivalFrame(run, 1 / 30, { x: 0, y: 0 }, { spawnDist: 520, rng: () => 0.5 });
  assert.ok(ev.cheated); assert.equal(run.boat.health, 1, 'Hollis kept the ship afloat');
  run.boat.health = 0;
  assert.ok(!stepSurvivalFrame(run, 1 / 30, { x: 0, y: 0 }, { spawnDist: 520, rng: () => 0.5 }).cheated, 'once a level');
});

test('a stage boss brings its key home and its recruit aboard, once', () => {
  const meta = createDefaultMeta();
  const won = { outcome: 'victory', bossDefeated: true, reefIndex: 4, stage: 1, crew: ['barnaby'] };
  const got = recordDepth(meta, won);
  assert.equal(got.key, 'tide'); assert.equal(got.recruit, 'juno'); assert.equal(got.chapter.stage, 1);
  assert.ok(meta.keysOwned.includes('tide')); assert.deepEqual(meta.crewAboard, ['barnaby', 'juno']);
  assert.equal(meta.crewBond.barnaby, 1);
  const again = recordDepth(meta, won);
  assert.equal(again.key, null); assert.equal(again.recruit, null);
  recordDepth(meta, { outcome: 'sunk', reefIndex: 2, stage: 1, crew: ['barnaby'] });
  assert.equal(meta.crewBond.barnaby, 2.25, 'a sinking still counts a little');
  const before = JSON.stringify(meta);
  recordDepth(meta, { ...won, stage: 2, daily: true });
  assert.equal(JSON.stringify(meta), before, 'daily voyages tell no story');
  assert.match(nanaLine({ outcome: 'sunk', sv: { lastHurtBy: 'pirate_cutter' } }, () => 0), /Pirate Cutter/);
});

test('shop: QoL is open from the start; the rest waits for stages; top levels need Kraken Scales', () => {
  const meta = createDefaultMeta(); meta.salvage = 1e6; meta.krakenScales = 0;
  assert.equal(purchaseCharm(meta, 'sea_legs').ok, true);
  assert.equal(purchaseHull(meta, 'galleon').reason, 'locked');
  assert.equal(purchaseRefit(meta, 'sloop', 'plating').ok, true);
  assert.equal(purchaseRefit(meta, 'sloop', 'plating').ok, true);
  assert.equal(purchaseRefit(meta, 'sloop', 'plating').reason, 'locked', 'level 3 waits for a cleared stage');
  meta.highestStageUnlocked = 11;
  for (let i = 0; i < 5; i++) assert.equal(purchaseRefit(meta, 'sloop', 'plating').ok, true);
  const p8 = nextRefitPrice(meta, 'sloop', 'plating');
  assert.equal(p8.level, 8); assert.ok(p8.scales > 0);
  assert.equal(purchaseRefit(meta, 'sloop', 'plating').reason, 'scales');
  for (let l = 2; l <= 10; l++) assert.ok(nextMasteryPrice({ ...meta, mastery: { cannonballs: l - 1 } }, 'cannonballs').salvage > nextMasteryPrice({ ...meta, mastery: { cannonballs: l - 2 } }, 'cannonballs').salvage);
  assert.equal(purchaseMastery(meta, 'cannonballs').ok, true);
  assert.equal(purchaseKeyLevel(meta, 'tide').reason, 'not_owned');
  assert.equal(purchaseWake(meta, 'rainbow').ok, true);
});

test('save: depth fields survive a reload and junk is dropped', () => {
  const store = {};
  const raw = { ...createDefaultMeta(), keysOwned: ['anchor', 'tide', 'nope'], keyEquipped: 'nope', keyLevels: { tide: 9, zzz: 2 },
    crewOwned: ['barnaby', 'juno', 'ghost'], crewAboard: ['juno', 'ghost', 'barnaby', 'barnaby'], crewSlots: 7,
    refits: { sloop: { plating: 99, bogus: 3 } }, mastery: { cannonballs: 4, laser: 3 }, wakesOwned: ['gold', 'x'], wake: 'x', storySeen: { prologue: 1 } };
  store['shatteredReef.meta.v1'] = JSON.stringify(raw);
  const m = loadMeta(memStore(store));
  assert.deepEqual(m.keysOwned, ['anchor', 'tide']); assert.equal(m.keyEquipped, 'anchor'); assert.deepEqual(m.keyLevels, { tide: 5 });
  assert.deepEqual(m.crewOwned, ['barnaby', 'juno']); assert.equal(m.crewSlots, 3); assert.deepEqual(m.crewAboard, ['juno', 'barnaby']);
  assert.deepEqual(m.refits, { sloop: { plating: 10 } }); assert.deepEqual(m.mastery, { cannonballs: 4 });
  assert.deepEqual(m.wakesOwned, ['foam', 'gold']); assert.equal(m.wake, 'foam'); assert.equal(m.storySeen.prologue, true);
  assert.deepEqual(sanitizeDepth({}, {}).keysOwned, defaultDepth().keysOwned);
});

test('mastery and refits reach the run', () => {
  const meta = createDefaultMeta();
  meta.mastery.cannonballs = 10; meta.refits.sloop = { plating: 5, guns: 4 };
  const plain = flatRun(9);
  const run = flatRun(9, resolveLoadout(meta));
  const a = weaponStats(plain, 'cannonballs'); const b = weaponStats(run, 'cannonballs');
  assert.ok(b.damage > a.damage * 1.6 * 1.19, 'mastery x1.6 and gun deck x1.2');
  assert.equal(b.count, a.count + 1); assert.ok(b.cooldown < a.cooldown);
  assert.equal(run.boat.maxHealth ?? run.boat.maxHull, (plain.boat.maxHealth ?? plain.boat.maxHull) + 40);
});

test('unlock pace: QoL inside two hours, everything takes well over a full day', () => {
  const items = shopCatalogue();
  assert.ok(items.length > 300);
  const h = unlockHours(items);
  assert.ok(h.qol <= 2, `QoL ${h.qol.toFixed(1)}h`);
  assert.ok(h.mid > h.qol);
  assert.ok(h.all >= 24, `everything ${h.all.toFixed(1)}h`);
});

// Warlords and bosses with signature moves (engine/warlord.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initLord, stepLord, LORD_KITS, LORD_TRAITS } from '../src/engine/warlord.mjs';
import { createSurvivalRun } from '../src/engine/survivalRun.mjs';
import { stepDirector } from '../src/engine/survival.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

function lord(kitLevel, boss = false) {
  const e = { id: 1, x: 300, y: 300, vx: 0, vy: 0, radius: 18, health: 100, maxHealth: 100, damageScale: 1 };
  initLord(e, { levelIndex: kitLevel, stage: 1, boss }, makeSeededRng(2));
  return e;
}
const fakeRun = (bx = 300, by = 460) => ({ boat: { x: bx, y: by, vx: 0, vy: 0, health: 100 }, coast: null });

test('each level\'s final enemy brings more than the last', () => {
  for (let i = 1; i < LORD_KITS.length - 1; i++) assert.ok(LORD_KITS[i].length >= LORD_KITS[i - 1].length);
  assert.ok(LORD_KITS[4].includes('shield'));
  assert.ok(new Set(LORD_KITS.map((k) => k.join())).size === LORD_KITS.length, 'every level is different');
});

test('nova: telegraphs, then fires a full ring', () => {
  const e = lord(1);
  const run = fakeRun(); const shots = []; const rng = makeSeededRng(4);
  let windupSeen = false; let fired = 0;
  for (let t = 0; t < 12 && !fired; t += 0.05) {
    const out = stepLord(run, e, 0.05, rng, () => null, shots);
    if (e.lord.novaWindup > 0) windupSeen = true;
    if (out.nova) fired = out.nova;
  }
  assert.ok(windupSeen, 'wound up before firing');
  assert.ok(fired >= LORD_TRAITS.nova.count);
  assert.equal(shots.length, fired);
});

test('charge: marks a lane, holds still, then rams a ship that stays put', () => {
  const e = lord(2);
  const run = fakeRun(); const rng = makeSeededRng(5);
  let aimed = false; let rammed = 0;
  for (let t = 0; t < 15 && !rammed; t += 0.02) {
    const x0 = e.x;
    const out = stepLord(run, e, 0.02, rng, () => null, []);
    if (e.lord.charge?.state === 'aim') { aimed = true; assert.equal(e.x, e.lord.charge.hx); }
    if (out.rammed) rammed = out.rammed;
    void x0;
  }
  assert.ok(aimed && rammed > 0);
});

test('charge can be dodged by leaving the lane', () => {
  const e = lord(2);
  const run = fakeRun(); const rng = makeSeededRng(5);
  let rammed = 0;
  for (let t = 0; t < 15; t += 0.02) {
    if (e.lord.charge?.state === 'aim' && e.lord.charge.t < 0.5) run.boat.x = 300 + 120; // sidestep
    const out = stepLord(run, e, 0.02, rng, () => null, []);
    if (out.rammed) rammed++;
    if (!e.lord.charge && rammed === 0 && run.boat.x !== 300) break;
  }
  assert.equal(rammed, 0);
});

test('shield: wards at 2/3 hull, calls the crew, then drops', () => {
  const e = lord(0, true);
  const run = fakeRun(); const rng = makeSeededRng(6);
  let crew = 0;
  e.health = 60;
  const out = stepLord(run, e, 0.05, rng, () => { crew++; return {}; }, []);
  assert.ok(out.shieldUp && e.warded && crew > 0);
  let down = false;
  for (let t = 0; t < 5 && !down; t += 0.1) down = !!stepLord(run, e, 0.1, rng, () => null, []).shieldDown;
  assert.ok(down && !e.warded);
});

test('the director gives wave 10\'s warlord its kit', () => {
  for (const levelIndex of [0, 3]) {
    const run = createSurvivalRun(9, undefined, { stage: 1, levelIndex });
    run.sv.wave = 9; run.sv.waveTime = 0;
    const rng = makeSeededRng(1);
    const out = stepDirector(run, 0.01, { spawnDist: 420 }, rng);
    assert.ok(out.boss && out.boss.lord);
    assert.deepEqual(out.boss.lord.kit, LORD_KITS[levelIndex === 4 ? 4 : levelIndex]);
  }
});

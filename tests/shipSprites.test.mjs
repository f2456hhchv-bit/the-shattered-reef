import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SHIP_SPRITE_FRAMES, SHIP_SPRITE_VIEWS, spriteViewFor, spriteRefWidth } from '../src/engine/shipSprites.mjs';
import { HULL_IDS } from '../src/data/meta.mjs';

const deg = (d) => (d * Math.PI) / 180;

test('cardinal headings pick the right view and mirror', () => {
  assert.deepEqual(spriteViewFor(deg(90)), { view: 0, flip: false }); // south, bow to camera
  assert.deepEqual(spriteViewFor(deg(180)), { view: 4, flip: false }); // west, broadside
  assert.deepEqual(spriteViewFor(deg(270)), { view: 8, flip: false }); // north, stern to camera
  assert.deepEqual(spriteViewFor(deg(-90)), { view: 8, flip: false });
  assert.deepEqual(spriteViewFor(deg(0)), { view: 4, flip: true }); // east = mirrored west
  assert.deepEqual(spriteViewFor(deg(45)), { view: 2, flip: true }); // south-east = mirrored south-west
  assert.deepEqual(spriteViewFor(deg(315)), { view: 6, flip: true }); // north-east = mirrored north-west
});

test('16 headings map to 16 distinct (view, flip) pairs', () => {
  const seen = new Set();
  for (let i = 0; i < 16; i++) {
    const v = spriteViewFor(deg(i * 22.5));
    assert.ok(v.view >= 0 && v.view < SHIP_SPRITE_VIEWS);
    // Due south / north look the same mirrored or not; count them once.
    seen.add(v.view === 0 || v.view === 8 ? `${v.view}` : `${v.view}${v.flip}`);
  }
  assert.equal(seen.size, 16);
  // Small heading changes never jump more than one view.
  let prev = spriteViewFor(0);
  for (let d = 1; d <= 360; d++) {
    const v = spriteViewFor(deg(d));
    if (v.flip === prev.flip) assert.ok(Math.abs(v.view - prev.view) <= 1, `jump at ${d}`);
    prev = v;
  }
});

function pngSize(path) {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test('every atlas exists, holds its frames, and anchors sit inside them', () => {
  for (const [id, frames] of Object.entries(SHIP_SPRITE_FRAMES)) {
    assert.ok(Object.values(HULL_IDS).includes(id), `${id} is a hull`);
    assert.equal(frames.length, SHIP_SPRITE_VIEWS);
    const path = new URL(`../assets/ships/${id}.png`, import.meta.url);
    assert.ok(existsSync(path), `${id}.png exists`);
    const { w, h } = pngSize(path);
    for (const [x, y, fw, fh, ax, ay] of frames) {
      assert.ok(x >= 0 && y >= 0 && x + fw <= w && y + fh <= h, `${id} frame in atlas`);
      assert.ok(ax > 0 && ax < fw && ay > fh * 0.4 && ay < fh, `${id} anchor on the hull`);
    }
    assert.ok(spriteRefWidth(id) > 0);
  }
});

import { recolourPixels, classifyPixel, lookKey } from '../src/engine/shipRecolour.mjs';
import { ENEMY_SHIP_LOOKS } from '../src/data/enemyShipLooks.mjs';
import { ENEMIES } from '../src/data/enemies.mjs';

test('recolour: cream sail takes the new colour with its shading, hull keeps its own', () => {
  const px = new Uint8ClampedArray([
    235, 225, 200, 255, // bright cream sail
    150, 140, 120, 255, // shaded cream sail (folds)
    110, 70, 40, 255, // brown hull
    40, 170, 170, 255, // teal flag
    0, 0, 0, 0, // transparent
  ]);
  assert.equal(classifyPixel('sloop', 235, 225, 200), 'sail');
  assert.equal(classifyPixel('sloop', 110, 70, 40), 'hull');
  assert.equal(classifyPixel('sloop', 40, 170, 170), 'flag');
  recolourPixels(px, 'sloop', { sail: '#b8322a', flag: '#111111' });
  assert.ok(px[0] > px[1] * 2, 'sail is red');
  assert.ok(px[4] < px[0], 'fold stays darker than the lit cloth');
  assert.deepEqual([...px.slice(8, 12)], [110, 70, 40, 255], 'hull untouched without a hull tint');
  assert.ok(px[12] < 30 && px[13] < 30, 'flag recoloured');
  assert.equal(px[19], 0, 'transparent stays transparent');
});

test('recolour: ghost looks are see-through', () => {
  const px = new Uint8ClampedArray([110, 70, 40, 255]);
  recolourPixels(px, 'sloop', { ghost: true });
  assert.ok(px[3] < 255 && px[2] > px[0]);
  assert.notEqual(lookKey({ ghost: true }), lookKey({ sail: '#000000' }));
});

test('every enemy ship look names a painted hull and a real enemy sprite', () => {
  const keys = new Set(Object.values(ENEMIES).map((d) => d.sprite || d.id));
  for (const [k, v] of Object.entries(ENEMY_SHIP_LOOKS)) {
    assert.ok(SHIP_SPRITE_FRAMES[v.hull], `${k} uses a painted hull`);
    assert.ok(keys.has(k), `${k} is an enemy sprite key`);
  }
});

import { CREATURE_ART, CREATURE_FILES } from '../src/data/creatureArt.mjs';
import { creatureRotation } from '../src/engine/creatureSprites.mjs';

test('creature art: every file exists and every key is a real enemy id or sprite key', () => {
  const keys = new Set(Object.values(ENEMIES).flatMap((d) => [d.id, d.sprite].filter(Boolean)));
  for (const f of CREATURE_FILES) assert.ok(existsSync(new URL(`../assets/creatures/${f}.png`, import.meta.url)), `${f}.png`);
  for (const [k, a] of Object.entries(CREATURE_ART)) {
    assert.ok(keys.has(k.replace(/_flying$/, '')), `${k} is an enemy`);
    assert.ok(a.mode === 'turn' || a.mode === 'face');
    assert.ok(a.size > 1.5 && a.size < 5);
  }
});

test('creature art: turning art points along the heading', () => {
  // Art drawn pointing up (−y) must rotate by +90° to point east (heading 0).
  assert.ok(Math.abs(creatureRotation({ forward: 'up' }, 0) - Math.PI / 2) < 1e-9);
  assert.equal(creatureRotation({ forward: 'right' }, 1.2), 1.2);
});

import { BUILDING_SPRITES, buildingSpriteRect } from '../src/engine/buildingSprites.mjs';
import { BASE_BUILDINGS } from '../src/data/base.mjs';

test('building sprites: files exist, ids are real buildings, art stands on its ground point', () => {
  const ids = new Set(BASE_BUILDINGS.map((b) => b.id));
  for (const [id, s] of Object.entries(BUILDING_SPRITES)) {
    assert.ok(ids.has(id), `${id} is a harbour building`);
    const path = new URL(`../assets/buildings/${s.file}.png`, import.meta.url);
    assert.ok(existsSync(path), `${s.file}.png`);
    const { w, h } = pngSize(path);
    const r = buildingSpriteRect(id, 0, 0, { w, h });
    assert.ok(Math.abs(r.x + r.w / 2) < 1e-9 && r.y + r.h > 0 && r.y < -40, `${id} drawn upright on its ground point`);
    assert.ok(r.h < 120 && r.w < 100, `${id} fits the building footprint`);
  }
});

test('tower sprites: every tower and the Heart has an image, upright on its ground point', async () => {
  const { TOWER_SPRITES, towerSpriteRect, towerSpriteScale } = await import('../src/engine/towerSprites.mjs');
  const { TOWERS } = await import('../src/data/towers.mjs');
  for (const id of [...Object.keys(TOWERS), 'heart']) {
    const s = TOWER_SPRITES[id];
    assert.ok(s, `${id} has a sprite entry`);
    const path = new URL(`../assets/towers/${s.file}.png`, import.meta.url);
    assert.ok(existsSync(path), `${s.file}.png`);
    const { w, h } = pngSize(path);
    const r = towerSpriteRect(id, 0, 0, 1, { w, h });
    assert.ok(Math.abs(r.x + r.w / 2) < 1e-9 && r.y < -10 && r.y + r.h > 0, `${id} upright`);
  }
  assert.ok(towerSpriteScale(3) > towerSpriteScale(1));
});

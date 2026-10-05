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

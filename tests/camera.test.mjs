import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCameraView, applyCameraTransform, createCamera, updateCamera } from '../src/engine/camera.mjs';

const VW = 400;
const VH = 800;
const MAP = 1600; // bigger than the viewport both ways

// Where a world point lands on screen under a given view.
const toScreen = (view, wx, wy) => ({ x: wx + view.translateX, y: wy + view.translateY });

test('with no insets, behaves exactly like the original clamp (backward compatible)', () => {
  const view = computeCameraView({ x: 800, y: 800 }, VW, VH, MAP, MAP);
  assert.equal(view.cx, 800);
  assert.equal(view.cy, 800);
  assert.deepEqual(toScreen(view, 800, 800), { x: VW / 2, y: VH / 2 });
});

// Regression (2026-09-28 playtest): the spawn is always the maze's top-left
// start cell; clamping to the full screen put the boat under the weapon bar.
test('a boat at the map\'s top-left corner renders below the top HUD inset, not under it', () => {
  const insets = { top: 150, right: 0, bottom: 110, left: 0 };
  const boat = { x: 48, y: 48 }; // center of the top-left start room
  const view = computeCameraView(boat, VW, VH, MAP, MAP, insets);
  const s = toScreen(view, boat.x, boat.y);
  assert.ok(s.y >= insets.top, `boat drawn at screen y=${s.y}, should be at/below the HUD band ending at ${insets.top}`);
  assert.equal(toScreen(view, 0, 0).y, insets.top, 'the map\'s top edge should sit exactly at the inset boundary');
});

test('a boat at the map\'s bottom edge renders above the bottom (fire button) inset', () => {
  const insets = { top: 150, right: 0, bottom: 110, left: 0 };
  const boat = { x: 800, y: MAP - 20 };
  const view = computeCameraView(boat, VW, VH, MAP, MAP, insets);
  assert.ok(toScreen(view, boat.x, boat.y).y <= VH - insets.bottom);
  assert.equal(toScreen(view, 0, MAP).y, VH - insets.bottom, 'map bottom edge should sit exactly at the bottom inset');
});

test('mid-map, the target is centered in the usable region between insets', () => {
  const insets = { top: 150, right: 0, bottom: 110, left: 0 };
  const view = computeCameraView({ x: 800, y: 800 }, VW, VH, MAP, MAP, insets);
  const s = toScreen(view, 800, 800);
  assert.equal(s.y, 150 + (VH - 150 - 110) / 2);
  assert.equal(s.x, VW / 2);
});

test('visible rect covers the whole screen in world space, even with asymmetric insets (tile culling)', () => {
  const insets = { top: 150, right: 0, bottom: 0, left: 0 };
  const view = computeCameraView({ x: 800, y: 800 }, VW, VH, MAP, MAP, insets);
  assert.equal(toScreen(view, view.visible.left, view.visible.top).x, 0);
  assert.equal(toScreen(view, view.visible.left, view.visible.top).y, 0);
  assert.equal(toScreen(view, view.visible.right, view.visible.bottom).x, VW);
  assert.equal(toScreen(view, view.visible.right, view.visible.bottom).y, VH);
});

test('a map smaller than the usable region is centered within it', () => {
  const insets = { top: 100, right: 0, bottom: 100, left: 0 };
  const view = computeCameraView({ x: 0, y: 0 }, VW, VH, 200, 200, insets);
  assert.deepEqual(toScreen(view, 100, 100), { x: VW / 2, y: 100 + (VH - 200) / 2 });
});

test('applyCameraTransform translates by the view offset plus shake, and returns the view', () => {
  const calls = [];
  const ctx = { translate: (x, y) => calls.push([x, y]) };
  const insets = { top: 150, right: 0, bottom: 0, left: 0 };
  const view = applyCameraTransform(ctx, { x: 800, y: 800 }, VW, VH, MAP, MAP, { x: 3, y: -2 }, insets);
  assert.deepEqual(calls, [[view.translateX + 3, view.translateY - 2]]);
});

test('updateCamera converges on its target', () => {
  const cam = createCamera();
  for (let i = 0; i < 120; i++) updateCamera(cam, 100, 50, 1 / 60);
  assert.ok(Math.abs(cam.x - 100) < 0.1 && Math.abs(cam.y - 50) < 0.1);
});

// Landscape layout (2026-09-28): the weapon grid + fire button form a RIGHT
// band instead of top/bottom bands.
test('a right-side HUD band keeps the map\'s right edge — and a boat on it — clear of the controls', () => {
  const insets = { top: 42, right: 146, bottom: 0, left: 0 };
  const W = 667, H = 375;
  const boat = { x: MAP - 30, y: 800 };
  const view = computeCameraView(boat, W, H, MAP, MAP, insets);
  assert.ok(toScreen(view, boat.x, boat.y).x <= W - insets.right, 'boat must render left of the control band');
  assert.equal(toScreen(view, MAP, 0).x, W - insets.right, 'map right edge sits exactly at the band');
  // Mid-map vertically, so no vertical clamp — the boat is centred in the
  // usable height (the top-inset clamp has its own test above).
  const sy = toScreen(view, boat.x, boat.y).y;
  assert.equal(sy, insets.top + (H - insets.top - insets.bottom) / 2);
});

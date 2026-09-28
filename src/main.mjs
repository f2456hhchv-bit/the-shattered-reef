// Boots the game: canvas setup, the run/level, input, the game loop, and
// (for now, this early) a minimal HUD. This is step 2 of the build order —
// prove the core "steer a weighty boat through a generated maze" feel on a
// touch screen before combat, enemies or any content go anywhere near it.

import { createRun, checkReachedExit, checkSunk } from './engine/run.mjs';
import { stepBoat, resolveTileCollision, applyWallImpactDamage, DEFAULT_BOAT_TUNING, MAX_HULL } from './engine/boat.mjs';
import { createCamera, updateCamera, applyCameraTransform } from './engine/camera.mjs';
import { drawTileGrid, drawExit, drawBoat, PALETTE } from './engine/renderer.mjs';
import { createJoystick } from './input/joystick.mjs';

export function startApp(root) {
  root.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  root.appendChild(canvas);

  const touchLayer = document.createElement('div');
  touchLayer.id = 'touch-layer';
  root.appendChild(touchLayer);

  const hud = document.createElement('div');
  hud.id = 'hud';
  hud.innerHTML = `
    <span id="hud-status">Find the exit ⚓</span>
    <div id="hull-bar"><div id="hull-bar-fill"></div></div>
  `;
  root.appendChild(hud);

  const hitFlash = document.createElement('div');
  hitFlash.id = 'hit-flash';
  root.appendChild(hitFlash);

  const ctx = canvas.getContext('2d');
  const joystick = createJoystick(touchLayer);

  let run = createRun(Date.now() & 0xffffffff);
  const camera = createCamera();
  camera.x = run.boat.x;
  camera.y = run.boat.y;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function setStatus(text) {
    document.getElementById('hud-status').textContent = text;
  }

  function updateHullBar() {
    const pct = Math.max(0, Math.min(100, (run.boat.health / MAX_HULL) * 100));
    const fill = document.getElementById('hull-bar-fill');
    fill.style.width = `${pct}%`;
    fill.classList.toggle('low', pct <= 30);
  }

  let flashTimer = null;
  function flashHit() {
    hitFlash.classList.add('show');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => hitFlash.classList.remove('show'), 160);
  }

  function nextRun() {
    run = createRun((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) & 0xffffffff);
    camera.x = run.boat.x;
    camera.y = run.boat.y;
    setStatus('Find the exit ⚓');
    updateHullBar();
  }

  // A tiny debug hook for headless/automated testing — not user-facing,
  // costs nothing at runtime, and saves having to poke at internals.
  window.__shatteredReefDebug = () => ({
    boatX: run.boat.x, boatY: run.boat.y, heading: run.boat.heading,
    hull: run.boat.health, cameraX: camera.x, cameraY: camera.y,
    over: run.over, outcome: run.outcome,
  });

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000); // clamp so a tab-switch stall can't fling the boat
    lastTime = now;

    if (!run.over) {
      const vec = joystick.getVector();
      stepBoat(run.boat, vec, dt, DEFAULT_BOAT_TUNING);
      const impactSpeed = resolveTileCollision(run.boat, 11, run.grid, run.tileSize);
      const damage = applyWallImpactDamage(run.boat, impactSpeed);
      if (damage > 0) {
        updateHullBar();
        flashHit();
      }
      if (checkSunk(run)) {
        setStatus('Your ship has sunk! Tap to try again ⚓');
      } else if (checkReachedExit(run)) {
        setStatus('Reef cleared! Tap to sail a new one ⚓');
      }
    }

    updateCamera(camera, run.boat.x, run.boat.y, dt);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    const { cx, cy } = applyCameraTransform(ctx, camera, vw, vh, run.widthPx, run.heightPx);
    drawTileGrid(ctx, run.grid, run.tileSize, cx - vw / 2, cy - vh / 2, cx + vw / 2, cy + vh / 2);
    drawExit(ctx, run.exitWorld.x, run.exitWorld.y, run.tileSize * 0.9, now / 1000);
    if (run.outcome !== 'sunk') drawBoat(ctx, run.boat, 11);
    ctx.restore();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  updateHullBar();

  function tapToContinue() {
    if (run.over) nextRun();
  }
  hud.addEventListener('click', tapToContinue);
  touchLayer.addEventListener('pointerup', tapToContinue);
}

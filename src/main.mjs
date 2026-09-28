// Boots the game: canvas setup, the run/level, input, combat, the game
// loop, and the HUD. Step 3 (combat core) is now wired in alongside the
// step 2 navigation loop: weapons, projectiles, hit detection, and enemy
// AI with niches — the Overboard hook (wrong weapon = little/no effect).

import { createRun, checkReachedExit, checkSunk, addSalvage, totalSalvage, BOAT_RADIUS } from './engine/run.mjs';
import { stepBoat, resolveTileCollision, applyWallImpactDamage, DEFAULT_BOAT_TUNING, MAX_HULL } from './engine/boat.mjs';
import { createCamera, updateCamera, applyCameraTransform } from './engine/camera.mjs';
import { drawTileGrid, drawExit, drawBoat, drawEnemies, drawProjectiles, drawPickups, PALETTE } from './engine/renderer.mjs';
import { createJoystick } from './input/joystick.mjs';
import {
  tryFire, stepCombat, resolveHits, cleanupProjectiles, stepBurn, setActiveWeapon, ammoFor, isHeld,
} from './engine/combat.mjs';
import { updateEnemies, resolveEnemyContacts, currentCounter } from './engine/enemies.mjs';
import { collectPickups } from './engine/pickups.mjs';
import { PICKUP_KINDS } from './data/pickups.mjs';
import { WEAPON_LIST, getWeapon } from './data/weapons.mjs';
import { getEnemy } from './data/enemies.mjs';

const WEAPON_SHORT_LABEL = {
  chain_shot: 'CS', grapeshot: 'GS', depth_charges: 'DC', flame_barrels: 'FB', cannonballs: 'CB',
};

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
    <div id="stat-row">
      <span id="reef-indicator">Reef 1/3</span>
      <span id="salvage-counter">⚓ Salvage: 0</span>
    </div>
    <div id="weapon-bar"></div>
  `;
  root.appendChild(hud);

  const summaryOverlay = document.createElement('div');
  summaryOverlay.id = 'run-summary';
  summaryOverlay.innerHTML = `
    <div id="run-summary-card">
      <h1 id="run-summary-title"></h1>
      <div id="run-summary-body"></div>
      <button type="button" id="run-summary-btn">Sail again ⚓</button>
    </div>
  `;
  root.appendChild(summaryOverlay);
  const summaryTitle = summaryOverlay.querySelector('#run-summary-title');
  const summaryBody = summaryOverlay.querySelector('#run-summary-body');
  const summaryBtn = summaryOverlay.querySelector('#run-summary-btn');

  const fireButton = document.createElement('button');
  fireButton.id = 'fire-button';
  fireButton.type = 'button';
  fireButton.textContent = '🔥';
  root.appendChild(fireButton);

  const hitFlash = document.createElement('div');
  hitFlash.id = 'hit-flash';
  root.appendChild(hitFlash);

  const toast = document.createElement('div');
  toast.id = 'pickup-toast';
  root.appendChild(toast);
  let toastTimer = null;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
  }

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

  function updateSalvageCounter() {
    document.getElementById('salvage-counter').textContent = `⚓ Salvage: ${totalSalvage(run)}`;
  }

  function updateReefIndicator() {
    document.getElementById('reef-indicator').textContent = `Reef ${run.reefIndex + 1}/${run.reefCount}`;
  }

  // Weapon-select bar: one button per weapon, thumb-sized, showing ammo
  // (∞ for Cannonballs) and highlighting the active weapon. A tap swaps
  // the active weapon without touching the joystick or fire button, so it
  // works alongside steering with the same hand per the touch-first rule.
  const weaponBar = document.getElementById('weapon-bar');
  const weaponButtons = {};
  for (const weapon of WEAPON_LIST) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'weapon-btn';
    btn.dataset.weaponId = weapon.id;
    btn.innerHTML = `<span class="weapon-name">${weapon.name}</span><span class="weapon-ammo"></span>`;
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!isHeld(run.weapons, weapon.id)) return; // locked — found via a weapon cache pickup
      setActiveWeapon(run.weapons, weapon.id);
      updateWeaponBar();
    });
    weaponBar.appendChild(btn);
    weaponButtons[weapon.id] = btn;
  }

  // Unheld weapons (not yet found this run — everything but Cannonballs at
  // the start, per the loot/economy design: the niche kit is discovered via
  // weapon-cache pickups, not available from the outset) show a lock glyph
  // in place of an ammo count and can't be tapped active.
  function updateWeaponBar() {
    for (const weapon of WEAPON_LIST) {
      const btn = weaponButtons[weapon.id];
      const held = isHeld(run.weapons, weapon.id);
      btn.classList.toggle('active', held && run.weapons.activeWeaponId === weapon.id);
      btn.classList.toggle('locked', !held);
      const ammoEl = btn.querySelector('.weapon-ammo');
      if (!held) {
        ammoEl.textContent = '🔒';
      } else {
        const ammo = ammoFor(run.weapons, weapon.id);
        ammoEl.textContent = Number.isFinite(ammo) ? ammo : '∞';
      }
    }
  }

  // Tracks the specific pointer (finger) that pressed the fire button, so
  // a second finger steering the joystick — which may well cross over the
  // fire button's screen region on a small phone screen — can't cancel
  // firing just by passing near/over it. Only *that* pointer ending
  // (pointerup/pointercancel) stops firing; pointerleave is deliberately
  // not used here, since it fires for any pointer that crosses the
  // button's bounds, not just the one holding it down.
  let isFiring = false;
  let firingPointerId = null;
  fireButton.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    isFiring = true;
    firingPointerId = e.pointerId;
  });
  function stopFiring(e) {
    if (e.pointerId !== firingPointerId) return;
    e.stopPropagation();
    isFiring = false;
    firingPointerId = null;
  }
  fireButton.addEventListener('pointerup', stopFiring);
  fireButton.addEventListener('pointercancel', stopFiring);

  // Aim-assist: fires at the nearest live enemy within the active weapon's
  // range, falling back to the boat's own facing if nothing is in range.
  // Flagged as a provisional decision in the PRD's Open Risks — precise
  // manual aiming would fight the joystick for the same hand/thumb, so
  // this trades aim precision for one-handed playability; revisit if
  // playtesting says otherwise.
  function computeFireHeading() {
    const weapon = getWeapon(run.weapons.activeWeaponId);
    let target = null;
    let bestDist = weapon.range;
    for (const enemy of run.enemies) {
      if (enemy.health <= 0 || enemy.invulnerable) continue;
      const dist = Math.hypot(enemy.x - run.boat.x, enemy.y - run.boat.y);
      if (dist <= bestDist) { bestDist = dist; target = enemy; }
    }
    return target
      ? Math.atan2(target.y - run.boat.y, target.x - run.boat.x)
      : run.boat.heading;
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
    setStatus(`Reef 1 of ${run.reefCount} — find the exit ⚓`);
    toast.classList.remove('show');
    summaryOverlay.classList.remove('show');
    updateHullBar();
    updateSalvageCounter();
    updateReefIndicator();
    updateWeaponBar();
  }

  // A voyage ends in exactly two ways: cleared every reef (`victory`) or
  // sank before finishing one (`sunk`). Either way the same summary
  // screen shows what's actually true of a permadeath run — Salvage only
  // "counts" once it's banked (a completed reef's exit reached); whatever
  // was still at risk in the reef the boat died in is lost, not just
  // hidden, so a sunk run's `reefSalvage` (not yet folded into
  // `bankedSalvage`) is shown as lost rather than silently dropped.
  function showRunSummary() {
    const heldNiche = Array.from(run.weapons.heldWeapons).filter((id) => id !== 'cannonballs');
    const victory = run.outcome === 'victory';
    summaryTitle.textContent = victory ? 'Voyage complete! ⚓' : 'Your ship has sunk ⚓';
    const reefsCleared = victory ? run.reefCount : run.reefIndex;
    summaryBody.innerHTML = `
      <p>Reefs cleared: ${reefsCleared} / ${run.reefCount}</p>
      <p>Salvage banked: ${run.bankedSalvage}</p>
      ${run.reefSalvage > 0 ? `<p class="lost">Salvage lost with the ship: ${run.reefSalvage}</p>` : ''}
      <p>Weapons found: ${heldNiche.length ? heldNiche.map((id) => getWeapon(id).name).join(', ') : 'None'}</p>
    `;
    summaryOverlay.classList.add('show');
  }
  summaryBtn.addEventListener('click', nextRun);

  // A tiny debug hook for headless/automated testing — not user-facing,
  // costs nothing at runtime, and saves having to poke at internals.
  window.__shatteredReefDebug = () => ({
    boatX: run.boat.x, boatY: run.boat.y, heading: run.boat.heading,
    hull: run.boat.health, cameraX: camera.x, cameraY: camera.y,
    over: run.over, outcome: run.outcome,
    reefIndex: run.reefIndex, reefCount: run.reefCount,
    exitX: run.exitWorld.x, exitY: run.exitWorld.y,
    bankedSalvage: run.bankedSalvage, reefSalvage: run.reefSalvage,
    salvage: totalSalvage(run), activeWeapon: run.weapons.activeWeaponId,
    enemyCount: run.enemies.filter((e) => e.health > 0).length,
    projectileCount: run.weapons.projectiles.length,
    enemies: run.enemies.filter((e) => e.health > 0).map((e) => ({
      defId: e.defId, x: e.x, y: e.y, health: e.health, invulnerable: e.invulnerable,
    })),
    firing: isFiring, cooldownRemaining: run.weapons.cooldownRemaining,
    heldWeapons: Array.from(run.weapons.heldWeapons),
    pickupsRemaining: run.pickups.filter((p) => !p.collected).length,
    pickups: run.pickups.map((p) => ({
      kind: p.kind, weaponId: p.weaponId, x: p.x, y: p.y, collected: p.collected,
    })),
  });
  // Testing-only: teleports the boat, since a headless test driving the
  // touch joystick can't reliably pathfind a maze it has no map of. Not
  // reachable from any in-game UI.
  window.__shatteredReefWarp = (x, y) => { run.boat.x = x; run.boat.y = y; run.boat.vx = 0; run.boat.vy = 0; };
  // Testing-only: sets hull directly, since reliably sinking the boat by
  // simulating wall rams through a headless pointer script is unreliable
  // (wall-impact damage was already proven correct in step 2's dedicated
  // playtesting) — this just lets a test reach a "nearly sunk"/"sunk"
  // state on demand to check what happens *after*, e.g. the run summary.
  window.__shatteredReefSetHull = (hp) => { run.boat.health = hp; };
  // Testing-only: adds at-risk Salvage directly, for scripting a controlled
  // "sank with unbanked Salvage" scenario without needing to actually
  // steer onto a pickup first.
  window.__shatteredReefAddSalvage = (amount) => { addSalvage(run, amount); updateSalvageCounter(); };

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000); // clamp so a tab-switch stall can't fling the boat
    lastTime = now;

    if (!run.over) {
      const jam = run.boat.turnJamRemaining > 0;
      const tuning = jam ? { ...DEFAULT_BOAT_TUNING, turnRate: DEFAULT_BOAT_TUNING.turnRate * 0.5 } : DEFAULT_BOAT_TUNING;

      const vec = joystick.getVector();
      stepBoat(run.boat, vec, dt, tuning);
      const impactSpeed = resolveTileCollision(run.boat, BOAT_RADIUS, run.grid, run.tileSize);
      const damage = applyWallImpactDamage(run.boat, impactSpeed);
      if (damage > 0) {
        updateHullBar();
        flashHit();
      }

      if (run.boat.turnJamRemaining > 0) {
        run.boat.turnJamRemaining = Math.max(0, run.boat.turnJamRemaining - dt);
      }

      if (isFiring) {
        const fired = tryFire(run.weapons, run.boat.x, run.boat.y, computeFireHeading());
        if (fired) updateWeaponBar();
      }
      stepCombat(run.weapons, dt, run.grid, run.tileSize);
      updateEnemies(run.enemies, run.boat, dt, run.grid, run.tileSize);

      let salvageGained = 0;
      const hitEvents = resolveHits(run.weapons, run.enemies, currentCounter);
      cleanupProjectiles(run.weapons);
      for (const ev of hitEvents) if (ev.killed) salvageGained += ev.enemy.salvageDrop;
      for (const enemy of run.enemies) {
        const burnEvent = stepBurn(enemy, dt);
        if (burnEvent && burnEvent.killed) salvageGained += burnEvent.enemy.salvageDrop;
      }
      if (salvageGained > 0) {
        addSalvage(run, salvageGained);
        updateSalvageCounter();
      }

      const contactDamage = resolveEnemyContacts(run.enemies, run.boat, BOAT_RADIUS);
      if (contactDamage > 0) {
        updateHullBar();
        flashHit();
      }

      const pickupEvents = collectPickups(run.pickups, run.boat, BOAT_RADIUS, run.weapons);
      for (const ev of pickupEvents) {
        if (ev.kind === PICKUP_KINDS.WEAPON_CACHE) {
          updateWeaponBar();
          showToast(ev.freshUnlock ? `New weapon: ${getWeapon(ev.weaponId).name}! ⚓` : `${getWeapon(ev.weaponId).name} restocked ⚓`);
        } else if (ev.kind === PICKUP_KINDS.SALVAGE) {
          addSalvage(run, ev.amount);
          updateSalvageCounter();
        }
      }

      if (checkSunk(run)) {
        showRunSummary();
      } else {
        const bankedThisReef = run.reefSalvage;
        const reefResult = checkReachedExit(run);
        if (reefResult === 'victory') {
          showRunSummary();
        } else if (reefResult === 'advanced') {
          camera.x = run.boat.x;
          camera.y = run.boat.y;
          setStatus(`Reef ${run.reefIndex + 1} of ${run.reefCount} — find the exit ⚓`);
          showToast(`Reef cleared! +${bankedThisReef} Salvage banked ⚓`);
          updateReefIndicator();
          updateSalvageCounter();
          updateWeaponBar();
        }
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
    drawPickups(ctx, run.pickups, (p) => WEAPON_SHORT_LABEL[p.weaponId], now / 1000);
    drawEnemies(ctx, run.enemies, (e) => e.colorHex || enemyColor(e), now / 1000);
    drawProjectiles(ctx, run.weapons.projectiles, (p) => getWeapon(p.weaponId).color);
    if (run.outcome !== 'sunk') drawBoat(ctx, run.boat, BOAT_RADIUS);
    ctx.restore();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setStatus(`Reef 1 of ${run.reefCount} — find the exit ⚓`);
  updateHullBar();
  updateSalvageCounter();
  updateReefIndicator();
  updateWeaponBar();
}

// Resolves an enemy's draw color from its data definition, cached on the
// instance the first time (avoids a data lookup every frame for every
// enemy).
function enemyColor(enemy) {
  enemy.colorHex = getEnemy(enemy.defId).color;
  return enemy.colorHex;
}

// Boots the game: canvas setup, the run/level, input, combat, the game
// loop, the HUD, and the Captain's Hub (step 7 — meta-progression). The
// app now opens on the Hub rather than straight into a run: Salvage
// persisted across runs (localStorage, engine/meta.mjs) is spent there on
// Ship Hulls / Cargo Loadouts / Captain's Charms before "Set Sail" starts
// an actual voyage with that loadout resolved into it.

import {
  createRun, checkReachedExit, checkSunk, addSalvage, totalSalvage, BOAT_RADIUS,
} from './engine/run.mjs';
import { stepBoat, resolveTileCollision, applyWallImpactDamage } from './engine/boat.mjs';
import { createCamera, updateCamera, applyCameraTransform } from './engine/camera.mjs';
import {
  drawTileGrid, drawExit, drawBoat, drawEnemies, drawProjectiles, drawPickups,
  drawParticles, drawDamageNumbers, PALETTE,
} from './engine/renderer.mjs';
import { createJoystick } from './input/joystick.mjs';
import {
  tryFire, stepCombat, stepAmmoRegen, resolveHits, cleanupProjectiles, stepBurn, setActiveWeapon, ammoFor, isHeld,
  craftedMultiplierFor,
} from './engine/combat.mjs';
import { createEnemy, updateEnemies, resolveEnemyContacts, currentCounter, factionMultiplierFor } from './engine/enemies.mjs';
import { collectPickups } from './engine/pickups.mjs';
import { PICKUP_KINDS } from './data/pickups.mjs';
import { WEAPON_LIST, getWeapon } from './data/weapons.mjs';
import { getEnemy } from './data/enemies.mjs';
import {
  SHIP_HULL_LIST, CARGO_TIER_LIST, CHARM_LIST, PLAYABLE_FACTION_LIST, WORKSHOP_UPGRADE_LIST,
} from './data/meta.mjs';
import { triangleMultiplier } from './data/factions.mjs';
import {
  loadMeta, saveMeta, resolveLoadout, recordRunResult, canAfford,
  purchaseHull, selectHull, purchaseCargoTier, purchaseCharm,
  purchaseFaction, selectFaction,
  purchaseWorkshopUpgrade, canAffordWorkshopUpgrade,
} from './engine/meta.mjs';
import {
  createParticlePool, spawnHitSpark, spawnKillBurst, spawnExplosion, spawnSplash, updateParticles,
  createDamageNumberPool, spawnDamageNumber, updateDamageNumbers,
  createShake, addShake, updateShake,
  createHitStop, triggerHitStop, applyHitStop,
} from './engine/juice.mjs';
import {
  unlockAudio, setMuted, isMuted, playFire, playHit, playKill, playExplosion, playWallImpact,
  playPickupWeapon, playPickupSalvage, playReefCleared, playVictory, playSunk, playRevive, playLockedWeapon,
  playBossPhaseChange, playBossDefeated,
} from './audio/audio.mjs';
import { WEAPON_IDS } from './data/weapons.mjs';

const MUTE_STORAGE_KEY = 'shatteredReef.muted.v1';

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

  // A top-level sibling (not nested inside #hud) so its own z-index isn't
  // capped by #hud's stacking context — it needs to stay clickable above
  // the Hub/run-summary overlays too, not just during a run.
  const muteButton = document.createElement('button');
  muteButton.id = 'mute-button';
  muteButton.type = 'button';
  muteButton.setAttribute('aria-label', 'Mute sound');
  root.appendChild(muteButton);

  // Audio hooks (step 8, src/audio/audio.mjs) — muted state persists across
  // sessions like meta-progression does; a separate localStorage key since
  // it's a device/UI preference, not save-file state.
  function refreshMuteButton() {
    muteButton.textContent = isMuted() ? '🔇' : '🔊';
  }
  setMuted(window.localStorage.getItem(MUTE_STORAGE_KEY) === '1');
  refreshMuteButton();
  muteButton.addEventListener('click', (e) => {
    e.stopPropagation();
    setMuted(!isMuted());
    window.localStorage.setItem(MUTE_STORAGE_KEY, isMuted() ? '1' : '0');
    refreshMuteButton();
  });
  // Browsers require a real user gesture before audio can play — the first
  // pointerdown anywhere in the app (steering, firing, a Hub button) is as
  // good a gesture as any, so this listens once and gets out of the way.
  window.addEventListener('pointerdown', unlockAudio, { once: true });

  const summaryOverlay = document.createElement('div');
  summaryOverlay.id = 'run-summary';
  summaryOverlay.innerHTML = `
    <div id="run-summary-card">
      <h1 id="run-summary-title"></h1>
      <div id="run-summary-body"></div>
      <button type="button" id="run-summary-btn">Return to Hub ⚓</button>
    </div>
  `;
  root.appendChild(summaryOverlay);
  const summaryTitle = summaryOverlay.querySelector('#run-summary-title');
  const summaryBody = summaryOverlay.querySelector('#run-summary-body');
  const summaryBtn = summaryOverlay.querySelector('#run-summary-btn');

  // Captain's Hub — the app's home screen between runs. Persistent Salvage
  // (meta.salvage, separate from a single run's bankedSalvage) is spent
  // here on the 3 unlock tracks; "Set Sail" resolves the current loadout
  // (engine/meta.mjs's resolveLoadout) and starts a fresh run with it.
  const hubOverlay = document.createElement('div');
  hubOverlay.id = 'captains-hub';
  hubOverlay.innerHTML = `
    <div id="hub-card">
      <h1>Captain's Hub ⚓</h1>
      <p id="hub-salvage"></p>
      <p id="hub-stats"></p>
      <section class="hub-section">
        <h2>Ship Hulls</h2>
        <p id="hub-hulls-note" class="hub-section-note" hidden></p>
        <div id="hub-hulls" class="hub-list"></div>
      </section>
      <section class="hub-section">
        <h2>Cargo Loadouts</h2>
        <div id="hub-cargo" class="hub-list"></div>
      </section>
      <section class="hub-section">
        <h2>Captain's Charms</h2>
        <div id="hub-charms" class="hub-list"></div>
      </section>
      <section class="hub-section">
        <h2>Factions</h2>
        <div id="hub-factions" class="hub-list"></div>
      </section>
      <section class="hub-section">
        <h2>Workshop</h2>
        <p class="hub-section-note">Craft permanent upgrades with Salvage + Kraken Scales — earn a Scale by defeating The Kraken's Anchor.</p>
        <div id="hub-workshop" class="hub-list"></div>
      </section>
      <button type="button" id="hub-set-sail">Set Sail ⚓</button>
    </div>
  `;
  root.appendChild(hubOverlay);
  const hubSalvage = hubOverlay.querySelector('#hub-salvage');
  const hubStats = hubOverlay.querySelector('#hub-stats');
  const hubHulls = hubOverlay.querySelector('#hub-hulls');
  const hubHullsNote = hubOverlay.querySelector('#hub-hulls-note');
  const hubCargo = hubOverlay.querySelector('#hub-cargo');
  const hubCharms = hubOverlay.querySelector('#hub-charms');
  const hubFactions = hubOverlay.querySelector('#hub-factions');
  const hubWorkshop = hubOverlay.querySelector('#hub-workshop');
  const hubSetSailBtn = hubOverlay.querySelector('#hub-set-sail');

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

  // Persistent meta-progression (localStorage). `run` always exists (so
  // the frame loop below has something to render/step against even before
  // the first voyage), but `sailing` gates whether physics/combat actually
  // advance — false while the Hub overlay is up.
  const meta = loadMeta(window.localStorage);
  let run = createRun(Date.now() & 0xffffffff, resolveLoadout(meta));
  let sailing = false;
  const camera = createCamera();

  // Screen bands covered by HUD, fed to the camera so it frames the boat in
  // the part of the screen the player can actually see (engine/camera.mjs's
  // computeCameraView explains the bug this fixes). Measured from the real
  // DOM rather than hardcoded, so safe-area notches and HUD layout changes
  // are picked up automatically — but only on resize/HUD-size change via
  // ResizeObserver, never per frame, since a per-frame getBoundingClientRect
  // after the HUD's own DOM writes would force a synchronous layout every
  // frame on mobile.
  const hudInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  function measureHudInsets() {
    const margin = 8;
    const vh = window.innerHeight;
    const top = Math.max(0, Math.round(hud.getBoundingClientRect().bottom + margin));
    const bottom = Math.max(0, Math.round(vh - fireButton.getBoundingClientRect().top + margin));
    hudInsets.top = top;
    // In a short (landscape) viewport, reserving both bands would leave a
    // sliver of playfield — drop the fire-button band first (it only
    // covers one corner anyway), keeping the top band that covers the boat.
    hudInsets.bottom = (top + bottom) > vh * 0.5 ? 0 : bottom;
  }
  measureHudInsets();
  window.addEventListener('resize', measureHudInsets);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(measureHudInsets);
    ro.observe(hud);
    ro.observe(fireButton);
  }
  camera.x = run.boat.x;
  camera.y = run.boat.y;

  // Step 8 juice state — reset on every startRun() alongside `run` itself,
  // so leftover particles/numbers from a finished voyage never bleed into
  // the next one.
  let particles = createParticlePool();
  let damageNumbers = createDamageNumberPool();
  const shake = createShake();
  const hitStop = createHitStop();

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
    const pct = Math.max(0, Math.min(100, (run.boat.health / run.boat.maxHull) * 100));
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
      if (!isHeld(run.weapons, weapon.id)) { playLockedWeapon(); return; } // locked — found via a weapon cache pickup
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

  // Rebuilds the Hub's displayed state from `meta` — called on boot and
  // after every purchase/selection so the screen always reflects what was
  // actually saved, not optimistic UI state.
  function renderHub() {
    hubSalvage.textContent = `Salvage: ${meta.salvage} ⚓${meta.krakenScales > 0 ? ` · Kraken Scales: ${meta.krakenScales} 🦑` : ''}`;
    hubStats.textContent = `Runs sailed: ${meta.stats.runsPlayed} · Best reefs cleared: ${meta.stats.bestReefsCleared}/${run.reefCount} · Deepest reef reached: ${meta.stats.deepestReefReached}`;

    // A selected faction overrides the hull (engine/meta.mjs resolveLoadout),
    // so say so here — otherwise the Hub shows your own pick as "Selected"
    // while the run silently sails a different hull.
    const activeFaction = PLAYABLE_FACTION_LIST.find((f) => f.id === meta.selectedFaction);
    if (activeFaction) {
      const factionHull = SHIP_HULL_LIST.find((h) => h.id === activeFaction.hullId);
      hubHullsNote.textContent = `Sailing as ${activeFaction.name}: the ${factionHull.name} is used while a faction is active. Your pick below applies when Unaligned.`;
      hubHullsNote.hidden = false;
    } else {
      hubHullsNote.hidden = true;
    }
    hubHulls.innerHTML = '';
    for (const hull of SHIP_HULL_LIST) {
      const owned = meta.ownedHulls.includes(hull.id);
      const selected = meta.selectedHull === hull.id;
      const disabled = selected || (!owned && !canAfford(meta, hull.cost));
      const label = selected ? 'Selected' : owned ? 'Select' : `Buy ${hull.cost} ⚓`;
      const row = document.createElement('div');
      row.className = 'hub-item';
      row.innerHTML = `
        <div class="hub-item-info">
          <span class="hub-item-name">${hull.name}${selected ? ' ✓' : ''}</span>
          <span class="hub-item-desc">${hull.description}</span>
        </div>
        <button type="button" class="hub-item-btn" data-hull-id="${hull.id}"${disabled ? ' disabled' : ''}>${label}</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        if (!owned) {
          const res = purchaseHull(meta, hull.id);
          if (res.ok) selectHull(meta, hull.id);
        } else {
          selectHull(meta, hull.id);
        }
        saveMeta(window.localStorage, meta);
        renderHub();
      });
      hubHulls.appendChild(row);
    }

    hubCargo.innerHTML = '';
    for (const tier of CARGO_TIER_LIST) {
      const owned = meta.ownedCargoTiers.includes(tier.id);
      const disabled = owned || !canAfford(meta, tier.cost);
      const row = document.createElement('div');
      row.className = 'hub-item';
      row.innerHTML = `
        <div class="hub-item-info">
          <span class="hub-item-name">${tier.name}${owned ? ' ✓' : ''}</span>
          <span class="hub-item-desc">${tier.description}</span>
        </div>
        <button type="button" class="hub-item-btn" data-cargo-id="${tier.id}"${disabled ? ' disabled' : ''}>${owned ? 'Owned' : `Buy ${tier.cost} ⚓`}</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        purchaseCargoTier(meta, tier.id);
        saveMeta(window.localStorage, meta);
        renderHub();
      });
      hubCargo.appendChild(row);
    }

    hubCharms.innerHTML = '';
    for (const charm of CHARM_LIST) {
      const owned = meta.ownedCharms.includes(charm.id);
      const disabled = owned || !canAfford(meta, charm.cost);
      const row = document.createElement('div');
      row.className = 'hub-item';
      row.innerHTML = `
        <div class="hub-item-info">
          <span class="hub-item-name">${charm.name}${owned ? ' ✓' : ''}</span>
          <span class="hub-item-desc">${charm.description}</span>
        </div>
        <button type="button" class="hub-item-btn" data-charm-id="${charm.id}"${disabled ? ' disabled' : ''}>${owned ? 'Owned' : `Buy ${charm.cost} ⚓`}</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        purchaseCharm(meta, charm.id);
        saveMeta(window.localStorage, meta);
        renderHub();
      });
      hubCharms.appendChild(row);
    }

    hubFactions.innerHTML = '';
    const unalignedSelected = meta.selectedFaction === null;
    const unalignedRow = document.createElement('div');
    unalignedRow.className = 'hub-item';
    unalignedRow.innerHTML = `
      <div class="hub-item-info">
        <span class="hub-item-name">Unaligned${unalignedSelected ? ' ✓' : ''}</span>
        <span class="hub-item-desc">No faction — your own selected hull/loadout/charms apply, and enemies deal/take no combat-triangle bonus.</span>
      </div>
      <button type="button" class="hub-item-btn"${unalignedSelected ? ' disabled' : ''}>${unalignedSelected ? 'Selected' : 'Select'}</button>
    `;
    unalignedRow.querySelector('button').addEventListener('click', () => {
      selectFaction(meta, null);
      saveMeta(window.localStorage, meta);
      renderHub();
    });
    hubFactions.appendChild(unalignedRow);
    for (const faction of PLAYABLE_FACTION_LIST) {
      const owned = meta.ownedFactions.includes(faction.id);
      const selected = meta.selectedFaction === faction.id;
      const disabled = selected || (!owned && !canAfford(meta, faction.cost));
      const label = selected ? 'Selected' : owned ? 'Select' : `Buy ${faction.cost} ⚓`;
      const row = document.createElement('div');
      row.className = 'hub-item';
      row.innerHTML = `
        <div class="hub-item-info">
          <span class="hub-item-name">${faction.name}${selected ? ' ✓' : ''}</span>
          <span class="hub-item-desc">${faction.description}</span>
        </div>
        <button type="button" class="hub-item-btn" data-faction-id="${faction.id}"${disabled ? ' disabled' : ''}>${label}</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        if (!owned) {
          const res = purchaseFaction(meta, faction.id);
          if (res.ok) selectFaction(meta, faction.id);
        } else {
          selectFaction(meta, faction.id);
        }
        saveMeta(window.localStorage, meta);
        renderHub();
      });
      hubFactions.appendChild(row);
    }

    hubWorkshop.innerHTML = '';
    for (const upgrade of WORKSHOP_UPGRADE_LIST) {
      const owned = meta.ownedWorkshopUpgrades.includes(upgrade.id);
      const disabled = owned || !canAffordWorkshopUpgrade(meta, upgrade);
      const row = document.createElement('div');
      row.className = 'hub-item';
      row.innerHTML = `
        <div class="hub-item-info">
          <span class="hub-item-name">${upgrade.name}${owned ? ' ✓' : ''}</span>
          <span class="hub-item-desc">${upgrade.description}</span>
        </div>
        <button type="button" class="hub-item-btn" data-upgrade-id="${upgrade.id}"${disabled ? ' disabled' : ''}>${owned ? 'Owned' : `Craft ${upgrade.salvageCost} ⚓ + ${upgrade.krakenScaleCost} 🦑`}</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        purchaseWorkshopUpgrade(meta, upgrade.id);
        saveMeta(window.localStorage, meta);
        renderHub();
      });
      hubWorkshop.appendChild(row);
    }
  }

  function openHub() {
    sailing = false;
    renderHub();
    hubOverlay.classList.add('show');
  }

  function startRun() {
    run = createRun((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) & 0xffffffff, resolveLoadout(meta));
    camera.x = run.boat.x;
    camera.y = run.boat.y;
    particles = createParticlePool();
    damageNumbers = createDamageNumberPool();
    shake.trauma = 0;
    hitStop.remaining = 0;
    setStatus(`Reef 1 of ${run.reefCount} — find the exit ⚓`);
    toast.classList.remove('show');
    hubOverlay.classList.remove('show');
    updateHullBar();
    updateSalvageCounter();
    updateReefIndicator();
    updateWeaponBar();
    sailing = true;
  }
  hubSetSailBtn.addEventListener('click', startRun);

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
      <p>Salvage banked this voyage: ${run.bankedSalvage}</p>
      ${run.reefSalvage > 0 ? `<p class="lost">Salvage lost with the ship: ${run.reefSalvage}</p>` : ''}
      <p>Weapons found: ${heldNiche.length ? heldNiche.map((id) => getWeapon(id).name).join(', ') : 'None'}</p>
      ${run.bossDefeated ? '<p>The Kraken\'s Anchor defeated — 1 Kraken Scale earned 🦑</p>' : ''}
      <p>Salvage in the Hub: ${meta.salvage} ⚓${meta.krakenScales > 0 ? ` · Kraken Scales: ${meta.krakenScales} 🦑` : ''}</p>
    `;
    summaryOverlay.classList.add('show');
  }
  // Every ending banks this voyage's Salvage/stats into the persistent
  // meta state before the summary is shown, so "Salvage in the Hub" above
  // is already correct the moment the screen appears.
  function endRun() {
    if (run.outcome === 'victory') playVictory(); else playSunk();
    recordRunResult(meta, run);
    saveMeta(window.localStorage, meta);
    showRunSummary();
  }
  summaryBtn.addEventListener('click', () => {
    summaryOverlay.classList.remove('show');
    openHub();
  });

  // A tiny debug hook for headless/automated testing — not user-facing,
  // costs nothing at runtime, and saves having to poke at internals.
  window.__shatteredReefDebug = () => ({
    boatX: run.boat.x, boatY: run.boat.y, heading: run.boat.heading,
    hull: run.boat.health, maxHull: run.boat.maxHull, cameraX: camera.x, cameraY: camera.y,
    over: run.over, outcome: run.outcome, sailing, hubOpen: hubOverlay.classList.contains('show'),
    reefIndex: run.reefIndex, reefCount: run.reefCount,
    exitX: run.exitWorld.x, exitY: run.exitWorld.y,
    bankedSalvage: run.bankedSalvage, reefSalvage: run.reefSalvage,
    salvage: totalSalvage(run), activeWeapon: run.weapons.activeWeaponId,
    enemyCount: run.enemies.filter((e) => e.health > 0).length,
    projectileCount: run.weapons.projectiles.length,
    enemies: run.enemies.filter((e) => e.health > 0).map((e) => ({
      defId: e.defId, x: e.x, y: e.y, health: e.health, invulnerable: e.invulnerable,
      isBoss: e.isBoss, phaseIndex: e.phaseIndex,
    })),
    firing: isFiring, cooldownRemaining: run.weapons.cooldownRemaining,
    heldWeapons: Array.from(run.weapons.heldWeapons),
    pickupsRemaining: run.pickups.filter((p) => !p.collected).length,
    pickups: run.pickups.map((p) => ({
      kind: p.kind, weaponId: p.weaponId, x: p.x, y: p.y, collected: p.collected,
    })),
    meta: {
      salvage: meta.salvage, ownedHulls: meta.ownedHulls, selectedHull: meta.selectedHull,
      ownedCargoTiers: meta.ownedCargoTiers, ownedCharms: meta.ownedCharms, stats: meta.stats,
      ownedFactions: meta.ownedFactions, selectedFaction: meta.selectedFaction,
      krakenScales: meta.krakenScales, ownedWorkshopUpgrades: meta.ownedWorkshopUpgrades,
    },
    faction: run.faction, bossDefeated: run.bossDefeated, craftedDamageMultipliers: run.craftedDamageMultipliers,
    particleCount: particles.length, damageNumberCount: damageNumbers.length,
    damageNumbers: damageNumbers.map((d) => ({ amount: d.amount, crit: d.crit, triangle: d.triangle })),
    shakeTrauma: shake.trauma, hitStopRemaining: hitStop.remaining, muted: isMuted(),
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
  // Testing-only: places an enemy (optionally at reduced health) at a world
  // position — added so a headless playtest can reliably stage a specific
  // fight (e.g. the boss, which only appears by chance on reef 3) without
  // navigating a generated maze. The kill itself still goes through the
  // real resolveHits/boss-kill path, so this proves the wiring, not a shortcut.
  window.__shatteredReefSpawnEnemy = (defId, x, y, health) => {
    const e = createEnemy(defId, x, y);
    if (health != null) e.health = health;
    run.enemies.push(e);
    return e.id;
  };
  // Testing-only: adds at-risk Salvage directly, for scripting a controlled
  // "sank with unbanked Salvage" scenario without needing to actually
  // steer onto a pickup first.
  window.__shatteredReefAddSalvage = (amount) => { addSalvage(run, amount); updateSalvageCounter(); };
  // Testing-only: grants Hub Salvage directly, so a headless test can
  // afford an unlock without grinding a full voyage first.
  window.__shatteredReefAddHubSalvage = (amount) => { meta.salvage += amount; saveMeta(window.localStorage, meta); if (hubOverlay.classList.contains('show')) renderHub(); };
  window.__shatteredReefAddKrakenScales = (amount) => { meta.krakenScales += amount; saveMeta(window.localStorage, meta); if (hubOverlay.classList.contains('show')) renderHub(); };

  let lastTime = performance.now();
  function frame(now) {
    const rawDt = Math.min(0.05, (now - lastTime) / 1000); // clamp so a tab-switch stall can't fling the boat
    lastTime = now;
    // Hit-stop (engine/juice.mjs) only ever freezes active gameplay
    // simulation, never the Hub/summary screens or the juice systems
    // themselves — a brief freeze on a big hit should still let its own
    // particles/shake play out smoothly rather than freezing with them.
    const dt = (sailing && !run.over) ? applyHitStop(hitStop, rawDt) : rawDt;

    if (sailing && !run.over) {
      const jam = run.boat.turnJamRemaining > 0;
      const tuning = jam ? { ...run.tuning, turnRate: run.tuning.turnRate * 0.5 } : run.tuning;

      const vec = joystick.getVector();
      stepBoat(run.boat, vec, dt, tuning);
      const impactSpeed = resolveTileCollision(run.boat, BOAT_RADIUS, run.grid, run.tileSize);
      const damage = applyWallImpactDamage(run.boat, impactSpeed);
      if (damage > 0) {
        updateHullBar();
        flashHit();
        const intensity = Math.min(1, damage / 15);
        addShake(shake, 0.25 + intensity * 0.5);
        spawnSplash(particles, run.boat.x, run.boat.y, Math.random, 8);
        playWallImpact(intensity);
      }

      if (run.boat.turnJamRemaining > 0) {
        run.boat.turnJamRemaining = Math.max(0, run.boat.turnJamRemaining - dt);
      }

      if (isFiring) {
        const fired = tryFire(run.weapons, run.boat.x, run.boat.y, computeFireHeading());
        if (fired) { updateWeaponBar(); playFire(run.weapons.activeWeaponId); }
      }
      stepCombat(run.weapons, dt, run.grid, run.tileSize);
      stepAmmoRegen(run.weapons, dt);
      updateEnemies(run.enemies, run.boat, dt, run.grid, run.tileSize);

      // The Kraken's Anchor announces its own phase swaps (submerged/
      // Depth-Charges <-> tank/Flame-Barrels) — the whole point of the
      // mechanic is "your weapon just stopped working, swap," which is
      // silent and easy to miss without an explicit cue. `_lastAnnouncedPhase`
      // is transient render/UI state kept directly on the enemy object
      // (never read by engine/enemies.mjs itself), initialized on first
      // sight rather than at spawn so it doesn't fire a false "swap" the
      // instant the boss appears.
      for (const enemy of run.enemies) {
        if (!enemy.isBoss || enemy.health <= 0) continue;
        if (enemy._lastAnnouncedPhase === undefined) {
          enemy._lastAnnouncedPhase = enemy.phaseIndex;
        } else if (enemy.phaseIndex !== enemy._lastAnnouncedPhase) {
          enemy._lastAnnouncedPhase = enemy.phaseIndex;
          showToast(`The Kraken's Anchor shifts — try ${getWeapon(enemy.counter).name}! ⚓`);
          playBossPhaseChange();
          addShake(shake, 0.3);
        }
      }

      // Depth Charges detonate as an AoE rather than a per-enemy direct
      // hit, so their "something exploded" feedback (a big particle ring +
      // boom) is tied to the projectile itself going spent, not to
      // resolveHits' per-enemy events below — it should fire even against
      // open water with nothing in the blast.
      for (const p of run.weapons.projectiles) {
        if (p.weaponId === WEAPON_IDS.DEPTH_CHARGES && p.spent) {
          spawnExplosion(particles, p.x, p.y, 28, Math.random);
          addShake(shake, 0.5);
          playExplosion();
        }
      }

      let salvageGained = 0;
      const hitEvents = resolveHits(
        run.weapons, run.enemies, currentCounter,
        factionMultiplierFor(run.faction), craftedMultiplierFor(run.craftedDamageMultipliers)
      );
      cleanupProjectiles(run.weapons);
      for (const ev of hitEvents) {
        const weaponColor = getWeapon(ev.weaponId).color;
        // Post-slice combat-triangle feedback: the raw multiplier (not
        // ev.damage, which already has it baked in) tells us whether this
        // specific hit was triangle-advantaged/-disadvantaged, so the
        // damage number can say so distinctly from a plain on-counter crit.
        const triangleMult = triangleMultiplier(run.faction, ev.enemy.faction);
        spawnDamageNumber(damageNumbers, ev.enemy.x, ev.enemy.y - ev.enemy.radius - 4, ev.damage, {
          crit: currentCounter(ev.enemy) === ev.weaponId,
          triangle: triangleMult > 1 ? 'advantage' : triangleMult < 1 ? 'disadvantage' : null,
        });
        if (ev.killed) {
          if (ev.enemy.isBoss) {
            // A 220 HP boss with its own phase mechanic earns a bigger
            // "you actually won that" moment than a regular kill.
            spawnExplosion(particles, ev.enemy.x, ev.enemy.y, 50, Math.random);
            addShake(shake, 1);
            triggerHitStop(hitStop, 0.15);
            playBossDefeated();
            showToast("The Kraken's Anchor is defeated! ⚓");
            run.bossDefeated = true; // engine/meta.mjs's recordRunResult awards a Kraken Scale
          } else {
            spawnKillBurst(particles, ev.enemy.x, ev.enemy.y, weaponColor, Math.random);
            addShake(shake, 0.35);
            triggerHitStop(hitStop, 0.05);
            playKill();
          }
          salvageGained += ev.enemy.salvageDrop;
        } else {
          spawnHitSpark(particles, ev.enemy.x, ev.enemy.y, weaponColor, Math.random);
          addShake(shake, 0.12);
          playHit();
        }
      }
      for (const enemy of run.enemies) {
        const burnEvent = stepBurn(enemy, dt);
        if (burnEvent) {
          const triangleMult = triangleMultiplier(run.faction, enemy.faction);
          spawnDamageNumber(damageNumbers, enemy.x, enemy.y - enemy.radius - 4, burnEvent.damage, {
            triangle: triangleMult > 1 ? 'advantage' : triangleMult < 1 ? 'disadvantage' : null,
          });
          if (burnEvent.killed) {
            if (enemy.isBoss) {
              spawnExplosion(particles, enemy.x, enemy.y, 50, Math.random);
              addShake(shake, 1);
              triggerHitStop(hitStop, 0.15);
              playBossDefeated();
              showToast("The Kraken's Anchor is defeated! ⚓");
              run.bossDefeated = true;
            } else {
              spawnKillBurst(particles, enemy.x, enemy.y, PALETTE.burn, Math.random);
              addShake(shake, 0.3);
              playKill();
            }
            salvageGained += burnEvent.enemy.salvageDrop;
          }
        }
      }
      if (salvageGained > 0) {
        addSalvage(run, salvageGained);
        updateSalvageCounter();
      }

      const contactDamage = resolveEnemyContacts(run.enemies, run.boat, BOAT_RADIUS);
      if (contactDamage > 0) {
        updateHullBar();
        flashHit();
        addShake(shake, 0.3);
        playWallImpact(Math.min(1, contactDamage / 10));
      }

      const pickupEvents = collectPickups(run.pickups, run.boat, BOAT_RADIUS, run.weapons);
      for (const ev of pickupEvents) {
        if (ev.kind === PICKUP_KINDS.WEAPON_CACHE) {
          updateWeaponBar();
          showToast(ev.freshUnlock ? `New weapon: ${getWeapon(ev.weaponId).name}! ⚓` : `${getWeapon(ev.weaponId).name} restocked ⚓`);
          playPickupWeapon();
        } else if (ev.kind === PICKUP_KINDS.SALVAGE) {
          addSalvage(run, ev.amount);
          updateSalvageCounter();
          playPickupSalvage();
        }
      }

      // checkSunk has three outcomes: false (nothing happened), true (the
      // voyage is over — bank stats and show the summary), or the string
      // 'revived' (the Last Gasp charm patched the boat through at 1 hull
      // instead — the run continues, so this must NOT be treated as a
      // truthy "game over", which the old plain `if (checkSunk(run))`
      // check would have done).
      const sunkResult = checkSunk(run);
      if (sunkResult === true) {
        sailing = false;
        spawnExplosion(particles, run.boat.x, run.boat.y, 24, Math.random);
        addShake(shake, 0.7);
        endRun();
      } else if (sunkResult === 'revived') {
        updateHullBar();
        flashHit();
        addShake(shake, 0.4);
        playRevive();
        showToast('Last Gasp! Patched through at 1 hull ⚓');
      } else {
        const bankedThisReef = run.reefSalvage;
        const reefResult = checkReachedExit(run);
        if (reefResult === 'victory') {
          sailing = false;
          endRun();
        } else if (reefResult === 'advanced') {
          camera.x = run.boat.x;
          camera.y = run.boat.y;
          setStatus(`Reef ${run.reefIndex + 1} of ${run.reefCount} — find the exit ⚓`);
          // The Kraken's Anchor is a chance-based spawn on the final reef
          // (see data/enemies.mjs), so a voyage may or may not meet it —
          // when it does, fold the warning into the same toast as the
          // reef-cleared message rather than a second toast that would
          // just overwrite this one a moment later.
          const boss = run.enemies.find((e) => e.isBoss);
          if (boss) {
            boss._lastAnnouncedPhase = boss.phaseIndex; // don't fire a false "swap" on first sight
            showToast(`Reef cleared! +${bankedThisReef} Salvage banked ⚓ — The Kraken's Anchor guards the exit! Try ${getWeapon(boss.counter).name} ⚓`);
          } else {
            showToast(`Reef cleared! +${bankedThisReef} Salvage banked ⚓`);
          }
          updateReefIndicator();
          updateSalvageCounter();
          updateWeaponBar();
          playReefCleared();
        }
      }
    }

    updateCamera(camera, run.boat.x, run.boat.y, rawDt);
    particles = updateParticles(particles, rawDt);
    damageNumbers = updateDamageNumbers(damageNumbers, rawDt);
    const shakeOffset = updateShake(shake, rawDt);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    const view = applyCameraTransform(ctx, camera, vw, vh, run.widthPx, run.heightPx, shakeOffset, hudInsets);
    drawTileGrid(ctx, run.grid, run.tileSize, view.visible.left, view.visible.top, view.visible.right, view.visible.bottom);
    drawExit(ctx, run.exitWorld.x, run.exitWorld.y, run.tileSize * 0.9, now / 1000);
    drawPickups(ctx, run.pickups, (p) => WEAPON_SHORT_LABEL[p.weaponId], now / 1000);
    drawEnemies(ctx, run.enemies, (e) => e.colorHex || enemyColor(e), now / 1000, (e) => (e.isBoss ? "The Kraken's Anchor" : null));
    drawProjectiles(ctx, run.weapons.projectiles, (p) => getWeapon(p.weaponId).color);
    if (run.outcome !== 'sunk') drawBoat(ctx, run.boat, BOAT_RADIUS);
    drawParticles(ctx, particles);
    drawDamageNumbers(ctx, damageNumbers);
    ctx.restore();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setStatus(`Reef 1 of ${run.reefCount} — find the exit ⚓`);
  updateHullBar();
  updateSalvageCounter();
  updateReefIndicator();
  updateWeaponBar();
  openHub();
}

// Resolves an enemy's draw color from its data definition, cached on the
// instance the first time (avoids a data lookup every frame for every
// enemy).
function enemyColor(enemy) {
  enemy.colorHex = getEnemy(enemy.defId).color;
  return enemy.colorHex;
}

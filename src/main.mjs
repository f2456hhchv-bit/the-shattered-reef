// Boots the game: canvas setup, the run/level, input, combat, the game
// loop, the HUD, and the Captain's Hub (step 7 — meta-progression). The
// app now opens on the Hub rather than straight into a run: Salvage
// persisted across runs (localStorage, engine/meta.mjs) is spent there on
// Ship Hulls / Cargo Loadouts / Captain's Charms before "Set Sail" starts
// an actual voyage with that loadout resolved into it.

import { computeAim, trackEnemyMotion } from './engine/aim.mjs';
import { playMusic, currentMusic } from './audio/music.mjs';
import { BASE_BUILDINGS } from './data/base.mjs';
import { buildBaseWorld, computeBaseView, boatOrbitPoint } from './engine/base.mjs';
import { drawBaseBuildings, drawGulls, BUILDING_SCALE } from './engine/baseRenderer.mjs';
import { sampleField } from './engine/terrain.mjs';
import { decodeLevelCode } from './engine/levels.mjs';
import { buildTerrain } from './engine/terrain.mjs';
import { createTerrainRenderer } from './engine/terrainRenderer.mjs';
import { getBiome, BIOME_IDS } from './data/biomes.mjs';
import {
  createRun, checkReachedExit, checkSunk, retryLevel, addSalvage, totalSalvage, BOAT_RADIUS,
  TIER_COUNT, LEVELS_PER_STAGE, biomeForStage, isExitOpen, levelForReef, buildLevelWorld,
} from './engine/run.mjs';
import { stepBoat, resolveCoastCollision, applyWallImpactDamage } from './engine/boat.mjs';
import { createCamera, updateCamera, applyCameraTransform } from './engine/camera.mjs';
import {
  drawExit, drawWake, drawSealedExit, drawLairCurrents, drawBoat, drawEnemies, drawProjectiles, drawPickups,
  drawParticles, drawDamageNumbers, drawTargetReticle, drawEnemyProjectiles, PALETTE,
} from './engine/renderer.mjs';
import { createJoystick } from './input/joystick.mjs';
import {
  tryFire, stepCombat, stepAmmoRegen, resolveHits, cleanupProjectiles, stepBurn, setActiveWeapon, ammoFor, isHeld,
  craftedMultiplierFor,
} from './engine/combat.mjs';
import {
  createEnemy, updateEnemies, stepSummons, resolveEnemyContactEvents, currentCounter, factionMultiplierFor, incomingMultiplierFor,
} from './engine/enemies.mjs';
import { collectPickups, makeRepairKit } from './engine/pickups.mjs';
import { PICKUP_KINDS, PICKUP_TUNING } from './data/pickups.mjs';
import { WEAPON_LIST, getWeapon } from './data/weapons.mjs';
import { getEnemy } from './data/enemies.mjs';
import { bossForStage, stageInfo } from './data/stages.mjs';
import { updateEnemyGuns, stepEnemyProjectiles } from './engine/enemyGuns.mjs';
import {
  SHIP_HULL_LIST, CARGO_TIER_LIST, CHARM_LIST, PLAYABLE_FACTION_LIST, WORKSHOP_UPGRADE_LIST,
} from './data/meta.mjs';
import { triangleMultiplier, incomingTriangleMultiplier, matchupFor, relationTo } from './data/factions.mjs';
import { ENEMY_LIST } from './data/enemies.mjs';
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
  unlockAudio, setMuted, isMuted, audioLevel, playFire, playHit, playKill, playExplosion, playWallImpact,
  playPickupWeapon, playPickupSalvage, playReefCleared, playVictory, playSunk, playRevive, playLockedWeapon,
  playBossPhaseChange, playBossDefeated, playEnemyFire,
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
      <span id="reef-indicator">Level 1/5</span>
      <span id="salvage-counter">⚓ Salvage: 0</span>
    </div>
  `;
  root.appendChild(hud);
  // Weapons sit at the bottom, in thumb reach (2026-09-29): firing is
  // automatic now, so the right thumb's only job is picking the weapon.
  const weaponDock = document.createElement('div');
  weaponDock.id = 'weapon-bar';
  root.appendChild(weaponDock);

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
  // Every early gesture retries the unlock: iOS can need more than one.
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlockAudio, { capture: true, passive: true });

  const summaryOverlay = document.createElement('div');
  summaryOverlay.id = 'run-summary';
  summaryOverlay.innerHTML = `
    <div id="run-summary-card">
      <h1 id="run-summary-title"></h1>
      <div id="run-summary-body"></div>
      <button type="button" id="run-summary-retry" hidden>↻ Retry this level</button>
      <button type="button" id="run-summary-btn">Return to Harbour ⚓</button>
    </div>
  `;
  root.appendChild(summaryOverlay);
  const summaryTitle = summaryOverlay.querySelector('#run-summary-title');
  const summaryBody = summaryOverlay.querySelector('#run-summary-body');
  const summaryBtn = summaryOverlay.querySelector('#run-summary-btn');
  const summaryRetryBtn = summaryOverlay.querySelector('#run-summary-retry');

  // The base (2026-09-28): the app's home screen between runs. A painted
  // harbour (engine/base.mjs + baseRenderer.mjs, drawn on the game canvas
  // while the Hub is open) with a building per real system. Tapping a
  // building or its label opens that system's panel; the voyage card
  // picks a stage and sets sail. Persistent Salvage (meta.salvage) is spent
  // in the panels; "Set Sail" resolves the loadout and starts a run.
  const hubOverlay = document.createElement('div');
  hubOverlay.id = 'captains-hub';
  hubOverlay.innerHTML = `
    <div id="base-scene-hit" aria-hidden="true"></div>
    <div id="base-topbar">
      <button type="button" id="captain-chip" data-panel="log" aria-label="Captain's Log">
        <img src="assets/icons/icon-192.png" alt="" />
        <span class="cc-text"><b>Captain</b><small id="cc-sub"></small>
          <span class="cc-bar"><span id="cc-bar-fill"></span></span></span>
      </button>
      <div class="currency-pills">
        <span class="pill pill-salvage" title="Salvage"><i>⚓</i><b id="pill-salvage">0</b></span>
        <span class="pill pill-scales" title="Kraken Scales"><i>🦑</i><b id="pill-scales">0</b></span>
      </div>
    </div>
    <div id="base-chips"></div>
    <div id="voyage-card">
      <div class="vc-head">
        <canvas id="voyage-map" width="192" height="192" aria-hidden="true"></canvas>
        <div class="vc-info">
          <div class="vc-kicker">⚓ Next voyage</div>
          <div id="hub-stage-picker">
            <button type="button" id="stage-prev" aria-label="Previous stage">◀</button>
            <div id="stage-label"><strong></strong><span></span></div>
            <button type="button" id="stage-next" aria-label="Next stage">▶</button>
          </div>
          <div class="vc-pips" aria-label="5 levels, boss on level 5">
            <span>1</span><span>2</span><span>3</span><span>4</span><span class="boss" title="The boss lair">☠</span>
          </div>
        </div>
      </div>
      <button type="button" id="hub-set-sail">▶ Set Sail</button>
    </div>
    <div id="base-panel" hidden>
      <div id="base-panel-card" role="dialog" aria-modal="true" aria-labelledby="base-panel-title">
        <div class="bp-head">
          <button type="button" id="base-panel-back" aria-label="Back to the harbour">←</button>
          <div class="bp-titles"><h1 id="base-panel-title"></h1><p id="base-panel-sub"></p></div>
          <div class="currency-pills small">
            <span class="pill pill-salvage"><i>⚓</i><b class="pill-salvage-v">0</b></span>
            <span class="pill pill-scales"><i>🦑</i><b class="pill-scales-v">0</b></span>
          </div>
        </div>
        <div class="bp-body">
          <section class="hub-section" data-panel="hulls">
            <p id="hub-hulls-note" class="hub-section-note" hidden></p>
            <div id="hub-hulls" class="hub-list"></div>
          </section>
          <section class="hub-section" data-panel="cargo">
            <p class="hub-section-note">Permanent: every tier you own is loaded on every voyage.</p>
            <div id="hub-cargo" class="hub-list"></div>
          </section>
          <section class="hub-section" data-panel="charms">
            <p class="hub-section-note">Permanent: every charm you own works on every voyage.</p>
            <div id="hub-charms" class="hub-list"></div>
          </section>
          <section class="hub-section" data-panel="factions">
            <div id="hub-factions" class="hub-list"></div>
          </section>
          <section class="hub-section" data-panel="workshop">
            <p class="hub-section-note">Craft permanent upgrades with Salvage + Kraken Scales — earn a Scale by sinking a stage boss.</p>
            <div id="hub-workshop" class="hub-list"></div>
          </section>
          <section class="hub-section" data-panel="log">
            <div id="hub-log" class="log-grid"></div>
          </section>
        </div>
      </div>
    </div>
  `;
  root.appendChild(hubOverlay);
  const hubHulls = hubOverlay.querySelector('#hub-hulls');
  const hubHullsNote = hubOverlay.querySelector('#hub-hulls-note');
  const hubCargo = hubOverlay.querySelector('#hub-cargo');
  const hubCharms = hubOverlay.querySelector('#hub-charms');
  const hubFactions = hubOverlay.querySelector('#hub-factions');
  const hubWorkshop = hubOverlay.querySelector('#hub-workshop');
  const hubLog = hubOverlay.querySelector('#hub-log');
  const hubSetSailBtn = hubOverlay.querySelector('#hub-set-sail');
  const stagePrevBtn = hubOverlay.querySelector('#stage-prev');
  const stageNextBtn = hubOverlay.querySelector('#stage-next');
  const stageLabel = hubOverlay.querySelector('#stage-label');
  const basePanel = hubOverlay.querySelector('#base-panel');
  const baseChips = hubOverlay.querySelector('#base-chips');
  const voyageCard = hubOverlay.querySelector('#voyage-card');
  const baseTopbar = hubOverlay.querySelector('#base-topbar');
  const voyageMap = hubOverlay.querySelector('#voyage-map');

  // One chip per building: the name, what it's for, and a "!" badge when
  // something in that panel is affordable right now (real, not decorative).
  const PANEL_TITLES = {
    hulls: ['Shipyard', 'Choose the hull you sail in'],
    cargo: ['Armory', 'Cargo loadouts — start voyages better armed'],
    charms: ['Charm Shrine', "Captain's charms — permanent blessings"],
    factions: ['Faction Hall', 'Sail under a flag — and its rivalries'],
    workshop: ['Workshop', 'Craft upgrades from Kraken Scales'],
    log: ["Captain's Log", 'Your record at sea'],
  };
  const chipEls = new Map();
  for (const b of BASE_BUILDINGS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'base-chip';
    chip.dataset.panel = b.panel;
    chip.dataset.building = b.id;
    chip.innerHTML = `<span class="bc-icon">${b.icon}</span><span class="bc-text"><b>${b.name}</b><small>${b.sub}</small></span><span class="bc-badge" hidden>!</span>`;
    chip.addEventListener('click', () => openPanel(b.panel));
    baseChips.appendChild(chip);
    chipEls.set(b.id, chip);
  }
  hubOverlay.querySelector('#captain-chip').addEventListener('click', () => openPanel('log'));
  hubOverlay.querySelector('#base-panel-back').addEventListener('click', closePanel);
  basePanel.addEventListener('click', (e) => { if (e.target === basePanel) closePanel(); });

  function openPanel(id) {
    const [title, sub] = PANEL_TITLES[id];
    hubOverlay.querySelector('#base-panel-title').textContent = title;
    hubOverlay.querySelector('#base-panel-sub').textContent = sub;
    for (const sec of basePanel.querySelectorAll('.hub-section')) sec.hidden = sec.dataset.panel !== id;
    basePanel.hidden = false;
    basePanel.dataset.open = id;
    basePanel.querySelector('.bp-body').scrollTop = 0;
  }
  function closePanel() {
    basePanel.hidden = true;
    delete basePanel.dataset.open;
  }


  const hitFlash = document.createElement('div');
  hitFlash.id = 'hit-flash';
  root.appendChild(hitFlash);

  const toast = document.createElement('div');
  toast.id = 'pickup-toast';
  root.appendChild(toast);
  let toastTimer = null;
  // `parts` (optional) replaces `text` with coloured segments
  // [{text, cls}] — built as DOM nodes, never innerHTML. `ms` extends the
  // default 1.6s for messages that carry more to read; `dark` swaps the
  // gold pill for a dark one so cyan/red segments stay legible.
  function showToast(text, { ms = 1600, parts = null, dark = false } = {}) {
    toast.replaceChildren();
    if (parts) {
      for (const p of parts) {
        const span = document.createElement('span');
        span.textContent = p.text;
        if (p.cls) span.className = p.cls;
        toast.appendChild(span);
      }
    } else {
      toast.textContent = text;
    }
    toast.classList.toggle('dark', dark);
    // The dark briefing is longer-lived, so it sits just below the HUD
    // (the camera's measured inset) rather than over the weapon bar.
    toast.style.top = dark ? `${hudInsets.top + 4}px` : '';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
  }

  // Player-facing names of the enemies a faction fields, e.g. "Gullswarm
  // Harpy, Deep Crawler" — so "strong vs Wyrdtide" means something the
  // player can recognise in the water.
  function enemyNamesOf(factionId) {
    return ENEMY_LIST.filter((e) => e.faction === factionId).map((e) => e.name).join(', ');
  }

  // Run-start briefing for a faction run: the same ▲ / ! glyphs the enemy
  // matchup pips use, so the pips are self-explaining from the first second.
  function showMatchupBriefing(factionId) {
    const m = matchupFor(factionId);
    if (!m) return;
    showToast(null, {
      ms: 4200,
      dark: true,
      parts: [
        { text: `\u25B2 Strong vs ${m.prey.name}`, cls: 'm-prey' },
        { text: `! Weak vs ${m.predator.name}`, cls: 'm-pred' },
      ],
    });
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
  let lastView = null; // last frame's camera view — debug hook only
  // Terrain art (2026-09-28): rebuilt whenever the reef's grid changes
  // (new run or next reef). Pure fields + a chunked canvas cache.
  const biome = getBiome(BIOME_IDS.TROPICAL);
  const wake = []; let wakeTimer = 0;
  let terrainGrid = null; let terrain = null; let terrainRenderer = null; let terrainFresh = false;
  function ensureTerrain() {
    if (terrainGrid === run.grid) return;
    terrainGrid = run.grid;
    terrain = buildTerrain(run.grid, run.tileSize, run.coastSeed, biome, run.coast);
    terrainRenderer = createTerrainRenderer(terrain, biome, { res: Math.min(window.devicePixelRatio || 1, 1.5) });
    terrainFresh = true; // first draw renders every visible chunk at once
    wake.length = 0; // the boat just teleported to a new spawn
  }
  // Short landscape phones get a different HUD (ui/styles.css, same query):
  // one compact top row, and the weapon bar as a grid above the fire
  // button in the right-thumb zone — so the camera reserves a RIGHT band
  // instead of a tall top band plus a bottom band. Keep in sync with CSS.
  const LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 540px)';
  const landscapeMql = window.matchMedia ? window.matchMedia(LANDSCAPE_QUERY) : null;
  function measureHudInsets() {
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const weaponBar = document.getElementById('weapon-bar');
    const top = Math.max(0, Math.round(hud.getBoundingClientRect().bottom + margin));
    if (landscapeMql && landscapeMql.matches) {
      const leftEdge = weaponBar.getBoundingClientRect().left;
      hudInsets.top = top;
      hudInsets.right = Math.max(0, Math.round(vw - leftEdge + margin));
      hudInsets.bottom = 0;
      hudInsets.left = 0;
      return;
    }
    const bottom = Math.max(0, Math.round(vh - weaponBar.getBoundingClientRect().top + margin));
    hudInsets.top = top;
    hudInsets.right = 0;
    hudInsets.left = 0;
    hudInsets.bottom = bottom;
  }
  measureHudInsets();
  window.addEventListener('resize', measureHudInsets);
  if (landscapeMql && landscapeMql.addEventListener) landscapeMql.addEventListener('change', measureHudInsets);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(measureHudInsets);
    ro.observe(hud);
    ro.observe(document.getElementById('weapon-bar'));
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
    document.getElementById('reef-indicator').textContent = `Level ${run.reefIndex + 1}/${run.reefCount}`;
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
  // Auto-fire (2026-09-29, project owner): the ship fires by itself at
  // whatever the aim-assist can hit, so steering is the only thing the
  // left thumb has to do. `isFiring` is true while a target is locked.
  let isFiring = false;

  // Aim-assist (engine/aim.mjs): leads moving targets along their
  // measured arc, only picks shots it can land (in range, clear water),
  // prefers what the active weapon counters, and sticks to one target.
  let aimTarget = null;
  let aimHeading = null;
  function updateAim() {
    const weapon = getWeapon(run.weapons.activeWeaponId);
    const aim = computeAim(run.enemies, run.boat, weapon, {
      grid: run.grid, tileSize: run.tileSize, coast: run.coast,
      counterOf: currentCounter, previousTarget: aimTarget,
    });
    aimTarget = aim ? aim.target : null;
    aimHeading = aim ? aim.heading : null;
  }
  function computeFireHeading() {
    return aimHeading ?? run.boat.heading;
  }

  // Counter hint: the weapon button that answers the nearest awake threat
  // pulses, so "read the enemy, swap the weapon" is taught in play.
  let suggestedWeapon = null;
  function updateCounterHint() {
    let nearest = null; let best = 200;
    for (const e of run.enemies) {
      if (e.health <= 0 || !e.aggro) continue;
      const d = Math.hypot(e.x - run.boat.x, e.y - run.boat.y);
      if (d < best) { best = d; nearest = e; }
    }
    let want = nearest ? currentCounter(nearest) : null;
    if (want && (!isHeld(run.weapons, want) || ammoFor(run.weapons, want) <= 0 || run.weapons.activeWeaponId === want)) want = null;
    if (want === suggestedWeapon) return;
    if (suggestedWeapon) weaponButtons[suggestedWeapon].classList.remove('suggest');
    if (want) weaponButtons[want].classList.add('suggest');
    suggestedWeapon = want;
  }

  // A regular kill sometimes leaves a repair kit floating where it sank.
  function maybeDropRepair(enemy) {
    if (Math.random() < PICKUP_TUNING.repairDropChance) run.pickups.push(makeRepairKit(enemy.x, enemy.y));
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
    const fmt = (n) => Math.round(n).toLocaleString('en-GB');
    hubOverlay.querySelector('#pill-salvage').textContent = fmt(meta.salvage);
    hubOverlay.querySelector('#pill-scales').textContent = fmt(meta.krakenScales);
    for (const el of hubOverlay.querySelectorAll('.pill-salvage-v')) el.textContent = fmt(meta.salvage);
    for (const el of hubOverlay.querySelectorAll('.pill-scales-v')) el.textContent = fmt(meta.krakenScales);
    hubOverlay.querySelector('#cc-sub').textContent = `Stage ${meta.highestStageUnlocked} · best ${meta.stats.bestReefsCleared}/${LEVELS_PER_STAGE}`;
    hubOverlay.querySelector('#cc-bar-fill').style.width = `${Math.min(100, (100 * meta.stats.bestReefsCleared) / LEVELS_PER_STAGE)}%`;
    renderBadges();
    renderLog();
    renderStagePicker();

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
          <span class="hub-matchup"><span class="m-prey">\u25B2 Strong vs ${matchupFor(faction.id).prey.name}</span> <span class="m-who">(${enemyNamesOf(matchupFor(faction.id).prey.id)})</span><br><span class="m-pred">! Weak vs ${matchupFor(faction.id).predator.name}</span> <span class="m-who">(${enemyNamesOf(matchupFor(faction.id).predator.id)})</span></span>
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

  // "!" on a building's chip when something in its panel is affordable now.
  function renderBadges() {
    const buyable = {
      hulls: SHIP_HULL_LIST.some((h) => !meta.ownedHulls.includes(h.id) && canAfford(meta, h.cost)),
      cargo: CARGO_TIER_LIST.some((t) => !meta.ownedCargoTiers.includes(t.id) && canAfford(meta, t.cost)),
      charms: CHARM_LIST.some((c) => !meta.ownedCharms.includes(c.id) && canAfford(meta, c.cost)),
      factions: PLAYABLE_FACTION_LIST.some((f) => !meta.ownedFactions.includes(f.id) && canAfford(meta, f.cost)),
      workshop: WORKSHOP_UPGRADE_LIST.some((u) => !meta.ownedWorkshopUpgrades.includes(u.id) && canAffordWorkshopUpgrade(meta, u)),
      log: false,
    };
    for (const [, chip] of chipEls) chip.querySelector('.bc-badge').hidden = !buyable[chip.dataset.panel];
  }

  // The Captain's Log: the record the save file actually holds.
  function renderLog() {
    const faction = PLAYABLE_FACTION_LIST.find((f) => f.id === meta.selectedFaction);
    const loadout = resolveLoadout(meta);
    const rows = [
      ['Voyages sailed', meta.stats.runsPlayed],
      ['Stages unlocked', meta.highestStageUnlocked],
      ['Best voyage', `${meta.stats.bestReefsCleared} / ${LEVELS_PER_STAGE} levels`],
      ['Deepest level reached', meta.stats.deepestReefReached],
      ['Salvage earned, all time', Math.round(meta.stats.totalSalvageEarned).toLocaleString('en-GB')],
      ['Kraken Scales', meta.krakenScales],
      ['Sailing as', faction ? faction.name : 'Unaligned'],
      ['Hull', `${loadout.hull.name} (${loadout.hull.maxHull + (loadout.extraMaxHull || 0)} hull)`],
      ['Hulls owned', `${meta.ownedHulls.length} / ${SHIP_HULL_LIST.length}`],
      ['Cargo tiers', `${meta.ownedCargoTiers.length} / ${CARGO_TIER_LIST.length}`],
      ['Charms', `${meta.ownedCharms.length} / ${CHARM_LIST.length}`],
      ['Workshop crafts', `${meta.ownedWorkshopUpgrades.length} / ${WORKSHOP_UPGRADE_LIST.length}`],
    ];
    hubLog.replaceChildren(...rows.map(([k, v]) => {
      const row = document.createElement('div');
      row.className = 'log-row';
      const a = document.createElement('span'); a.textContent = k;
      const b = document.createElement('b'); b.textContent = String(v);
      row.append(a, b);
      return row;
    }));
  }

  // Voyage card preview: a small chart of the stage's first level, drawn
  // straight from its coastline field (fixed seeds, so it's the real reef).
  const previewCache = new Map();
  // The next voyage's seed is rolled when the harbour opens, so the chart
  // on the voyage card is the real first reef you're about to sail.
  let nextRunSeed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  function rollNextRunSeed() {
    nextRunSeed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    previewCache.clear();
  }
  function renderVoyagePreview(stage) {
    const g = voyageMap.getContext('2d');
    let img = previewCache.get(stage);
    if (!img) {
      const level = levelForReef(nextRunSeed, 0, biomeForStage(stage));
      const world = buildLevelWorld(level);
      const W = voyageMap.width; const H = voyageMap.height;
      img = g.createImageData(W, H);
      const b = getBiome(level.biomeId);
      const water = b.water.map(([d, c]) => [d, hexRgb(c)]);
      const land = b.land.map(([d, c]) => [d, hexRgb(c)]);
      const pick = (stops, d) => { let c = stops[0][1]; for (const [sd, sc] of stops) if (d >= sd) c = sc; return c; };
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const s = sampleField(world.coast, ((x + 0.5) / W) * world.widthPx, ((y + 0.5) / H) * world.heightPx);
          const c = s < 0 ? pick(water, -s * 0.8) : (s > 44 ? hexRgb(b.rock) : pick(land, s * 0.7));
          const o = (y * W + x) * 4;
          img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
        }
      }
      img.spawn = { x: world.spawnWorld.x / world.widthPx, y: world.spawnWorld.y / world.heightPx };
      img.exit = { x: world.exitWorld.x / world.widthPx, y: world.exitWorld.y / world.heightPx };
      previewCache.set(stage, img);
    }
    g.putImageData(img, 0, 0);
    const W = voyageMap.width; const H = voyageMap.height;
    // Start (white) → exit (gold), the route you'll be charting.
    g.setLineDash([5, 5]); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(img.spawn.x * W, img.spawn.y * H); g.lineTo(img.exit.x * W, img.exit.y * H); g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(img.spawn.x * W, img.spawn.y * H, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8b54b'; g.beginPath(); g.arc(img.exit.x * W, img.exit.y * H, 7, 0, Math.PI * 2); g.fill();
  }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  // Stage picker (2026-09-28). Defaults to the furthest unlocked stage each
  // time the Hub opens; cleared stages stay replayable (for Salvage).
  let selectedStage = 1;
  function renderStagePicker() {
    selectedStage = Math.min(Math.max(1, selectedStage), meta.highestStageUnlocked);
    stageLabel.querySelector('strong').textContent = `Stage ${selectedStage}`;
    const cleared = selectedStage < meta.highestStageUnlocked;
    stageLabel.querySelector('span').textContent = `${stageInfo(selectedStage).name} · boss: ${getEnemy(bossForStage(selectedStage)).name}${cleared ? ' · Cleared ✓' : ''}`;
    stagePrevBtn.disabled = selectedStage <= 1;
    stageNextBtn.disabled = selectedStage >= meta.highestStageUnlocked;
    renderVoyagePreview(selectedStage);
  }
  stagePrevBtn.addEventListener('click', () => { selectedStage -= 1; renderStagePicker(); });
  stageNextBtn.addEventListener('click', () => { selectedStage += 1; renderStagePicker(); });

  function bossName(r = run) {
    const b = r.enemies.find((e) => e.isBoss) || null;
    return b ? getEnemy(b.defId).name : getEnemy(bossForStage(r.stage || 1)).name;
  }
  function stageLevelText(r = run) {
    return r.stage ? `Stage ${r.stage} – Level ${r.reefIndex + 1}/${r.reefCount}` : `Level ${r.reefIndex + 1}/${r.reefCount}`;
  }
  function levelStartStatus(r = run) {
    if (r.lair) return `${stageLevelText(r)} — sink ${bossName(r)} in its lair ⚓`;
    return r.enemies.some((e) => e.isBoss)
      ? `${stageLevelText(r)} — ${bossName(r)} guards the exit ⚓`
      : `${stageLevelText(r)} — find the exit ⚓`;
  }

  // --- The base harbour scene (2026-09-28) ---------------------------------
  let base = null;
  function ensureBase() {
    if (base) return base;
    const world = buildBaseWorld();
    const terrain = buildTerrain(world.grid, world.tileSize, world.coastSeed, biome, world.coast);
    // Keep palms and boulders out from under the buildings and the dock.
    terrain.decorations = terrain.decorations.filter((d) => !world.buildings.some((b) => Math.hypot(d.x - b.x, d.y - (b.y - 10)) < 64
      || (b.id === 'shipyard' && Math.abs(d.x - b.x) < 30 && d.y > b.y && d.y < b.y + 190)));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const renderer = createTerrainRenderer(terrain, biome, { res: Math.min(1.25, dpr * 0.8) });
    base = { world, renderer, wake: [], wakeTimer: 0, view: null, fresh: true };
    return base;
  }
  // The screen region the harbour can use: below the top bar, and above
  // (portrait) or left of (landscape) the voyage card.
  function baseFreeInsets() {
    const vw = window.innerWidth; const vh = window.innerHeight;
    const top = baseTopbar.getBoundingClientRect().bottom + 4;
    const vc = voyageCard.getBoundingClientRect();
    const sideCard = vc.left > vw * 0.35 && vc.top < vh * 0.5;
    return sideCard
      ? { top, bottom: 6, left: 6, right: vw - vc.left + 6 }
      : { top, bottom: vh - vc.top + 6, left: 0, right: 0 };
  }
  function layoutBase() {
    if (!hubOverlay.classList.contains('show')) return;
    const b = ensureBase();
    b.view = computeBaseView(window.innerWidth, window.innerHeight, baseFreeInsets());
    // Small map: one-line labels so they don't bury the buildings.
    baseChips.classList.toggle('compact', b.view.scale < 0.62);
    for (const bd of b.world.buildings) {
      const p = b.view.toScreen(bd.x, bd.y + b.world.layout.labelOffset);
      const chip = chipEls.get(bd.id);
      chip.style.left = `${Math.round(p.x)}px`;
      chip.style.top = `${Math.round(p.y)}px`;
    }
  }
  function drawBase(now, dt) {
    const b = ensureBase();
    if (!b.view) layoutBase();
    const t = now / 1000; const v = b.view;
    ctx.fillStyle = biome.outside;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.save();
    ctx.translate(v.tx, v.ty); ctx.scale(v.scale, v.scale);
    b.renderer.draw(ctx, v.visible, t, { forceVisible: b.fresh, maxNewChunks: 0 });
    b.fresh = false;
    // Your ship, idling round the lagoon with its wake.
    const p = boatOrbitPoint(t);
    for (const w of b.wake) w.life -= dt;
    while (b.wake.length && b.wake[0].life <= 0) b.wake.shift();
    b.wakeTimer -= dt;
    if (b.wakeTimer <= 0) {
      b.wakeTimer = 0.07;
      b.wake.push({ x: p.x - Math.cos(p.heading) * 18, y: p.y - Math.sin(p.heading) * 18, heading: p.heading, life: 1.1, maxLife: 1.1 });
    }
    drawWake(ctx, b.wake);
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1.5, 1.5); ctx.translate(-p.x, -p.y);
    drawBoat(ctx, { x: p.x, y: p.y, heading: p.heading }, BOAT_RADIUS, t);
    ctx.restore();
    drawBaseBuildings(ctx, b.world.buildings, t, { selectedFaction: meta.selectedFaction });
    drawGulls(ctx, b.world.centre, t);
    ctx.restore();
    b.renderer.prewarm(b.world.centre.x, b.world.centre.y, 3);
  }
  // Tapping a building itself (not just its label) opens its panel.
  hubOverlay.querySelector('#base-scene-hit').addEventListener('click', (e) => {
    if (!base || !base.view) return;
    const wx = (e.clientX - base.view.tx) / base.view.scale;
    const wy = (e.clientY - base.view.ty) / base.view.scale;
    let best = null; let bestD = 70 * BUILDING_SCALE;
    for (const bd of base.world.buildings) {
      const d = Math.hypot(wx - bd.x, wy - (bd.y - 20 * BUILDING_SCALE));
      if (d < bestD) { bestD = d; best = bd; }
    }
    if (best) openPanel(best.panel);
  });
  new ResizeObserver(() => layoutBase()).observe(voyageCard);
  window.addEventListener('resize', () => layoutBase());

  function openHub() {
    sailing = false;
    closePanel();
    selectedStage = meta.highestStageUnlocked;
    rollNextRunSeed();
    renderHub();
    hubOverlay.classList.add('show');
    document.body.classList.add('in-hub');
    playMusic('harbour');
    layoutBase();
  }

  function startRun() {
    // `?level=TR2-0K3F9ZA` in the URL plays that exact reef first (the
    // share/replay hook for seeded levels — engine/levels.mjs); the rest of
    // the voyage is generated as normal. An invalid code is ignored.
    const sharedLevel = decodeLevelCode(new URLSearchParams(window.location.search).get('level'), TIER_COUNT);
    run = createRun(
      nextRunSeed, resolveLoadout(meta),
      { stage: selectedStage, ...(sharedLevel ? { levels: { 0: sharedLevel } } : {}) },
    );
    camera.x = run.boat.x;
    camera.y = run.boat.y;
    particles = createParticlePool();
    damageNumbers = createDamageNumberPool();
    shake.trauma = 0;
    hitStop.remaining = 0;
    setStatus(levelStartStatus());
    toast.classList.remove('show');
    if (run.faction) showMatchupBriefing(run.faction);
    hubOverlay.classList.remove('show');
    document.body.classList.remove('in-hub');
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
  function showRunSummary(newlyUnlocked = false) {
    playMusic(null);
    const heldNiche = Array.from(run.weapons.heldWeapons).filter((id) => id !== 'cannonballs');
    const victory = run.outcome === 'victory';
    summaryTitle.textContent = victory ? `Stage ${run.stage} cleared! ⚓` : `Sunk on ${stageLevelText()}`;
    summaryRetryBtn.hidden = victory;
    summaryBtn.textContent = victory ? 'Return to Harbour ⚓' : 'Give up · keep banked Salvage';
    summaryBtn.classList.toggle('secondary', !victory);
    const reefsCleared = victory ? run.reefCount : run.reefIndex;
    summaryBody.innerHTML = victory ? `
      <p>Levels cleared: ${reefsCleared} / ${run.reefCount}${run.retries ? ` · retries: ${run.retries}` : ''}</p>
      ${newlyUnlocked ? `<p><strong>Stage ${meta.highestStageUnlocked} unlocked!</strong></p>` : ''}
      <p>Salvage banked this voyage: ${Math.round(run.bankedSalvage)}</p>
      <p>Weapons found: ${heldNiche.length ? heldNiche.map((id) => getWeapon(id).name).join(', ') : 'None'}</p>
      ${run.bossDefeated ? `<p>${bossName(run)} sunk — 1 Kraken Scale earned 🦑</p>` : ''}
      <p>Salvage in the Harbour: ${meta.salvage} ⚓${meta.krakenScales > 0 ? ` · Kraken Scales: ${meta.krakenScales} 🦑` : ''}</p>
      <p class="level-codes">Level codes: ${run.levelCodes.map((c) => `<code>${c}</code>`).join(' ')}</p>
    ` : `
      <p>Retry Level ${run.reefIndex + 1} on a new reef, with your hull repaired and the weapons you arrived with. Levels already cleared stay cleared.</p>
      ${run.reefSalvage > 0 ? `<p class="lost">Salvage lost with the ship: ${Math.round(run.reefSalvage)}</p>` : ''}
      <p>Salvage banked so far: ${Math.round(run.bankedSalvage)}</p>
    `;
    summaryOverlay.classList.add('show');
  }
  // A victory banks the voyage into the persistent meta state at once. A
  // sinking waits: the player may retry the level, and the voyage is only
  // recorded when they give up (so nothing is counted twice).
  function endRun() {
    if (run.outcome === 'victory') {
      playVictory();
      const unlockedBefore = meta.highestStageUnlocked;
      recordRunResult(meta, run);
      saveMeta(window.localStorage, meta);
      showRunSummary(meta.highestStageUnlocked > unlockedBefore);
    } else {
      playSunk();
      showRunSummary(false);
    }
  }
  summaryBtn.addEventListener('click', () => {
    if (run.outcome === 'sunk') {
      recordRunResult(meta, run);
      saveMeta(window.localStorage, meta);
    }
    summaryOverlay.classList.remove('show');
    openHub();
  });
  summaryRetryBtn.addEventListener('click', () => {
    if (!retryLevel(run)) return;
    summaryOverlay.classList.remove('show');
    camera.x = run.boat.x; camera.y = run.boat.y;
    particles = createParticlePool();
    damageNumbers = createDamageNumberPool();
    shake.trauma = 0; hitStop.remaining = 0;
    aimTarget = null; aimHeading = null;
    setStatus(levelStartStatus());
    showToast(`Level ${run.reefIndex + 1} — a new reef. Hull repaired ⚓`);
    updateHullBar(); updateSalvageCounter(); updateReefIndicator(); updateWeaponBar();
    sailing = true;
  });

  // A tiny debug hook for headless/automated testing — not user-facing,
  // costs nothing at runtime, and saves having to poke at internals.
  window.__shatteredReefDebug = () => ({
    boatX: run.boat.x, boatY: run.boat.y, heading: run.boat.heading,
    hull: run.boat.health, maxHull: run.boat.maxHull, cameraX: camera.x, cameraY: camera.y,
    over: run.over, outcome: run.outcome, sailing, hubOpen: hubOverlay.classList.contains('show'),
    stage: run.stage, highestStageUnlocked: meta.highestStageUnlocked, reefIndex: run.reefIndex, reefCount: run.reefCount, levelCode: run.levelCode, levelCodes: run.levelCodes.slice(),
    exitX: run.exitWorld.x, exitY: run.exitWorld.y,
    bankedSalvage: run.bankedSalvage, reefSalvage: run.reefSalvage,
    salvage: totalSalvage(run), activeWeapon: run.weapons.activeWeaponId,
    enemyCount: run.enemies.filter((e) => e.health > 0).length,
    projectileCount: run.weapons.projectiles.length,
    enemies: run.enemies.filter((e) => e.health > 0).map((e) => ({
      id: e.id, defId: e.defId, aggro: e.aggro, x: e.x, y: e.y, health: e.health, invulnerable: e.invulnerable,
      isBoss: e.isBoss, phaseIndex: e.phaseIndex, diveState: e.diveState, sharkState: e.sharkState, submergedState: e.submergedState, gunWindup: e.gunWindup,
    })),
    aimTargetId: aimTarget ? aimTarget.id : null, suggestedWeapon, enemyShots: run.enemyProjectiles.length, volleysAtYou: run.volleysAtYou || 0,
    firing: isFiring, cooldownRemaining: run.weapons.cooldownRemaining,
    heldWeapons: Array.from(run.weapons.heldWeapons),
    ammo: { ...run.weapons.ammo },
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
    hudInsets: { ...hudInsets },
    boatScreen: lastView && { x: run.boat.x + lastView.translateX, y: run.boat.y + lastView.translateY },
    faction: run.faction, bossDefeated: run.bossDefeated, craftedDamageMultipliers: run.craftedDamageMultipliers,
    particleCount: particles.length, damageNumberCount: damageNumbers.length,
    damageNumbers: damageNumbers.map((d) => ({ amount: d.amount, crit: d.crit, triangle: d.triangle, incoming: d.incoming })),
    shakeTrauma: shake.trauma, hitStopRemaining: hitStop.remaining, muted: isMuted(), audio: audioLevel(), music: currentMusic(),
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
  window.__shatteredReefSetHull = (hp) => { run.boat.health = hp; if (hp > run.boat.maxHull) run.boat.maxHull = hp; };
  // Testing-only: places an enemy (optionally at reduced health) at a world
  // position — added so a headless playtest can reliably stage a specific
  // fight (e.g. the boss, which only appears by chance on reef 3) without
  // navigating a generated maze. The kill itself still goes through the
  // real resolveHits/boss-kill path, so this proves the wiring, not a shortcut.
  // Testing-only: move a spawned enemy (by the id __shatteredReefSpawnEnemy
  // returned). Lets a headless playtest hold a fight at a chosen range —
  // e.g. the Depth-Charge kiting distance a real player would keep —
  // without scripting maze-aware joystick kiting.
  window.__shatteredReefMoveEnemy = (id, x, y) => {
    const e = run.enemies.find((en) => en.id === id);
    if (e) { e.x = x; e.y = y; e.vx = 0; e.vy = 0; }
    return !!e;
  };
  // Testing-only: set a live enemy's health (e.g. 1, to finish a boss
  // through the real hit path in a playtest). Unreachable from any UI.
  window.__shatteredReefSetEnemyHealth = (id, health) => {
    const e = run.enemies.find((en) => en.id === id);
    if (e) e.health = health;
    return !!e;
  };
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
      const impactSpeed = resolveCoastCollision(run.boat, BOAT_RADIUS, run.coast);
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

      updateAim();
      updateCounterHint();
      playMusic(run.lair ? 'lair' : 'voyage');
      isFiring = aimHeading != null;
      if (isFiring) {
        const fired = tryFire(run.weapons, run.boat.x, run.boat.y, computeFireHeading());
        if (fired) { updateWeaponBar(); playFire(run.weapons.activeWeaponId); }
      }
      stepCombat(run.weapons, dt, run.grid, run.tileSize, run.enemies);
      if (stepAmmoRegen(run.weapons, dt)) updateWeaponBar();
      updateEnemies(run.enemies, run.boat, dt, run.grid, run.tileSize, run.coast);
      if (stepSummons(run.enemies, dt).length) playBossPhaseChange();
      trackEnemyMotion(run.enemies, dt);
      // Enemy gunnery: wind-up, fire, and shots in flight.
      const world = { grid: run.grid, tileSize: run.tileSize, coast: run.coast };
      const volleys = updateEnemyGuns(run.enemies, run.boat, dt, world, run.enemyProjectiles);
      if (volleys > 0) { playEnemyFire(); run.volleysAtYou = (run.volleysAtYou || 0) + volleys; }
      const shotResult = stepEnemyProjectiles(run.enemyProjectiles, run.boat, BOAT_RADIUS, dt, world, incomingMultiplierFor(run.faction));
      for (const sp of shotResult.splashes) spawnSplash(particles, sp.x, sp.y, Math.random, 5);
      if (shotResult.hits.length) {
        for (const h of shotResult.hits) {
          const m = incomingTriangleMultiplier(h.shot.faction, run.faction);
          spawnDamageNumber(damageNumbers, run.boat.x + 24, run.boat.y - BOAT_RADIUS - 8, h.damage, {
            incoming: true, triangle: m > 1 ? 'danger' : m < 1 ? 'resist' : null,
          });
          spawnHitSpark(particles, h.shot.x, h.shot.y, '#ffb347', Math.random);
        }
        updateHullBar();
        flashHit();
        addShake(shake, 0.35);
        playWallImpact(0.7);
      }

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
          showToast(`${getEnemy(enemy.defId).name} changes tactics — ${getWeapon(enemy.counter).name} hurts it most ⚓`);
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
          jitterX: (Math.random() - 0.5) * 10,
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
            showToast(run.lair ? `${bossName(run)} is sunk — the whirlpool opens! Sail into it ⚓` : `${bossName(run)} is sunk! ⚓`);
            run.bossDefeated = true; // engine/meta.mjs's recordRunResult awards a Kraken Scale
          } else {
            spawnKillBurst(particles, ev.enemy.x, ev.enemy.y, weaponColor, Math.random);
            maybeDropRepair(ev.enemy);
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
              showToast(run.lair ? `${bossName(run)} is sunk — the whirlpool opens! Sail into it ⚓` : `${bossName(run)} is sunk! ⚓`);
              run.bossDefeated = true;
            } else {
              spawnKillBurst(particles, enemy.x, enemy.y, PALETTE.burn, Math.random);
              maybeDropRepair(enemy);
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

      // The triangle applies to damage you TAKE too (engine/enemies.mjs
      // incomingMultiplierFor). Each hit floats a number over the boat, so
      // "your predator hits harder" is visible, not just a faster hull bar.
      const contactEvents = resolveEnemyContactEvents(run.enemies, run.boat, BOAT_RADIUS, incomingMultiplierFor(run.faction));
      let contactDamage = 0;
      for (const ev of contactEvents) {
        contactDamage += ev.damage;
        const m = incomingTriangleMultiplier(ev.enemy.faction, run.faction);
        // Offset left of the boat: an enemy touching the boat spawns its own
        // (outgoing) numbers at nearly the same point, and the two used to
        // overprint each other.
        spawnDamageNumber(damageNumbers, run.boat.x - 30, run.boat.y - BOAT_RADIUS - 8, ev.damage, {
          incoming: true,
          triangle: m > 1 ? 'danger' : m < 1 ? 'resist' : null,
        });
      }
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
        } else if (ev.kind === PICKUP_KINDS.REPAIR) {
          updateHullBar();
          spawnDamageNumber(damageNumbers, run.boat.x, run.boat.y - BOAT_RADIUS - 10, ev.amount, { heal: true });
          spawnSplash(particles, run.boat.x, run.boat.y, Math.random, 10);
          showToast('Hull repaired ⚓');
          playRevive();
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
          setStatus(levelStartStatus());
          // The Kraken's Anchor is a chance-based spawn on the final reef
          // (see data/enemies.mjs), so a voyage may or may not meet it —
          // when it does, fold the warning into the same toast as the
          // reef-cleared message rather than a second toast that would
          // just overwrite this one a moment later.
          const boss = run.enemies.find((e) => e.isBoss);
          if (boss) {
            boss._lastAnnouncedPhase = boss.phaseIndex; // don't fire a false "swap" on first sight
            showToast(`Level ${run.reefIndex} cleared! +${Math.round(bankedThisReef)} Salvage ⚓ — ${getEnemy(boss.defId).name} waits in its lair`);
          } else {
            showToast(`Level ${run.reefIndex} cleared! +${bankedThisReef} Salvage banked ⚓`);
          }
          updateReefIndicator();
          updateSalvageCounter();
          updateWeaponBar();
          playReefCleared();
        }
      }
    }

    if (hubOverlay.classList.contains('show')) {
      // The base harbour replaces the reef view entirely while the Hub is up.
      drawBase(now, rawDt);
      requestAnimationFrame(frame);
      return;
    }

    updateCamera(camera, run.boat.x, run.boat.y, rawDt);
    // Wake: foam puffs off the stern while under way.
    for (const w of wake) w.life -= rawDt;
    while (wake.length && wake[0].life <= 0) wake.shift();
    const boatSpeed = Math.hypot(run.boat.vx, run.boat.vy);
    wakeTimer -= rawDt;
    if (boatSpeed > 25 && !run.over && wakeTimer <= 0) {
      wakeTimer = 0.05;
      const life = 0.5 + Math.min(1, boatSpeed / 120) * 0.5;
      wake.push({ x: run.boat.x - Math.cos(run.boat.heading) * BOAT_RADIUS * 1.2, y: run.boat.y - Math.sin(run.boat.heading) * BOAT_RADIUS * 1.2, heading: run.boat.heading, life, maxLife: life });
    }
    particles = updateParticles(particles, rawDt);
    damageNumbers = updateDamageNumbers(damageNumbers, rawDt);
    const shakeOffset = updateShake(shake, rawDt);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    ctx.fillStyle = biome.outside;
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    const view = applyCameraTransform(ctx, camera, vw, vh, run.widthPx, run.heightPx, shakeOffset, hudInsets);
    lastView = view;
    ensureTerrain();
    terrainRenderer.draw(ctx, view.visible, now / 1000, { forceVisible: terrainFresh, maxNewChunks: 0 });
    terrainFresh = false;
    if (run.lair) drawLairCurrents(ctx, run.lair.centre, run.lair.pitRadius, now / 1000);
    drawWake(ctx, wake);
    if (isExitOpen(run)) drawExit(ctx, run.exitWorld.x, run.exitWorld.y, run.tileSize * 0.9, now / 1000);
    else drawSealedExit(ctx, run.exitWorld.x, run.exitWorld.y, run.tileSize * 0.9, now / 1000);
    drawPickups(ctx, run.pickups, (p) => WEAPON_SHORT_LABEL[p.weaponId], now / 1000);
    drawEnemies(
      ctx, run.enemies, (e) => e.colorHex || enemyColor(e), now / 1000,
      (e) => (e.isBoss ? getEnemy(e.defId).name : null),
      (e) => relationTo(run.faction, e.faction),
      run.boat,
    );
    drawEnemyProjectiles(ctx, run.enemyProjectiles, now / 1000);
    if (aimTarget && aimTarget.health > 0 && sailing && !run.over) drawTargetReticle(ctx, aimTarget, now / 1000, isFiring);
    drawProjectiles(ctx, run.weapons.projectiles, (p) => getWeapon(p.weaponId).color);
    if (run.outcome !== 'sunk') drawBoat(ctx, run.boat, BOAT_RADIUS, now / 1000);
    drawParticles(ctx, particles);
    drawDamageNumbers(ctx, damageNumbers);
    ctx.restore();

    // Stream the rest of the reef's terrain in the background, one chunk a
    // frame, so scrolling never reveals an unrendered chunk.
    terrainRenderer.prewarm(camera.x, camera.y, 3);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setStatus(levelStartStatus());
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

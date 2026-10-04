// Boots the game: canvas setup, the run/level, input, combat, the game
// loop, the HUD, and the Captain's Hub (step 7 — meta-progression). The
// app now opens on the Hub rather than straight into a run: Salvage
// persisted across runs (localStorage, engine/meta.mjs) is spent there on
// Ship Hulls / Cargo Loadouts / Captain's Charms before "Set Sail" starts
// an actual voyage with that loadout resolved into it.

import { viewH, installViewportFix } from './ui/viewport.mjs';
import { playMusic, currentMusic } from './audio/music.mjs';
import { musicFor } from './data/music.mjs';
import { saveVoyage, loadVoyage, peekVoyage, clearVoyage, retireLegacyVoyage } from './engine/save.mjs';
import { ARMAMENT_BY_ID, ARMAMENT_MAX_LEVEL } from './data/armaments.mjs';
import { grantArmament, spiritPositions } from './engine/armaments.mjs';
import { drawSpirits, drawLightning, drawEnrage } from './engine/armamentArt.mjs';
import { startWeather, weatherModifiers } from './engine/weather.mjs';
import { drawWeatherWorld, drawWeatherAbove, drawWeatherScreen, drawBolt } from './engine/weatherArt.mjs';
import { ambientLight } from './engine/ambient.mjs';
import { drawDarkness, drawGlows, drawEyes, drawAmbientScreen } from './engine/lightArt.mjs';
import { glowingDecorations } from './engine/terrainRenderer.mjs';
import { BASE_BUILDINGS } from './data/base.mjs';
import { buildBaseWorld, computeBaseView, boatOrbitPoint } from './engine/base.mjs';
import { drawBaseBuildings, drawGulls, BUILDING_SCALE } from './engine/baseRenderer.mjs';
import { sampleField } from './engine/terrain.mjs';
import { buildTerrain } from './engine/terrain.mjs';
import { createTerrainRenderer } from './engine/terrainRenderer.mjs';
import { getBiome, BIOME_IDS } from './data/biomes.mjs';
import { checkSunk, addSalvage, BOAT_RADIUS, LEVELS_PER_STAGE, biomeForStage } from './engine/run.mjs';
import { hasAffliction } from './engine/boat.mjs';
import { createCamera, updateCamera, applyCameraTransform } from './engine/camera.mjs';
import {
  drawWake, drawBoat, drawBoatStatus, drawEnemies, drawEnemyTelegraphs, drawProjectiles, drawParticles, drawDamageNumbers, drawEnemyProjectiles, PALETTE,
} from './engine/renderer.mjs';
import { createJoystick } from './input/joystick.mjs';
import { resolveHits } from './engine/combat.mjs';
import { createEnemy } from './engine/enemies.mjs';
import { getWeapon } from './data/weapons.mjs';
import { getEnemy } from './data/enemies.mjs';
import { bossForStage, stageInfo, stageName } from './data/stages.mjs';
import { createWorldMap } from './ui/worldMap.mjs';
import { createIntro } from './ui/intro.mjs';
import { SHIP_HULL_LIST, CARGO_TIER_LIST, CHARM_LIST, PLAYABLE_FACTION_LIST, WORKSHOP_UPGRADE_LIST } from './data/meta.mjs';
import { triangleMultiplier, incomingTriangleMultiplier, matchupFor, relationTo } from './data/factions.mjs';
import { ENEMY_LIST } from './data/enemies.mjs';
import {
  loadMeta, saveMeta, resolveLoadout, canAfford, purchaseHull, selectHull, purchaseCargoTier, purchaseCharm, purchaseFaction, selectFaction, purchaseWorkshopUpgrade, canAffordWorkshopUpgrade, isLevelUnlocked, furthestLevel, recordLevelResult,
} from './engine/meta.mjs';
import {
  createParticlePool, spawnHitSpark, spawnMuzzleFlash, spawnKillBurst, spawnExplosion, spawnSplash, updateParticles, createDamageNumberPool, spawnDamageNumber, updateDamageNumbers, createShake, addShake, updateShake, createHitStop, triggerHitStop, applyHitStop,
} from './engine/juice.mjs';
import {
  unlockAudio, setMuted, isMuted, audioLevel, playFire, playHit, playKill, playExplosion, playWallImpact, playPickupWeapon, playPickupSalvage, playReefCleared, playVictory, playSunk, playRevive, playBossPhaseChange, playBossDefeated, playTreasure, playZap, playThunder, playWeatherWarning, playStrikeMark,
} from './audio/audio.mjs';
import { createSurvivalRun, buildSurvivalWorld, survivalLevel, completeLevel, sinkLevel, addLevelSalvage } from './engine/survivalRun.mjs';
import { rollChoices, applyChoice, describeChoice, addXp, timeToBoss, orbitBlades } from './engine/survival.mjs';
import { stepSurvivalFrame } from './engine/survivalLoop.mjs';
import {
  drawSurvivalPickups, drawFirePools, drawOrbitBlades, drawHullBar, drawRings, drawSinkers, drawLandmarks, drawEdgeArrows, drawVignette,
} from './engine/survivalArt.mjs';
import { SURVIVAL, WAVES, SV_WEAPONS, SV_WEAPON_MAX, PASSIVE_BY_ID } from './data/survival.mjs';
import { createDefenceMode } from './td/tdMode.mjs';
import { renderTowerYard, towerYardBuyable } from './ui/towerYard.mjs';

const MUTE_STORAGE_KEY = 'shatteredReef.muted.v1';

const WEAPON_ICONS = {
  cannonballs: '⚫', chain_shot: '⛓️', grapeshot: '💥', depth_charges: '💣', flame_barrels: '🔥',
};

const WEAPON_SHORT_LABEL = {
  chain_shot: 'CS', grapeshot: 'GS', depth_charges: 'DC', flame_barrels: 'FB', cannonballs: 'CB',
};

export function startApp(root) {
  installViewportFix();
  root.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  root.appendChild(canvas);

  const touchLayer = document.createElement('div');
  touchLayer.id = 'touch-layer';
  root.appendChild(touchLayer);

  const hud = document.createElement('div');
  hud.id = 'hud';
  // Survival HUD (2026-10-04): where you are and the time to the boss,
  // Salvage, the XP bar with your ship's level, and the ten wave pips.
  hud.innerHTML = `
    <div id="sv-top">
      <div id="sv-title"><b id="sv-place"></b><small id="sv-sub"></small></div>
      <div id="sv-timer"><i>⏳</i><b id="sv-time">5:00</b></div>
      <div id="sv-salvage"><i>⚓</i><b id="salvage-counter">0</b></div>
    </div>
    <div id="sv-xp"><div id="sv-xp-fill"></div><span id="sv-lv">Lv 1</span></div>
    <div id="sv-waves" aria-label="Waves"></div>
    <div id="sv-under"><span id="weather-chip" hidden></span><span id="sv-boss" hidden></span></div>
    <span id="hud-status" hidden></span>
  `;
  root.appendChild(hud);
  // The armament/weapon dock: what your ship carries, with level pips.
  // Display only (everything fires on its own), so it never steals a touch.
  const weaponDock = document.createElement('div');
  weaponDock.id = 'weapon-bar';
  root.appendChild(weaponDock);
  const passiveStrip = document.createElement('div');
  passiveStrip.id = 'upgrade-strip';
  root.appendChild(passiveStrip);

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

  // No text selection, copy/paste callouts or magnifier on long presses
  // (2026-09-29 playtest: "copy and paste/select comes up on touch"). Only
  // things marked .selectable (the level codes) can be selected.
  const allowSelect = (t) => !!(t && t.closest && t.closest('.selectable'));
  document.addEventListener('selectstart', (e) => { if (!allowSelect(e.target)) e.preventDefault(); });
  document.addEventListener('contextmenu', (e) => { if (!allowSelect(e.target)) e.preventDefault(); });
  for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(g, (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  // Pause (2026-09-29): a button in the corner during play, a menu while
  // paused, and "save & return to harbour" to pick the voyage up later.
  const pauseButton = document.createElement('button');
  pauseButton.id = 'pause-button';
  pauseButton.type = 'button';
  pauseButton.setAttribute('aria-label', 'Pause');
  pauseButton.textContent = '❚❚';
  root.appendChild(pauseButton);
  const pauseMenu = document.createElement('div');
  pauseMenu.id = 'pause-menu';
  pauseMenu.hidden = true;
  pauseMenu.innerHTML = `
    <div class="pm-card" role="dialog" aria-modal="true" aria-labelledby="pm-title">
      <h1 id="pm-title">Paused</h1>
      <p id="pm-where"></p>
      <div id="pm-kit"></div>
      <button type="button" id="pm-resume" class="pm-primary">▶ Resume</button>
      <button type="button" id="pm-sound" class="pm-btn"></button>
      <button type="button" id="pm-harbour" class="pm-btn">⚓ Save &amp; return to harbour</button>
      <p class="pm-note">Your level is saved. Continue it from the harbour any time.</p>
      <button type="button" id="pm-abandon" class="pm-btn pm-danger">Abandon level</button>
    </div>`;
  root.appendChild(pauseMenu);
  const countdownEl = document.createElement('div');
  countdownEl.id = 'resume-countdown';
  countdownEl.hidden = true;
  root.appendChild(countdownEl);
  // A small in-game confirm (the browser's own is ugly and blocks audio).
  const confirmEl = document.createElement('div');
  confirmEl.id = 'confirm-dialog';
  confirmEl.hidden = true;
  confirmEl.innerHTML = `<div class="cd-card" role="alertdialog" aria-modal="true"><p id="cd-text"></p><div class="cd-row"><button type="button" id="cd-cancel" class="pm-btn">Cancel</button><button type="button" id="cd-ok" class="pm-primary"></button></div></div>`;
  root.appendChild(confirmEl);
  function askConfirm(text, okLabel) {
    return new Promise((resolve) => {
      confirmEl.querySelector('#cd-text').textContent = text;
      confirmEl.querySelector('#cd-ok').textContent = okLabel;
      confirmEl.hidden = false;
      const done = (v) => { confirmEl.hidden = true; ok.removeEventListener('click', yes); cancel.removeEventListener('click', no); resolve(v); };
      const ok = confirmEl.querySelector('#cd-ok'); const cancel = confirmEl.querySelector('#cd-cancel');
      const yes = () => done(true); const no = () => done(false);
      ok.addEventListener('click', yes); cancel.addEventListener('click', no);
    });
  }

  const upgradeOverlay = document.createElement('div');
  upgradeOverlay.id = 'upgrade-pick';
  upgradeOverlay.hidden = true;
  upgradeOverlay.innerHTML = `<div class="up-wrap"><h2 id="up-title"></h2><p class="up-sub"></p><div id="up-cards"></div></div>`;
  root.appendChild(upgradeOverlay);

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
          <button type="button" class="vc-chart-btn" id="open-chart">🗺️ Voyage Chart ›</button>
          <div id="hub-stage-picker">
            <button type="button" id="stage-prev" aria-label="Previous stage">◀</button>
            <div id="stage-label"><strong></strong><span></span></div>
            <button type="button" id="stage-next" aria-label="Next stage">▶</button>
          </div>
          <div class="vc-pips" id="vc-pips" role="group" aria-label="Levels — the boss waits on level 5"></div>
        </div>
      </div>
      <button type="button" id="hub-continue" hidden>▶ Continue level<small></small></button>
      <div class="vc-actions">
        <button type="button" id="hub-set-sail">▶ Set Sail</button>
        <button type="button" id="vc-defend"><span>🏰 Defend</span><small>the Reef</small></button>
      </div>
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
          <section class="hub-section" data-panel="towers">
            <p class="hub-section-note">Towers for Reef Defence. Cannon Battery and Grapeshot Nest are yours from the start; specialisations are built on a level-3 tower.</p>
            <div id="hub-towers" class="hub-list"></div>
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
  const continueBtn = hubOverlay.querySelector('#hub-continue');
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
    towers: ['Tower Yard', 'Reef Defence — towers, specialisations and reef works'],
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
    toast.style.top = (dark || document.body.classList.contains('in-run')) ? `${hudInsets.top + 4}px` : '';
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
  let run = createSurvivalRun(Date.now() & 0xffffffff, resolveLoadout(meta));
  let sailing = false;
  // Pause and save (2026-09-29). `voyageActive`: a voyage is under way (or
  // sunk and waiting on retry / give up) and should be saved. `paused`
  // freezes the simulation; `resumeIn` is the short "3, 2, 1" before play
  // picks up again, so a resume never drops you straight into a hit.
  let voyageActive = false;
  let paused = false;
  let resumeIn = 0;
  let pendingChoice = null;
  let autosaveTimer = 0;
  function saveCurrentVoyage() {
    if (!voyageActive) return;
    saveVoyage(window.localStorage, run, { pendingChoice });
  }
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
  const biome = getBiome(BIOME_IDS.TROPICAL); // the harbour's
  let runBiome = biome; // the current reef's (each stage has its own)
  const wake = []; let wakeTimer = 0;
  let terrainGrid = null; let terrain = null; let terrainRenderer = null; let terrainFresh = false; let terrainGlows = [];
  function ensureTerrain() {
    if (terrainGrid === run.grid) return;
    terrainGrid = run.grid;
    runBiome = getBiome(run.level?.biomeId || BIOME_IDS.TROPICAL);
    terrain = buildTerrain(run.grid, run.tileSize, run.coastSeed, runBiome, run.coast, { shoals: run.mode === 'survival' });
    terrainRenderer = createTerrainRenderer(terrain, runBiome, { res: Math.min(window.devicePixelRatio || 1, 1.5) });
    terrainGlows = glowingDecorations(terrain, runBiome);
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
    const vh = viewH();
    const weaponBar = document.getElementById('weapon-bar');
    const top = Math.max(0, Math.round(hud.getBoundingClientRect().bottom + margin));
    const dock = weaponBar.getBoundingClientRect();
    const hasDock = dock.width > 0 && dock.height > 0;
    hudInsets.top = top;
    hudInsets.left = 0;
    if (landscapeMql && landscapeMql.matches) {
      // Landscape: the dock is a column on the right.
      hudInsets.right = hasDock ? Math.max(0, Math.round(vw - dock.left + margin)) : 0;
      hudInsets.bottom = 0;
      return;
    }
    hudInsets.right = 0;
    hudInsets.bottom = hasDock ? Math.max(0, Math.round(vh - dock.top + margin)) : 0;
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
  let lightning = []; // St Elmo's Fire arcs (armamentArt.drawLightning)
  let bolts = []; // weather lightning strikes, drawn briefly
  let announcedWeather = null;
  const shake = createShake();
  const hitStop = createHitStop();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(viewH() * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${viewH()}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function setStatus(text) {
    document.getElementById('hud-status').textContent = text;
  }

  // Survival HUD (2026-10-04). Every DOM write is guarded by a "changed?"
  // check: per-frame writes force style recalcs on phones (2026-09-29).
  const salvageEl = document.getElementById('salvage-counter');
  const xpFill = document.getElementById('sv-xp-fill');
  const lvEl = document.getElementById('sv-lv');
  const timeEl = document.getElementById('sv-time');
  const wavesEl = document.getElementById('sv-waves');
  const timerBox = document.getElementById('sv-timer');
  const hudShown = { salvage: -1, xp: -1, lv: -1, time: '', wave: -1 };
  // Hull is drawn under the ship on the canvas; nothing to do in the DOM.
  function updateHullBar() {}
  function updateSalvageCounter() {
    const v = Math.floor(run.reefSalvage);
    if (v !== hudShown.salvage) { hudShown.salvage = v; salvageEl.textContent = String(v); }
  }
  function updateReefIndicator() {
    document.getElementById('sv-place').textContent = stageName(run.stage || 1);
    document.getElementById('sv-sub').textContent = `Stage ${run.stage || 1} · Level ${run.reefIndex + 1}/${run.reefCount}`;
    hudShown.wave = -1;
    renderWavePips();
  }
  function renderWavePips() {
    if (!run.sv || run.sv.wave === hudShown.wave) return;
    hudShown.wave = run.sv.wave;
    const n = SURVIVAL.waves;
    const boss = run.sv.bossDefId ? '☠' : '⚔';
    wavesEl.replaceChildren(...Array.from({ length: n }, (_, i) => {
      const el = document.createElement('span');
      el.className = `pip${i < run.sv.wave ? ' done' : ''}${i === run.sv.wave ? ' now' : ''}${i === n - 1 ? ' boss' : ''}${WAVES[i].event === 'elite' || WAVES[i].event === 'elite2' ? ' elite' : ''}`;
      if (i === n - 1) el.textContent = boss;
      return el;
    }));
  }
  function updateSurvivalHud() {
    if (!run.sv) return;
    const sv = run.sv;
    const pct = Math.round((1000 * sv.xp) / sv.xpNeed) / 10;
    if (pct !== hudShown.xp) { hudShown.xp = pct; xpFill.style.width = `${pct}%`; }
    if (sv.shipLevel !== hudShown.lv) { hudShown.lv = sv.shipLevel; lvEl.textContent = `Lv ${sv.shipLevel}`; }
    const left = timeToBoss(run);
    const txt = left > 0 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : (sv.bossDefId ? 'BOSS' : 'WARLORD');
    if (txt !== hudShown.time) { hudShown.time = txt; timeEl.textContent = txt; timerBox.classList.toggle('boss', left <= 0); }
    renderWavePips();
    updateSalvageCounter();
  }

  // The dock: every weapon and armament aboard, with its level as pips
  // (gold flame when evolved). Rebuilt only when the kit changes.
  const weaponBar = weaponDock;
  let dockKey = '';
  function renderDock() {
    if (!run.sv) return;
    const items = [
      ...Object.entries(run.sv.weapons).map(([id, lv]) => ({ id, lv, max: SV_WEAPON_MAX, icon: run.sv.evolved[id] ? SV_WEAPONS[id].evolve.icon : SV_WEAPONS[id].icon, name: run.sv.evolved[id] ? SV_WEAPONS[id].evolve.name : SV_WEAPONS[id].name, evo: !!run.sv.evolved[id] })),
      ...Object.entries(run.armaments || {}).map(([id, lv]) => ({ id, lv, max: ARMAMENT_MAX_LEVEL, icon: ARMAMENT_BY_ID[id].icon, name: ARMAMENT_BY_ID[id].name, arm: true })),
    ];
    const key = items.map((i) => `${i.id}${i.lv}${i.evo ? 'e' : ''}`).join(',');
    if (key === dockKey) return;
    dockKey = key;
    weaponBar.replaceChildren(...items.map((it) => {
      const el = document.createElement('div');
      el.className = `dock-tile${it.evo ? ' evo' : ''}${it.arm ? ' arm' : ''}`;
      el.title = it.name;
      const ic = document.createElement('span'); ic.className = 'dock-icon'; ic.textContent = it.icon;
      const pips = document.createElement('span'); pips.className = 'dock-pips';
      if (it.evo) pips.textContent = 'MAX';
      else for (let k = 0; k < it.max; k++) { const d = document.createElement('i'); if (k < it.lv) d.className = 'on'; pips.appendChild(d); }
      el.append(ic, pips);
      return el;
    }));
  }
  const updateWeaponBar = renderDock;
  function renderUpgradeStrip() {
    if (!run.sv) return;
    passiveStrip.replaceChildren(...Object.entries(run.sv.passives).map(([id, lv]) => {
      const el = document.createElement('span');
      el.textContent = `${PASSIVE_BY_ID[id].icon}${lv}`;
      el.title = PASSIVE_BY_ID[id].name;
      return el;
    }));
  }

  // Level-up and treasure choices: the level waits while you pick.
  function cardEl(card) {
    const v = describeChoice(run, card);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `up-card k-${card.kind}${v.evolve ? ' evo' : ''}`;
    b.dataset.card = `${card.kind}:${card.id}`;
    b.innerHTML = '<span class="up-icon"></span><span class="up-text"><small class="up-kind"></small><b></b><span class="up-desc"></span><em class="up-note"></em></span><span class="up-lv"></span>';
    b.querySelector('.up-icon').textContent = v.icon;
    b.querySelector('.up-kind').textContent = v.kindLabel;
    b.querySelector('b').textContent = v.name;
    b.querySelector('.up-desc').textContent = v.desc;
    const note = v.counters?.length ? `Counters: ${v.counters.join(', ')}` : v.evolves ? `Evolves ${v.evolves} at Lv 5` : '';
    b.querySelector('.up-note').textContent = note;
    if (!note) b.querySelector('.up-note').remove();
    const lv = b.querySelector('.up-lv');
    if (v.max) lv.textContent = '★'.repeat(v.level) + '☆'.repeat(Math.max(0, v.max - v.level));
    else if (v.evolve) lv.textContent = 'EVOLVE';
    return b;
  }
  function offerChoices(title, sub, choices) {
    if (!choices.length) return false;
    sailing = false;
    pendingChoice = { title, sub, choices };
    saveCurrentVoyage();
    joystick.reset?.();
    upgradeOverlay.querySelector('#up-title').textContent = title;
    upgradeOverlay.querySelector('.up-sub').textContent = sub;
    const cards = upgradeOverlay.querySelector('#up-cards');
    cards.replaceChildren(...choices.map((c) => {
      const b = cardEl(c);
      b.addEventListener('click', () => {
        if (upgradeOverlay.hidden) return;
        const v = describeChoice(run, c);
        const res = applyChoice(run, c);
        if (res?.salvage) addLevelSalvage(run, res.salvage);
        upgradeOverlay.hidden = true;
        pendingChoice = null;
        playPickupWeapon();
        showToast(`${v.icon} ${v.name}${v.max ? ` ${'★'.repeat(v.level)}` : ''}`);
        renderDock(); renderUpgradeStrip(); updateSurvivalHud();
        spawnLevelRing(c.kind === 'evolve');
        sailing = true;
        saveCurrentVoyage();
        // Several level-ups at once: the next one follows straight on.
        setTimeout(maybeOfferChoice, 140);
      });
      return b;
    }));
    upgradeOverlay.hidden = false;
    return true;
  }
  function maybeOfferChoice() {
    if (!run.sv || run.over || !upgradeOverlay.hidden || paused || !voyageActive) return;
    const n = SURVIVAL.choices + (run.extraCardChoices || 0);
    if (run.sv.pendingLevelUps > 0) {
      run.sv.pendingLevelUps -= 1;
      playReefCleared();
      offerChoices(`Level up! ⚓ Lv ${run.sv.shipLevel - run.sv.pendingLevelUps}`, 'Choose one — it lasts for this level.', rollChoices(run, Math.random, n));
    } else if (run.sv.pendingChests > 0) {
      run.sv.pendingChests -= 1;
      playTreasure();
      if (run.chestSalvage) addLevelSalvage(run, run.chestSalvage);
      const evo = rollChoices(run, Math.random, n);
      offerChoices('Treasure! 💰', 'Pick a free upgrade from the hold.', evo);
    }
  }
  // A ring of light off the ship on a level-up pick (an evolution: gold).
  function spawnLevelRing(evo) {
    rings.push({ x: run.boat.x, y: run.boat.y, life: 0.6, maxLife: 0.6, r: evo ? 90 : 60, color: evo ? '255, 214, 92' : '150, 230, 255' });
  }

  // A ship's portrait for the Shipyard: the same art you'll sail.
  let baseBoatStyle = 'sloop';
  function drawHullPreview(cv, hullId) {
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#1f7fa0'; c.beginPath(); c.arc(56, 56, 54, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(56, 56); c.scale(2.3, 2.3);
    drawBoat(c, { x: 0, y: 0, heading: -Math.PI / 2, style: hullId }, BOAT_RADIUS, 0.4);
    c.restore();
  }

  // Feedback for one hit (the engine has already applied the damage and
  // dropped the loot). With a hundred enemies on the water this runs a lot,
  // so numbers, particles and sounds are capped and throttled.
  const sinkers = []; // sunk enemies, drawn going under for a moment
  const rings = []; // shockwave rings (blasts, level-ups)
  let killSoundCd = 0; let hitSoundCd = 0;
  function processHitEvent(ev, { burn = false, ram = false } = {}) {
    const enemy = ev.enemy;
    if (ev.blocked || !ev.damage) return 0;
    burn = burn || !!ev.burn;
    const color = burn ? PALETTE.burn : getWeapon(ev.weaponId).color;
    const big = enemy.isBoss || enemy.elite;
    enemy.hitFlash = 0.09;
    if (damageNumbers.length < 70 || ev.counter || big) {
      const triangleMult = ram ? 1 : triangleMultiplier(run.faction, enemy.faction);
      spawnDamageNumber(damageNumbers, enemy.x, enemy.y - enemy.radius - 4, ev.damage, {
        jitterX: (Math.random() - 0.5) * 12,
        crit: !!ev.counter,
        triangle: triangleMult > 1 ? 'advantage' : triangleMult < 1 ? 'disadvantage' : null,
      });
    }
    if (!ev.killed) {
      if (!burn && particles.length < 420) spawnHitSpark(particles, enemy.x, enemy.y, color, Math.random, big ? 8 : 4);
      if (!burn && hitSoundCd <= 0) { hitSoundCd = 0.06; playHit(); }
      if (big) addShake(shake, 0.06);
      return 0;
    }
    sinkers.push({ e: { ...enemy, burn: null, hitFlash: 0 }, life: 0.5, maxLife: 0.5 });
    if (enemy.isBoss || enemy.warlord) {
      spawnExplosion(particles, enemy.x, enemy.y, 50, Math.random);
      rings.push({ x: enemy.x, y: enemy.y, life: 0.7, maxLife: 0.7, r: 140, color: '255, 214, 92' });
      addShake(shake, 1);
      triggerHitStop(hitStop, 0.15);
      playBossDefeated();
      showToast(enemy.isBoss ? `${getEnemy(enemy.defId).name} is sunk! ⚓` : 'The warlord is sunk! ⚓');
    } else if (enemy.elite) {
      spawnExplosion(particles, enemy.x, enemy.y, 30, Math.random);
      addShake(shake, 0.4); triggerHitStop(hitStop, 0.05);
      showToast('Elite sunk — it dropped a chest! 💰');
      playKill();
    } else {
      if (particles.length < 420) spawnKillBurst(particles, enemy.x, enemy.y, color, Math.random);
      if (killSoundCd <= 0) { killSoundCd = 0.05; playKill(); }
    }
    return 0;
  }

  // Weather events: announce, and the hits on your hull.
  let weatherChipEl = null;
  function handleWeather(wx) {
    const chip = weatherChipEl || (weatherChipEl = document.getElementById('weather-chip'));
    const act = run.weather && run.weather.active;
    if (act && act !== announcedWeather) {
      const d = act.def;
      showToast(`${d.icon} ${d.msg}`, { ms: 2600 });
      playWeatherWarning();
      chip.textContent = `${d.icon} ${d.name}`; chip.hidden = false;
    }
    if (!act && !chip.hidden) chip.hidden = true;
    announcedWeather = act || null;
    let hullHit = 0;
    for (const h of wx.boatHits) {
      hullHit += h.damage;
      spawnDamageNumber(damageNumbers, run.boat.x + 26, run.boat.y - BOAT_RADIUS - 8, h.damage, { incoming: true });
    }
    if (hullHit > 0) { flashHit(); addShake(shake, Math.min(0.6, 0.2 + hullHit / 30)); playWallImpact(Math.min(1, hullHit / 15)); }
    if (wx.salvage) playPickupSalvage();
    if (wx.marks) playStrikeMark();
    for (const st of wx.strikes) {
      bolts.push({ x: st.x, y: st.y, life: 0.25 });
      spawnExplosion(particles, st.x, st.y, 20, Math.random);
      playThunder(); addShake(shake, 0.35);
    }
    for (const im of wx.impacts) {
      spawnSplash(particles, im.x, im.y, Math.random, 14);
      spawnExplosion(particles, im.x, im.y, im.r * 0.7, Math.random);
      playExplosion(); addShake(shake, 0.2);
    }
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
    try { baseBoatStyle = resolveLoadout(meta).hull.id; } catch { baseBoatStyle = 'sloop'; }
    hubHulls.innerHTML = '';
    for (const hull of SHIP_HULL_LIST) {
      const owned = meta.ownedHulls.includes(hull.id);
      const selected = meta.selectedHull === hull.id;
      const disabled = selected || (!owned && !canAfford(meta, hull.cost));
      const label = selected ? 'Selected' : owned ? 'Select' : `Buy ${hull.cost} ⚓`;
      const row = document.createElement('div');
      row.className = 'hub-item';
      row.innerHTML = `
        <canvas class="hull-preview" width="112" height="112" aria-hidden="true"></canvas>
        <div class="hub-item-info">
          <span class="hub-item-name">${hull.name}${selected ? ' ✓' : ''}</span>
          <span class="hub-item-desc">${hull.description}</span>
          <span class="hull-stats">🛡️ ${hull.maxHull} · ⛵ ${Math.round(hull.maxSpeedMult * 100)}% · ↻ ${Math.round(hull.turnRateMult * 100)}%${hull.perk ? ` · <b>${hull.perk}</b>` : ''}</span>
        </div>
        <button type="button" class="hub-item-btn" data-hull-id="${hull.id}"${disabled ? ' disabled' : ''}>${label}</button>
      `;
      drawHullPreview(row.querySelector('canvas'), hull.id);
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

    renderTowerYard(hubOverlay.querySelector('#hub-towers'), meta, () => { saveMeta(window.localStorage, meta); renderHub(); });

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
      towers: towerYardBuyable(meta),
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
  // The voyage card's chart: the actual arena of the selected level, drawn
  // from its coastline field, with its landmarks marked.
  function renderVoyagePreview(stage) {
    const g = voyageMap.getContext('2d');
    const key = `${stage}:${selectedLevel}`;
    let img = previewCache.get(key);
    if (!img) {
      const level = survivalLevel(nextRunSeed, stage, selectedLevel);
      const world = buildSurvivalWorld(level);
      const W = voyageMap.width; const H = voyageMap.height;
      img = g.createImageData(W, H);
      const b = getBiome(level.biomeId);
      const water = b.water.map(([d, c]) => [d, hexRgb(c)]);
      const land = b.land.map(([d, c]) => [d, hexRgb(c)]);
      const pick = (stops, d) => { let c = stops[0][1]; for (const [sd, sc] of stops) if (d >= sd) c = sc; return c; };
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const sm = sampleField(world.coast, ((x + 0.5) / W) * world.widthPx, ((y + 0.5) / H) * world.heightPx);
          const c = sm < 0 ? pick(water, -sm * 0.8) : (sm > 44 ? hexRgb(b.rock) : pick(land, sm * 0.7));
          const o = (y * W + x) * 4;
          img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
        }
      }
      img.marks = world.landmarks.map((l) => ({ x: l.x / world.widthPx, y: l.y / world.heightPx }));
      previewCache.set(key, img);
    }
    g.putImageData(img, 0, 0);
    const W = voyageMap.width; const H = voyageMap.height;
    g.fillStyle = '#e8b54b';
    for (const m of img.marks) { g.beginPath(); g.arc(m.x * W, m.y * H, 4, 0, Math.PI * 2); g.fill(); }
    // You start in the middle; they come from everywhere.
    g.strokeStyle = 'rgba(255, 90, 70, 0.75)'; g.lineWidth = 2; g.setLineDash([4, 5]);
    g.beginPath(); g.arc(W / 2, H / 2, W * 0.2, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(W / 2, H / 2, 6, 0, Math.PI * 2); g.fill();
  }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  // Stage and level picker (2026-10-04): five levels per stage, each opened
  // by clearing the one before; the boss waits on level 5.
  let selectedStage = 1;
  let selectedLevel = 0;
  const pipsEl = hubOverlay.querySelector('#vc-pips');
  function renderStagePicker() {
    selectedStage = Math.min(Math.max(1, selectedStage), meta.highestStageUnlocked);
    if (!isLevelUnlocked(meta, selectedStage, selectedLevel)) selectedLevel = furthestLevel(meta, selectedStage);
    stageLabel.querySelector('strong').textContent = `Stage ${selectedStage}`;
    const cleared = selectedStage < meta.highestStageUnlocked;
    stageLabel.querySelector('span').innerHTML = `<em></em><i></i>`;
    stageLabel.querySelector('em').textContent = `${stageName(selectedStage)}${cleared ? ' ✓' : ''}`;
    stageLabel.querySelector('i').textContent = `☠ ${getEnemy(bossForStage(selectedStage)).name}`;
    stagePrevBtn.disabled = selectedStage <= 1;
    stageNextBtn.disabled = selectedStage >= meta.highestStageUnlocked;
    const done = selectedStage < meta.highestStageUnlocked ? 5 : (meta.levelsCleared[selectedStage] || 0);
    pipsEl.replaceChildren(...Array.from({ length: LEVELS_PER_STAGE }, (_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      const open = isLevelUnlocked(meta, selectedStage, i);
      b.className = `${i === LEVELS_PER_STAGE - 1 ? 'boss' : ''}${i < done ? ' cleared' : ''}${i === selectedLevel ? ' sel' : ''}`;
      b.textContent = i === LEVELS_PER_STAGE - 1 ? '☠' : String(i + 1);
      b.disabled = !open;
      b.setAttribute('aria-label', `Level ${i + 1}${i === 4 ? ' (boss)' : ''}${open ? '' : ' (locked)'}`);
      b.addEventListener('click', () => { selectedLevel = i; renderStagePicker(); renderSailLabel(); });
      return b;
    }));
    renderVoyagePreview(selectedStage);
    renderSailLabel();
  }
  function renderSailLabel() {
    if (peekVoyage(window.localStorage)) return; // "New voyage" while one is saved
    hubSetSailBtn.innerHTML = `▶ Set Sail <small>Level ${selectedLevel + 1}${selectedLevel === 4 ? ' ☠' : ''}</small>`;
  }
  stagePrevBtn.addEventListener('click', () => { selectedStage -= 1; selectedLevel = furthestLevel(meta, selectedStage); renderStagePicker(); });
  stageNextBtn.addEventListener('click', () => { selectedStage += 1; selectedLevel = furthestLevel(meta, selectedStage); renderStagePicker(); });

  function bossName(r = run) {
    const b = r.enemies.find((e) => e.isBoss) || null;
    return b ? getEnemy(b.defId).name : getEnemy(bossForStage(r.stage || 1)).name;
  }
  function stageLevelText(r = run) {
    return `${stageName(r.stage || 1)} – Level ${r.reefIndex + 1}/${r.reefCount}`;
  }
  function levelStartStatus(r = run) {
    return `${stageLevelText(r)} — survive 10 waves`;
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
    const vw = window.innerWidth; const vh = viewH();
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
    b.view = computeBaseView(window.innerWidth, viewH(), baseFreeInsets());
    // Small map: one-line labels so they don't bury the buildings.
    baseChips.classList.toggle('compact', b.view.scale < 0.62);
    baseChips.classList.remove('tiny');
    for (const bd of b.world.buildings) {
      const p = b.view.toScreen(bd.x, bd.y + b.world.layout.labelOffset);
      const chip = chipEls.get(bd.id);
      chip.style.left = `${Math.round(p.x)}px`;
      chip.style.top = `${Math.round(p.y)}px`;
    }
    // Very small harbour (short phones with the Continue button showing):
    // if any two labels overlap, shrink every label to its icon.
    const rects = [...chipEls.values()].map((c) => c.getBoundingClientRect());
    const overlap = rects.some((a, i) => rects.some((r, j) => j > i
      && a.left < r.right - 2 && r.left < a.right - 2 && a.top < r.bottom - 2 && r.top < a.bottom - 2));
    baseChips.classList.toggle('tiny', overlap);
  }
  function drawBase(now, dt) {
    const b = ensureBase();
    if (!b.view) layoutBase();
    const t = now / 1000; const v = b.view;
    ctx.fillStyle = biome.outside;
    ctx.fillRect(0, 0, window.innerWidth, viewH());
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
    drawBoat(ctx, { x: p.x, y: p.y, heading: p.heading, style: baseBoatStyle }, BOAT_RADIUS, t);
    ctx.restore();
    drawBaseBuildings(ctx, b.world.buildings, t, { selectedFaction: meta.selectedFaction });
    drawGulls(ctx, b.world.centre, t);
    ctx.restore();
    b.renderer.prewarm(b.world.centre.x, b.world.centre.y, 3);
  }
  // The voyage chart (ui/worldMap.mjs): swipe left on the harbour, or the
  // chart button on the voyage card, slides it in.
  const worldMap = createWorldMap(root, {
    getMeta: () => meta,
    onSail: (stage) => { selectedStage = stage; selectedLevel = furthestLevel(meta, stage); rollNextRunSeed(); renderStagePicker(); startRun(); },
    onClose: () => {},
    stageName, stageInfo, biomeForStage,
    biomeName: (st) => getBiome(biomeForStage(st)).name,
    bossName: (st) => getEnemy(bossForStage(st)).name,
    drawBoat, boatRadius: BOAT_RADIUS, getBoatStyle: () => baseBoatStyle, levelsPerStage: LEVELS_PER_STAGE,
  });
  hubOverlay.querySelector('#open-chart').addEventListener('click', () => worldMap.open());
  // Reef Defence (2026-09-29): the second game mode. Its chart opens over
  // the harbour; a defence takes over the canvas until you come back.
  const defence = createDefenceMode(root, {
    canvas, ctx,
    getMeta: () => meta,
    persistMeta: () => saveMeta(window.localStorage, meta),
    askConfirm,
    onEnter: () => { sailing = false; hubOverlay.classList.remove('show'); document.body.classList.remove('in-hub'); if (worldMap.isOpen()) worldMap.close(false); },
    onExit: () => openHub(),
    onMuteChange: () => { window.localStorage.setItem(MUTE_STORAGE_KEY, isMuted() ? '1' : '0'); refreshMuteButton(); },
  });
  hubOverlay.querySelector('#vc-defend').addEventListener('click', () => defence.openChart());
  window.__shatteredReefTd = {
    debug: () => defence.debug(), start: (id) => defence.start(id), openChart: () => defence.openChart(),
    setGold: (g) => defence.debugSetGold(g), state: () => defence.debugState(),
  };
  // Swipe left anywhere on the harbour (not in a panel or the voyage card)
  // slides the chart in. Listening on the whole overlay means a swipe that
  // starts on a building label still counts.
  let swipeStart = null; let swiped = false;
  const sceneHit = hubOverlay.querySelector('#base-scene-hit');
  hubOverlay.addEventListener('pointerdown', (e) => {
    swiped = false;
    swipeStart = (!basePanel.hidden || e.target.closest('#voyage-card, #base-panel')) ? null : { x: e.clientX, y: e.clientY };
  }, true);
  window.addEventListener('pointerup', (e) => {
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x; const dy = e.clientY - swipeStart.y;
    swipeStart = null;
    if (dx < -60 && Math.abs(dy) < Math.abs(dx) * 0.8 && hubOverlay.classList.contains('show')) { swiped = true; worldMap.open(); }
  });
  // Tapping a building itself (not just its label) opens its panel.
  sceneHit.addEventListener('click', (e) => {
    if (swiped) { swiped = false; return; }
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
    // An old maze voyage left saved from before survival mode: it can't be
    // continued, so pay out its banked Salvage and clear it.
    const legacy = retireLegacyVoyage(window.localStorage);
    if (legacy) {
      meta.salvage += legacy.salvage;
      saveMeta(window.localStorage, meta);
      setTimeout(() => showToast(`The reefs have changed! Your old voyage is retired${legacy.salvage ? ` — +${legacy.salvage} Salvage banked` : ''} ⚓`, { ms: 3600 }), 400);
    }
    sailing = false;
    voyageActive = false;
    closePanel();
    selectedStage = meta.highestStageUnlocked;
    selectedLevel = furthestLevel(meta, selectedStage);
    rollNextRunSeed();
    renderHub();
    renderContinue();
    paused = false; pauseMenu.hidden = true; countdownEl.hidden = true;
    upgradeOverlay.hidden = true;
    hubOverlay.classList.add('show');
    document.body.classList.add('in-hub');
    document.body.classList.remove('in-run');
    playMusic('harbour');
    layoutBase();
  }

  // Everything a fresh level (or a restored one) needs on screen.
  function enterLevelView() {
    camera.x = run.boat.x; camera.y = run.boat.y;
    particles = createParticlePool();
    damageNumbers = createDamageNumberPool();
    sinkers.length = 0; rings.length = 0; wake.length = 0;
    shake.trauma = 0; hitStop.remaining = 0;
    dockKey = ''; announcedWeather = null;
    hubOverlay.classList.remove('show');
    document.body.classList.remove('in-hub');
    document.body.classList.add('in-run');
    if (worldMap.isOpen()) worldMap.close(false);
    toast.classList.remove('show');
    upgradeOverlay.hidden = true;
    summaryOverlay.classList.remove('show');
    setStatus(levelStartStatus());
    updateReefIndicator(); renderDock(); renderUpgradeStrip(); updateSurvivalHud();
    paused = false; resumeIn = 0; pauseMenu.hidden = true;
    voyageActive = true;
  }
  function startRun(stage = selectedStage, levelIndex = selectedLevel, seed = nextRunSeed) {
    run = createSurvivalRun(seed, resolveLoadout(meta), { stage, levelIndex });
    pendingChoice = null;
    enterLevelView();
    saveCurrentVoyage();
    sailing = true;
    startCountdown();
    if (run.faction) showMatchupBriefing(run.faction);
    else showToast(`${stageLevelText()} — survive 10 waves! ⚔`, { ms: 2400 });
  }
  // Setting sail with a level still saved: that one is abandoned (half its
  // Salvage is kept, as if you'd sunk), after asking.
  hubSetSailBtn.addEventListener('click', async () => {
    const saved = peekVoyage(window.localStorage);
    if (saved) {
      if (!await askConfirm(`Abandon your level in progress (Stage ${saved.stage || 1} – Level ${saved.reefIndex + 1})? You keep half its Salvage.`, 'Abandon & set sail')) return;
      abandonSavedVoyage();
    }
    startRun();
  });
  function abandonSavedVoyage() {
    const got = loadVoyage(window.localStorage);
    if (got && !got.run.over) { sinkLevel(got.run); recordLevelResult(meta, got.run); saveMeta(window.localStorage, meta); }
    clearVoyage(window.localStorage);
  }
  // Continue a saved level exactly where it was left.
  function continueVoyage() {
    const got = loadVoyage(window.localStorage);
    if (!got) { clearVoyage(window.localStorage); renderContinue(); return; }
    if (!got.run.sv) { clearVoyage(window.localStorage); renderContinue(); return; }
    run = got.run;
    pendingChoice = null;
    enterLevelView();
    if (run.over) { sailing = false; showRunSummary(); return; }
    sailing = true;
    if (got.pendingChoice && got.pendingChoice.choices?.length) {
      offerChoices(got.pendingChoice.title, got.pendingChoice.sub, got.pendingChoice.choices);
    } else {
      startCountdown();
    }
    showToast(`Welcome back — ${stageLevelText()}`);
  }
  function renderContinue() {
    const saved = peekVoyage(window.localStorage);
    continueBtn.hidden = !saved;
    hubSetSailBtn.classList.toggle('secondary', !!saved);
    if (saved) {
      hubSetSailBtn.textContent = 'New voyage';
      continueBtn.querySelector('small').textContent = `Stage ${saved.stage || 1} · Level ${saved.reefIndex + 1}/${saved.reefCount || 5}${saved.over ? ' · sunk' : ''}`;
    } else renderSailLabel();
  }
  continueBtn.addEventListener('click', continueVoyage);

  function pauseGame() {
    if (!sailing || run.over || paused || !upgradeOverlay.hidden) return;
    paused = true; resumeIn = 0; countdownEl.hidden = true;
    joystick.reset?.();
    pauseMenu.querySelector('#pm-where').textContent = stageLevelText();
    const kit = pauseMenu.querySelector('#pm-kit');
    const sv = run.sv;
    const items = [
      ...Object.entries(sv.weapons).map(([id, n]) => (sv.evolved[id] ? `${SV_WEAPONS[id].evolve.icon} ${SV_WEAPONS[id].evolve.name}` : `${SV_WEAPONS[id].icon} ${SV_WEAPONS[id].name} Lv ${n}`)),
      ...Object.entries(run.armaments || {}).map(([id, n]) => `${ARMAMENT_BY_ID[id].icon} ${ARMAMENT_BY_ID[id].name} Lv ${n}`),
      ...Object.entries(sv.passives).map(([id, n]) => `${PASSIVE_BY_ID[id].icon} ${PASSIVE_BY_ID[id].name} Lv ${n}`),
    ];
    kit.replaceChildren(...items.map((t) => { const s = document.createElement('span'); s.textContent = t; return s; }));
    kit.hidden = !items.length;
    refreshPauseSound();
    pauseMenu.hidden = false;
    saveCurrentVoyage();
  }
  function refreshPauseSound() {
    pauseMenu.querySelector('#pm-sound').textContent = isMuted() ? '🔇 Sound: off' : '🔊 Sound: on';
  }
  function startCountdown() {
    resumeIn = 1.5;
    countdownEl.hidden = false;
  }
  function resumeGame() {
    if (!paused) return;
    paused = false;
    pauseMenu.hidden = true;
    startCountdown();
  }
  pauseButton.addEventListener('click', (e) => { e.stopPropagation(); pauseGame(); });
  pauseMenu.querySelector('#pm-resume').addEventListener('click', resumeGame);
  pauseMenu.querySelector('#pm-sound').addEventListener('click', () => {
    setMuted(!isMuted());
    window.localStorage.setItem(MUTE_STORAGE_KEY, isMuted() ? '1' : '0');
    refreshMuteButton(); refreshPauseSound();
  });
  pauseMenu.querySelector('#pm-harbour').addEventListener('click', () => {
    saveCurrentVoyage();
    voyageActive = false; paused = false; pauseMenu.hidden = true;
    openHub();
    showToast('Voyage saved — Continue it from the harbour ⚓');
  });
  pauseMenu.querySelector('#pm-abandon').addEventListener('click', async () => {
    if (!await askConfirm('Abandon this level? You keep half the Salvage you\'ve collected in it.', 'Abandon level')) return;
    sinkLevel(run); recordLevelResult(meta, run); saveMeta(window.localStorage, meta);
    clearVoyage(window.localStorage);
    voyageActive = false; paused = false; pauseMenu.hidden = true;
    openHub();
  });
  // Leaving the app (home button, a call, switching apps) pauses and saves.
  const onHide = () => { if (document.visibilityState === 'hidden') { if (sailing && !run.over && upgradeOverlay.hidden) pauseGame(); saveCurrentVoyage(); } };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', () => { if (sailing && !run.over && upgradeOverlay.hidden) pauseGame(); saveCurrentVoyage(); });
  // Testing only (never reachable from the UI): sail straight into any
  // stage's level, skipping the unlock and the earlier levels.
  window.__shatteredReefSailStage = (stage, level = 0) => {
    selectedStage = stage; selectedLevel = level;
    startRun(stage, level);
    resumeIn = 0; countdownEl.hidden = true;
    return { stage: run.stage, level: run.reefIndex, biome: run.level.biomeId };
  };

  // A level ends two ways: the last wave's warlord or boss sinks (cleared),
  // or you do. Either way the haul is banked now (all of it on a win, half
  // on a sinking) and the summary says what happened.
  let lastResult = null;
  function showRunSummary() {
    playMusic(null);
    const victory = run.outcome === 'victory';
    const sv = run.sv;
    const nextOpen = victory && run.reefIndex < LEVELS_PER_STAGE - 1;
    summaryTitle.textContent = victory
      ? (run.reefIndex === LEVELS_PER_STAGE - 1 ? `${stageName(run.stage)} conquered! ⚓` : `Level ${run.reefIndex + 1} cleared! ⚓`)
      : `Sunk on wave ${sv.wave + 1} of ${SURVIVAL.waves}`;
    summaryRetryBtn.hidden = false;
    summaryRetryBtn.textContent = victory ? (nextOpen ? `▶ Next: Level ${run.reefIndex + 2}${run.reefIndex + 1 === LEVELS_PER_STAGE - 1 ? ' ☠' : ''}` : `▶ Stage ${run.stage + 1}`) : '↻ Try again';
    summaryBtn.textContent = 'Return to Harbour ⚓';
    summaryBtn.classList.toggle('secondary', true);
    const mm = Math.floor(sv.time / 60); const ss = String(Math.floor(sv.time % 60)).padStart(2, '0');
    const kit = [
      ...Object.entries(sv.weapons).map(([id, lv]) => (sv.evolved[id] ? `${SV_WEAPONS[id].evolve.icon} ${SV_WEAPONS[id].evolve.name}` : `${SV_WEAPONS[id].icon} ${SV_WEAPONS[id].name} ${lv}`)),
      ...Object.entries(run.armaments || {}).map(([id, lv]) => `${ARMAMENT_BY_ID[id].icon} ${ARMAMENT_BY_ID[id].name} ${lv}`),
    ];
    summaryBody.innerHTML = `
      <div class="sum-stats">
        <span><b>${sv.kills.toLocaleString('en-GB')}</b><small>sunk</small></span>
        <span><b>Lv ${sv.shipLevel}</b><small>ship</small></span>
        <span><b>${mm}:${ss}</b><small>time</small></span>
        <span><b>${Math.round(run.bankedSalvage)}</b><small>Salvage ⚓</small></span>
      </div>
      ${victory ? `<p>Level bonus: +${run.levelBonus || 0} Salvage</p>` : `<p class="lost">Half your haul went down with the ship (−${Math.round(run.lostSalvage || 0)})</p>`}
      ${lastResult?.unlockedStage ? `<p><strong>New island on your chart: ${stageName(meta.highestStageUnlocked)}!</strong></p>` : ''}
      ${lastResult?.unlockedLevel ? `<p><strong>Level ${run.reefIndex + 2} unlocked</strong></p>` : ''}
      ${run.bossDefeated ? `<p>${bossName(run)} sunk — 1 Kraken Scale earned 🦑</p>` : ''}
      <p class="sum-kit"></p>
      <p>Salvage in the Harbour: ${meta.salvage} ⚓${meta.krakenScales > 0 ? ` · Kraken Scales: ${meta.krakenScales} 🦑` : ''}</p>
    `;
    summaryBody.querySelector('.sum-kit').textContent = kit.join(' · ');
    summaryOverlay.classList.add('show');
  }
  function endRun() {
    if (run.outcome === 'victory') playVictory(); else playSunk();
    lastResult = recordLevelResult(meta, run);
    saveMeta(window.localStorage, meta);
    clearVoyage(window.localStorage); voyageActive = false;
    showRunSummary();
  }
  summaryBtn.addEventListener('click', () => {
    clearVoyage(window.localStorage); voyageActive = false;
    summaryOverlay.classList.remove('show');
    openHub();
  });
  summaryRetryBtn.addEventListener('click', () => {
    summaryOverlay.classList.remove('show');
    rollNextRunSeed();
    if (run.outcome === 'victory') {
      if (run.reefIndex < LEVELS_PER_STAGE - 1) startRun(run.stage, run.reefIndex + 1);
      else startRun(run.stage + 1, 0);
    } else startRun(run.stage, run.reefIndex);
  });

  // A tiny debug hook for headless/automated testing — not user-facing,
  // costs nothing at runtime, and saves having to poke at internals.
  window.__shatteredReefDebug = () => ({
    boatX: run.boat.x, boatY: run.boat.y, heading: run.boat.heading,
    hull: run.boat.health, maxHull: run.boat.maxHull, chill: run.boat.chillRemaining || 0, afflictions: { ...(run.boat.afflictions || {}) },
    biome: run.level?.biomeId, cameraX: camera.x, cameraY: camera.y,
    over: run.over, outcome: run.outcome, sailing, paused, hubOpen: hubOverlay.classList.contains('show'),
    stage: run.stage, reefIndex: run.reefIndex, reefCount: run.reefCount, levelCode: run.levelCode,
    highestStageUnlocked: meta.highestStageUnlocked, levelsCleared: { ...meta.levelsCleared },
    mapW: run.widthPx, mapH: run.heightPx,
    bankedSalvage: run.bankedSalvage, reefSalvage: run.reefSalvage, salvage: run.reefSalvage,
    sv: run.sv && {
      wave: run.sv.wave, waveTime: run.sv.waveTime, time: run.sv.time, xp: run.sv.xp, xpNeed: run.sv.xpNeed, shipLevel: run.sv.shipLevel,
      pendingLevelUps: run.sv.pendingLevelUps, pendingChests: run.sv.pendingChests, kills: run.sv.kills, weapons: { ...run.sv.weapons },
      evolved: { ...run.sv.evolved }, passives: { ...run.sv.passives }, pools: run.sv.pools.length, bossId: run.sv.bossId, finished: run.sv.finished,
    },
    enemyCount: run.enemies.filter((e) => e.health > 0).length,
    projectileCount: run.weapons.projectiles.length,
    enemies: run.enemies.filter((e) => e.health > 0).map((e) => ({
      id: e.id, defId: e.defId, x: e.x, y: e.y, health: e.health, maxHealth: e.maxHealth, isBoss: e.isBoss, elite: !!e.elite, warlord: !!e.warlord, invulnerable: e.invulnerable,
    })),
    weather: run.weather && run.weather.active ? { id: run.weather.active.id } : null,
    armaments: { ...(run.armaments || {}) },
    choice: upgradeOverlay.hidden ? null : { title: upgradeOverlay.querySelector('#up-title').textContent, cards: [...upgradeOverlay.querySelectorAll('.up-card')].map((c) => c.dataset.card) },
    enemyShots: run.enemyProjectiles.length,
    pickupsRemaining: run.pickups.filter((p) => !p.collected).length,
    pickups: run.pickups.filter((p) => !p.collected).map((p) => ({ kind: p.kind, x: p.x, y: p.y, value: p.value })),
    meta: {
      salvage: meta.salvage, ownedHulls: meta.ownedHulls, selectedHull: meta.selectedHull,
      ownedCargoTiers: meta.ownedCargoTiers, ownedCharms: meta.ownedCharms, stats: meta.stats,
      ownedFactions: meta.ownedFactions, selectedFaction: meta.selectedFaction,
      krakenScales: meta.krakenScales, ownedWorkshopUpgrades: meta.ownedWorkshopUpgrades,
    },
    hudInsets: { ...hudInsets },
    boatScreen: lastView && { x: run.boat.x + lastView.translateX, y: run.boat.y + lastView.translateY },
    faction: run.faction, bossDefeated: run.bossDefeated,
    particleCount: particles.length, damageNumberCount: damageNumbers.length,
    shakeTrauma: shake.trauma, hitStopRemaining: hitStop.remaining, muted: isMuted(), audio: audioLevel(), music: currentMusic(),
    frameMs: perf.avg, frameMax: perf.max,
  });
  // Testing-only (never reachable from the UI): jump the level clock to a
  // wave, grant XP, or queue a chest — so a playtest can reach the boss.
  window.__shatteredReefSv = {
    toWave: (n) => { run.sv.wave = Math.max(0, n - 1); run.sv.waveTime = 0; return run.sv.wave; },
    addXp: (n) => { addXp(run, n); maybeOfferChoice(); return run.sv.shipLevel; },
    chest: () => { run.sv.pendingChests += 1; maybeOfferChoice(); },
    pick: (i = 0) => { const b = upgradeOverlay.querySelectorAll('.up-card')[i]; if (b) b.click(); return !!b; },
    give: (kind, id, times = 1) => { for (let k = 0; k < times; k++) applyChoice(run, { kind, id }); renderDock(); renderUpgradeStrip(); return { ...run.sv.weapons }; },
  };
  // Testing-only: teleports the boat, since a headless test driving the
  // touch joystick can't reliably pathfind a maze it has no map of. Not
  // reachable from any in-game UI.
  // Testing-only: start a weather event now (e.g. 'thunderstorm').
  window.__shatteredReefWeather = (id) => startWeather(run, id);
  window.__shatteredReefGrantArmament = (id) => { const lv = grantArmament(run, id); renderUpgradeStrip(); return lv; };
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
    e.hunting = true;
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

  // Darkness (engine/ambient.mjs, lightArt.mjs): in the caverns and the
  // abyss (or blinded by ink) the world beyond your lantern goes dark.
  // Everything that glows cuts its own hole; attacks are redrawn over the
  // dark so they're always readable; eyes glint just past the light.
  function drawLighting(visible, t) {
    const amb = ambientLight(run, runBiome);
    const enemyGlows = [];
    for (const e of run.enemies) {
      if (e.health <= 0 || enemyGlows.length >= 28) continue;
      if (e.x < visible.left - 30 || e.x > visible.right + 30 || e.y < visible.top - 30 || e.y > visible.bottom + 30) continue;
      const g = getEnemy(e.defId).glow;
      if (g && !e.invulnerable) enemyGlows.push({ x: e.x, y: e.y, r: g * 1.6, rgb: e._rgb || (e._rgb = hexRgb(e.colorHex || enemyColor(e))), phase: e.id });
    }
    if (amb.dark && amb.light != null) {
      const lights = [{ x: run.boat.x, y: run.boat.y, r: amb.light * 1.15 }];
      if (!run.over || run.outcome !== 'sunk') lights.push({ x: run.boat.x, y: run.boat.y, r: amb.light * 0.55 });
      for (const p of run.pickups) if (!p.collected && (p.kind === 'chest' || p.kind === 'gem' && p.value >= 5)) lights.push({ x: p.x, y: p.y, r: p.kind === 'chest' ? 60 : 24, k: 0.7 });
      for (const gl of terrainGlows) lights.push({ x: gl.x, y: gl.y, r: gl.r * 1.4, k: 0.7 });
      for (const gl of enemyGlows) lights.push({ x: gl.x, y: gl.y, r: gl.r, k: 0.85 });
      for (const s of run.enemyProjectiles) lights.push({ x: s.x, y: s.y, r: 26, k: 0.6 });
      for (let k = 0; k < Math.min(30, run.weapons.projectiles.length); k++) { const p = run.weapons.projectiles[k]; lights.push({ x: p.x, y: p.y, r: 22, k: 0.5 }); }
      if (run.sv) for (const pl of run.sv.pools) lights.push({ x: pl.x, y: pl.y, r: pl.r * 1.6, k: 0.8 });
      for (const b of bolts) lights.push({ x: b.x, y: b.y, r: 140, k: 1 });
      if (run.weather?.active) {
        for (const st of run.weather.strikes) lights.push({ x: st.x, y: st.y, r: st.r * 1.6, k: 0.7 });
        for (const l of run.weather.lights) if (!l.taken) lights.push({ x: l.x, y: l.y, r: 60, k: 0.9 });
      }
      if (particles.length > 40) lights.push({ x: run.boat.x, y: run.boat.y, r: amb.light * 1.3, k: 0.25 });
      drawDarkness(ctx, visible, amb, lights, t);
      drawGlows(ctx, terrainGlows, visible, t);
      drawGlows(ctx, enemyGlows, visible, t);
      drawEyes(ctx, run.enemies, run.boat, amb.light, (e) => getEnemy(e.defId).eyes || '#ffcf4a', t);
      drawEnemyTelegraphs(ctx, run.enemies, t);
    } else {
      if (terrainGlows.length) drawGlows(ctx, terrainGlows, visible, t, 0.6);
      if (enemyGlows.length) drawGlows(ctx, enemyGlows, visible, t, 0.5);
    }
  }
  function hexRgb(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16) || 0xffffff;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  let lastTime = performance.now();
  // Frame timing (2026-10-04 graphics pass): the simulation runs on a
  // smoothed dt, so uneven rAF spacing on phones doesn't show as stutter
  // in the camera; real hitches still pass straight through.
  let smoothDt = 1 / 60;
  const perf = { avg: 16, max: 0, n: 0 };
  const statusToastShown = new Set();
  let dotAccum = 0; let dotTimer = 0;
  const STATUS_TOASTS = [
    ['chill', '❄️ Frozen rudder — you turn and sail slower for a moment'],
    ['burn', '🔥 On fire — your hull burns for a few seconds'],
    ['poison', '☠️ Poisoned — slow damage for a while'],
    ['shock', '⚡ Shocked — your sails stall for a moment'],
    ['ink', '🦑 Ink! You can barely see for a few seconds'],
  ];
  const fireSoundCd = {};
  let explosionSoundCd = 0; let coinSoundCd = 0; let hullFlash = 0;
  const lookAhead = { x: 0, y: 0 };
  // Enemies appear just beyond the screen's corners.
  function spawnDistance() {
    return Math.hypot(window.innerWidth, viewH()) / 2 + SURVIVAL.spawnMargin;
  }

  // Everything one simulated frame did, turned into sound, light and HUD.
  function feedback(ev, now) {
    const b = run.boat;
    if (ev.wallDamage > 0) {
      flashHit(); hullFlash = 0.4;
      const intensity = Math.min(1, ev.wallDamage / 15);
      addShake(shake, 0.25 + intensity * 0.5);
      spawnSplash(particles, b.x, b.y, Math.random, 8);
      playWallImpact(intensity);
    }
    if (ev.dot > 0) {
      dotAccum += ev.dot; dotTimer -= 1 / 60;
      if (dotTimer <= 0) { dotTimer = 0.5; spawnDamageNumber(damageNumbers, b.x - 18, b.y - BOAT_RADIUS - 6, dotAccum, { incoming: true }); dotAccum = 0; }
    }
    for (const [kind, msg] of STATUS_TOASTS) {
      if (!statusToastShown.has(kind) && hasAffliction(b, kind)) { statusToastShown.add(kind); showToast(msg); }
    }
    handleWeather(ev.weather);
    // Your guns.
    for (const f of ev.fired) {
      if ((fireSoundCd[f.id] || 0) <= now) { fireSoundCd[f.id] = now + 90; playFire(f.id === 'flame_barrels' ? 'flame_barrels' : f.id); }
      spawnMuzzleFlash(particles, b.x + Math.cos(f.heading) * BOAT_RADIUS, b.y + Math.sin(f.heading) * BOAT_RADIUS, f.heading, getWeapon(f.id).color, Math.random);
    }
    for (const id of ev.armFired) {
      if ((fireSoundCd[id] || 0) <= now) { fireSoundCd[id] = now + 120; playFire(id); }
      if (id === 'arm_broadside') addShake(shake, 0.08);
    }
    for (const x of ev.explosions) {
      if (x.delayed) continue;
      const fire = x.weaponId === 'flame_barrels';
      if (particles.length < 460) spawnExplosion(particles, x.x, x.y, fire ? 16 : x.r * 0.7, Math.random);
      rings.push({ x: x.x, y: x.y, life: 0.35, maxLife: 0.35, r: x.r * 1.1, color: fire ? '255, 150, 60' : '210, 245, 255' });
      if (explosionSoundCd <= 0) { explosionSoundCd = 0.08; playExplosion(); }
      addShake(shake, x.fireShip ? 0.5 : 0.08);
    }
    for (const h of ev.hits) processHitEvent(h, { burn: !!h.burn, ram: !!h.ram });
    for (const a of ev.arcs) lightning.push({ ...a, life: 0.22, maxLife: 0.22, jag: Array.from({ length: 9 }, Math.random) });
    if (ev.arcs.length) playZap();
    // Their guns, their teeth.
    for (const sp of ev.shots.splashes) {
      if (sp.lob) { spawnExplosion(particles, sp.tx, sp.ty, sp.blast, Math.random); spawnSplash(particles, sp.tx, sp.ty, Math.random, 10); playExplosion(); addShake(shake, 0.15); }
      else if (particles.length < 460) spawnSplash(particles, sp.x, sp.y, Math.random, 4);
    }
    let hurt = 0;
    for (const h of ev.shots.hits) {
      hurt += h.damage;
      const m = incomingTriangleMultiplier(h.shot.faction, run.faction);
      spawnDamageNumber(damageNumbers, b.x + 24, b.y - BOAT_RADIUS - 8, h.damage, { incoming: true, triangle: m > 1 ? 'danger' : m < 1 ? 'resist' : null });
      spawnHitSpark(particles, h.shot.x, h.shot.y, '#ffb347', Math.random);
    }
    for (const c of ev.contacts) {
      hurt += c.damage;
      if (c.enemy.detonated) {
        spawnExplosion(particles, c.enemy.x, c.enemy.y, 40, Math.random);
        playExplosion(); addShake(shake, 0.6);
        showToast('A fire ship rammed you! Sink them at range 🔥');
      }
      const m = incomingTriangleMultiplier(c.enemy.faction, run.faction);
      spawnDamageNumber(damageNumbers, b.x - 30, b.y - BOAT_RADIUS - 8, c.damage, { incoming: true, triangle: m > 1 ? 'danger' : m < 1 ? 'resist' : null });
    }
    if (hurt > 0) { flashHit(); hullFlash = 0.5; addShake(shake, Math.min(0.5, 0.15 + hurt / 40)); playWallImpact(Math.min(1, hurt / 12)); }
    // The director's set pieces.
    const d = ev.director;
    if (d.waveStarted != null) {
      renderWavePips();
      if (d.waveStarted > 0) {
        const last = d.waveStarted === SURVIVAL.waves - 1;
        showToast(last ? (run.sv.bossDefId ? `☠ Final wave — ${getEnemy(run.sv.bossDefId).name} is coming!` : '⚔ Final wave — the warlord is coming!') : `Wave ${d.waveStarted + 1} / ${SURVIVAL.waves}`, { ms: 1800 });
        playReefCleared();
      }
    }
    if (d.encircle && !d.boss) { showToast('⚠️ Surrounded! Break out!', { ms: 1600 }); playWeatherWarning(); }
    if (d.elites.length) { showToast(`⭐ ${d.elites.length > 1 ? 'Elites approach' : 'An elite approaches'} — sink it for a chest!`, { ms: 2200 }); playBossPhaseChange(); }
    if (d.boss) {
      addShake(shake, 0.6); playBossPhaseChange();
      if (d.boss.isBoss) d.boss._lastAnnouncedPhase = d.boss.phaseIndex;
    }
    if (ev.summoned) playBossPhaseChange();
    // Loot.
    const pk = ev.pickups;
    if (pk.xp) updateSurvivalHud();
    if (pk.salvage && coinSoundCd <= 0) { coinSoundCd = 0.07; playPickupSalvage(); }
    if (pk.repaired > 0) { spawnDamageNumber(damageNumbers, b.x, b.y - BOAT_RADIUS - 10, pk.repaired, { heal: true }); playRevive(); }
    if (pk.magnet) { showToast('🧲 Lodestone! Every gem comes to you'); playPickupWeapon(); rings.push({ x: b.x, y: b.y, life: 0.8, maxLife: 0.8, r: 260, color: '160, 220, 255' }); }
    if (pk.chests) { run.sv.pendingChests += pk.chests; spawnExplosion(particles, b.x, b.y, 18, Math.random); }
    if (ev.levelUps) rings.push({ x: b.x, y: b.y, life: 0.5, maxLife: 0.5, r: 70, color: '150, 230, 255' });
    // Boss phase changes and enrage.
    for (const e of run.enemies) {
      if (!e.isBoss || e.health <= 0) continue;
      if (e._lastAnnouncedPhase === undefined) e._lastAnnouncedPhase = e.phaseIndex;
      else if (e.phaseIndex !== e._lastAnnouncedPhase) {
        e._lastAnnouncedPhase = e.phaseIndex;
        showToast(`${getEnemy(e.defId).name} changes tactics — ${getWeapon(e.counter).name} hurts it most ⚓`);
        playBossPhaseChange(); addShake(shake, 0.3);
      }
      if (e.enraged && !e._enrageAnnounced) {
        e._enrageAnnounced = true;
        showToast(`${getEnemy(e.defId).name} is enraged! 🔥`);
        playBossPhaseChange(); addShake(shake, 0.5);
      }
    }
  }

  function frame(now) {
    const realDt = Math.min(0.05, (now - lastTime) / 1000); // clamp so a tab-switch stall can't fling the boat
    lastTime = now;
    smoothDt += (realDt - smoothDt) * 0.3;
    const rawDt = Math.abs(realDt - smoothDt) > 0.012 ? realDt : smoothDt;
    perf.avg += (realDt * 1000 - perf.avg) * 0.05; perf.max = Math.max(perf.max * 0.995, realDt * 1000);
    // Reef Defence (td/tdMode.mjs) owns the canvas while it's running.
    if (defence.active) { defence.frame(now, rawDt); requestAnimationFrame(frame); return; }
    if (resumeIn > 0 && !paused) {
      resumeIn -= rawDt;
      countdownEl.textContent = resumeIn > 1 ? '3' : resumeIn > 0.5 ? '2' : '1';
      if (resumeIn <= 0) countdownEl.hidden = true;
    }
    const live = sailing && !run.over && !paused && resumeIn <= 0 && upgradeOverlay.hidden;
    const showPause = sailing && !run.over;
    if (pauseButton.hidden === showPause) pauseButton.hidden = !showPause;
    const dt = live ? applyHitStop(hitStop, rawDt) : rawDt;
    killSoundCd -= rawDt; hitSoundCd -= rawDt; explosionSoundCd -= rawDt; coinSoundCd -= rawDt; hullFlash = Math.max(0, hullFlash - rawDt * 2);

    if (live && dt > 0 && run.sv) {
      autosaveTimer += rawDt;
      if (autosaveTimer > 6) { autosaveTimer = 0; saveCurrentVoyage(); }
      const ev = stepSurvivalFrame(run, dt, joystick.getVector(), { spawnDist: spawnDistance(), biome: runBiome, rng: Math.random, t: now / 1000 });
      feedback(ev, now);
      playMusic(musicFor(run.level?.biomeId, run.sv.wave >= SURVIVAL.waves - 1 && !!run.sv.bossDefId));
      updateSurvivalHud(); renderDock(); renderUpgradeStrip();
      const sunkResult = checkSunk(run);
      if (sunkResult === true) {
        sailing = false;
        sinkLevel(run);
        spawnExplosion(particles, run.boat.x, run.boat.y, 30, Math.random);
        rings.push({ x: run.boat.x, y: run.boat.y, life: 0.8, maxLife: 0.8, r: 120, color: '255, 120, 80' });
        addShake(shake, 0.8);
        setTimeout(endRun, 900);
      } else if (sunkResult === 'revived') {
        flashHit(); addShake(shake, 0.4); playRevive();
        showToast('Last Gasp! Patched through at 1 hull ⚓');
      } else if (run.sv.finished) {
        sailing = false;
        completeLevel(run);
        // Everything still afloat goes down with its warlord.
        for (const e of run.enemies) if (e.health > 0) { e.health = 0; sinkers.push({ e: { ...e }, life: 0.6, maxLife: 0.6 }); if (particles.length < 500) spawnKillBurst(particles, e.x, e.y, '#f4ead0', Math.random); }
        playReefCleared();
        setTimeout(endRun, 1400);
      } else if (run.sv.pendingLevelUps > 0 || run.sv.pendingChests > 0) {
        maybeOfferChoice();
      }
    }
    for (const e of run.enemies) if (e.hitFlash > 0) e.hitFlash -= rawDt;

    if (hubOverlay.classList.contains('show')) {
      // The base harbour replaces the reef view entirely while the Hub is up.
      drawBase(now, rawDt);
      requestAnimationFrame(frame);
      return;
    }
    drawWorld(now, rawDt);
    requestAnimationFrame(frame);
  }

  function drawWorld(now, rawDt) {
    const t = now / 1000;
    // Look ahead: the camera leads the ship a little, so you see more of
    // where you're going (and what's coming) than where you've been.
    const sp = Math.hypot(run.boat.vx, run.boat.vy);
    const lead = Math.min(1, sp / 120) * 70;
    const la = 1 - Math.exp(-3 * rawDt);
    lookAhead.x += ((sp > 1 ? (run.boat.vx / sp) * lead : 0) - lookAhead.x) * la;
    lookAhead.y += ((sp > 1 ? (run.boat.vy / sp) * lead : 0) - lookAhead.y) * la;
    updateCamera(camera, run.boat.x + lookAhead.x, run.boat.y + lookAhead.y, rawDt, 6);
    // Wake: foam puffs off the stern while under way.
    for (const w of wake) w.life -= rawDt;
    while (wake.length && wake[0].life <= 0) wake.shift();
    wakeTimer -= rawDt;
    if (sp > 25 && !run.over && wakeTimer <= 0) {
      wakeTimer = 0.04;
      const life = 0.6 + Math.min(1, sp / 120) * 0.6;
      wake.push({ x: run.boat.x - Math.cos(run.boat.heading) * BOAT_RADIUS * 1.2, y: run.boat.y - Math.sin(run.boat.heading) * BOAT_RADIUS * 1.2, heading: run.boat.heading, life, maxLife: life });
    }
    particles = updateParticles(particles, rawDt);
    for (const b of bolts) b.life -= rawDt;
    bolts = bolts.filter((b) => b.life > 0);
    for (const a of lightning) a.life -= rawDt;
    lightning = lightning.filter((a) => a.life > 0);
    for (const s of sinkers) s.life -= rawDt;
    for (let i = sinkers.length - 1; i >= 0; i--) if (sinkers[i].life <= 0) sinkers.splice(i, 1);
    for (const r of rings) r.life -= rawDt;
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].life <= 0) rings.splice(i, 1);
    damageNumbers = updateDamageNumbers(damageNumbers, rawDt);
    const shakeOffset = updateShake(shake, rawDt);

    const vw = window.innerWidth;
    const vh = viewH();
    ctx.fillStyle = runBiome.outside;
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    const view = applyCameraTransform(ctx, camera, vw, vh, run.widthPx, run.heightPx, shakeOffset, hudInsets);
    lastView = view;
    ensureTerrain();
    terrainRenderer.draw(ctx, view.visible, t, { forceVisible: terrainFresh, maxNewChunks: 0 });
    terrainFresh = false;
    drawLandmarks(ctx, run.landmarks || [], view.visible, t);
    drawWeatherWorld(ctx, run.weather, t);
    drawWake(ctx, wake);
    if (run.sv) drawFirePools(ctx, run.sv.pools, view.visible, t);
    drawSurvivalPickups(ctx, run.pickups, view.visible, t);
    drawSinkers(ctx, sinkers, t, (e) => e.colorHex || enemyColor(e));
    drawEnemies(
      ctx, visibleOnly(run.enemies, view.visible), (e) => e.colorHex || enemyColor(e), t,
      (e) => (e.isBoss ? getEnemy(e.defId).name : e.warlord ? `Warlord ${getEnemy(e.defId).name}` : null),
      (e) => relationTo(run.faction, e.faction),
      run.boat,
    );
    for (const e of run.enemies) if (e.isBoss && e.enraged && e.health > 0) drawEnrage(ctx, e, t);
    drawLighting(view.visible, t);
    drawEnemyProjectiles(ctx, run.enemyProjectiles, t);
    drawProjectiles(ctx, run.weapons.projectiles, (p) => getWeapon(p.weaponId).color, t);
    if (run.outcome !== 'sunk') {
      if (run.sv) drawOrbitBlades(ctx, orbitBlades(run), t);
      drawBoat(ctx, run.boat, BOAT_RADIUS, t);
      drawBoatStatus(ctx, run.boat, BOAT_RADIUS, t);
      drawSpirits(ctx, spiritPositions(run), run.spiritAngle || 0, t);
      drawHullBar(ctx, run.boat, BOAT_RADIUS, hullFlash);
    }
    drawLightning(ctx, lightning);
    drawWeatherAbove(ctx, run.weather, t);
    for (const b of bolts) drawBolt(ctx, b.x, b.y, b.life / 0.25);
    drawParticles(ctx, particles);
    drawRings(ctx, rings);
    drawDamageNumbers(ctx, damageNumbers);
    ctx.restore();
    // Rain, snow, fog, darkness: over the world, under the HUD.
    drawAmbientScreen(ctx, runBiome, t, vw, vh);
    if (sailing || run.over) drawWeatherScreen(ctx, run.weather, weatherModifiers(run.weather), t, vw, vh, { x: run.boat.x + view.translateX, y: run.boat.y + view.translateY });
    drawVignette(ctx, vw, vh, run.boat.health / run.boat.maxHull, t);
    // What's worth knowing about off-screen: the boss, elites, treasure.
    const marks = [];
    for (const e of run.enemies) {
      if (e.health <= 0) continue;
      if (e.isBoss || e.warlord) marks.push({ x: e.x, y: e.y, color: '#ff5a4a', icon: '☠' });
      else if (e.elite) marks.push({ x: e.x, y: e.y, color: '#ffd35c', icon: '⭐' });
    }
    const chests = run.pickups.filter((p) => p.kind === 'chest' && !p.collected)
      .map((p) => ({ p, d: Math.hypot(p.x - run.boat.x, p.y - run.boat.y) })).filter((c) => c.d < 900).sort((a, b) => a.d - b.d).slice(0, 2);
    for (const { p } of chests) marks.push({ x: p.x, y: p.y, color: '#e8b54b', icon: '💰' });
    drawEdgeArrows(ctx, marks, (x, y) => ({ x: x + view.translateX, y: y + view.translateY }),
      { left: hudInsets.left + 22, right: vw - hudInsets.right - 22, top: hudInsets.top + 22, bottom: vh - hudInsets.bottom - 22 }, t);
    updateBossBar();
    // Stream the rest of the terrain in what's left of this frame's budget.
    const spent = performance.now() - now;
    terrainRenderer.prewarm(camera.x, camera.y, Math.max(0, Math.min(3, 11 - spent)));
  }

  // Only what's on (or just off) the screen is worth drawing.
  function visibleOnly(enemies, v) {
    const out = [];
    for (const e of enemies) if (e.health > 0 && e.x > v.left - 40 && e.x < v.right + 40 && e.y > v.top - 40 && e.y < v.bottom + 40) out.push(e);
    return out;
  }

  // The warlord / boss bar under the HUD.
  const bossBarEl = document.getElementById('sv-boss');
  bossBarEl.innerHTML = '<b></b><i><u></u></i>';
  let bossShown = '';
  function updateBossBar() {
    const b = run.sv && run.sv.bossId != null ? run.enemies.find((e) => e.id === run.sv.bossId && e.health > 0) : null;
    const key = b ? `${b.id}:${Math.ceil((100 * b.health) / b.maxHealth)}` : '';
    if (key === bossShown) return;
    bossShown = key;
    bossBarEl.hidden = !b;
    if (!b) return;
    bossBarEl.querySelector('b').textContent = b.isBoss ? getEnemy(b.defId).name : `Warlord ${getEnemy(b.defId).name}`;
    bossBarEl.querySelector('u').style.width = `${(100 * b.health) / b.maxHealth}%`;
  }
  requestAnimationFrame(frame);
  setStatus(levelStartStatus());
  updateHullBar();
  updateSalvageCounter();
  updateReefIndicator();
  updateWeaponBar();
  openHub();
  // Opening sequence (ui/intro.mjs): a short painted scene that covers the
  // harbour's build, then washes over into it. Skipped under automation
  // (playtest scripts) unless ?intro is in the URL.
  const params = new URLSearchParams(window.location.search);
  if (!navigator.webdriver || params.has('intro')) {
    createIntro(root, { prepare: () => { ensureBase(); layoutBase(); } });
  }
}

// Resolves an enemy's draw color from its data definition, cached on the
// instance the first time (avoids a data lookup every frame for every
// enemy).
function enemyColor(enemy) {
  enemy.colorHex = getEnemy(enemy.defId).color;
  return enemy.colorHex;
}

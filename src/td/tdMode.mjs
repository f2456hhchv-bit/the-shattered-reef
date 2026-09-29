// Reef Defence mode (2026-09-29): the glue between engine/td.mjs and the
// screen. Owns its HUD, the tap-to-build ring, the defence chart and
// briefing, the results card, the pause menu and the between-wave
// checkpoint save. main.mjs hands it the shared canvas and calls
// frame() while it's active.
//
// Touch: everything is a tap. Tap a stone ring to open the build ring,
// tap a tower to open its ring (upgrade, specialise, target, sell), tap an
// enemy to read it. Ring options need two taps (the first shows what it
// is and its range), so a stray thumb never spends gold.

import { viewH } from '../ui/viewport.mjs';
import { buildDefenceMap, transposeDefenceMap, computeTdView } from '../engine/tdMap.mjs';
import {
  createDefence, stepDefence, drainEvents, buildTower, upgradeTower, specializeTower, sellTower, sellValue, upgradeCost,
  startNextWave, canCallWave, effectiveStats, cycleTargetMode, checkpointOf, restoreCheckpoint, isCalm, isRevealed,
  transposeDefence, lightsOf, currentCounterTower, towerAt, TD_TUNING,
} from '../engine/td.mjs';
import { waveRoster, isFlyer, goldFor } from '../engine/tdWaves.mjs';
import { TD_MAPS, getTdMap, defenceReward } from '../data/tdMaps.mjs';
import { TOWERS, TOWER_LIST, TOWER_FOR_WEAPON, getTower, towerStats } from '../data/towers.mjs';
import { getEnemy, ARCHETYPES as A } from '../data/enemies.mjs';
import { stageInfo } from '../data/stages.mjs';
import { getBiome, colorAtStops } from '../data/biomes.mjs';
import { buildTerrain } from '../engine/terrain.mjs';
import { createTerrainRenderer, glowingDecorations } from '../engine/terrainRenderer.mjs';
import { drawEnemy, drawParticles, drawDamageNumbers, drawEnemyProjectiles } from '../engine/renderer.mjs';
import {
  createParticlePool, spawnHitSpark, spawnKillBurst, spawnExplosion, spawnSplash, spawnMuzzleFlash, updateParticles,
  createDamageNumberPool, spawnDamageNumber, updateDamageNumbers, createShake, addShake, updateShake,
} from '../engine/juice.mjs';
import { drawDarkness, drawGlows, drawAmbientScreen } from '../engine/lightArt.mjs';
import {
  drawTower, drawSpot, drawRange, drawHeart, drawTdProjectile, drawMine, drawPool, drawBreath, drawEntryMarkers, drawAirRoutes, drawLighthouseBeams,
} from '../engine/tdArt.mjs';
import { drawIsland } from '../engine/islandArt.mjs';
import { isDefenceUnlocked, defenceKit, recordDefenceResult } from '../engine/meta.mjs';
import { drawTowerPortrait } from '../ui/towerYard.mjs';
import { playMusic } from '../audio/music.mjs';
import { musicFor } from '../data/music.mjs';
import {
  unlockAudio, isMuted, setMuted, playFire, playHit, playKill, playExplosion, playBossDefeated, playBossPhaseChange, playEnemyFire,
  playVictory, playSunk, playBuild, playUpgrade, playSell, playLeak, playWaveHorn, playTap, playLockedWeapon,
} from '../audio/audio.mjs';

const SAVE_KEY = 'shatteredReef.defence.v1';
const TAU = Math.PI * 2;
const ICON = Object.fromEntries(TOWER_LIST.map((t) => [t.id, t.icon]));
const TOWER_ART = 1.22; // towers drawn a little larger than their spot so they read on a phone
const TARGET_LABEL = { first: 'First', last: 'Last', strong: 'Strongest', close: 'Closest' };

// What makes an enemy tricky, in plain words (for its info card).
export function enemyTraits(defId) {
  const d = getEnemy(defId);
  const out = [];
  if (isFlyer(d)) out.push(['✈', 'Flies over land — only Cannon, Grapeshot and Chain Mast reach it']);
  if (d.archetype === A.SUBMERGED || d.archetype === A.SERPENT || d.burrows) out.push(['🌊', 'Dives — only Depth Charges hit it under the water']);
  if (d.camo) out.push(['👁', 'Hidden — a Lighthouse reveals it (or a tower right beside it)']);
  if (d.archetype === A.GHOST) out.push(['👻', 'Fades out of this world — only a Lighthouse can pin it down']);
  if (d.archetype === A.SHARK || d.archetype === A.RAMMER) out.push(['⚡', 'Bursts of speed']);
  if (d.archetype === A.SIREN) out.push(['🎵', 'Her song slows towers near her']);
  if (d.id === 'fire_ship') out.push(['💥', 'Blows up when sunk — burning ships beside it']);
  if (d.gun || d.phases?.some((p) => p.gun)) out.push(['🎯', 'Shoots your towers (stuns, chills or blinds them)']);
  if (d.packSize) out.push(['🐟', 'Comes in packs']);
  if (d.isBoss) out.push(['☠', 'Boss — changes form, and what hurts it, as it fights']);
  return out;
}

export function createDefenceMode(root, deps) {
  const { canvas, ctx } = deps;
  const el = document.createElement('div');
  el.id = 'td-root';
  el.hidden = true;
  el.innerHTML = `
    <div id="td-hit"></div>
    <div id="td-top">
      <div class="td-stats">
        <span class="td-stat td-lives" title="Heart of the Reef">❤️<b id="td-lives">20</b></span>
        <span class="td-stat td-gold" title="Gold">🪙<b id="td-gold">0</b></span>
        <span class="td-stat td-wave" title="Wave">🌊<b id="td-wave">0/10</b></span>
      </div>
      <div class="td-ctrl">
        <button type="button" id="td-speed" aria-label="Game speed">×1</button>
        <button type="button" id="td-pause" aria-label="Pause">❚❚</button>
      </div>
    </div>
    <div id="td-boss" hidden><span id="td-boss-name"></span><span class="td-bossbar"><i id="td-boss-fill"></i></span><small id="td-boss-weak"></small></div>
    <div id="td-intro" hidden></div>
    <div id="td-bottom">
      <div id="td-incoming" aria-label="Next wave"></div>
      <button type="button" id="td-call">▶ Start</button>
    </div>
    <div id="td-info" hidden></div>
    <div id="td-ring" hidden></div>
    <div id="td-toast"></div>
    <div id="td-pausemenu" class="td-modal" hidden>
      <div class="pm-card">
        <h1>Paused</h1>
        <p class="td-where" id="td-pm-where"></p>
        <button type="button" class="pm-primary" id="td-resume">▶ Resume</button>
        <button type="button" class="pm-btn" id="td-sound">🔊 Sound: on</button>
        <button type="button" class="pm-btn" id="td-leave">⚓ Save & return to harbour</button>
        <button type="button" class="pm-btn pm-danger" id="td-restart">↺ Restart this defence</button>
      </div>
    </div>
    <div id="td-result" class="td-modal" hidden><div class="pm-card td-result-card"></div></div>
  `;
  root.appendChild(el);
  const $ = (id) => el.querySelector(`#${id}`);

  // The chart of defence maps and the pre-battle briefing (over the harbour).
  const chart = document.createElement('div');
  chart.id = 'td-chart';
  chart.hidden = true;
  chart.innerHTML = `
    <div class="tdc-card">
      <div class="tdc-head">
        <button type="button" class="tdc-back" aria-label="Back to the harbour">←</button>
        <div class="tdc-titles"><h1>Reef Defence</h1><p>Hold the Heart of the Reef. Tap a stone ring to build.</p></div>
        <span class="pill pill-salvage"><i>⚓</i><b class="tdc-salvage">0</b></span>
      </div>
      <button type="button" class="tdc-continue" hidden></button>
      <div class="tdc-list"></div>
    </div>
    <div class="tdc-brief" hidden></div>
  `;
  root.appendChild(chart);

  // ------------------------------------------------------------ state
  let active = false;
  let s = null; let mapDef = null; let maps = null; let landscape = false;
  let terrain = null; let renderer = null; let glows = []; let fresh = true; let view = null;
  let particles = createParticlePool(); let numbers = createDamageNumberPool(); const shake = createShake();
  let coins = []; let breaths = []; let heartHurt = 0; let speed = 1; let paused = false;
  let sel = null; // { type: 'spot'|'tower'|'enemy', id }
  let armed = null; // ring option waiting for its confirming tap
  let seen = new Set(); let hint = 0; let resultShown = false; let resultTimer = 0;
  let lastSfx = {}; let lastHud = {}; let lastCalm = true;
  let bossRef = null;

  const sfx = (key, fn, gap = 0.07) => { const t = performance.now() / 1000; if ((lastSfx[key] || 0) + gap > t) return; lastSfx[key] = t; fn(); };

  // ------------------------------------------------------------ world
  function isLandscape() { return window.innerWidth > viewH() * 1.05; }
  function buildWorld() {
    const m = landscape ? maps.landscape : maps.portrait;
    const biome = s.biome;
    terrain = buildTerrain(m.grid, m.tileSize, m.coastSeed, biome, m.coast);
    // Keep palms and boulders off the build spots and the Heart.
    terrain.decorations = terrain.decorations.filter((d) => !m.spots.some((sp) => Math.hypot(d.x - sp.x, d.y - sp.y) < 22)
      && Math.hypot(d.x - m.heart.x, d.y - m.heart.y) > 34);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer = createTerrainRenderer(terrain, biome, { res: Math.min(1.5, dpr) });
    glows = biome.glow ? glowingDecorations(terrain, biome) : [];
    fresh = true;
    layout();
  }
  function ensureOrientation() {
    const want = isLandscape();
    if (want === landscape) return;
    landscape = want;
    if (!maps.landscape) maps.landscape = transposeDefenceMap(maps.portrait);
    transposeDefence(s, landscape ? maps.landscape : maps.portrait);
    closeRing();
    buildWorld();
  }
  function insets() {
    const vw = window.innerWidth; const vh = viewH();
    const top = $('td-top').getBoundingClientRect().bottom + 2;
    const b = $('td-bottom').getBoundingClientRect();
    if (landscape) return { top, bottom: 4, left: 4, right: Math.max(8, vw - b.left + 6) };
    return { top, bottom: Math.max(6, vh - b.top + 4), left: 0, right: 0 };
  }
  function layout() {
    if (!active || !s) return;
    el.classList.toggle('landscape', landscape);
    view = computeTdView(window.innerWidth, viewH(), insets(), s.map.widthPx, s.map.heightPx);
    if (sel) positionRing();
  }
  window.addEventListener('resize', () => { if (active) { ensureOrientation(); layout(); } });

  // ------------------------------------------------------------ start / stop
  function start(mapId, { resume = null } = {}) {
    const meta = deps.getMeta();
    mapDef = getTdMap(mapId);
    maps = { portrait: buildDefenceMap(mapDef), landscape: null };
    landscape = isLandscape();
    if (landscape) maps.landscape = transposeDefenceMap(maps.portrait);
    s = createDefence(mapDef, landscape ? maps.landscape : maps.portrait, defenceKit(meta));
    if (resume) restoreCheckpoint(s, resume);
    particles = createParticlePool(); numbers = createDamageNumberPool(); coins = []; breaths = [];
    shake.trauma = 0; heartHurt = 0; speed = 1; paused = false; sel = null; armed = null; bossRef = null;
    seen = new Set(); resultShown = false; resultTimer = 0; lastHud = {}; lastCalm = true;
    hint = (meta.tdStars[mapDef.id] || 0) === 0 && mapDef.index === 0 && !resume ? 1 : 0;
    active = true;
    chart.hidden = true;
    el.hidden = false;
    $('td-pausemenu').hidden = true; $('td-result').hidden = true; $('td-boss').hidden = true; $('td-intro').hidden = true;
    closeRing();
    document.body.classList.add('in-td');
    deps.onEnter?.();
    buildWorld();
    playMusic(musicFor(s.biome.id, false));
    toast(resume ? `Welcome back — wave ${s.waveIndex + 2} is next` : `${mapDef.name} — build your defences`);
    if (hint === 1) setTimeout(() => { if (active && hint === 1) toast('Tap a glowing stone ring to build a tower'); }, 1800);
    saveCheckpoint();
    updateHud(true);
  }

  function stop() {
    active = false;
    el.hidden = true;
    document.body.classList.remove('in-td');
    closeRing();
  }

  // ------------------------------------------------------------ checkpoint
  function saveCheckpoint() {
    if (!s || s.over || !isCalm(s)) return;
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify({ mapId: mapDef.id, cp: checkpointOf(s) })); } catch { /* storage full or off */ }
  }
  function clearCheckpoint() { try { window.localStorage.removeItem(SAVE_KEY); } catch { /* */ } }
  function peekCheckpoint() {
    try {
      const v = JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null');
      return v && v.cp && getTdMap(v.mapId) ? v : null;
    } catch { return null; }
  }

  // ------------------------------------------------------------ HUD
  function toast(text, ms = 2400) {
    const t = $('td-toast'); t.textContent = text; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), ms);
  }
  function setIf(key, value, fn) { if (lastHud[key] !== value) { lastHud[key] = value; fn(value); } }
  function updateHud(force = false) {
    if (force) lastHud = {};
    setIf('lives', s.lives, (v) => { $('td-lives').textContent = v; $('td-lives').parentElement.classList.toggle('low', v <= s.maxLives * 0.35); });
    setIf('gold', s.gold, (v) => { $('td-gold').textContent = v; if (sel) refreshRing(); });
    setIf('wave', `${Math.max(0, s.waveIndex + 1)}/${s.waves.length}`, (v) => { $('td-wave').textContent = v; });
    setIf('speed', speed, (v) => { $('td-speed').textContent = `×${v}`; $('td-speed').classList.toggle('on', v > 1); });
    // The call button: start, call early (with its bonus), or waiting.
    let label; let enabled = canCallWave(s); let cls = '';
    const next = s.waveIndex + 1;
    if (s.over) { label = s.outcome === 'won' ? '⚓ Reef held!' : '💔 The Heart is lost'; enabled = false; }
    else if (s.waveIndex < 0 || s.hold) { label = `▶ Start wave ${next + 1}`; cls = 'go'; }
    else if (s.nextWaveTimer != null) {
      const bonus = Math.round(s.nextWaveTimer * TD_TUNING.earlyGoldPerSecond * (1 + s.perks.earlyBonus));
      label = `▶ Wave ${next + 1} in ${Math.ceil(s.nextWaveTimer)}s · call now +${bonus}🪙`; cls = 'early';
    } else if (next >= s.waves.length) { label = `Final wave — ${s.enemies.length} left`; }
    else label = `Wave ${s.waveIndex + 1} incoming…`;
    setIf('call', `${label}|${enabled}|${cls}`, () => {
      const b = $('td-call'); b.textContent = label; b.disabled = !enabled; b.className = cls;
    });
    // The next wave's roster: who's coming and what they're weak to.
    const w = s.waves[Math.min(s.waves.length - 1, s.waveIndex + 1)];
    const key = s.over ? 'over' : `${s.waveIndex}|${w.index}|${seen.size}`;
    setIf('incoming', key, () => {
      const box = $('td-incoming'); box.innerHTML = '';
      if (s.over || s.waveIndex + 1 >= s.waves.length) return;
      for (const id of waveRoster(w)) {
        const d = getEnemy(id);
        const tw = TOWER_FOR_WEAPON[d.phases ? d.phases[0].counter : d.counter];
        const chip = document.createElement('button');
        chip.type = 'button'; chip.className = `td-foe${seen.has(id) ? '' : ' new'}${d.isBoss ? ' boss' : ''}`;
        chip.innerHTML = `<i style="background:${d.color}"></i><span>${d.name}</span><em>${ICON[tw] || ''}</em>`;
        chip.addEventListener('click', () => showEnemyInfo(id));
        box.appendChild(chip);
      }
    });
    // The boss bar.
    if (bossRef && bossRef.health > 0 && !bossRef.gone) {
      $('td-boss').hidden = false;
      $('td-boss-fill').style.width = `${Math.max(0, (100 * bossRef.health) / bossRef.maxHealth).toFixed(1)}%`;
      const tw = currentCounterTower(bossRef);
      setIf('bossWeak', `${bossRef.id}|${tw}|${bossRef.airborne}|${bossRef.invulnerable}`, () => {
        $('td-boss-name').textContent = bossRef.name;
        $('td-boss-weak').textContent = `Weak to ${ICON[tw]} ${TOWERS[tw].short}${bossRef.airborne ? ' · airborne' : ''}`;
      });
    } else if (!$('td-boss').hidden) $('td-boss').hidden = true;
    setIf('bossOn', !$('td-boss').hidden, (v) => el.classList.toggle('boss-on', v));
  }

  $('td-call').addEventListener('click', () => {
    unlockAudio();
    if (!s || !canCallWave(s)) return;
    const r = startNextWave(s);
    if (r.ok && hint === 2) hint = 3;
    updateHud();
  });
  $('td-speed').addEventListener('click', () => { speed = speed === 1 ? 2 : 1; playTap(); updateHud(); });
  $('td-pause').addEventListener('click', () => setPaused(true));
  $('td-resume').addEventListener('click', () => setPaused(false));
  $('td-sound').addEventListener('click', () => { setMuted(!isMuted()); deps.onMuteChange?.(); refreshPauseMenu(); });
  $('td-leave').addEventListener('click', () => { saveCheckpoint(); leave(); });
  $('td-restart').addEventListener('click', async () => {
    if (!await deps.askConfirm('Restart this defence from wave 1? Your towers here will be cleared.', 'Restart')) return;
    clearCheckpoint(); start(mapDef.id);
  });
  function refreshPauseMenu() {
    $('td-sound').textContent = isMuted() ? '🔇 Sound: off' : '🔊 Sound: on';
    const calm = isCalm(s);
    $('td-pm-where').textContent = `${mapDef.name} · wave ${Math.max(1, s.waveIndex + 1)}/${s.waves.length} · ❤️ ${s.lives}`;
    $('td-leave').textContent = calm ? '⚓ Save & return to harbour' : '⚓ Return to harbour (resumes from the last cleared wave)';
  }
  function setPaused(p) {
    if (!s || s.over) return;
    paused = p;
    $('td-pausemenu').hidden = !p;
    if (p) { refreshPauseMenu(); closeRing(); }
  }
  function leave() { stop(); deps.onExit(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden && active && s && !s.over) { setPaused(true); saveCheckpoint(); } });

  // ------------------------------------------------------------ taps on the map
  $('td-hit').addEventListener('pointerdown', (e) => { unlockAudio(); e.preventDefault(); });
  $('td-hit').addEventListener('click', (e) => {
    if (!s || !view || paused) return;
    const w = view.toWorld(e.clientX, e.clientY);
    const k = 1 / view.scale; // screen px → world px
    // Towers and spots first (bigger, more important targets), then enemies.
    let best = null; let bd = Math.max(24, 26 * k);
    for (const t of s.towers) { const d = Math.hypot(t.x - w.x, t.y - 8 - w.y); if (d < bd) { bd = d; best = { type: 'tower', id: t.id }; } }
    for (const sp of s.map.spots) { if (towerAt(s, sp.id)) continue; const d = Math.hypot(sp.x - w.x, sp.y - w.y); if (d < bd) { bd = d; best = { type: 'spot', id: sp.id }; } }
    if (!best) {
      let ed = 22 * k;
      for (const en of s.enemies) { const d = Math.hypot(en.x - w.x, en.y - w.y) - en.radius; if (d < ed) { ed = d; best = { type: 'enemy', id: en.id }; } }
    }
    if (!best || (sel && best.type === sel.type && best.id === sel.id)) { closeRing(); return; }
    playTap();
    select(best);
  });

  function select(x) {
    sel = x; armed = null;
    if (x.type === 'enemy') { const en = s.enemies.find((q) => q.id === x.id); if (en) showEnemyInfo(en.defId); $('td-ring').hidden = true; return; }
    if (hint === 1 && x.type === 'spot') hint = 1.5;
    refreshRing();
    showSelectionInfo();
  }
  function closeRing() {
    sel = null; armed = null;
    $('td-ring').hidden = true; $('td-info').hidden = true;
  }

  // Options for the current selection: [{ key, icon, label, cost, disabled, info }].
  function ringOptions() {
    if (!sel) return [];
    if (sel.type === 'spot') {
      return TOWER_LIST.map((t) => {
        const locked = !s.unlockedTowers.has(t.id);
        const cost = t.levels[0].cost;
        return { key: `build:${t.id}`, icon: t.icon, label: locked ? '🔒' : `${cost}`, disabled: locked || s.gold < cost, locked, tower: t.id };
      });
    }
    if (sel.type === 'tower') {
      const t = s.towers.find((q) => q.id === sel.id);
      if (!t) return [];
      const def = getTower(t.towerId);
      const out = [];
      if (!t.spec && t.level < 3) { const c = upgradeCost(t); out.push({ key: 'upgrade', icon: '⬆', label: `${c}`, disabled: s.gold < c }); }
      if (!t.spec && t.level === 3) {
        for (const sp of def.specs) {
          const locked = !s.unlockedSpecs.has(sp.id);
          out.push({ key: `spec:${sp.id}`, icon: '★', label: locked ? '🔒' : `${sp.cost}`, disabled: locked || s.gold < sp.cost, locked, spec: sp.id });
        }
      }
      if (!def.support) out.push({ key: 'target', icon: '🎯', label: TARGET_LABEL[t.targetMode], disabled: false });
      out.push({ key: 'sell', icon: '🪙', label: `+${sellValue(s, t)}`, disabled: false, sell: true });
      return out;
    }
    return [];
  }
  function selPoint() {
    if (!sel) return null;
    if (sel.type === 'spot') return s.map.spots.find((p) => p.id === sel.id);
    if (sel.type === 'tower') return s.towers.find((q) => q.id === sel.id);
    return null;
  }
  function refreshRing() {
    const opts = ringOptions();
    const ring = $('td-ring');
    if (!opts.length) { ring.hidden = true; return; }
    ring.innerHTML = '';
    for (const o of opts) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `td-opt${o.disabled ? ' off' : ''}${armed === o.key ? ' armed' : ''}${o.sell ? ' sell' : ''}${o.locked ? ' locked' : ''}`;
      b.dataset.key = o.key;
      b.innerHTML = `<span class="i">${armed === o.key ? '✓' : o.icon}</span><small>${o.label}</small>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); pickOption(o); });
      ring.appendChild(b);
    }
    ring.hidden = false;
    $('td-toast').classList.remove('show'); // never cover the ring
    positionRing();
  }
  function positionRing() {
    const p = selPoint(); const ring = $('td-ring');
    if (!p || !view) { ring.hidden = true; return; }
    const sc = view.toScreen(p.x, p.y);
    const n = ring.children.length; const R = n <= 3 ? 54 : 62;
    const vw = window.innerWidth; const vh = viewH(); const m = R + 30;
    const cx = Math.max(m, Math.min(vw - m, sc.x)); const cy = Math.max(m + 40, Math.min(vh - m - 20, sc.y));
    [...ring.children].forEach((b, i) => {
      const a = -Math.PI / 2 + (i * TAU) / n;
      b.style.left = `${Math.round(cx + Math.cos(a) * R)}px`; b.style.top = `${Math.round(cy + Math.sin(a) * R)}px`;
    });
  }
  function pickOption(o) {
    if (o.locked) { playLockedWeapon(); showOptionInfo(o); toast(o.tower ? 'Unlock this tower in the harbour\'s Tower Yard' : 'Learn this in the harbour\'s Tower Yard'); return; }
    if (armed !== o.key) { armed = o.key; playTap(); refreshRing(); showOptionInfo(o); return; }
    if (o.disabled) { playLockedWeapon(); toast('Not enough gold'); return; }
    const t = sel.type === 'tower' ? s.towers.find((q) => q.id === sel.id) : null;
    if (o.key.startsWith('build:')) {
      const r = buildTower(s, sel.id, o.tower);
      if (r.ok) { sel = { type: 'tower', id: r.tower.id }; armed = null; closeRing(); if (hint > 0 && hint < 2) { hint = 2; setTimeout(() => { if (active && hint === 2) toast('Tap ▶ Start when you\'re ready for the first wave'); }, 500); } }
    } else if (o.key === 'upgrade') { upgradeTower(s, t.id); armed = null; refreshRing(); showSelectionInfo(); }
    else if (o.key.startsWith('spec:')) { specializeTower(s, t.id, o.spec); armed = null; refreshRing(); showSelectionInfo(); }
    else if (o.key === 'target') { cycleTargetMode(s, t.id); armed = 'target'; refreshRing(); showSelectionInfo(); }
    else if (o.key === 'sell') { sellTower(s, t.id); closeRing(); }
    saveCheckpoint();
    updateHud();
  }

  // ------------------------------------------------------------ info cards
  function strongHere(towerId) {
    const ids = new Set();
    for (const w of s.waves) for (const g of w.groups) {
      const d = getEnemy(g.defId);
      const counters = d.phases ? d.phases.map((p) => p.counter) : [d.counter];
      if (counters.some((c) => TOWER_FOR_WEAPON[c] === towerId)) ids.add(d.name);
    }
    return [...ids];
  }
  function statsLine(st, towerId) {
    const def = getTower(towerId);
    if (def.support) return `Range ${Math.round(st.range)} · towers in range +${Math.round(st.aura.rangeBonus * 100)}% range${st.aura.damageBonus ? `, +${Math.round(st.aura.damageBonus * 100)}% damage` : ''}`;
    const parts = [];
    if (st.damage) parts.push(`Dmg ${Math.round(st.damage)}`);
    if (st.burnDps) parts.push(`Burn ${Math.round(st.burnDps)}/s`);
    parts.push(`Every ${st.cooldown.toFixed(2)}s`, `Range ${Math.round(st.range)}`);
    if (st.splash) parts.push(`Blast ${st.splash}`);
    if (st.slow) parts.push(`Slow ${Math.round(st.slow * 100)}%`);
    if (st.pierce) parts.push(`Pierce ${st.pierce}`);
    return parts.join(' · ');
  }
  function reachLine(towerId) {
    const r = getTower(towerId).reach;
    return [r.air ? '✈ hits flyers' : '✈ can\'t hit flyers', r.submerged ? '🌊 hits divers' : null].filter(Boolean).join(' · ');
  }
  function infoCard(html) { const box = $('td-info'); box.innerHTML = html; box.hidden = false; }
  function showOptionInfo(o) {
    if (o.tower) {
      const t = TOWERS[o.tower]; const st = t.levels[0];
      const strong = strongHere(o.tower);
      infoCard(`<b>${t.icon} ${t.name}</b> <span class="td-cost">${st.cost}🪙</span><p>${t.blurb}</p><p class="td-stats-line">${statsLine({ ...st, damage: st.damage }, o.tower)}</p><p class="td-reach">${reachLine(o.tower)}</p>${strong.length ? `<p class="td-strong">Strong here vs: ${strong.join(', ')}</p>` : ''}<p class="td-tapagain">${o.locked ? '🔒 Unlock at the Tower Yard' : o.disabled ? 'Not enough gold' : 'Tap again to build'}</p>`);
    } else if (o.spec) {
      const t = s.towers.find((q) => q.id === sel.id); const sp = getTower(t.towerId).specs.find((q) => q.id === o.spec);
      infoCard(`<b>★ ${sp.name}</b> <span class="td-cost">${sp.cost}🪙</span><p>${sp.blurb}</p><p class="td-stats-line">${statsLine({ ...getTower(t.towerId).levels[2], ...sp }, t.towerId)}</p><p class="td-tapagain">${o.locked ? '🔒 Learn it at the Tower Yard' : o.disabled ? 'Not enough gold' : 'Tap again to specialise'}</p>`);
    } else if (o.key === 'upgrade') {
      const t = s.towers.find((q) => q.id === sel.id); const next = getTower(t.towerId).levels[t.level];
      infoCard(`<b>Upgrade to level ${t.level + 1}</b> <span class="td-cost">${next.cost}🪙</span><p class="td-stats-line">${statsLine(next, t.towerId)}</p><p class="td-tapagain">${o.disabled ? 'Not enough gold' : 'Tap again to upgrade'}</p>`);
    } else if (o.key === 'sell') {
      infoCard(`<b>Sell for ${o.label}🪙</b><p>${s.waveIndex < 0 ? 'Full refund until the first wave.' : `Refunds ${Math.round(s.perks.sellRefund * 100)}% of what you spent.`}</p><p class="td-tapagain">Tap again to sell</p>`);
    } else if (o.key === 'target') showSelectionInfo();
  }
  function showSelectionInfo() {
    if (!sel || sel.type !== 'tower') { if (sel?.type === 'spot') infoCard('<b>Build a tower</b><p>Pick one from the ring. Read the incoming wave below: every enemy has a tower that counters it.</p>'); return; }
    const t = s.towers.find((q) => q.id === sel.id); if (!t) return;
    const def = getTower(t.towerId); const st = effectiveStats(s, t);
    const title = t.spec ? `★ ${def.specs.find((p) => p.id === t.spec).name}` : `${def.icon} ${def.name} · Lv ${t.level}`;
    infoCard(`<b>${title}</b><p class="td-stats-line">${statsLine(st, t.towerId)}</p><p class="td-reach">${reachLine(t.towerId)}${def.support ? '' : ` · Target: ${TARGET_LABEL[t.targetMode]}`}</p><p class="td-kills">Sunk ${t.kills} · dealt ${Math.round(t.damage)}</p>`);
  }
  function showEnemyInfo(defId) {
    const d = getEnemy(defId);
    const counters = [...new Set((d.phases ? d.phases.map((p) => p.counter) : [d.counter]).map((c) => TOWER_FOR_WEAPON[c]))];
    const traits = enemyTraits(defId).map(([i, tx]) => `<li><span>${i}</span>${tx}</li>`).join('');
    infoCard(`<b style="color:${d.color}">●</b> <b>${d.name}</b><p class="td-strong">Weak to: ${counters.map((c) => `${ICON[c]} ${TOWERS[c].name}`).join(' → ')}</p>${traits ? `<ul class="td-traits">${traits}</ul>` : ''}<p class="td-kills">Worth ${goldFor(defId)}🪙</p>`);
  }

  // A new kind of enemy arriving: a short card that teaches it.
  function introduce(ids) {
    const fresh = ids.filter((id) => !seen.has(id));
    for (const id of ids) seen.add(id);
    if (!fresh.length) return;
    const d = getEnemy(fresh[0]);
    const tw = TOWER_FOR_WEAPON[d.phases ? d.phases[0].counter : d.counter];
    const tr = enemyTraits(fresh[0]).slice(0, 2).map(([i]) => i).join(' ');
    const box = $('td-intro');
    box.innerHTML = `<small>${d.isBoss ? 'BOSS' : 'NEW ENEMY'}</small><b style="color:${d.color}">${d.name}</b> ${tr}<span>Weak to ${ICON[tw]} ${TOWERS[tw].short}</span>`;
    box.hidden = false; box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
    clearTimeout(introduce.t); introduce.t = setTimeout(() => { box.hidden = true; }, 4200);
  }

  // ------------------------------------------------------------ events → juice
  function handle(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'fire': {
          const t = ev.tower; const def = getTower(t.towerId);
          const top = t.y - (t.towerId === 'chain' ? 30 : 16);
          if (ev.kind !== 'mine' && ev.kind !== 'fire') spawnMuzzleFlash(particles, t.x + Math.cos(t.angle) * 10, top + Math.sin(t.angle) * 6, t.angle, '#ffd07a');
          sfx(`fire:${t.towerId}`, () => playFire(def.weapon), 0.09);
          break;
        }
        case 'hit':
          if (ev.amount >= 1) spawnDamageNumber(numbers, ev.x + (Math.random() - 0.5) * 8, ev.y, ev.amount, { crit: ev.crit });
          if (!ev.burn) { spawnHitSpark(particles, ev.x, ev.y + 4, ev.crit ? '#ffd35c' : '#ffe9c0', Math.random, 4); sfx('hit', playHit, 0.06); }
          break;
        case 'kill': {
          const e = ev.enemy;
          if (ev.boss) { spawnExplosion(particles, e.x, e.y, 46); addShake(shake, 0.9); playBossDefeated(); toast(`${e.name} is sunk!`); }
          else { spawnKillBurst(particles, e.x, e.y, e.color || '#fff'); sfx('kill', playKill, 0.08); }
          coins.push({ x: e.x, y: e.y - 10, text: `+${ev.gold}`, life: 0.9 });
          break;
        }
        case 'blast':
          if (ev.kind === 'depth' || ev.kind === 'mine') { spawnSplash(particles, ev.x, ev.y, Math.random, 14); spawnExplosion(particles, ev.x, ev.y, ev.r * 0.6); }
          else spawnExplosion(particles, ev.x, ev.y, ev.r * 0.8);
          sfx('blast', playExplosion, 0.12);
          addShake(shake, 0.12);
          break;
        case 'breath': breaths.push({ x: ev.tower.x, y: ev.tower.y - 14, angle: ev.angle, range: ev.range, cone: ev.cone, life: 0.3, maxLife: 0.3 }); sfx('breath', () => playFire('flame_barrels'), 0.3); break;
        case 'leak':
          heartHurt = 1; addShake(shake, ev.enemy.isBoss ? 1 : 0.4); playLeak();
          spawnSplash(particles, ev.x, ev.y, Math.random, 12);
          numbers.push({ ...makeLoss(ev), id: Math.random() });
          if (ev.enemy.isBoss) toast(`${ev.enemy.name} broke through! −${ev.lives} ❤️`);
          break;
        case 'waveStart': {
          const w = s.waves[ev.index];
          playWaveHorn(ev.boss);
          toast(ev.boss ? `Final wave — the boss is coming!` : `Wave ${ev.index + 1}${ev.bonus ? ` · +${ev.bonus}🪙 for calling early` : ''}`);
          introduce(waveRoster(w));
          if (ev.boss) playMusic(musicFor(s.biome.id, true));
          if (hint === 3 && ev.index === 0) setTimeout(() => { if (active && hint === 3) { toast('Tap a tower to upgrade it · tap an enemy to read it', 3400); hint = 4; } }, 9000);
          break;
        }
        case 'bossArrives': bossRef = ev.enemy; addShake(shake, 0.5); break;
        case 'bossPhase': {
          const tw = currentCounterTower(ev.enemy);
          playBossPhaseChange(); toast(`${ev.enemy.name} changes — now weak to ${ICON[tw]} ${TOWERS[tw].short}!`, 3000);
          break;
        }
        case 'enrage': toast(`${ev.enemy.name} is enraged!`); break;
        case 'enemyFire': sfx('efire', playEnemyFire, 0.25); break;
        case 'rattle': spawnHitSpark(particles, ev.tower.x, ev.tower.y - 14, '#b8c4d0', Math.random, 6); break;
        case 'towerHit': spawnHitSpark(particles, ev.x, ev.y, '#ffb070', Math.random, 5); break;
        case 'build': playBuild(); spawnSplash(particles, ev.tower.x, ev.tower.y, Math.random, 10); ev.tower.builtAge = 0; break;
        case 'upgrade': playUpgrade(); spawnKillBurst(particles, ev.tower.x, ev.tower.y - 12, '#ffd35c'); break;
        case 'sell': playSell(); coins.push({ x: ev.tower.x, y: ev.tower.y - 20, text: `+${ev.refund}`, life: 1.1 }); spawnSplash(particles, ev.tower.x, ev.tower.y, Math.random, 8); break;
        case 'won': case 'lost': resultTimer = 1.4; break;
        default: break;
      }
    }
  }
  function makeLoss(ev) {
    const n = { x: s.map.heart.x, y: s.map.heart.y - 26, amount: ev.lives, vy: -30, life: 1.1, maxLife: 1.1, crit: false, triangle: null, incoming: true, heal: false };
    return n;
  }

  // ------------------------------------------------------------ results
  function showResult() {
    resultShown = true;
    const meta = deps.getMeta();
    const won = s.outcome === 'won';
    const old = meta.tdStars[mapDef.id] || 0;
    const reward = recordDefenceResult(meta, mapDef.id, s.stars, s.stats.kills);
    deps.persistMeta();
    clearCheckpoint();
    if (won) playVictory(); else playSunk();
    const next = TD_MAPS[mapDef.index + 1];
    const nextOpen = next && isDefenceUnlocked(meta, mapDef.index + 1);
    const stars = [1, 2, 3].map((k) => `<span class="${k <= s.stars ? 'on' : ''}${k > old && k <= s.stars ? ' fresh' : ''}" style="animation-delay:${0.25 + k * 0.25}s">★</span>`).join('');
    const card = el.querySelector('.td-result-card');
    card.innerHTML = `
      <h1>${won ? 'The reef holds!' : 'The Heart is lost'}</h1>
      <p class="td-where">${mapDef.name} · ${won ? `❤️ ${s.lives}/${s.maxLives}` : `fell on wave ${s.waveIndex + 1}/${s.waves.length}`}</p>
      <div class="td-stars">${stars}</div>
      <ul class="td-res">
        <li>Enemies sunk <b>${s.stats.kills}</b></li>
        <li>Got through <b>${s.stats.leaked}</b></li>
        ${s.stats.bossKilled ? '<li>Boss <b>sunk ☠</b></li>' : ''}
        <li>Salvage earned <b>+${reward.salvage} ⚓</b></li>
        ${reward.scales ? `<li>First 3-star defence <b>+${reward.scales} 🦑</b></li>` : ''}
      </ul>
      ${won && s.stars < 3 ? '<p class="td-tip">3 stars: let no more than 10% of the Heart\'s lives go.</p>' : ''}
      ${!won ? `<p class="td-tip">${failTip()}</p>` : ''}
      ${won && nextOpen ? `<button type="button" class="pm-primary" data-act="next">▶ Next: ${next.name}</button>` : ''}
      <button type="button" class="${won && nextOpen ? 'pm-btn' : 'pm-primary'}" data-act="retry">↺ ${won ? 'Play again' : 'Try again'}</button>
      <button type="button" class="pm-btn" data-act="harbour">⚓ Harbour</button>
    `;
    card.querySelector('[data-act="retry"]').addEventListener('click', () => start(mapDef.id));
    card.querySelector('[data-act="harbour"]').addEventListener('click', leave);
    card.querySelector('[data-act="next"]')?.addEventListener('click', () => openBrief(next.id));
    $('td-result').hidden = false;
    closeRing();
  }
  // What got through most, and the tower that answers it.
  function failTip() {
    const tally = {};
    for (const w of s.waves.slice(0, s.waveIndex + 1)) for (const g of w.groups) tally[g.defId] = (tally[g.defId] || 0) + g.count;
    const hard = Object.keys(tally).map((id) => getEnemy(id)).find((d) => isFlyer(d) || d.camo || d.archetype === A.GHOST || d.archetype === A.SUBMERGED || d.archetype === A.SERPENT);
    if (!hard) return 'Upgrade the towers that cover the longest stretch of channel, and call waves early for gold.';
    const tw = TOWER_FOR_WEAPON[hard.counter] || 'cannon';
    return `${hard.name}: ${enemyTraits(hard.id)[0]?.[1] || ''}. Try more ${TOWERS[tw].name}s.`;
  }

  // ------------------------------------------------------------ frame
  function frame(now, rawDt) {
    if (!active) return;
    ensureOrientation();
    if (!view) layout();
    const t = now / 1000;
    if (!paused && !s.over && $('td-result').hidden) {
      let sim = rawDt * speed;
      while (sim > 1e-6) { const d = Math.min(1 / 30, sim); stepDefence(s, d); sim -= d; handle(drainEvents(s)); }
    }
    if (s.over && !resultShown) { resultTimer -= rawDt; if (resultTimer <= 0) showResult(); }
    const calm = isCalm(s);
    if (calm && !lastCalm) saveCheckpoint();
    lastCalm = calm;
    // Juice runs on real time.
    particles = updateParticles(particles, rawDt);
    numbers = updateDamageNumbers(numbers, rawDt);
    for (const c of coins) { c.life -= rawDt; c.y -= 22 * rawDt; }
    coins = coins.filter((c) => c.life > 0);
    for (const b of breaths) b.life -= rawDt;
    breaths = breaths.filter((b) => b.life > 0);
    heartHurt = Math.max(0, heartHurt - rawDt * 1.5);
    for (const tw of s.towers) if (tw.builtAge != null && tw.builtAge < 1) tw.builtAge = Math.min(1, tw.builtAge + rawDt * 3);
    const sh = updateShake(shake, rawDt);
    render(t, sh);
    updateHud();
    if (sel) positionRing();
  }

  function render(t, sh) {
    const vw = window.innerWidth; const vh = viewH();
    const biome = s.biome; const m = s.map;
    ctx.fillStyle = `rgb(${colorAtStops(biome.land, 40).join(',')})`;
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(view.tx + (sh?.x || 0), view.ty + (sh?.y || 0)); ctx.scale(view.scale, view.scale);
    // Enemies sail in from beyond the edge: keep everything inside the map.
    ctx.beginPath(); ctx.rect(0, 0, m.widthPx, m.heightPx); ctx.clip();
    renderer.draw(ctx, { left: 0, top: 0, right: m.widthPx, bottom: m.heightPx }, t, { forceVisible: fresh, maxNewChunks: 0 });
    fresh = false;
    // Where the next wave comes in (between waves and while it arrives).
    const w = s.waves[s.waveIndex + 1];
    if (w && !s.over && (s.nextWaveTimer != null || s.waveIndex < 0 || s.hold)) {
      const lanes = new Set(w.groups.map((g) => g.lane));
      const fl = w.groups.some((g) => isFlyer(getEnemy(g.defId)));
      if (fl) drawAirRoutes(ctx, m, new Set(w.groups.filter((g) => isFlyer(getEnemy(g.defId))).map((g) => g.lane)), t);
      drawEntryMarkers(ctx, m, lanes, t, fl);
    }
    for (const p of s.pools) drawPool(ctx, p, t);
    for (const mn of s.mines) drawMine(ctx, mn, t);
    drawHeart(ctx, m.heart, t, { lives: s.lives, maxLives: s.maxLives, hurt: heartHurt });
    // Build spots (the best one pulses for a first-time player). In the
    // dark they're drawn over the darkness: you can always see where to build.
    const cheapest = Math.min(...[...s.unlockedTowers].map((id) => TOWERS[id].levels[0].cost));
    const drawSpots = () => {
      for (const sp of m.spots) {
        if (towerAt(s, sp.id)) continue;
        drawSpot(ctx, sp, t, { selected: sel?.type === 'spot' && sel.id === sp.id, affordable: s.gold >= cheapest });
      }
      if (hint > 0 && hint < 2 && s.towers.length === 0) drawHintArrow(ctx, m.spots[bestSpotIndex()], t);
    };
    if (!s.dark) drawSpots();
    // Range preview for the selection / the armed build option.
    const sp = selPoint();
    if (sp) {
      let r = null; let col;
      if (armed?.startsWith('build:')) { const id = armed.slice(6); r = TOWERS[id].levels[0].range * (1 + s.perks.rangeBonus); }
      else if (sel.type === 'tower') {
        const tw = s.towers.find((q) => q.id === sel.id);
        if (armed === 'upgrade') r = getTower(tw.towerId).levels[tw.level].range;
        else if (armed?.startsWith('spec:')) r = getTower(tw.towerId).specs.find((q) => q.id === armed.slice(5)).range;
        else r = effectiveStats(s, tw).range;
        if (tw.towerId === 'lighthouse') col = '160, 220, 255';
      }
      if (r) drawRange(ctx, sp.x, sp.y, r, t, col);
    }
    // Enemies on the water, then towers, then flyers above them all.
    const hiddenAlpha = (e) => ((e.camo && !isRevealed(s, e)) ? 0.16 : 1);
    const ground = s.enemies.filter((e) => !e.flying && e.health > 0);
    const air = s.enemies.filter((e) => e.flying && e.health > 0);
    for (const e of ground) drawFoe(e, t, hiddenAlpha(e));
    const towers = [...s.towers].sort((a, b) => a.y - b.y);
    for (const tw of towers) { ctx.save(); ctx.translate(tw.x, tw.y); ctx.scale(TOWER_ART, TOWER_ART); ctx.translate(-tw.x, -tw.y); drawTower(ctx, tw, t); ctx.restore(); }
    for (const e of air) drawFoe(e, t, 1);
    // Darkness (caverns, abyss): towers, the Heart and fire light the way.
    if (s.dark) {
      const amb = biome.ambient;
      drawDarkness(ctx, { left: 0, top: 0, right: m.widthPx, bottom: m.heightPx }, { dark: amb.dark, light: amb.light, color: amb.color || [3, 5, 12] }, lightsOf(s), t);
      drawGlows(ctx, glows, { left: 0, top: 0, right: m.widthPx, bottom: m.heightPx }, t);
      drawSpots();
    }
    drawLighthouseBeams(ctx, s.towers, (tw) => towerStats(tw).range, t);
    for (const b of breaths) drawBreath(ctx, b);
    for (const p of s.projectiles) drawTdProjectile(ctx, p, t);
    drawEnemyProjectiles(ctx, s.enemyShots, t);
    // Selected enemy: a ring that follows it.
    if (sel?.type === 'enemy') {
      const e = s.enemies.find((q) => q.id === sel.id);
      if (e) { ctx.strokeStyle = 'rgba(255, 226, 138, .9)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 7, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    }
    drawParticles(ctx, particles);
    drawDamageNumbers(ctx, numbers);
    ctx.font = '800 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const c of coins) {
      ctx.globalAlpha = Math.min(1, c.life * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40, 24, 0, .85)'; ctx.strokeText(`${c.text}🪙`, c.x, c.y);
      ctx.fillStyle = '#ffd35c'; ctx.fillText(`${c.text}🪙`, c.x, c.y);
    }
    ctx.globalAlpha = 1;
    // Soft edges: the map fades into the surrounding land instead of a hard box.
    const bg = colorAtStops(biome.land, 40).join(',');
    const F = 18;
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [
      [0, 0, 0, F, 0, 0, m.widthPx, F], [0, m.heightPx, 0, m.heightPx - F, 0, m.heightPx - F, m.widthPx, F],
      [0, 0, F, 0, 0, 0, F, m.heightPx], [m.widthPx, 0, m.widthPx - F, 0, m.widthPx - F, 0, F, m.heightPx],
    ]) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(${bg}, 1)`); g.addColorStop(1, `rgba(${bg}, 0)`);
      ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.restore();
    drawAmbientScreen(ctx, biome, t, vw, vh);
  }

  function drawFoe(e, t, alpha) {
    if (alpha < 1) ctx.globalAlpha = alpha;
    const lit = !s.dark || true;
    drawEnemy(ctx, e, e.color || '#ccc', t, null, null, null);
    // Slowed: chains round the hull. Stunned: stars.
    if (e.slowT > 0 && e.slowMult < 1) { ctx.strokeStyle = 'rgba(200, 210, 225, .8)'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 3, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    if (e.stunT > 0) { ctx.fillStyle = '#ffe28a'; for (let k = 0; k < 3; k++) { const a = t * 6 + (k * TAU) / 3; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * e.radius, e.y - e.radius - 3 + Math.sin(a) * 2, 1.5, 0, TAU); ctx.fill(); } }
    ctx.globalAlpha = 1;
    void lit;
  }

  function bestSpotIndex() {
    let best = 0; let bs = -1;
    s.map.spots.forEach((sp, i) => {
      let n = 0; for (const l of s.map.lanes) for (let k = 0; k < l.ground.pts.length; k += 3) { const p = l.ground.pts[k]; if (Math.hypot(p.x - sp.x, p.y - sp.y) < 100) n++; }
      if (n > bs) { bs = n; best = i; }
    });
    return best;
  }
  function drawHintArrow(g, sp, t) {
    if (!sp) return;
    const bob = Math.sin(t * 5) * 4;
    g.save(); g.translate(sp.x, sp.y - 26 + bob);
    g.fillStyle = '#ffe28a'; g.strokeStyle = 'rgba(60, 30, 0, .9)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 12); g.lineTo(-9, 0); g.lineTo(-4, 0); g.lineTo(-4, -10); g.lineTo(4, -10); g.lineTo(4, 0); g.lineTo(9, 0); g.closePath();
    g.stroke(); g.fill(); g.restore();
  }

  // ------------------------------------------------------------ the chart
  function openChart() {
    unlockAudio();
    const meta = deps.getMeta();
    chart.querySelector('.tdc-salvage').textContent = Math.round(meta.salvage).toLocaleString('en-GB');
    const cont = chart.querySelector('.tdc-continue');
    const cp = peekCheckpoint();
    cont.hidden = !cp;
    if (cp) cont.innerHTML = `▶ Continue defence<small>${getTdMap(cp.mapId).name} · wave ${cp.cp.waveIndex + 2} next · ❤️ ${cp.cp.lives}</small>`;
    const list = chart.querySelector('.tdc-list'); list.innerHTML = '';
    TD_MAPS.forEach((md, i) => {
      const open = isDefenceUnlocked(meta, i);
      const stars = meta.tdStars[md.id] || 0;
      const info = stageInfo(md.stage);
      const card = document.createElement('button');
      card.type = 'button'; card.className = `tdc-map${open ? '' : ' locked'}`;
      card.innerHTML = `
        <canvas width="84" height="84" aria-hidden="true"></canvas>
        <span class="tdc-txt"><b>${i + 1}. ${md.name}</b><small>${getBiome(info.biome).name} · ${md.waves} waves · ${md.lanes.length} channel${md.lanes.length > 1 ? 's' : ''}</small>
        <span class="tdc-stars">${[1, 2, 3].map((k) => `<i class="${k <= stars ? 'on' : ''}">★</i>`).join('')}</span></span>
        <span class="tdc-go">${open ? '▶' : '🔒'}</span>
      `;
      const cv = card.querySelector('canvas');
      requestAnimationFrame(() => { const g = cv.getContext('2d'); try { drawIsland(g, cv.width, cv.height, info.biome, md.stage, { locked: !open }); } catch { /* art only */ } });
      card.addEventListener('click', () => {
        playTap();
        if (!open) { toast(`Earn a star on ${TD_MAPS[i - 1].name} to open this — or reach stage ${i + 1} on your voyages.`); return; }
        openBrief(md.id);
      });
      list.appendChild(card);
    });
    chart.hidden = false;
  }
  chart.querySelector('.tdc-back').addEventListener('click', () => { chart.hidden = true; deps.onChartClosed?.(); });
  chart.querySelector('.tdc-continue').addEventListener('click', () => {
    const cp = peekCheckpoint(); if (!cp) return;
    start(cp.mapId, { resume: cp.cp });
  });

  // The briefing: who's coming, what answers them, and what stars pay.
  function openBrief(mapId) {
    const meta = deps.getMeta();
    const md = getTdMap(mapId);
    const probe = createDefence(md, { lanes: md.lanes.map(() => ({})), spots: [] }, defenceKit(meta));
    const ids = [];
    for (const w of probe.waves) for (const id of waveRoster(w)) if (!ids.includes(id)) ids.push(id);
    const need = new Set();
    for (const id of ids) { const d = getEnemy(id); for (const c of (d.phases ? d.phases.map((p) => p.counter) : [d.counter])) need.add(TOWER_FOR_WEAPON[c]); }
    if (ids.some((id) => getEnemy(id).camo || getEnemy(id).archetype === A.GHOST) || probe.dark) need.add('lighthouse');
    const stars = meta.tdStars[md.id] || 0;
    const per = defenceReward(md.index, 0, 1).salvage;
    const brief = chart.querySelector('.tdc-brief');
    brief.innerHTML = `
      <div class="pm-card tdb-card">
        <h1>${md.name}</h1>
        <p class="td-where">${getBiome(stageInfo(md.stage).biome).name} · ${md.waves} waves · start with ${md.startGold + probe.perks.startGold}🪙${probe.dark ? ' · <b>dark</b>: towers only see what\'s lit' : ''}</p>
        <h2>Coming through</h2>
        <div class="tdb-foes">${ids.map((id) => { const d = getEnemy(id); const tw = TOWER_FOR_WEAPON[d.phases ? d.phases[0].counter : d.counter]; return `<span class="td-foe${d.isBoss ? ' boss' : ''}"><i style="background:${d.color}"></i><span>${d.name}</span><em>${ICON[tw]}</em><sub>${enemyTraits(id).filter(([k]) => k !== '☠').map(([k]) => k).slice(0, 2).join('')}</sub></span>`; }).join('')}</div>
        <h2>Your towers</h2>
        <div class="tdb-towers">${TOWER_LIST.map((t) => `<span class="tdb-tw${meta.tdTowers.includes(t.id) ? '' : ' locked'}${need.has(t.id) ? ' need' : ''}"><canvas width="48" height="48" data-t="${t.id}"></canvas><small>${meta.tdTowers.includes(t.id) ? t.short : '🔒'}</small></span>`).join('')}</div>
        ${[...need].some((id) => !meta.tdTowers.includes(id)) ? '<p class="td-tip">Highlighted towers answer enemies here. Locked ones are unlocked at the harbour\'s Tower Yard.</p>' : '<p class="td-tip">Highlighted towers answer the enemies here.</p>'}
        <p class="tdb-reward">★ ${stars}/3 · each new star pays ${per} ⚓${stars < 3 ? ' · 3 stars pays a 🦑 Kraken Scale' : ''}</p>
        <button type="button" class="pm-primary" data-act="go">▶ Defend the reef</button>
        <button type="button" class="pm-btn" data-act="back">← Back to the chart</button>
      </div>
    `;
    for (const cv of brief.querySelectorAll('canvas[data-t]')) drawTowerPortrait(cv, cv.dataset.t, 2);
    brief.querySelector('[data-act="go"]').addEventListener('click', async () => {
      const cp = peekCheckpoint();
      if (cp && !await deps.askConfirm(`Abandon your defence in progress on ${getTdMap(cp.mapId).name}?`, 'Abandon & defend')) return;
      clearCheckpoint(); brief.hidden = true; start(md.id);
    });
    brief.querySelector('[data-act="back"]').addEventListener('click', () => { brief.hidden = true; if (!active) openChart(); else chart.hidden = true; });
    if (active) { stop(); deps.onExit(); }
    chart.hidden = false;
    brief.hidden = false;
  }

  return {
    get active() { return active; },
    frame, openChart, openBrief, start, isChartOpen: () => !chart.hidden,
    hasCheckpoint: () => !!peekCheckpoint(),
    closeChart: () => { chart.hidden = true; },
    // Testing hooks (playtest scripts; not reachable from the UI).
    debug: () => s && {
      map: mapDef.id, gold: s.gold, lives: s.lives, wave: s.waveIndex, over: s.over, outcome: s.outcome, stars: s.stars, landscape,
      towers: s.towers.map((q) => ({ id: q.id, spotId: q.spotId, towerId: q.towerId, level: q.level, spec: q.spec, x: q.x, y: q.y })),
      spots: s.map.spots.map((p) => ({ ...p, ...view.toScreen(p.x, p.y) })),
      enemies: s.enemies.map((e) => ({ id: e.id, defId: e.defId, x: e.x, y: e.y, health: e.health, ...view.toScreen(e.x, e.y) })),
      paused, speed, scale: view.scale,
    },
    debugState: () => s,
    debugSetGold: (g) => { if (s) s.gold = g; },
  };
}

# The Shattered Reef — build log

Read this file first, every session. It replaces a handoff report — update
the "Current status" and "Decisions log" sections at the end of every
session, before anything else.

**Full design PRD** (weapon list, enemy roster, run structure, meta-
progression, vertical slice scope, roadmap, open risks — all in one place):
https://claude.ai/artifact/FwH7vbLuCQ9ao1Hm7bB1KH — this file stays the
authoritative build log/status; the PRD is the design reference, read it
before starting step 3+.

## What this is (pivoted 2026-09-28)

A mobile, single-player nautical roguelite: you captain a ship through
procedurally generated maze-like reef levels, fighting distinct enemy ship/
creature types that each demand reading their niche and countering with the
right weapon, collecting loot and upgrades, and reaching the exit before you
die. Runs are permadeath; a meta-progression hub between runs unlocks
permanent upgrades for the next attempt.

**Design reference:** *Overboard!* (aka *Shipwreckers!*, PS1, 1997,
Psygnosis) — top-down maze-like naval levels, weapon-select-to-counter-
enemy-niche combat (rockets for flyers, depth charges for submerged
enemies, etc.), checkpoints at captured towns. We're keeping the core
"read the enemy, swap the weapon" hook and the maze-level structure, but
*adding* the roguelite layer (procedural generation, permadeath, meta-
progression) that the original didn't have — it was a fixed 20-level
arcade campaign, not a roguelike. See the decisions log for the research
that established this.

**This replaces the project's original concept** (a Hearthstone
Battlegrounds-style card auto-battler). That version got 6 of its own 8
build steps done and fully tested, but after playtesting the vertical
slice the project owner judged a solo auto-battler against heuristic AI
can't realistically compete with a genre defined by years of live human-
opponent balance — a structural ceiling, not a polish problem. Its code is
archived at `archive/card-game-vertical-slice/` (see that folder's own
README) rather than deleted, in case any of it — the data-driven-content
pattern, the AI-tuning-as-data approach — is useful again. The repo and
the name "The Shattered Reef" carry over to this new game.

## Stack rules — do not deviate without discussion

- **Vanilla JS, ES modules (`.mjs`), no build step, no `node_modules`.**
  Deliberately kept from the archived project even though this is now an
  action game like the project owner's other Canvas titles (Briarbloom,
  Keyfall), which use TypeScript/Vite — the whole reason this repo adopted
  no-build in the first place was to avoid the compile-step rework pain
  Briarbloom hit, and that reason doesn't stop applying just because the
  genre changed. Flag it if you'd rather match Briarbloom/Keyfall's stack
  instead; not changing it without that conversation.
- No dependencies. `node --test` (built into Node 22) for tests, no test
  framework. Pure logic (maze generation, physics, collision, weapon/
  enemy data) is unit-tested; rendering and the input/game-loop glue are
  verified with real headless-browser playtesting (Playwright/Chromium),
  since neither is meaningfully unit-testable.
- Canvas 2D for the game world (maze, boat, enemies, projectiles, VFX) —
  not DOM+CSS. This is the opposite call from the card game (which was
  DOM+CSS because it needed crisp text and easy hit-testing, not
  real-time rendering) — a real-time action game with continuous movement
  needs a render surface built for that, not the DOM. Touch controls
  (the virtual joystick) are DOM+CSS overlays on top of the canvas, since
  those genuinely are discrete, styleable UI elements.
- Data-driven content: enemy types, weapons, and (once they exist) ships/
  relics/unlocks live in `src/data/*.mjs` as plain objects, not scattered
  through engine code — same principle as the archived project, still
  correct here.
- Touch-first from day one: no feature ships that only works with a
  mouse/keyboard. Steering is a floating virtual joystick (appears where
  the thumb lands, not a fixed-position stick) via Pointer Events, so it
  works uniformly for touch/mouse/pen without separate code paths.

## Build order

Mirrors the project owner's own stated phased approach (Concept →
Architecture → Vertical slice → Core systems → Content → Polish → Testing
→ Expansion), collapsed into concrete steps for this game:

1. **Concept + architecture** (this doc, the stack rules above) — ✅ done
2. **Core movement + maze** — boat physics (momentum/drag, not tank
   controls), procedural maze generation, tile-grid collision, camera,
   touch joystick — a real playable "steer a weighty boat through a
   generated maze" loop with nothing else in it yet — ✅ done
3. **Combat core** — weapons, projectiles, hit detection, enemy AI with
   niches (the Overboard hook: wrong weapon = little/no effect) — ✅ done
4. Enemy content — 5-6 distinct enemy types + a boss, each with a real
   tactical identity (data for all 5 + boss already written in step 3;
   remaining work here is content/balance passes once playtested more,
   not new archetypes)
5. Loot/economy — weapon pickups, ammo as a resource, in-run currency
6. Roguelike run structure — multi-room progression, exit, permadeath,
   run summary screen
7. Meta-progression hub — persistent currency + unlocks (localStorage)
8. Polish — juice (particles, screen shake, hit-stop, damage numbers),
   audio hooks, mobile safe-area/UX pass

Each step its own commit, each step end-to-end testable headless before
depending on the next, matching how the archived project was built.

**Confirmed next phase after step 8** (not scoped into the build order
yet): playable factions (Blacksail Reavers, Wyrdtide, Iron Accord), a
rock-paper-scissors combat triangle between them, and a Captain's Hub →
proper base with a Workshop (crafting). See the PRD's "Post-Slice
Direction" section and the decisions log below.

## Vertical slice scope (locked 2026-09-28 by the PRD — steps 2-7)

Locked, not a rough target anymore. Full detail (stats, counters, behavior)
lives in the PRD linked at the top of this file; the locked content list:

- **1 ship** (current boat + the Ship Hulls unlock track once step 7 lands)
- **5 weapons**: Cannonballs (default) + Chain Shot, Grapeshot, Depth
  Charges, Flame Barrels — each with one real counter-role, not a stat
  variant of another
- **5 enemy types + 1 boss**: Reef Skimmers (Grapeshot), Gullswarm Harpies
  (Chain Shot), Deep Crawlers (Depth Charges), Ironclad Brigands (Flame
  Barrels), Riggers/Sailcutters (Chain Shot), boss "The Kraken's Anchor"
  (working name, forces a mid-fight weapon swap)
- **1 reef-generation style** (existing room/corridor maze), difficulty
  scaled by size/density across a run rather than multiple generation
  styles
- **3 reefs per run**, fixed sequence, increasing difficulty, hull carries
  over between reefs (no mid-run healing)
- **Minimal meta-progression**: Salvage currency + 3 unlock tracks (Ship
  Hulls, Cargo Loadouts, Captain's Charms), 2-3 tiers each

Out of scope for the slice: multiple biomes, more than one boss, crafting,
quests/NPCs/dialogue, cosmetics, audio beyond hooks, any backend.

## Current status (update this every session)

- **Phase:** step 2 of 8 (core movement + maze) complete. First real
  playable slice of the new game: a touch-controlled boat with momentum/
  drag physics navigating a procedurally generated maze, camera follow,
  no combat/enemies/content yet (that's steps 3+).
- **Just shipped:**
  - `src/engine/maze.mjs` — recursive-backtracker graph maze
    (`generateMazeGraph`), farthest-cell BFS for exit placement
    (`farthestCell`), and conversion to a solid tile grid
    (`buildTileGrid`) where each graph cell becomes an open `room`-tile
    square joined by `wall`-tile-thick corridor gaps — chosen over a
    1-tile-wide corridor maze specifically so a boat with momentum has
    room to actually turn, not just a graph-maze rendered literally.
    `isFullyConnected` double-checks the *tile* grid (not just the graph)
    is fully reachable, since the room/wall conversion is itself a place
    a bug could hide.
  - `src/engine/boat.mjs` — arcade boat physics (`stepBoat`): steers
    toward wherever the stick points (twin-stick feel) but keeps its own
    momentum via drag/turn-rate tuning, not tank controls and not a
    rigid-body sim. `DEFAULT_BOAT_TUNING` holds the numbers.
  - `src/engine/camera.mjs` — frame-rate-independent follow camera,
    clamped to map bounds.
  - `src/engine/renderer.mjs` — Canvas 2D drawing for the tile grid, the
    exit marker, and the boat (placeholder shapes on purpose — no art
    pass yet, per the project's own quality bar that gets a real pass
    once the loop is proven, not before).
  - `src/input/joystick.mjs` — a single floating virtual joystick,
    Pointer-Events-based (touch/mouse/pen uniformly), reused the pattern
    from the archived project's touch drag-drop code.
  - `src/engine/run.mjs` — assembles one run's level from a seed: maze +
    tile grid + boat spawn (start cell) + exit (farthest cell). Pure and
    deterministic — same seed, same level, same spawn, same exit.
  - `src/main.mjs` — boots canvas/DOM, the game loop, wires input →
    physics → collision → camera → render. Tap the HUD once the exit is
    reached to generate a fresh run (placeholder "next run" flow — the
    real roguelike run structure is step 6).
  - New tests: `tests/maze.test.mjs` (graph connectivity, determinism,
    tile-grid connectivity/dimensions, exit reachability),
    `tests/boat.test.mjs` (rest/acceleration/max-speed/drag/turning,
    collision stops the boat at a wall, **a regression test for a real
    bug found this session** — see below), `tests/run.test.mjs`
    (determinism, boat spawns in open water, exit reachable, one-shot
    exit trigger). **96/96 tests pass** across the whole repo.
- **Real bug found and fixed via headless-browser playtesting (not just
  `node --test`, which couldn't have caught this — it's a live-physics-
  over-many-frames bug):** the first version of `resolveTileCollision`
  resolved each axis independently using "push toward whichever tile edge
  is closer to the boat's center," with the *last* overlapping tile in
  the scan order winning outright when several were solid at once. At a
  2-tile-thick wall corner (`wall: 2` in the maze config), the boat could
  end up genuinely overlapping two adjacent solid tiles with
  contradictory push directions; the heuristic could pick the one that
  pushed it *into* a different solid tile rather than out of the wall
  entirely. Once embedded, every subsequent frame found it still
  overlapping solid ground one column further over and pushed it another
  full tile-width sideways — the boat walked through solid rock forever,
  in a real playtest observed flying to `x ≈ -1211` (map is ~1184px
  wide) within about two seconds of normal-looking steering into a
  corner. Fixed by replacing the per-axis heuristic with a proper
  minimum-translation-vector resolver (`deepestOverlap` in `boat.mjs`):
  find the single most-deeply-penetrating solid tile, push out along its
  actual normal by exactly the penetration depth, repeat up to 4 passes
  so a genuine corner (two tiles overlapping at once) converges instead
  of fighting itself. Every push now strictly reduces total penetration,
  which has no equivalent failure mode. Added a regression test
  reproducing the exact geometry that broke it
  (`tests/boat.test.mjs`, "never lets the boat escape through a 2-tile-
  thick wall corner"). Verified fixed with the same headless-browser
  scenario that found it, plus a 24-direction stress test (drag in every
  compass direction, confirm the boat never leaves plausible map bounds)
  — no more escapes, no console errors.
- **Verified end-to-end in a real headless browser (Playwright/
  Chromium):** page loads with no console errors; maze + boat render
  correctly (screenshotted); dragging the virtual joystick moves and
  turns the boat with visible momentum; collision stops the boat at
  walls and lets it slide along them; the 24-direction stress test and 5
  repeats of the bug's original repro scenario all stayed within bounds
  after the fix.
- **Same-session follow-up patch, step 2 (feedback from the first real
  playtest):** drift felt excessive — the boat kept coasting into walls
  after the stick was released. Two things fixed together, since they're
  the same underlying complaint ("hitting a wall should mean something,
  and I shouldn't be sliding into it by accident"):
  - Retuned `DEFAULT_BOAT_TUNING` in `boat.mjs`: `drag` 1.1 → 2.4 (coast
    distance after a full-throttle release dropped from a genre-
    inappropriate ~85px down to ~37px, about 2.3 tiles), `turnRate`
    ×1.6π → ×2.2π (turns fast enough to actually dodge a wall you see
    coming), `maxSpeed` 140 → 120. Acceleration left close to where it
    was (260 → 240) — the fix is stopping/turning faster, not going
    slower.
  - Added hull damage on a genuine wall impact: `resolveTileCollision`
    now returns the inward impact speed (the velocity component along
    the collision normal at the moment of a fresh hit) instead of a
    void; `applyWallImpactDamage(boat, impactSpeed)` converts that into
    "miniscule" hull loss above a threshold (grazes under 40px/s of
    inward speed do nothing). This falls out of the physics almost for
    free: sliding along a wall you're already resting against reports
    ~0 impact speed on every subsequent frame, because the inward
    velocity component was already cancelled the frame contact started
    — only a fresh, hard hit costs hull. `boat.mjs` itself never touches
    `boat.health` beyond that one function, keeping physics decoupled
    from game-state; `run.mjs` gained `checkSunk()` (mirrors
    `checkReachedExit()`) so 0 hull ends the run same as reaching the
    exit does. `run.complete` renamed to `run.over` + `run.outcome`
    (`'exit' | 'sunk'`) to carry which ending happened.
  - `main.mjs` / `styles.css`: a hull bar in the HUD (green → red under
    30%), a brief red screen-flash on any hit that actually deals
    damage, and a "Your ship has sunk!" end state parallel to the
    existing "reef cleared" one.
  - New/updated tests: `boat.test.mjs` gained coverage for impact-speed
    reporting (0 when idle, a real value on a head-on hit, back to ~0
    while sliding) and `applyWallImpactDamage` (grazes ignored, hits
    scaled small, clamped at 0 hull); `run.test.mjs` updated for the
    `over`/`outcome` rename and gained `checkSunk` coverage plus a test
    that exit and sunk are mutually exclusive. **104/104 tests pass.**
  - Verified in a real headless browser: repeatedly driving hard into a
    wall shows the hull bar tick down on the first hit, then hold steady
    while the boat slides along the same wall afterward (no continuous
    chip damage from contact alone) — matches the intent exactly. No
    console errors.
- **Phase:** step 3 of 8 (combat core) complete, following the PRD written
  earlier this session. Weapons, projectiles, hit detection, and enemy AI
  with niches are in and playtested; the counter-swap hook (wrong weapon =
  little/no effect) reads correctly in real play.
- **Just shipped:**
  - `src/data/weapons.mjs` — the 5 locked weapons (Cannonballs default +
    Chain Shot, Grapeshot, Depth Charges, Flame Barrels), each with
    `damage`/`offCounterFraction` — full damage only against the enemy
    whose `counter` matches the weapon id, a small fraction otherwise
    (Cannonballs keeps a much higher fraction — always a usable fallback,
    never a real counter). `damageAgainst(weapon, enemyCounterId)` is the
    one function that encodes the whole hook.
  - `src/data/enemies.mjs` — the 5 locked enemy types + boss, each with an
    `archetype` (SWARM/FLYER/SUBMERGED/TANK/FLANKER) driving distinct
    movement/attack behavior and exactly one `counter` weapon. The boss
    (`krakens_anchor`) has a `phases` array (submerged → tank, 14s each)
    that overrides its counter/archetype live. `spawnPoolForReefIndex`
    encodes the early-reef-easy/later-reef-mixed spawn mix from the PRD.
  - `src/engine/combat.mjs` — weapon state (active weapon, ammo, cooldown),
    `tryFire` (spawns 1+ pellets per shot per weapon, respects
    cooldown/ammo), `stepCombat` (projectile movement, range/wall/fuse
    expiry), `resolveHits` (circle-vs-circle for direct-hit weapons, a
    proper AoE blast-radius check for Depth Charges once their fuse
    expires, attaches a burn DoT status for Flame Barrels), `stepBurn`
    (ticks burn damage on its own schedule). Deliberately mirrors
    `boat.mjs`'s "pure logic, no rendering" split.
  - `src/engine/enemies.mjs` — `createEnemy`/`spawnReefEnemies` (places a
    reef's roster on open tiles away from spawn/exit; a Reef Skimmer pick
    spawns its whole pack at once) and `updateEnemy`, with one movement
    function per archetype: SWARM closes in then orbits at an engage
    radius, FLYER circles then dive-bombs and **deliberately ignores tile
    collision** (flies over rock the boat can't reach — ARCHETYPES.FLYER
    is the one archetype `updateEnemy` skips `resolveTileCollision` for),
    SUBMERGED alternates invulnerable-hidden and vulnerable-surfaced on a
    timer, TANK beelines, FLANKER tries to hold a perpendicular offset
    from the boat's heading. All non-flyer archetypes reuse
    `boat.mjs`'s exported `resolveTileCollision` directly — it's generic
    over any `{x,y,vx,vy}` object, not boat-specific, so no separate
    enemy-collision code was needed. `resolveEnemyContact` deals contact
    damage to the boat on a per-enemy cooldown and — Riggers only — jams
    the boat's turn rate briefly (`boat.turnJamRemaining`), matching the
    PRD's "left alone they degrade the player's control" identity.
  - `src/engine/run.mjs` — `createRun` now also spawns a reef's enemies and
    a fresh `weapons` state, and tracks a `salvage` tally. **Deliberately
    scoped down from the PRD's full 3-reef/banking run structure** — that
    belongs to step 6 (Roguelike run structure); step 3 just proves combat
    works inside the existing single-reef test arena, per "each step its
    own commit... don't build every feature simultaneously."
  - `src/main.mjs` — weapon-select bar (5 buttons, ammo shown, tap swaps
    active weapon), a dedicated fire button, and the combat step wired
    into the frame loop (fire → step projectiles → enemy AI → resolve hits
    → burn ticks → enemy contact damage → hull/salvage UI updates).
    **Firing uses aim-assist** (nearest live enemy within the active
    weapon's range; falls back to the boat's own facing) rather than
    manual second-stick aiming — flagged in the PRD's Open Risks as the
    riskiest one-handed-UX call in the whole design; revisit if
    playtesting says it feels wrong.
  - `src/engine/renderer.mjs` — `drawEnemy(s)`/`drawProjectile(s)`:
    placeholder colored-disc enemies (per-archetype color from their data
    definition), a translucent ring while invulnerable, a flickering
    overlay while burning, and a health bar that only appears once an
    enemy has taken damage.
  - New tests: `tests/combat.test.mjs` (cooldown/ammo, counter vs.
    off-counter damage, invulnerable enemies take no damage, Depth
    Charges' AoE hits everyone in the blast and no one outside it, Flame
    Barrels' burn keeps ticking after the initial hit) and
    `tests/enemies.test.mjs` (spawn placement/pack-spawning, one behavior
    test per archetype including the Flyer's deliberate wall-ignoring and
    the Submerged/surfaced cycle, contact damage + cooldown + the Rigger
    jam). **128/128 tests pass** across the whole repo.
  - **Real bug found via headless-browser playtesting (not just
    `node --test`):** the fire button's `pointerup`/`pointercancel`/
    `pointerleave` handlers cleared `isFiring` unconditionally, without
    checking which pointer triggered them. `pointerleave` fires for *any*
    pointer that crosses an element's bounds, not just the one that
    pressed it — so on a real phone, a second finger steering the
    joystick anywhere near the fire button's screen region could silently
    cancel firing, with no error and no obvious cause. `node --test`
    can't catch this (it's a real multi-pointer DOM interaction); found it
    by driving two independent simulated pointers in Playwright and
    noticing kills never happened despite the fire button visibly "held."
    Fixed by tracking the specific `pointerId` that pressed the button and
    only clearing `isFiring` when that same pointer ends, dropping
    `pointerleave` entirely as a stop signal. Verified fixed: re-ran the
    same two-pointer scenario and confirmed enemies now take damage and
    die while a second pointer drags the joystick nearby.
  - Verified end-to-end in a real headless browser: weapon-select bar and
    fire button render and work; ammo counters decrement and Cannonballs
    shows ∞; holding fire while chasing enemies deals damage, kills them,
    and banks Salvage in the HUD; **Chain Shot (a Gullswarm Harpy's real
    counter) killed one in ~13 engagement ticks** in the same test where
    Cannonballs alone only chipped a Harpy down to ~27% health over a
    comparable stretch — the counter-swap hook is reading correctly, not
    just theoretically correct in the data. No console errors across every
    playtest run this session.
- **Phase:** step 5 of 8 (loot/economy) complete. Weapon availability
  changed from "all 5 held from the start" (step 3's placeholder) to the
  PRD's actual design: only Cannonballs is held at run start, and the four
  niche weapons must be found in-run via weapon cache pickups. Salvage is
  now a real found resource instead of only an enemy-kill drop.
- **Just shipped:**
  - `src/data/pickups.mjs` — `PICKUP_KINDS` (`WEAPON_CACHE`, `SALVAGE`),
    `CACHE_WEAPON_IDS` (the 4 niche weapons — Cannonballs needs no cache),
    `PICKUP_TUNING` (cache/salvage pickup radii, `weaponCacheAmmoFraction:
    0.5`, Salvage range [3,6] per pickup, 6 Salvage pickups/reef), and
    `weaponCacheAmount(weaponId)`.
  - `src/engine/pickups.mjs` — `spawnReefPickups` (one weapon cache per
    niche weapon + 6 Salvage pickups, placed on open tiles away from the
    boat spawn — mirrors `enemies.mjs`'s `spawnReefEnemies` placement
    logic exactly) and `collectPickups` (circle-vs-circle proximity check
    each frame, same style as `resolveEnemyContact`/`resolveHits`; applies
    the pickup's effect and returns `{kind, weaponId?, amount,
    freshUnlock?}` events; marks `collected` in place rather than
    splicing, so nothing shifts under a caller mid-iteration).
  - `src/engine/combat.mjs` — reworked the held-weapon model:
    `createWeaponState()` now starts with niche-weapon ammo at 0 and a
    `heldWeapons` Set containing only Cannonballs; `setActiveWeapon()`
    returns a boolean and refuses to switch to an unheld weapon;
    `canFire()` also checks `isHeld`; new `isHeld(state, weaponId)` and
    `collectWeaponCache(state, weaponId, amount)` (clamps at `ammoMax`,
    returns whether this was a fresh unlock vs. a refill). This corrects
    a real gap from step 3, which had quietly diverged from the PRD's own
    Weapons/Meta-Progression sections (ammo "restocked by pickups";
    starting with the full kit is what the Cargo Loadouts *unlock* is
    supposed to grant, not the default).
  - `src/engine/run.mjs` — `createRun` now also calls `spawnReefPickups`
    and returns `pickups` on the run object.
  - `src/engine/renderer.mjs` — `drawPickup`/`drawPickups`: a bobbing
    diamond with a 2-letter weapon-code label for weapon caches, a small
    bobbing dot for Salvage; both skip already-`collected` pickups.
  - `src/main.mjs` — weapon-select buttons now show a 🔒 instead of an
    ammo count and can't be tapped active while unheld (`updateWeaponBar`
    reads `isHeld`); the frame loop calls `collectPickups` each frame and
    routes its events to `updateWeaponBar()` + a toast ("New weapon: X!"
    / "X restocked") for weapon caches, and `run.salvage +=
    amount`/`updateSalvageCounter()` for Salvage; added a `#pickup-toast`
    HUD element (`styles.css`) that shows briefly rather than overwriting
    the persistent "Find the exit" status text; `drawPickups(...)` added
    to the render pass; `__shatteredReefDebug()` extended with
    `heldWeapons`, `pickupsRemaining`, and per-pickup state; added a
    testing-only `__shatteredReefWarp(x, y)` teleport hook (not reachable
    from any in-game UI) since a headless test driving the touch joystick
    has no maze pathfinding and can't reliably steer to a pickup across a
    generated maze — that's a test-harness limitation, not a game concern
    (real navigation was already proven in step 2's playtesting).
  - New `tests/pickups.test.mjs` (spawn placement/determinism/pickup
    counts, weapon-cache unlock vs. refill vs. already-collected,
    Salvage collection, proximity gating) plus 5 new tests in
    `tests/combat.test.mjs` for the held-weapon-set behavior
    (`isHeld`/`setActiveWeapon` refusing an unheld weapon/`canFire`
    refusing to fire one/`collectWeaponCache` unlock vs. refill).
    **141/141 tests pass** across the whole repo.
  - Verified end-to-end in a real headless browser: a fresh run holds
    only Cannonballs (4 locked weapon buttons shown with 🔒); warping the
    boat onto each of the reef's 10 pickups (4 weapon caches + 6 Salvage)
    collected all of them, unlocked all 4 niche weapons with the correct
    starting ammo (`weaponCacheAmount`), showed the "New weapon!" toast,
    banked 29 Salvage into the HUD counter matching `run.salvage` exactly,
    and cleared every locked-button indicator; tapping a newly-unlocked
    weapon button correctly switched the active weapon; re-visiting an
    already-collected cache's spot did not re-collect it (`collected`
    flag holds). No console errors (only a benign `favicon.ico` 404 from
    the test server itself).
- **Phase:** step 6 of 8 (roguelike run structure) complete. A run is now
  a real 3-reef voyage, not three independent single-reef sessions: the
  exit advances you to the *next* reef (bigger, denser, harder) rather
  than generating an unrelated fresh run, the boat/hull/weapons/ammo carry
  over between reefs with no mid-run healing, Salvage has genuine
  permadeath stakes (at risk until banked at a reef's exit), and a proper
  run summary screen replaces the old "tap anywhere to continue" hack.
- **Just shipped:**
  - `src/engine/run.mjs` — rewritten around a whole voyage instead of one
    reef. `createRun(seed)` now takes only a seed (no more `{cols, rows,
    room, wall, reefIndex}` options object) and threads *one* seeded rng
    through every reef in the voyage, so a whole run — not just one reef
    in isolation — is deterministic and replayable from its seed.
    `REEF_TUNING` (a 3-entry table: 7×7/7 enemies → 9×9/10 → 11×11/13)
    replaces the old fixed single-arena size, giving the "difficulty
    scaled by size/density across a run" the PRD calls for. New
    `enterReef(run, reefIndex)` (internal) rebuilds the maze/grid/exit/
    enemies/pickups and repositions the boat at the new spawn — clearing
    velocity/heading/turn-jam but leaving hull and weapon/ammo state
    untouched, since those are meant to carry over.
  - Salvage is now two numbers instead of one flat tally: `bankedSalvage`
    (safe, from every reef already cleared) and `reefSalvage` (at risk,
    collected in the reef currently in progress). New `addSalvage(run,
    amount)` always adds to the at-risk pile; new `totalSalvage(run)` is
    what the HUD actually displays (banked + at-risk combined, since
    that's what the player is currently "carrying"). `checkReachedExit`
    banks `reefSalvage` into `bankedSalvage` the moment an exit is
    reached — before deciding whether that was the final reef.
  - `checkReachedExit(run)` changed from a boolean to a 3-way result:
    `null` (not there yet), `'advanced'` (this reef's exit was reached,
    Salvage banked, next reef built — run stays in progress), or
    `'victory'` (the *final* reef's exit was reached — the whole run
    ends). `checkSunk(run)` is unchanged in shape but now carries real
    weight: it ends the *entire voyage*, not just the current reef, and
    whatever was still in `reefSalvage` (not yet banked) is lost —
    that's the actual permadeath stakes the build order always specified,
    not implemented until now.
  - `src/main.mjs` — a `#reef-indicator` HUD chip ("Reef N/3") alongside
    the Salvage counter; the frame loop now branches on
    `checkReachedExit`'s 3-way result (a toast + reef-indicator/status
    update + camera snap to the new spawn on `'advanced'`, a run summary
    on `'victory'`); a new `#run-summary` overlay (full-screen, a card
    with outcome title, reefs-cleared/Salvage-banked/Salvage-lost/
    weapons-found stats, and a "Sail again" button) replaces the old
    "tap the HUD to continue" flow entirely — the old `tapToContinue`
    listener is gone. Two more testing-only debug hooks alongside the
    existing warp one: `__shatteredReefSetHull(hp)` and
    `__shatteredReefAddSalvage(amount)`, both unreachable from any
    in-game UI — added because reliably reproducing "sank with unbanked
    Salvage at risk" through simulated pointer input alone isn't
    practical (the wall-impact damage path itself was already proven
    correct in step 2's own dedicated playtesting; this is purely about
    testing what happens *after* a sink).
  - `src/ui/styles.css` — `#stat-row`/`#reef-indicator` layout, and the
    `#run-summary` overlay (dimmed backdrop, centered card, a highlighted
    ".lost" line for Salvage that went down with the ship).
  - `tests/run.test.mjs` rewritten for the new API (11 tests: multi-reef
    determinism including enemies/pickups, the fresh-run starting state,
    `addSalvage`/`totalSalvage`'s at-risk-until-banked behavior,
    `'advanced'` banking-and-repositioning, `'victory'` on the final
    reef banking everything, `checkSunk` losing only the still-at-risk
    reef's Salvage while earlier banked Salvage survives, exit/sunk
    mutual exclusivity re-derived for the 3-reef sequence). **146/146
    tests pass** across the whole repo.
  - Verified end-to-end in a real headless browser: a fresh run starts on
    "Reef 1/3"; warping to each reef's exit in turn correctly advances
    reef 1→2→3 (reef indicator and toast update each time, camera snaps
    to the new spawn instead of panning across the old map); the final
    reef's exit ends the run with `outcome: 'victory'` and shows the
    summary overlay with correct stats; "Sail again" starts a genuinely
    fresh run (reef 1, Salvage 0, no leftover overlay); separately,
    banking one reef's Salvage, collecting more in the next, then setting
    hull to 0 correctly ends the whole run with `outcome: 'sunk'`,
    "Reefs cleared: 1/3", the banked amount preserved, and the still-at-
    risk amount shown as "Salvage lost with the ship" — the permadeath
    stakes read correctly, not just theoretically correct in the data.
    No console errors (only the same benign `favicon.ico` 404 from the
    test server).
- **Phase:** step 7 of 8 (meta-progression hub) complete. The app now
  opens on a Captain's Hub screen instead of straight into a run:
  persistent Salvage (survives across *runs*, in `localStorage` — distinct
  from a single run's `bankedSalvage`/`reefSalvage`, which stay reset each
  voyage) is spent there on the PRD's 3 locked unlock tracks, and "Set
  Sail" resolves the current loadout into a fresh run.
- **Just shipped:**
  - `src/data/meta.mjs` — the 3 unlock tracks' content: **Ship Hulls**
    (Sloop/Longboat/Skiff — mutually exclusive, one selected at a time,
    each with its own `maxHull` and accel/speed/turn/drag multipliers
    applied on top of `DEFAULT_BOAT_TUNING` via `tuningForHull`),
    **Cargo Loadouts** (Forward Magazine/Chain Locker/Deep Stores —
    permanent and stacking, each either boosting starting ammo or
    granting a niche weapon held from run start; `cargoLoadoutFor`
    combines every owned tier additively), and **Captain's Charms**
    (Steady Hands/Last Gasp/First Haul — permanent and stacking, matching
    the PRD's own literal examples: passive ammo regen, a once-per-run
    revive at 1 hull, and a 1.5x Salvage bonus on the first reef only).
    All costs/multipliers are a first-pass balance with no real
    playtesting data yet — the PRD deliberately left exact numbers open —
    documented as such, expect retuning.
  - `src/engine/meta.mjs` — persistence + purchase logic. `loadMeta`/
    `saveMeta` take an injected `storage` object (`{getItem, setItem}`)
    rather than reaching for `window.localStorage` globally, so this
    module stays pure/unit-testable like the rest of `engine/*.mjs` (only
    `main.mjs` passes the real `window.localStorage`; tests use an
    in-memory fake). Never throws — a missing key, disabled storage, or
    corrupt/partial JSON all degrade to `createDefaultMeta()` rather than
    crashing the app over save data, and `loadMeta` merges field-by-field
    onto the defaults so an older save missing a newer field still loads
    cleanly. `purchaseHull`/`purchaseCargoTier`/`purchaseCharm` each
    check ownership + affordability and return `{ok, reason?}`;
    `resolveLoadout(meta)` is the one place raw ownership arrays turn
    into the plain loadout object `createRun` expects —
    **`run.mjs` never reads raw unlock state itself**, only this resolved
    shape, mirroring the existing "resolve then hand to run.mjs" pattern
    from `spawnPoolForReefIndex`. `recordRunResult(meta, run)` folds a
    finished voyage's `bankedSalvage` and best-run stats into the
    persistent meta state.
  - `src/engine/boat.mjs` — `createBoat(x, y, heading, maxHull = MAX_HULL)`
    takes an optional max-hull override so a selected hull's capacity is
    stored on the boat itself.
  - `src/engine/combat.mjs` — `createWeaponState(extraHeldWeapons = [],
    startingAmmoMultiplier = 1)` grants Cargo Loadout weapons held from
    run start with ammo scaled by the multiplier (clamped at max); new
    `stepAmmoRegen(state, dt)` drives the Steady Hands charm — a
    per-weapon accumulator (`ammoRegenAccum`) so fractional regen rates
    (e.g. 1 ammo per 8 seconds) accumulate correctly across frames.
  - `src/engine/run.mjs` — `createRun(seed, loadout = BASELINE_LOADOUT)`
    applies the resolved hull's tuning/max-hull, held weapons, and ammo
    bonus; `addSalvage` applies First Haul's 1.5x multiplier while
    `reefIndex === 0`; `checkSunk` gained a third return value —
    `'revived'` — when Last Gasp is owned and hasn't fired yet this run
    (patches hull to 1 and lets the voyage continue instead of ending it).
    `BASELINE_LOADOUT` (Sloop, no extra weapons/ammo bonus, no charms) is
    the default for every existing call site/test that predates step 7,
    kept backward-compatible via default parameters.
  - `src/main.mjs` — a `#captains-hub` overlay (Salvage total, best-run
    stats, a row per Ship Hull/Cargo Loadout/Captain's Charm with a
    Buy/Select/Owned button reflecting real affordability and ownership)
    shown on boot instead of starting a run immediately; `renderHub()`
    rebuilds it from `meta` after every purchase. "Set Sail" resolves
    `resolveLoadout(meta)` into a fresh `createRun` and hides the hub;
    the run-summary screen's button is now "Return to Hub" instead of
    restarting a run directly, and a run ending (`checkSunk === true` or
    `checkReachedExit === 'victory'`) now calls `recordRunResult` +
    `saveMeta` before showing the summary, so the Hub reflects the just-
    finished voyage's earnings the moment it reopens. Fixed two real
    correctness gaps this surfaced: (1) the frame loop's old
    `if (checkSunk(run))` was a plain truthy check, which would have
    mistreated the new `'revived'` string as "game over" — replaced with
    an explicit three-way branch (`true` / `'revived'` / `else`); (2) the
    boat-physics step was hardcoded to the raw `DEFAULT_BOAT_TUNING`
    constant regardless of the selected hull — changed to `run.tuning`
    (the hull-adjusted tuning `createRun` now computes and stores), so a
    Longboat/Skiff's actual stat differences apply in play, not just in
    data. `updateHullBar()` now reads `run.boat.maxHull` instead of the
    fixed `MAX_HULL` constant, since hull capacity now varies. Added a
    `stepAmmoRegen(run.weapons, dt)` call to the frame loop (previously
    written but never wired in). Overlay stacking (Hub/run-summary over
    the canvas/HUD/fire button/toast) now uses explicit `z-index` in
    `styles.css` instead of relying on DOM append order, which was a
    latent risk flagged but not yet fixed in step 6. New testing-only
    debug hook `__shatteredReefAddHubSalvage(amount)` (grants persistent
    Salvage directly, unreachable from any in-game UI) alongside the
    existing warp/hull/salvage hooks, and `__shatteredReefDebug()` now
    also reports `sailing`, `hubOpen`, `maxHull`, and a `meta` snapshot.
  - New `tests/meta.test.mjs` (19 tests: `tuningForHull`,
    `cargoLoadoutFor`, `createDefaultMeta`, `loadMeta`/`saveMeta`
    round-trips and corrupt/partial-JSON/disabled-storage edge cases, all
    3 purchase functions' ownership/affordability checks, `resolveLoadout`,
    `recordRunResult`, and `run.mjs` integration — hull tuning/max-hull
    applied, Cargo Loadout weapons/ammo applied, Last Gasp reviving
    exactly once then letting a second sink end the run, First Haul
    boosting only reef-1 Salvage) plus 5 new tests in
    `tests/combat.test.mjs` for extra-held-weapons/ammo-multiplier
    behavior and `stepAmmoRegen` (no-op at 0 rate, gradual regen clamped
    at max, never touches Cannonballs' unlimited ammo). **169/169 tests
    pass** across the whole repo.
  - **Real bug found via the test suite itself (not a playtest — a pure
    float-precision issue `node --test` was well-suited to catch):**
    `stepAmmoRegen`'s first version used `Math.floor(accum)` to decide
    how much ammo to grant from the accumulated regen time. A test
    driving it with `dt = 3.4` then `dt = 0.6` at a rate of 1 ammo/sec
    expected 4 ammo gained (3.4 + 0.6 = 4.0 seconds → 4 ammo) but got 3 —
    `3.4 - 3` in IEEE 754 double precision evaluates to
    `0.39999999999999947`, not exactly `0.4`, so `0.4 + 0.6` (really
    `0.39999999999999947 + 0.6`) came out to `0.9999999999999994`, and
    `Math.floor` of that silently dropped a tick that should have fired.
    Fixed with a tiny epsilon guard (`Math.floor(accum + 1e-9)`) — worth
    remembering as a general lesson: any "accumulate a fractional rate
    over frame-by-frame `dt` calls, then floor to a whole unit" pattern
    (ammo regen here; the same shape would apply to, say, a future
    resource-tick or regen system) needs this guard, since the bug isn't
    about picking "nice" test numbers — ordinary variable frame times
    hit the same float-drift case in real play, just less predictably.
  - Verified end-to-end in a real headless browser (Playwright/Chromium):
    the Hub shows on load with only the Sloop owned/selected and every
    other item's Buy button correctly disabled (can't afford, salvage 0);
    granting Hub Salvage immediately re-enables affordable buttons;
    buying the Longboat hull deducts its cost, adds it to `ownedHulls`,
    and auto-selects it; buying a Cargo Loadout tier and a Charm both
    deduct cost and add to their owned lists; "Set Sail" starts a run
    whose `boat.maxHull` is 140 (the Longboat's value, not the base 100)
    and whose held weapons include Chain Shot from run start (the Chain
    Locker tier) — the loadout demonstrably reached the actual run, not
    just the data layer. Forcing hull to 0 with Last Gasp owned revives
    the boat at 1 hull and the run continues (`over: false`); forcing it
    to 0 again ends the run for real (`outcome: 'sunk'`), shows the run
    summary, and immediately folds that voyage's Salvage into the Hub's
    persistent total. Clicking "Return to Hub" reopens the Hub reflecting
    the updated stats. **Reloading the page from scratch preserves every
    purchase, the selected hull, and the accumulated stats** — persistence
    genuinely round-trips through `localStorage`, not just within the
    live session. Separately verified Steady Hands/First Haul in actual
    play (not just unit tests): sailing with First Haul owned and adding
    Salvage while on reef 1 applied the exact 1.5x multiplier (100 →
    150). No console errors in any run (only the same benign
    `favicon.ico` 404 from the test server seen in every prior step's
    playtest).
- **Not built yet:** art pass, audio, juice/polish (step 8), and the boss
  ("The Kraken's Anchor") is defined in data but never actually spawned
  anywhere yet — worth deciding whether it belongs on the final reef as
  this voyage structure's natural finale, or stays deferred; flagged
  below as an open question rather than silently resolved.
- **Next up:** step 8, polish — juice (particles, screen shake, hit-stop,
  damage numbers), audio hooks, and a mobile safe-area/UX pass. The
  vertical slice's locked scope (steps 2-7) is now fully built end to end:
  navigation, combat, loot, a full 3-reef roguelike run structure, and
  persistent meta-progression between runs.

## Decisions log

*(Entries from the archived card-game project's own decisions log live in
that project's history — see `archive/card-game-vertical-slice/` and this
file's git history before 2026-09-28 if that context is ever needed again.
Starting fresh below for the new game.)*

- 2026-09-28: Pivoted from a Hearthstone-Battlegrounds-style card
  auto-battler to a nautical roguelite maze-battler, after the project
  owner playtested the card game's step-6 vertical slice and judged the
  genre itself (solo vs. heuristic AI, no live human-balance texture) has
  a ceiling that more build steps wouldn't fix. Kept the same repo and
  project name per the owner's explicit instruction. Old code archived,
  not deleted, at `archive/card-game-vertical-slice/`.
- 2026-09-28: Researched the reference game properly before building
  anything (project owner recalled it from memory as "PS1 or PS2,
  possibly roguelike") rather than taking the description at face value:
  confirmed via Wikipedia and a dedicated retrospective
  (collectionchamber.blogspot.com) that it's *Overboard!* / *Shipwreckers!*
  (PS1, 1997), and that it is **not** actually a roguelike — it's a fixed
  20-level arcade campaign with checkpoints, no procedural generation or
  permadeath. We're deliberately keeping its real hook (maze-like levels,
  weapon-matches-enemy-niche combat) and *adding* genuine roguelite
  structure (procedural mazes, permadeath, meta-progression) on top,
  rather than mis-describing the original as something it wasn't.
- 2026-09-28: Kept the vanilla-JS/no-build-step stack rule from the
  archived project even though this is now a real-time action game like
  the project owner's other Canvas titles (Briarbloom, Keyfall), which
  use TypeScript/Vite. The reason this repo went no-build in the first
  place (avoiding the exact compile-step rework pain Briarbloom hit)
  doesn't stop applying just because the genre changed — but flagged
  explicitly here since it's a real divergence from the sibling projects'
  stack, worth a second look if it starts to hurt.
- 2026-09-28: Switched from DOM+CSS (the card game's choice) to Canvas 2D
  for the game world — the card game picked DOM+CSS specifically because
  it needed crisp text and easy hit-testing on a static-ish board; this
  game needs continuous real-time movement and rendering, which is
  exactly what DOM+CSS is the wrong tool for. Touch controls stay as a
  DOM+CSS overlay on top of the canvas (a floating virtual joystick),
  since that's genuinely discrete, styleable UI, not the game world.
- 2026-09-28: Maze tile grid uses `room`-tile-wide open squares per graph
  cell joined by `wall`-tile-thick corridor gaps (defaults `room: 6,
  wall: 2`), not a literal 1-tile-wide corridor rendering of the graph
  maze — a boat with momentum needs actual room to turn; a 1-wide
  corridor maze would make every turn a wall-bounce.
  - 2026-09-28: The boat steers toward the stick's direction (twin-stick
  feel) rather than tank controls (forward/back + turn), even though the
  reference game (Overboard!) used tank controls — tank controls fit a
  physical d-pad; a touch stick maps far more naturally to "point where
  you want to go." The *weight*/momentum feel that makes it feel like a
  ship instead of a car comes entirely from the drag/turn-rate tuning,
  not from the control scheme.
- 2026-09-28: `resolveTileCollision` uses a minimum-translation-vector
  resolver (deepest single overlap, pushed out along its real normal, up
  to 4 passes) rather than the initially-simpler per-axis "closest edge"
  heuristic — the simpler version had a real, playtest-found failure mode
  at multi-tile-thick wall corners (see Current status). Worth remembering
  as a general lesson for this project: axis-independent tile collision
  heuristics are a trap the moment walls are more than 1 tile thick;
  proper 2D penetration resolution doesn't have that failure class.
- 2026-09-28: Wall-impact hull damage keys off *inward impact speed at the
  moment of a fresh hit*, not "is the boat currently touching a wall" —
  the latter would chip hull continuously while merely sliding along a
  wall, which isn't "smashing into the side," it's normal maze
  navigation. Tied damage to the same physics quantity the collision
  resolver already cancels (the velocity component along the collision
  normal) rather than inventing a separate damage-detection mechanism,
  so "sliding = free, ramming = costly" falls out of the existing
  physics instead of needing its own state tracking.
- 2026-09-28: Wrote a full PRD (linked at the top of this file) before
  starting step 3, resolving all three previously-open design questions:
  weapon list + enemy counters (5 weapons, 5 enemies + boss, each with one
  real counter-role), run structure (3 reefs per run, fixed sequence,
  Salvage banked per-reef, hull carries over with no mid-run healing), and
  meta-progression (Salvage currency, Captain's Hub, 3 unlock tracks — Ship
  Hulls, Cargo Loadouts, Captain's Charms). Also flagged real open risks in
  the PRD's own "Open Risks" section (firing control UX untested, one-
  handed weapon-select on phone screens is the riskiest UI element, 3
  reefs/run is a guess at session length) — those are prototyping/
  playtesting questions to revisit during steps 3-6, not blockers to
  starting.
- 2026-09-28: Combat firing uses aim-assist (nearest live enemy within the
  active weapon's range, falling back to the boat's own facing) rather
  than a manual second-stick/tap-to-aim scheme — the PRD flagged this as
  genuinely undecided, and manual aiming would compete with the movement
  joystick for the same hand/thumb, working against the touch-first
  principle. Chosen as the practical default for step 3's implementation;
  explicitly provisional, revisit if it feels bad in play.
- 2026-09-28: Enemy tile collision reuses `boat.mjs`'s exported
  `resolveTileCollision` as-is rather than writing separate enemy-specific
  collision code — it was already generic over any `{x,y,vx,vy}` object,
  not boat-specific, so no duplication was needed. Flyers are the one
  archetype that skips it entirely (they're meant to cross rock the boat
  can't), handled with a simple `archetype !== FLYER` check in
  `updateEnemy` rather than a second collision code path.
- 2026-09-28: `run.mjs`'s step-3 wiring deliberately stops short of the
  PRD's full 3-reef/Salvage-banking run structure — `run.salvage` is a
  flat tally for now, not banked-per-reef with permadeath stakes. That's
  step 6's job (Roguelike run structure); building it now would mean
  building two unvalidated systems at once, against the project's own
  "don't build every feature simultaneously" build-order principle.
- 2026-09-28: Fire button's `pointerup`/`pointercancel` handlers now check
  `e.pointerId` against the pointer that pressed it, and `pointerleave` was
  dropped as a stop signal entirely — see Current status for the real bug
  this fixes (a second finger steering the joystick could silently cancel
  firing by crossing the fire button's screen region, since the original
  handlers cleared `isFiring` for *any* pointer's leave/up event, not just
  the one holding the button down). Worth remembering as a general lesson:
  any touch control meant to be held down alongside other simultaneous
  touch input must track its own specific `pointerId`, not just "a
  pointer event happened on this element."
- 2026-09-28: Confirmed the game's next major design phase (post-vertical-
  slice, not folded into steps 4-8): three playable factions — Blacksail
  Reavers (Aggro/Speed) and Wyrdtide (Mystic/Deep), both reusing their
  names and flavor from the archived card game, plus a new Iron Accord
  (Armor/Discipline, since the card game's "Neutral" pool wasn't a real
  faction identity to port) — mapped onto the existing enemy roster
  (Reavers: Reef Skimmers/Riggers; Wyrdtide: Deep Crawlers/Gullswarm
  Harpies; Iron Accord: Ironclad Brigands), plus a rock-paper-scissors
  combat triangle (Reavers > Iron Accord > Wyrdtide > Reavers) that stacks
  as a *second* multiplier on top of the existing weapon-niche-counter
  system rather than replacing it, plus a Captain's Hub-grown base with a
  Workshop (where the already-deferred Crafting system lands). Full
  writeup in the PRD's new "Post-Slice Direction" section. Explicitly
  **not** re-scoping steps 4-8 to build this now — see that section for
  why (don't stack two unproven combat systems before either is
  playtested alone). Positioning: "Archero on water" — build-around-your-
  kit progression carrying PS1 naval-battler nostalgia, not a straight
  Overboard clone.
- 2026-09-28: Step 5 (loot/economy) corrected a real inconsistency left
  over from step 3: `createWeaponState()` originally held all 5 weapons
  from run start, which the PRD's own text never actually specified — its
  Weapons section describes ammo as "restocked by pickups" and its
  Meta-Progression section frames starting with extra weapons as what the
  Cargo Loadouts *unlock* grants, implying the unmodified default is
  finding them in-run. Reworked to a `heldWeapons` Set (only Cannonballs
  held at start) rather than adding a second parallel "is this available"
  flag, so `isHeld`/`setActiveWeapon`/`canFire` all check one source of
  truth instead of three call sites needing to agree on what "usable"
  means.
- 2026-09-28: Pickup collection (`collectPickups`) mutates a `collected`
  flag in place instead of removing pickups from the array — deliberately
  matches `resolveHits`'/`stepCombat`'s existing pattern of marking
  entities `spent`/dead rather than splicing mid-frame, so render/update
  code has one consistent "is this thing still live" check
  (`!collected`/`health > 0`/`!spent`) across projectiles, enemies and
  pickups instead of three different removal conventions.
- 2026-09-28: Added a testing-only `__shatteredReefWarp(x, y)` debug hook
  (teleports the boat, never called from any in-game UI) after a headless
  playtest script driving the touch joystick couldn't reliably navigate a
  generated maze to reach pickups — it has no pathfinding, and straight-
  line joystick aiming gets stuck on maze walls the same way a player
  would if they weren't actually steering around them. Real player
  navigation through walls was already proven in step 2's playtesting;
  the warp hook exists purely so step 5's playtest could verify
  collection/UI wiring (unlock, ammo top-up, Salvage banking, toast,
  locked-button state) without re-proving maze traversal it didn't need
  to re-test.
- 2026-09-28: `createRun(seed)` dropped its `{cols, rows, room, wall,
  reefIndex}` options parameter entirely in step 6's rewrite — reef size
  is now determined purely by `REEF_TUNING[reefIndex]`, an internal table,
  not a caller-supplied override. No caller (main.mjs, tests) was actually
  using custom sizes for anything other than test convenience, and a
  per-run size override would have fought against the PRD's own
  "difficulty scaled by size/density across a run" design — reef size is
  supposed to be a function of *where you are in the voyage*, not a free
  parameter.
- 2026-09-28: Salvage banking keys off *reaching an exit*, not off
  reaching the final one — `checkReachedExit` banks `reefSalvage` into
  `bankedSalvage` unconditionally before it even checks whether this was
  the last reef. This means a mid-voyage exit and the final exit share
  the exact same banking logic (one less thing to keep in sync), and it
  matches the intuitive fiction: Salvage becomes "yours" the moment you
  clear a reef, not only when the whole voyage ends.
- 2026-09-28: Chose not to spawn the boss ("The Kraken's Anchor") anywhere
  in step 6, even though the new 3-reef structure gives it an obvious
  home (the final reef, as the voyage's finale). Its data/phase logic has
  existed since step 3 but nothing ever calls `createEnemy` with it. Left
  as an explicit open question below rather than silently added, since
  "boss fight forces a mid-fight weapon swap" is enough of a distinct
  playtesting concern (does the phase-swap actually read as intended in
  real play, does a full boss fight fit the reef-3 maze size/pacing) that
  it deserves its own decision rather than riding in on the run-structure
  commit.
- 2026-09-28: Meta-progression persistence uses dependency-injected storage
  (`loadMeta(storage)`/`saveMeta(storage, meta)` take a `{getItem,
  setItem}`-shaped object) rather than `engine/meta.mjs` reaching for
  `window.localStorage` globally — keeps it pure/unit-testable exactly
  like every other `engine/*.mjs` module (tests use an in-memory fake
  storage); only `main.mjs` ever passes the real `window.localStorage`.
- 2026-09-28: `run.mjs` never reads raw meta-progression ownership state
  (`ownedHulls`, `ownedCargoTiers`, etc.) — only a pre-resolved plain
  `loadout` object that `engine/meta.mjs`'s `resolveLoadout(meta)`
  computes. Mirrors the existing "resolve first, hand run.mjs the
  resolved numbers" pattern already used for `spawnPoolForReefIndex`, and
  keeps `run.mjs` decoupled from *how* meta-progression is persisted —
  a different storage mechanism later wouldn't need to touch it.
- 2026-09-28: Ship Hulls are mutually exclusive/selectable (own several,
  sail with one at a time); Cargo Loadouts and Captain's Charms are
  permanent and stacking (every owned tier/charm is always in effect).
  Matches the PRD's own framing — "alternative starting hulls" implies
  picking one, since a ship can't sail as two hulls at once, while the
  other two tracks are described as unlocks that simply apply once owned.
- 2026-09-28: Captain's Charms were built as exactly the PRD's own literal
  examples (ammo regen, a one-time revive, a first-reef Salvage bonus)
  rather than inventing unrelated mechanics — the PRD gave themes/examples
  for this track but deliberately left exact numbers open, so the charms'
  *identity* follows the PRD closely while their costs/rates are a
  documented first-pass balance guess.
- 2026-09-28: `checkSunk` gained a third return value, `'revived'`,
  instead of reusing `true`/`false` with a side flag — a boolean return
  can't distinguish "the run is over" from "the run continues, but
  something notable happened," and the frame loop genuinely needs to
  branch three ways (nothing happened / revived, keep playing / actually
  over). Required fixing the frame loop's old `if (checkSunk(run))`
  truthy check, which would have wrongly treated the truthy `'revived'`
  string as "game over" — a good example of why a multi-state outcome
  should be a discriminated value, not a boolean plus something implicit.
- 2026-09-28: Found and fixed a floating-point-drift bug in
  `stepAmmoRegen` via `node --test` itself (not a playtest) — accumulating
  fractional seconds (`dt = 3.4` then `0.6`) and flooring the sum to a
  whole ammo count lost a tick because `3.4 - 3` isn't exactly `0.4` in
  IEEE 754 double precision. Fixed with a small epsilon guard before
  flooring. Worth remembering as a general lesson for any future
  "accumulate a fractional rate across variable `dt` calls, then floor to
  a whole unit" system (a future resource-tick or regen mechanic would hit
  the identical failure mode) — the guard belongs in the pattern itself,
  not just this one call site.
- 2026-09-28: Fixed a latent DOM-stacking risk carried over from step 6:
  `#run-summary` and the new `#captains-hub` overlay now have an explicit
  `z-index` in `styles.css` rather than relying on DOM append order to
  keep them visually and interactively on top of the canvas/HUD/fire
  button/toast. The old append-order-only approach happened to work by
  luck (overlays were appended early) but was never guaranteed to stay
  correct as more UI elements were added later in boot — worth doing this
  explicitly once rather than re-discovering the same risk in step 8.

## Known open questions (do not silently resolve — ask)

- **The Kraken's Anchor boss is defined but never spawned.** Its data and
  phase-swap logic (`data/enemies.mjs`/`engine/enemies.mjs`) have existed
  since step 3, and step 6's 3-reef structure makes "spawn it on the final
  reef as the voyage's finale" an obvious fit — but that's a real design/
  balance decision (guaranteed spawn vs. a spawn-pool entry; does a full
  boss fight fit reef 3's current size/enemy density; does it replace or
  add to the regular spawn pool there), not something to fold silently
  into a future commit. Ask before building it.
- See the PRD's "Open Risks & Provisional Decisions" section for the rest
  (firing control choice — implemented as aim-assist, still provisional;
  one-handed weapon-select UX; Depth Charges' prediction-based design;
  hull-carryover fairness across reefs, now directly testable since step
  6 actually carries hull between reefs).

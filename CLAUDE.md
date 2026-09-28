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
- **Phase:** step 8 of 8 (polish) complete — juice, audio hooks, and a
  mobile touch-target pass. This is the vertical slice's last locked
  build-order step; a real sprite/sample-audio art pass (as opposed to the
  placeholder shapes/procedural sounds below) and the boss remain
  deliberately out of scope, see "Not built yet" below.
- **Just shipped:**
  - `src/engine/juice.mjs` (new) — particles, screen shake, hit-stop, and
    floating damage numbers, all pure logic (spawn/update return or mutate
    plain arrays/small state objects — no Canvas/DOM calls), mirroring
    `boat.mjs`/`combat.mjs`'s split. One flat particle pool with tuned
    spawn presets (`spawnHitSpark`/`spawnKillBurst`/`spawnExplosion`/
    `spawnSplash`) rather than per-effect classes, so `updateParticles`/
    `drawParticles` stay generic. Screen shake uses the standard
    trauma-based model (`addShake` raises trauma, `updateShake` decays it
    and returns a squared-falloff random offset) so small hits barely
    move the camera and big ones punch. Hit-stop
    (`triggerHitStop`/`applyHitStop`) is a brief full freeze of gameplay
    simulation on a kill — `applyHitStop` hands back the dt the caller
    should actually simulate this frame (0 while frozen) and always
    advances the freeze countdown with the *real* frame time, so a freeze
    can never get stuck regardless of what dt the caller passes in.
  - `src/audio/audio.mjs` (new) — audio hooks via lightweight WebAudio
    oscillator/noise-burst synthesis rather than loaded sample files,
    matching the vertical slice's locked scope ("audio hooks", not a full
    sound-asset pipeline) — needs no asset pipeline, adds nothing to
    deploy, and gives every gameplay event a real, distinct sound now. A
    named cue function per event (`playFire`/`playHit`/`playKill`/
    `playExplosion`/`playWallImpact`/`playPickupWeapon`/
    `playPickupSalvage`/`playReefCleared`/`playVictory`/`playSunk`/
    `playRevive`/`playLockedWeapon`) is the one call site each in
    `main.mjs`, so swapping in real sampled SFX later only means changing
    what each cue does internally. `unlockAudio()` lazily creates/resumes
    the `AudioContext` on the app's first pointerdown (browsers require a
    real user gesture first). Not unit-testable (no WebAudio in Node's
    `node --test` runtime) — verified by ear/state in real headless-
    browser playtesting instead, same testing split as `renderer.mjs`.
  - `src/engine/renderer.mjs` — `drawParticles`/`drawDamageNumbers`, drawn
    in world space inside the same camera-transformed block as every other
    entity (not a screen-space overlay).
  - `src/engine/camera.mjs` — `applyCameraTransform` takes an optional
    `shakeOffset` ({x,y} screen pixels), added on top of the clamped
    follow position as a separate additive term — kept apart from
    `camera.x/y` itself so shake never fights the follow-camera's own
    smoothing or gets clamped against the map edge.
  - `src/main.mjs` — wired every juice/audio hook to its real gameplay
    event: wall impacts (splash + shake + a hit-scaled impact sound),
    weapon fire (a per-weapon fire tone), non-kill hits (spark + floating
    damage number + small shake + hit sound; "crit" styling — a bigger
    gold number — on an on-counter hit specifically, via
    `currentCounter(enemy) === weaponId`), kills (a bigger two-tone burst +
    bigger shake + a 0.05s hit-stop + kill sound), Depth Charges'
    detonation (a dedicated explosion burst/sound tied to the projectile
    itself going spent — fires even with nothing in the blast radius, not
    per enemy hit), enemy contact damage, pickups (a weapon-cache tone vs.
    a Salvage tone), a locked weapon-button tap (a small "no" tone),
    reaching an exit/victory/sinking/Last Gasp reviving. Hit-stop only
    ever freezes active gameplay simulation (`sailing && !run.over`) —
    never the Hub/summary screens, and particles/shake/damage numbers
    always advance on the real unscaled frame time so they read smoothly
    even during the brief freeze rather than pausing with it. A muted
    state (`#mute-button`, top-left, persisted in its own `localStorage`
    key) is a **top-level sibling element, not nested inside `#hud`** —
    nesting it inside `#hud` was tried first and found (via the headless
    playtest below) to silently cap its `z-index` at `#hud`'s own stacking
    context, making it unclickable while the Hub/run-summary overlay
    (drawn on a sibling element, `z-index: 50`) was open; a real, playtest-
    caught CSS stacking-context bug, not a hypothetical one — worth
    remembering as a general lesson: a child's `z-index` never escapes an
    ancestor that already established its own stacking context, so a
    control that must out-rank *siblings of an ancestor* has to itself be
    a sibling of that ancestor, not nested inside it.
  - `src/ui/styles.css` — the mute button sized to 44×44px (Apple/
    Android's own minimum recommended touch target — the 34px a purely
    visual match to the other small HUD chips would have used was too
    small) with `z-index: 60` so it stays usable from any screen; Hub
    unlock-track buttons (`.hub-item-btn`) gained a `min-height: 40px`
    and more padding for the same reason, reviewed against the project's
    touch-target guidance during this pass rather than left at whatever
    size looked fine on a desktop screenshot.
  - New `tests/juice.test.mjs` (16 tests, all pure logic: particle
    spawn-count presets and `updateParticles`' position/decay/drag/
    removal, damage-number rounding/crit-marking/rise-then-fall/expiry,
    shake trauma clamp/decay/squared-falloff scaling, hit-stop's
    freeze/expire/never-shorten-a-longer-freeze semantics). **185/185
    tests pass** across the whole repo.
  - Verified end-to-end in a real headless browser (Playwright/Chromium):
    the mute button toggles correctly and its muted state survives a page
    reload; holding fire on a live enemy produced particles, floating
    damage numbers, non-zero screen-shake trauma, and a non-zero hit-stop
    countdown all within the same combat burst (not just individually in
    isolation) and actually killed an enemy (enemy count dropped 7→6);
    forcing a sink correctly ran the explosion-burst path with no crash.
    No console errors in any run (only the same benign `favicon.ico` 404
    from the test server seen in every prior step's playtest).
- **Phase:** step 8 follow-up — The Kraken's Anchor boss is now built,
  spawned, and playtested. Asked the project owner first, per this file's
  own "Known open questions" rule, rather than silently resolving the
  three open design calls: **AskUserQuestion** answers were **chance-based
  pool entry** (not guaranteed), **keep full density** (reef 3's regular
  13-enemy count unchanged), **guarding the exit**.
- **Just shipped:**
  - `src/data/enemies.mjs` — `spawnPoolForReefIndex`'s final branch
    (`reefIndex >= 2`) now appends `ENEMY_IDS.KRAKENS_ANCHOR` to the same
    array the 5 regular reef-3 enemies are drawn from. Reconciles the two
    chosen answers literally: it's drawn by chance (one entry among six,
    same `spawnPool[Math.floor(rng() * spawnPool.length)]` mechanism), and
    reef 3's `REEF_TUNING` enemy count is untouched — the boss can consume
    one of the 13 regular slots rather than being an additive 14th spawn.
  - `src/engine/enemies.mjs` — `spawnReefEnemies` special-cases on the
    generic `def.isBoss` data field (not hardcoded to the Kraken), so any
    future second boss is already handled. A boss draw is placed with
    small jitter (`±0.7 tiles`) around `exitWorld` instead of the normal
    away-from-spawn/exit placement, and a `bossPlaced` flag redraws
    (`continue`) instead of placing a second boss in the same reef.
  - **Real bug found via my own new test (not a playtest) — an infinite
    loop:** the dedup's `continue` on an already-placed boss never
    incremented the loop's `placed` counter, so a spawn pool that's
    *entirely* the boss (built deliberately in one of the new tests to
    force every draw to hit it) redrew forever without ever reaching
    `count` — `node --test` hung for the full 2-minute tool timeout with
    no output, had to `pkill` it to diagnose. Fixed with a global
    `attempts`/`maxAttempts` bound (`count * 50 + 200`) on the whole
    `while` loop, mirroring the existing bounded-attempt pattern already
    used inside `findOpenSpawnTile` (200 attempts). Worth remembering as a
    general lesson: any pool-draw loop that can redraw without making
    progress needs a *global* attempt bound, not just one inside whatever
    helper it calls — this is reachable in real play too, if a maze is
    ever too small/dense for placement to succeed repeatedly.
  - `src/audio/audio.mjs` — two new cues: `playBossPhaseChange()` (a
    distinct sawtooth/sine sweep, deliberately unmistakable on a phone
    speaker mid-combat, since the whole point of a phase swap is "notice
    your weapon just stopped working") and `playBossDefeated()` (a 5-note
    ascending fanfare + noise burst, bigger than a regular `playKill()`).
  - `src/engine/renderer.mjs` — `drawEnemy`/`drawEnemies` gained an
    optional `name`/`nameFor` parameter (default `null`), drawing a text
    label above the health bar only when passed — kept the renderer
    decoupled from `data/enemies.mjs` (main.mjs resolves the name via a
    callback, same pattern as the existing `colorFor` callback), and only
    the boss ever gets one, so a regular enemy's silhouette+color stays
    the only identifier per the counter-swap hook's own design.
  - `src/main.mjs` — a phase-change-announcement loop in the frame loop
    (per-enemy transient state `enemy._lastAnnouncedPhase`, initialized to
    the current phase on first sight so encountering the boss mid-phase-1
    doesn't fire a false "just swapped!" toast); boss kills get distinctly
    bigger feedback than a regular kill (`spawnExplosion(..., 50, ...)`
    instead of `spawnKillBurst`, `addShake(shake, 1)` instead of `0.35`,
    `triggerHitStop(hitStop, 0.15)` instead of `0.05`,
    `playBossDefeated()`), applied identically in both the direct-hit kill
    branch and the Flame Barrels burn-tick kill branch, since either can
    land the killing blow during the boss's two phases; the `'advanced'`
    reef-transition toast is combined into one string (reef-cleared +
    boss-warning) rather than two separate toasts racing to overwrite each
    other, since `showToast()` only holds one message at a time; render
    call passes `(e) => (e.isBoss ? "The Kraken's Anchor" : null)` as the
    new `nameFor` callback.
  - New tests in `tests/enemies.test.mjs` (3): pool inclusion is
    reef-3-only, a boss-only pool always places exactly one boss guarding
    the exit (this is the test that originally hung before the fix), and
    a mixed full reef-3 pool never places more than one boss. **188/188
    tests pass** across the whole repo.
  - Verified end-to-end in a real headless browser (Playwright/Chromium),
    after two earlier playtest-script iterations that needed correcting
    (not game bugs): the first got cut short by the — deliberately
    undiminished — reef-3 mob sinking the boat before reaching the exit;
    the second warped the boat to within the exit's own trigger radius,
    which correctly triggered `'victory'` (slipping past the boss) before
    any combat happened — confirmed as the intended "guards the exit but
    can be slipped past" design (enemies only ever deal contact damage,
    never physically block the boat, and `checkReachedExit` only checks
    distance to `exitWorld`), not a bug, then fixed the test's own warp
    math to land clear of that radius. The corrected third run observed
    the full cycle for real: boss health ticked down through phase 0
    (submerged/Depth Charges), the phase-change toast and
    `playBossPhaseChange()` fired on schedule at the 14s mark (phase 1,
    tank/Flame Barrels), and the kill produced the defeat toast, fanfare,
    and a Salvage drop (47 total) with `over: false` — the boat survived,
    confirming the fight itself doesn't end the run, only sinking or
    reaching an exit does. No console errors (only the same benign
    `favicon.ico` 404 seen in every prior playtest).
- **Phase:** balance/content pass (project owner's choice, asked via
  `AskUserQuestion` alongside "post-slice direction" and "art/audio pass"
  once the locked build order + boss were fully done). Built a reusable
  headless balance-simulation tool and used it to find and fix a real
  boss bug, not just retune numbers.
- **Just shipped:**
  - `tools/balance-sim.mjs` (new, committed — a dev tool, not shipped
    game code) — runs many full voyages headlessly with a scripted bot:
    BFS pathfinding cell-to-cell over the maze graph (not per-tile),
    counter-aware weapon switching, and the same aim-assist firing
    `main.mjs` uses. Every module it drives (`run.mjs`/`boat.mjs`/
    `combat.mjs`/`enemies.mjs`/`pickups.mjs`) is already pure logic per
    the project's own engine/rendering split, so this runs at full sim
    speed with no browser. Usage: `node tools/balance-sim.mjs [runCount]
    [seedOffset]`; reports outcome distribution, per-reef death spread,
    kills by enemy type, boss encounter/defeat rate, damage-by-source,
    and weapon-cache find rate.
  - **Building the bot surfaced its own real bug, fixed before trusting
    any of its output:** the first version picked a fresh BFS path every
    0.5s regardless of whether the target had changed, which kept
    resetting `waypointIdx` to 0 before the boat ever cleared its first
    waypoint — it never left the starting room. Fixed by only replanning
    on an actual target change, a fully-consumed path, or (for a moving
    enemy target only) a slower periodic re-path. A second bug (a tight
    oscillation loop around an unreachable-feeling pickup/enemy) needed a
    "stuck timer" that blacklists a target after too long pursuing it
    without resolving it — first version reset that timer on every
    re-path even for the *same* target, so it never actually hit its cap;
    fixed by only resetting it on a genuine target change. Also narrowed
    "which enemy to chase" to a realistic detection radius (220px)
    instead of the single globally-nearest enemy regardless of distance,
    since the original had the bot crisscrossing an entire 9×9/11×11 reef
    chasing one evasive Rigger instead of making any progress.
  - **The real finding — a genuine boss bug, not a tuning number:**
    `createEnemy`'s archetype-specific init (FLYER/SUBMERGED/SWARM/
    FLANKER state setup) branched on `def.archetype`, the enemy
    definition's top-level field — correct for every regular enemy, but
    wrong for The Kraken's Anchor, whose top-level `archetype` is `TANK`
    (a mostly-cosmetic fallback label; its *real* starting behavior comes
    from `def.phases[0].archetype`, which is `SUBMERGED`). Because of
    that mismatch, the boss's phase-0 SUBMERGED init block never ran: it
    spawned with `invulnerable: false` and no `submergedState`/
    `submergedTimer` at all, so it was vulnerable to every weapon from
    the very first frame — Depth Charges never actually mattered, the
    "guards the exit" phase-1 weapon-swap hook aside, phase 0's own
    "read the enemy, use the right weapon" identity was silently dead
    code. A second, worse failure mode found while verifying the fix:
    `updateBossPhase` only ever flipped `enemy.invulnerable` on a phase
    *transition*, never re-priming `submergedState`/`submergedTimer` —
    so a fight lasting long enough to loop back through phase 0 a second
    time (>28s total) would go invulnerable on that transition and then
    never surface again for the rest of the fight, since
    `updateSubmerged`'s own timer was never reset to let it. Both fixed
    together in `src/engine/enemies.mjs`: `createEnemy` now computes an
    *effective* starting archetype (`def.phases[0].archetype` for a boss,
    `def.archetype` otherwise) and uses that for every archetype-specific
    init branch, not just the boss-specific one; `updateBossPhase` now
    fully resets the submerge state machine on every entry into a
    SUBMERGED phase, not just flips the flag. `src/data/enemies.mjs`
    gained `submergedSeconds`/`surfacedSeconds` on the boss's definition
    (reused Deep Crawler's own values — Depth Charges' existing tuning is
    already balanced against exactly that cadence, no reason to invent
    new numbers). Two regression tests added to
    `tests/enemies.test.mjs`: one confirming the boss starts invulnerable
    with a real timer (the first bug), one running a boss through 70
    simulated seconds (past 2 full phase loops) confirming it becomes
    vulnerable again in phase 0 the second time around (the second bug).
    **190/190 tests pass.**
  - **One clean-arithmetic weapon retune, not sim-dependent:** computed
    each weapon's direct-hit DPS against its counter enemy's HP pool.
    Every pair kills comfortably within a fraction of the weapon's
    `ammoMax` except Flame Barrels vs. Ironclad Brigand (its intended
    counter): at `damage: 4`, the Brigand's 60 HP needs 15 direct hits,
    but Flame Barrels' `ammoMax` is only 14 — one cache's full ammo
    literally cannot finish the kill on direct damage alone (only
    survivable via the last shot's burn tail landing fully, uninterrupted
    — a razor-thin margin for a weapon whose whole job is being the
    Brigand's answer). Bumped `damage` 4 → 5 (also raises the burn tick,
    since both reuse the same field): 12 hits needed, comfortably under
    `ammoMax` with real margin for missed shots. This was found by
    computing TTK/ammo-margin directly from the data files, not from the
    bot sim (see below for why the sim's own combat-outcome numbers
    aren't trustworthy enough to drive a change like this by themselves).
  - **Sim results, with an honest caveat about what they can and can't
    tell us:** a 60-run batch (post-fix) showed 0% victory, and boss
    defeat rate stayed 0% even after the invulnerability fix. This is
    **not** read as "the boss is still too hard" — the bot's own 15-
    second "give up and walk away" stuck-timer (added to stop it looping
    forever on unreachable targets) doesn't distinguish "making no
    positional progress" from "standing still, correctly draining a
    tanky boss's HP," so it likely abandons real boss fights mid-kill.
    The bug fix itself is verified correct at the unit level (the two
    regression tests above), which is the evidence that actually matters
    here — the sim's aggregate combat-outcome stats (win rate, boss
    defeat rate) are noted as unreliable until the bot gets real combat
    positioning (kiting, standing ground on a target it's actively
    damaging) rather than pure pursuit; its kill-distribution and
    pickup/detection-radius numbers are more trustworthy since they don't
    depend on that. Flagged as a known limitation below rather than
    quietly presented as more authoritative than it is.
- **Phase:** balance/content pass, continued — bot AI improvements, then a
  bot-independent reef-3-difficulty investigation (both explicitly
  requested by the project owner via `AskUserQuestion`, since the sim
  still showed 0% victory/0% boss-defeat after the boss bug fix above).
- **Just shipped:**
  - `tools/balance-sim.mjs` — two bot-AI improvements aimed at making the
    sim's aggregate stats trustworthy: (1) **damage-based stuck
    detection** replaced the old "time since last re-path" stuck timer
    for enemy targets — it now resets only when the target's health
    actually drops, so a bot correctly standing still and draining a
    tanky target's HP is no longer mistaken for "making no progress" and
    abandoned mid-kill; (2) **stand-off/kiting firing** —
    `standOffDistance()` holds the bot at
    `max(enemy.radius + BOAT_RADIUS + 6, weapon.range * 0.6)` from its
    current combat target instead of closing to contact distance, more
    realistically modeling an attentive player's positioning. Despite
    both fixes, a 60-run batch still showed 0% victory and 0% boss-defeat
    (up from the same 0%/0% before) — logged honestly below rather than
    re-tuned around, since the sim's remaining gap (no active
    retreat/kiting *while already at* stand-off range — it holds
    position but doesn't back away if an enemy keeps closing) is a
    plausible bot limitation, not proven game-balance evidence either
    way. Committed as `bcd2072`.
  - Given diminishing returns on further bot tuning, asked the project
    owner via `AskUserQuestion` whether to keep tuning the bot, stop and
    move to the art/audio pass, or dig into reef-3 difficulty by direct
    analysis instead. **Chose: dig into reef 3, independent of bot
    skill.**
  - **Reef-3 difficulty investigation (bot-independent, arithmetic/data-
    only — no sim runs used as evidence):**
    1. **Density check:** enemies-per-maze-cell is actually *lower* on
       reef 3 (13 enemies / 121 cells ≈ 0.107/cell) than reef 1 (7/49 ≈
       0.143/cell) or reef 2 (10/81 ≈ 0.123/cell) — density goes down as
       the voyage progresses, not up. Reef-3's harder feel comes from
       *which* enemies appear (Ironclad Brigand, the boss), not crowding.
    2. **Speed check:** compared every enemy's `speed` to the boat's
       `maxSpeed` (120). Ironclad Brigand (45) and the boss (55) are both
       far below it — fully kiteable by a player who keeps moving. Rigger
       (150) and Gullswarm Harpy's dive (130 × 1.6 = 208) both exceed it
       and can't be outrun — but both are the two lowest-HP enemies in
       the roster with near-instant TTK against their counter (0.36s and
       0.40s respectively, from the Flame Barrels TTK table above) — a
       deliberate fast-fragile skirmisher identity ("must kill fast,
       can't kite"), not an oversight.
    3. **Steady-state positioning check** (the deciding one — read
       `updateSwarm`/`updateFlanker`/`updateSubmerged`/`updateTank` in
       `src/engine/enemies.mjs` directly): every archetype's *equilibrium*
       distance from the boat sits well outside the ~18px contact-trigger
       radius (`enemy.radius + BOAT_RADIUS`). SWARM (Reef Skimmer packs)
       orbits at `engageRadius * 0.6 = 42px`; FLANKER (Rigger) holds a
       55px perpendicular offset it can always reach (its pursuit speed,
       165, exceeds the boat's 120 max); TANK/the boss simply close in at
       their own (kiteable) speed. The only archetype that closes to
       contact *by design* is FLYER's dive-bomb (Gullswarm Harpy) — an
       intentional attack, not incidental crowding — and SUBMERGED
       (Deep Crawler) only attacks during its brief surfaced window.
    - **Conclusion, reported to the project owner:** reef 3 is not
      inherently over-tuned. Nothing in density, raw speed, or steady-
      state AI positioning forces unavoidable damage on a player who
      moves and kites — the sim's 60.8-avg enemy-contact-damage figure
      and 0% clear rate are best explained by the bot's own
      still-imperfect positioning (holds ground once at stand-off range
      but doesn't retreat further if an enemy keeps closing), not a game
      defect. **No balance numbers changed as a result of this
      investigation** — a deliberate "no, it's fine" conclusion rather
      than a change for change's sake, consistent with only touching
      numbers that have a clear arithmetic case (as Flame Barrels did).
  - No code changes this entry; **190/190 tests still pass** (unchanged
    from the prior entry — this was pure analysis, no test-affecting
    edits).
- **Phase:** post-slice direction, part 1 — Factions & The Combat Triangle
  (project owner's explicit choice, "Post slice", after the vertical slice
  + balance pass were fully wrapped up). Read the PRD's "Post-Slice
  Direction" section in full via the Claude Docs connector before building
  anything. Built the faction data layer and the combat-triangle damage
  multiplier end-to-end — real gameplay effect, not just inert data —
  plus a minimal Playable Factions unlock track in the Captain's Hub so
  it's actually reachable in play. Deliberately scoped down from the
  PRD's full "Hub & Workshop"/Crafting vision (see Decisions log) — that's
  its own follow-up, not bundled in.
- **Just shipped:**
  - `src/data/factions.mjs` (new) — the 3 factions (Blacksail Reavers,
    Wyrdtide, Iron Accord) with their `beats` relationships forming one
    3-cycle (Reavers > Iron Accord > Wyrdtide > Reavers), and
    `triangleMultiplier(attackerFactionId, defenderFactionId)` — the one
    function that encodes the whole triangle. Either side missing (no
    playable faction chosen, or a faction-less target) is a deliberate
    no-op (1x), so every pre-faction call site keeps working unchanged —
    mirrors `weapons.mjs`'s `damageAgainst` being the one function that
    encodes the weapon-counter hook. `TRIANGLE_ADVANTAGE_MULTIPLIER` /
    `TRIANGLE_DISADVANTAGE_MULTIPLIER` (1.3x/0.75x) are a first-pass
    balance guess, same status as every other meta-progression number —
    expect retuning once played.
  - `src/data/enemies.mjs` — every regular enemy tagged with a `faction`
    field per the PRD's own faction/enemy mapping table (Reef Skimmer +
    Rigger → Reavers; Gullswarm Harpy + Deep Crawler → Wyrdtide; Ironclad
    Brigand → Iron Accord). The Kraken's Anchor deliberately has **no**
    `faction` field — "an Ancient-tier threat, not faction-aligned" per
    the PRD — and `triangleMultiplier`'s no-op rule means it's never
    triangle-affected regardless of the player's chosen faction, with no
    special-casing needed at any call site.
  - `src/engine/enemies.mjs` — `createEnemy` copies `def.faction` onto the
    enemy instance (`null` for the boss, matching the missing field); new
    `factionMultiplierFor(playerFactionId)` returns a ready-to-pass
    `(enemy) => triangleMultiplier(...)` closure, so call sites don't
    reach into `data/factions.mjs` directly.
  - `src/engine/combat.mjs` — `resolveHits` and the Flame Barrels burn-tick
    setup both gained an optional `getFactionMultiplier(enemy)` parameter
    (mirrors the existing `getEnemyCounter(enemy)` pattern exactly),
    defaulting to a no-op `() => 1` so every existing call site and test
    keeps working unchanged. A burn's `tickDamage` bakes in the multiplier
    that was active at the moment of the *landing* hit, not recomputed
    per tick — a burn applied under a triangle advantage keeps that edge
    for its whole duration.
  - `src/data/meta.mjs` — a new **Playable Factions** unlock track,
    literally an *extension* of the existing Ship Hulls/Cargo
    Loadouts/Captain's Charms tracks per the PRD's own instruction ("not
    a bolted-on separate system"): each faction's hull bias reuses an
    existing `HULL_IDS` entry (Reavers→Skiff, Wyrdtide→Sloop, Iron
    Accord→Longboat), its weapon bias an existing niche weapon
    (Grapeshot/Depth Charges/Chain Shot), and its passive an existing
    Captain's Charm's effect granted for free (First Haul/Last
    Gasp/Steady Hands respectively) — no new mechanics invented, only new
    combinations of ones already built and tested. Mutually exclusive
    like Ship Hulls, with `null` ("Unaligned") as the always-available
    baseline selection.
  - `src/engine/meta.mjs` — `purchaseFaction`/`selectFaction` (mirror
    `purchaseHull`/`selectHull`); `resolveLoadout` now resolves a selected
    faction's hull override, merges its weapon bias into
    `extraHeldWeapons` (deduped against an already-owned Cargo Loadout
    tier granting the same weapon), ORs its granted charm into the
    existing charm flags (stacks with, never replaces, a separately owned
    charm), and returns `faction: meta.selectedFaction` for the triangle.
    `createDefaultMeta`/`loadMeta` gained `ownedFactions`/`selectedFaction`
    (default `[]`/`null`), following the same never-throws/merge-onto-
    defaults pattern as every other field.
  - `src/engine/run.mjs` — `BASELINE_LOADOUT.faction = null`; `createRun`
    stores `run.faction` from the resolved loadout.
  - `src/main.mjs` / `tools/balance-sim.mjs` — both `resolveHits(...)`
    call sites updated to pass `factionMultiplierFor(run.faction)`. A new
    "Factions" section in the Captain's Hub (mirrors the existing
    Hulls/Cargo/Charms row-rendering pattern exactly) with an always-
    available "Unaligned" row plus the 3 factions; picking one shows in
    the debug hook (`__shatteredReefDebug().faction`,
    `.meta.selectedFaction`) and actually reaches a real run.
  - New `tests/factions.test.mjs` (triangle-cycle shape, multiplier
    correctness both directions, mirror-match/missing-faction no-op) and
    additions to `tests/combat.test.mjs` (faction multiplier applied
    through `resolveHits`, default no-op when omitted, baked into a Flame
    Barrels burn tick), `tests/enemies.test.mjs` (`factionMultiplierFor`
    correctness, boss stays faction-less), and `tests/meta.test.mjs`
    (purchase/select, `resolveLoadout`'s hull-override/weapon-dedup/
    charm-stacking behavior, and a real `createRun` integration check —
    hull, held weapon and `run.faction` all actually land). **207/207
    tests pass.**
  - **Real bug found via the test suite itself, not a playtest — a flaky
    test, not a game bug:** the new Flame Barrels burn-tick test used the
    default `Math.random` rng in `tryFire` without realizing Flame Barrels
    has a non-zero `spreadRad` — an unlucky spread roll made the test
    itself (not the game) intermittently fail (~1 in 5 runs) even though
    the shot geometry chosen always keeps the enemy well within the
    worst-case spread cone. Fixed by passing a fixed `() => 0.5` rng to
    `tryFire` in that test, matching this project's own established
    convention (seeded/fixed rng for deterministic tests) — confirmed
    fixed with 8 repeated runs, no failures. Worth remembering as a
    general lesson: any test that calls `tryFire` on a weapon with
    `spreadRad > 0` needs a fixed rng, the same way maze/enemy-spawn tests
    already use `makeSeededRng` — Cannonballs/Depth Charges (spreadRad 0)
    are the only weapons safe to fire with the default rng in a test.
  - Verified end-to-end in a real headless browser (Playwright/Chromium):
    granting Hub Salvage and buying/selecting the Reavers faction updates
    the Hub's Factions row correctly (Buy → Selected, others still
    buyable); "Set Sail" starts a real run whose `run.faction === 'reavers'`
    and whose held weapons include Grapeshot (the Reavers' weapon bias) —
    the loadout demonstrably reached the actual run, not just the data
    layer. No console errors (only the same benign `favicon.ico` 404 seen
    in every prior step's playtest).
- **Phase:** post-slice direction, part 2 — the three items flagged as
  open at the end of part 1, all done in one session at the project
  owner's explicit request ("All of them"): the Workshop/Crafting system,
  in-run UI feedback for a triangle hit, and a TTK check on the 1.3x/0.75x
  multipliers stacked with the weapon-counter system.
- **Just shipped:**
  - **TTK/ammo-margin check (arithmetic, not the sim — same method as the
    Flame Barrels retune):** wrote a script computing ammo needed to kill
    every enemy with its real counter weapon under 1x/advantage/
    disadvantage triangle multipliers, correctly modeling Flame Barrels'
    sustained direct-hit-plus-burn-tick damage (not just direct hits,
    which would have understated it — burn tick interval 0.35s is shorter
    than its 0.8s cooldown, so burn ticks land between each shot at
    sustained fire). **CORRECTED in the Opus review pass below:** this
    entry originally claimed "exactly one tick" per shot and "8 ammo"
    worst case; an empirical run through the real engine loop shows
    **two** ticks per shot (0.35 × 2 < 0.8), so real damage is ~3× a
    direct-only estimate and the worst case is **6** shots, not 8. The
    conclusion stands, with more margin than stated. **No shortfall found anywhere** — the
    worst case, Ironclad Brigand under a triangle disadvantage, needs 6
    ammo of Flame Barrels' 14 max (43%), comfortable margin; every other
    pair one-shots or two-shots its target even under disadvantage.
    **No balance changes made** — the multipliers are fine as shipped in
    part 1, a genuine "already tuned" finding, not a missed check.
  - `src/engine/juice.mjs` / `src/engine/renderer.mjs` — in-run visual
    feedback for a combat-triangle hit: `spawnDamageNumber` gained a
    `triangle` option (`'advantage' | 'disadvantage' | null`), independent
    of and stackable with the existing `crit` (on-counter) styling —
    `drawDamageNumbers` colors an advantage hit teal/cyan and a
    disadvantage hit dull red (crit still controls size), with a small
    ▲/▼ suffix on the number itself so it reads even without color.
  - `src/main.mjs` — both damage-number spawn call sites (direct hits and
    burn ticks) now compute the *raw* `triangleMultiplier(run.faction,
    enemy.faction)` (not `ev.damage`, which already has every multiplier
    baked in) to decide the `triangle` option.
  - `src/data/meta.mjs` — a new **Workshop** unlock track (PRD "Hub &
    Workshop": "combining Salvage and rare drops into weapon and ship
    upgrades"). Introduces **Kraken Scales**, a new rare-drop currency —
    NOT purchasable with Salvage, only earned by actually defeating The
    Kraken's Anchor — so a Workshop upgrade is genuinely gated behind a
    real boss kill, matching "Salvage and rare drops" rather than being
    Salvage-only under a different name. 3 upgrades, permanent/stacking
    like Cargo Loadouts/Charms rather than mutually exclusive: Reinforced
    Barrels (+20% Cannonballs damage), Sharpened Grapeshot (+25% Grapeshot
    damage), Reinforced Ribs (+15 flat max hull on any hull). Each costs
    both Salvage and Kraken Scales.
  - `src/engine/meta.mjs` — `krakenScales`/`ownedWorkshopUpgrades` added to
    the default/persisted meta shape (never-throws load pattern
    preserved); `purchaseWorkshopUpgrade`/`canAffordWorkshopUpgrade` check
    both costs; `resolveLoadout` now also returns
    `craftedDamageMultipliers` (a per-weapon map) and `extraMaxHull` from
    `workshopBonusesFor`; `recordRunResult` awards exactly 1 Kraken Scale
    when `run.bossDefeated` is true, independent of whether the voyage was
    ultimately won or lost afterward — killing the boss is what's being
    rewarded.
  - `src/engine/combat.mjs` — `resolveHits` gained a third multiplier
    parameter, `getWeaponMultiplier(weaponId)` (alongside the existing
    `getFactionMultiplier(enemy)`), multiplying together with it on every
    damage calculation (direct hit, AoE, and the burn tick baked at hit
    time) — the two are independent (one keyed by enemy, one by weapon)
    but both apply multiplicatively on the weapon-counter fraction; new
    `craftedMultiplierFor(craftedDamageMultipliers)` builds the callback,
    mirroring `enemies.mjs`'s `factionMultiplierFor`. Both default to a
    no-op 1x, so nothing pre-Workshop needed to change.
  - `src/engine/run.mjs` — `BASELINE_LOADOUT` gained
    `craftedDamageMultipliers: {}`/`extraMaxHull: 0`; `createRun` applies
    `extraMaxHull` on top of the selected hull's own `maxHull` (a flat
    bonus, not hull-specific) and stores `run.craftedDamageMultipliers`;
    new `run.bossDefeated` (starts `false`) is set `true` in `main.mjs` on
    either boss-kill branch (direct hit or burn tick) and read by
    `recordRunResult`.
  - `src/main.mjs` — a new "Workshop" section in the Captain's Hub
    (mirrors the existing row-rendering pattern), the run summary now
    notes a Kraken Scale earned when `run.bossDefeated`, and the Hub's
    Salvage line + summary both show the Kraken Scale count once above 0.
    A new debug hook `__shatteredReefAddKrakenScales(amount)` alongside
    the existing testing-only hooks.
  - New tests: `tests/meta.test.mjs` gained 6 Workshop tests (default
    state, dual-cost affordability, `resolveLoadout`'s crafted-multiplier/
    extra-hull resolution reaching a real `createRun`, and
    `recordRunResult`'s Kraken Scale award); `tests/combat.test.mjs`
    gained 3 (the `getWeaponMultiplier` callback itself, applied through
    `resolveHits`, and stacking multiplicatively with the faction
    multiplier); `tests/juice.test.mjs` gained 1 (`spawnDamageNumber`'s
    new `triangle` option, defaulting to `null`). **216/216 tests pass.**
  - Verified end-to-end in a real headless browser (Playwright/Chromium):
    granting Hub Salvage + Kraken Scales and crafting Reinforced Ribs
    updates the Workshop row (Craft → Owned) and correctly leaves the
    Salvage-only upgrades still craftable; "Set Sail" starts a run whose
    `boat.maxHull` is 115 (100 base + 15 from the upgrade) and whose
    `krakenScales` balance is correctly debited — the crafted bonus
    demonstrably reached the actual run, not just the data layer. No
    console errors (only the same benign `favicon.ico` 404 seen in every
    prior step's playtest). The triangle damage-number styling and the
    Kraken Scale boss-kill award were verified at the unit level (new
    tests above) rather than re-proven in this same playtest pass, since
    reliably forcing a live boss-kill-with-a-chosen-faction scenario
    through simulated pointer input isn't practical in the time this
    session had — flagged here rather than silently skipped.
- **Phase:** Opus review/verification pass (project owner switched the
  session model to Opus and asked to "run tests using opus now"). Re-ran
  everything, re-verified prior claims empirically instead of trusting
  them, and closed the one playtest gap part 2 left open.
- **Found and fixed:**
  - **Player boat hidden under the HUD at the start of every reef (real
    UX bug, pre-existing since step 2, found from a playtest screenshot).**
    `applyCameraTransform` clamped the map edge to the *screen* edge; the
    spawn is always the maze's top-left start cell, so on a portrait phone
    the boat and every opening fight sat underneath the weapon bar.
    `engine/camera.mjs` now takes HUD `insets` and clamps/centres within
    the usable region (new pure `computeCameraView`, returns the real
    visible world rect so tile culling stays correct with asymmetric
    insets). `main.mjs` measures insets from the live DOM (`#hud` bottom,
    fire-button top) via ResizeObserver + resize, never per frame, and
    drops the fire-button band in short/landscape viewports so the
    playfield doesn't collapse. Verified by screenshot at 400×800,
    390×844 and 844×390. New `tests/camera.test.mjs` (8 tests — camera had
    no tests at all before).
  - **A stale/hand-edited save could permanently strand the player in the
    Hub.** `loadMeta` promises never to throw, but a `selectedFaction` /
    `selectedHull` that's unknown or unowned made `resolveLoadout` throw
    on every "Set Sail". `loadMeta` now sanitizes selections (and
    non-numeric `salvage`/`krakenScales`, and a missing always-owned
    Sloop). 2 new tests; verified live (a fake `ghost_fleet` faction in
    localStorage now sails as unaligned instead of crashing).
  - **Hub lied about the active hull while a faction was selected** — it
    showed your own pick as "Selected ✓" while the run silently used the
    faction's hull. Added a note in the Ship Hulls section naming the
    hull actually in use.
  - **Corrected two wrong analysis claims in this log** (see the edited
    part-2 TTK entry and the decisions-log correction): Flame Barrels
    lands two burn ticks per shot, not one; and the original 4→5 Flame
    Barrels retune's rationale was false (at damage 4 a Brigand dies in
    ~5 shots once burn is counted). Verified empirically by driving the
    real engine loop, not by another hand model.
- **Playtest gap from part 2 closed** (real headless browser): as
  Wyrdtide, Brigand hits tag `disadvantage`; as Iron Accord, Harpy hits
  tag `advantage` (screenshotted); a boss spawned via a new testing-only
  `__shatteredReefSpawnEnemy(defId, x, y, health)` hook is killed through
  the real `resolveHits` path → `run.bossDefeated` → Last Gasp revive on
  first sink → real sink → summary shows the Kraken Scale → Hub shows
  `Kraken Scales: 1` → Workshop enables exactly the 1-scale crafts →
  survives reload. Boss hits correctly tag `null` (faction-less).
  `__shatteredReefDebug()` now also reports live `damageNumbers`.
- **226/226 tests pass**, stable across repeated runs. No console errors.
- **Next up:** the art/audio-asset pass (still not started); balance-sim
  still needs retreat/kiting before its win-rate numbers mean anything;
  and the new Known open questions below (faction weapon-bias coherence,
  one-directional triangle, triangle-cue legibility, the Flame Barrels
  4→5 retune) are design calls for the project owner. Next session should
  open by asking which to prioritize rather than assuming.

- **Phase:** resolved all five open design questions from the Opus review
  (project owner: "Do each one in order with a play test in between. Don't
  stop until all 5 are complete, tested to death"). Each decided with
  data, playtested live, and committed separately. The owner delegated the
  calls, so they were made rather than asked; reasoning is in the Decisions
  log.
- **Just shipped (in order):**
  1. **Faction weapon bias: the "cover your weakness" rule** (`e75fe24`).
     Each faction starts with the counter weapon for its PREDATOR's
     enemies: Reavers→Chain Shot, Wyrdtide→Flame Barrels, Iron
     Accord→Grapeshot. Last Gasp and First Haul were swapped (fragile
     Reavers get the survival charm). The measurement found the Skiff was
     a trap purchase: dragMult 0.95 made the fastest hull also the most
     slippery, so it sank ~45% of voyages vs the Sloop's ~19%. Now drag
     1.15 / hull 85. Also fixed a step-7 bug: Steady Hands regen never
     updated the weapon bar. The balance-sim bot gained wall-aware
     context-steering evasion (it never retreated before, so it couldn't
     value speed); new `tools/faction-compare.mjs`.
  2. **The triangle applies both ways** (`b310023`). Predator x1.3, prey
     x0.9 on contact damage, shown as a red "-N" over the boat. Brigands
     were added to the reef-2 pool; Longboat 140→115 hull, drag 1.1→1.0.
     Spawn pools moved to data (`SPAWN_POOLS`). New
     `tools/hull-compare.mjs`, plus a speed-independent metric: voyage
     survival chained from per-reef sink rates. Result: faction spread
     went from ~56pp to ~11pp (unaligned 70%, Reavers 69%, Wyrdtide 76%,
     Iron Accord 79% voyage survival, 3 seed sets).
  3. **Triangle legibility on phones** (`1bfc208`). One visual language,
     implemented as a pure tested function (`damageNumberStyle`):
     - red + minus sign = damage YOU took; nothing else is red
     - number colour = weapon match (gold counter / cream)
     - a separately coloured glyph = faction match (cyan ▲ amplified /
       grey ▼ resisted)
     - a dark outline on every number, 13px+ (was 11px)
     - enemy matchup pips (cyan ▲ prey, red ! threat)
     - Hub matchup lines, plus a two-line run-start briefing below the HUD
     Tests enforce WCAG contrast; the old "resisted" colour was 1.88:1 on
     rock.
  4. **Flame Barrels stays at 5, now for the right reason** (`f9c8828`).
     New `tools/ttk-check.mjs` drives the real engine loop. The Brigand
     dies in ~6 shots even at damage 4. What 5 is actually for is the
     boss's phase-2 counter: at 4, an average player (spamming Depth
     Charges, 20% misses) ran Flame dry and failed to kill the boss in
     30% of fights. Confirmed live: Flame ran dry in 3/6 fights at 4 vs
     1/6 at 5. Guarded by `tests/balance.test.mjs`, which was checked to
     fail at 4.
  5. **Landscape HUD** (`96deae3`, test fix `10d9798`). A compact top row,
     plus the weapon bar as a 2-column grid of 44px targets above the fire
     button. The camera reserves a RIGHT band in landscape
     (`LANDSCAPE_QUERY` in main.mjs, kept in sync with the CSS media
     query) and re-measures on rotation. Landscape playfield height went
     from 37-45% to 88-90% of the screen. Found and fixed during the
     audit:
     - Set Sail sat under ~3 (portrait) / ~5 (landscape) screens of Hub
       shops. It's now a sticky footer, and the landscape Hub has 2
       columns.
     - Portrait weapon buttons ran flush to both screen edges.
     - The Hub card slid under the mute button.
- **Mistake made and fixed:** `96deae3` was committed with a failing test,
  because the commit command wasn't gated on the test result. The test
  was wrong, not the camera; `10d9798` fixed it. Every commit since has
  been gated on `# fail 0`. Do the same going forward.
- **Final regression pass:**
  - 250/250 tests, 5 consecutive runs.
  - Every item's playtest script was re-run against the final code.
  - One continuous landscape voyage passed 20/20 checks with no console
    errors: faction Hub → briefing → triangle tags both directions →
    reefs 1→2→3 → boss kill → victory → Kraken Scale → Workshop craft →
    reload persistence → crafted bonus in the next run.
  - `drawDamageNumbers` costs 0.35ms per frame for 40 numbers on a
    software canvas (~2% of a 60fps frame).
- **Next up:** the art/audio-asset pass (still not started, and the
  biggest remaining quality gap: every enemy is still a coloured disc).
  After that, the new Known open questions below. Most important of those
  is Depth Charges being unusable against anything hugging you. Next
  session should open by asking which to prioritize.

- **Phase:** feel fixes from playtest feedback ("too much drift when
  turning... fix the depth charges too").
- **Just shipped:**
  - **Keel** (`332c36d`). New `lateralGrip: 4` in `DEFAULT_BOAT_TUNING`
    damps only the velocity component sideways to the heading. A 90° turn
    at speed now slides about half as far (Sloop 51→26px, Longboat 48→25,
    Skiff 43→22). Top speed and straight-line coast are unchanged, which
    a test enforces. `tuningForHull` passes it through (`lateralGripMult`,
    default 1).
  - **Depth Charges proximity fuse.** A charge in flight now detonates
    the moment it passes within `radius + 6px` of a live, surfaced enemy.
    Submerged (invulnerable) targets don't trigger it, so timing the
    surfacing is still the skill. With nothing near, the lob is
    unchanged. `stepCombat` takes an optional `enemies` argument; the
    check lives there, not in `resolveHits`, because main.mjs's
    explosion VFX reads `spent` before `resolveHits` runs. 4 new tests.
  - Verified: `ttk-check` boss results are unchanged at range. The live
    stand-still boss fight (boss hugging the boat) went from 0/3 wins to
    2/3; the loss spent every charge on the submerged boss. 256/256
    tests.
- **Next up:** unchanged: the art/audio pass, then the remaining Known
  open questions.

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
- 2026-09-28: Audio hooks (step 8) are procedural WebAudio synthesis
  (oscillators + filtered noise bursts), not loaded sample files — matches
  the vertical slice's own locked scope ("audio hooks", explicitly not a
  full sound-asset pipeline) and needs zero asset pipeline or deploy
  weight. Every call site is a named cue function (`playHit()`,
  `playKill()`, etc.), so swapping in real recorded SFX later only means
  rewriting what's inside `audio.mjs`'s functions, not touching `main.mjs`.
- 2026-09-28: Depth Charges' explosion particle/sound is tied to *the
  projectile itself going spent* (checked directly against
  `run.weapons.projectiles`, before `resolveHits`/`cleanupProjectiles`
  run), not to `resolveHits`' per-enemy hit events — a depth charge that
  detonates over open water with nothing in its blast radius still needs
  the "something exploded" feedback; keying it to per-enemy events would
  have silently dropped that case.
- 2026-09-28: Hit-stop only ever freezes *active gameplay simulation*
  (gated the same way as the rest of the frame loop's per-frame work:
  `sailing && !run.over`) — never the Hub or run-summary screens, and
  particles/screen-shake/damage-number updates always run on the real,
  unscaled frame time regardless of whether hit-stop is active, so they
  keep reading smoothly through a freeze instead of visibly pausing with
  it (the usual "juice keeps moving while the world holds" feel).
- 2026-09-28: Found and fixed a real CSS stacking-context bug via the
  step-8 headless playtest (not a hypothetical/inspection-only catch): the
  mute button was first built nested inside `#hud`, and `#hud` already
  establishes its own stacking context (`position: absolute` + its own
  `z-index: 2`) — a child's `z-index` can't escape that, so the mute
  button's `z-index: 60` was silently capped at `#hud`'s own rank,
  leaving it unclickable underneath the Hub overlay (`z-index: 50`,
  a sibling of `#hud`, not a descendant) the moment the app opened. Fixed
  by making the mute button a top-level sibling element instead of an
  `#hud` child. Worth remembering as a general lesson: any control that
  must out-rank a *sibling of one of its ancestors* has to itself be a
  sibling of that ancestor — nesting it deeper never works, no matter how
  high its own `z-index` is set.
- 2026-09-28: Reviewed touch-target sizing during the step-8 polish pass
  rather than leaving it at whatever looked fine on a desktop screenshot —
  bumped the mute button from an initial 34px to the 44px Apple/Android
  both recommend as a minimum, and gave the Hub's unlock-track buttons a
  40px minimum height. Small, easy to defer, but exactly the kind of thing
  that's cheap to fix now and easy to forget once more UI accumulates on
  top of it.
- 2026-09-28: Asked before building The Kraken's Anchor boss, per this
  file's own "ask before building it" instruction, via `AskUserQuestion`
  rather than picking recommended defaults silently. Project owner chose
  chance-based pool entry (not guaranteed), full density (reef 3's regular
  13-enemy count unchanged), and guarding the exit. Reconciled the first
  two by literally appending the boss id to the same randomly-drawn pool
  array that fills reef 3's unchanged enemy-count budget, rather than
  inventing a separate additive probability roll — it's drawn by chance
  and the regular count is genuinely untouched, satisfying both answers at
  face value rather than approximating them.
- 2026-09-28: `spawnReefEnemies` special-cases on the generic `def.isBoss`
  data field rather than hardcoding the Kraken's own id — future-proofs
  for a second boss later without touching this function again, matching
  the project's existing data-driven-content philosophy.
- 2026-09-28: Found and fixed a real infinite loop in `spawnReefEnemies`
  via `node --test` itself (a test deliberately built a boss-only spawn
  pool to force every draw to hit it) — the boss-dedup's `continue` on an
  already-placed boss never advanced the loop's `placed` counter, so with
  no bound on total iterations it redrew forever. Fixed with a global
  `attempts`/`maxAttempts` bound on the whole loop, mirroring
  `findOpenSpawnTile`'s existing bounded-attempt pattern. General lesson:
  any pool-draw loop that can redraw without guaranteed progress needs a
  bound on the loop itself, not just inside whatever helper it calls —
  this is reachable in real play too (a maze too small/dense for
  placement to succeed repeatedly), not just in a contrived test.
- 2026-09-28: Confirmed "guards the exit" means exactly that and not a
  hard gate — enemies never physically block the boat, only deal contact
  damage, and `checkReachedExit` only checks distance to the exit tile, so
  a player can legitimately reach it and win without fighting the boss.
  Verified via playtest (reaching the exit near the boss produced a clean
  `outcome: 'victory'` with the boss still alive, no crash) — matches the
  "must beat or slip past it" framing used when asking the project owner,
  which they approved, so this is confirmed intended behavior, not a gap.
- 2026-09-28: Built `tools/balance-sim.mjs` as a committed, reusable dev
  tool rather than a one-off throwaway script — a balance pass is
  explicitly a recurring kind of work for this project (the meta-
  progression/weapon/enemy numbers are all documented first-pass guesses
  "expect retuning"), and every module it drives is already pure logic,
  so a headless simulator costs nothing to keep around for the next pass.
- 2026-09-28: Found and fixed a real boss bug (not a balance number) via
  the balance pass: `createEnemy`'s archetype-specific init branched on
  `def.archetype`, which is correct for every regular enemy but wrong for
  a boss, whose actual starting behavior comes from
  `def.phases[0].archetype` — for The Kraken's Anchor those two disagree
  (`TANK` vs. `SUBMERGED`), so its phase-0 invulnerable/surface cycle
  never initialized and it was vulnerable to everything from frame one.
  Fixed by computing an effective starting archetype up front (the boss's
  phase-0 archetype, or `def.archetype` for anyone else) and using that
  for every archetype-specific init branch, not just checking
  `def.archetype` directly. Worth remembering as a general lesson: a
  boss's *effective* current archetype and its *top-level* `def`
  archetype are different things the moment phases exist, and any new
  code that branches on `def.archetype` for setup (as opposed to
  `enemy.archetype` for behavior) needs to account for that, not just the
  one place this bug happened to live.
- 2026-09-28: Also fixed `updateBossPhase` only flipping `invulnerable` on
  a phase transition without re-priming the SUBMERGED state machine
  itself — found while verifying the above fix, not independently
  reported. A fight looping back through phase 0 a second time (>28s)
  would go invulnerable on that transition and then never surface again,
  since `updateSubmerged`'s own timer was never reset to let it toggle
  back off. Now resets `submergedState`/`submergedTimer` on every entry
  into a SUBMERGED phase, not just the first. Added
  `submergedSeconds: [1.8, 3.0]` / `surfacedSeconds: 1.1` to the boss's
  data definition (reused Deep Crawler's exact values, since Depth
  Charges' cooldown/damage are already tuned against that cadence — no
  reason to invent new numbers for the same mechanic).
- 2026-09-28: Retuned Flame Barrels' `damage` 4 → 5 based on direct
  TTK/ammo-margin arithmetic against every weapon-counter pair, not on
  the balance sim's own aggregate outcomes — at 4, killing an Ironclad
  Brigand (60 HP) needed 15 direct hits against an `ammoMax` of only 14,
  a razor-thin (and sometimes literally insufficient) margin for the one
  weapon whose entire job is countering that enemy. Every other pair
  already killed comfortably under its `ammoMax`. Chose to raise damage
  rather than `ammoMax` since it also strengthens the (currently
  under-leveraged, given both direct-hit and burn-tick reuse the same
  field) burn DoT identity Flame Barrels is supposed to have.
- 2026-09-28: Deliberately did NOT retune anything based on the balance
  sim's aggregate combat-outcome numbers alone (0% victory rate, 0% boss
  defeat rate even after the invulnerability fix) — the bot's own 15-
  second stuck-timer (added to stop it looping forever chasing an
  unreachable target) can't distinguish "making no positional progress"
  from "correctly standing still draining a tanky target's HP," so it
  likely walks away from real boss fights mid-kill; that's a bot
  limitation, not necessarily a game one. The engine-level regression
  tests are the evidence trusted for the boss fix itself; the sim's own
  win/defeat-rate numbers are flagged as unreliable until it gets real
  combat positioning (kiting, holding ground on an active target) or
  until real human playtesting data exists to compare against. The sim's
  kill-distribution and pickup/detection-radius numbers don't depend on
  that same flaw and were used as directional signal only, not to drive
  any specific number change on their own.
- 2026-09-28: Improved the balance-sim bot twice more (damage-based stuck
  detection for enemy targets; stand-off/kiting fire distance instead of
  closing to contact) after the project owner flagged diminishing returns
  on tuning it further — both changes are real bot-quality improvements,
  not workarounds, but neither moved the sim's 0% victory/0% boss-defeat
  numbers, which is itself evidence the remaining gap is deeper than
  target-selection (likely the bot never retreats once already at
  stand-off range).
- 2026-09-28: Asked the project owner (via `AskUserQuestion`) whether to
  keep tuning the bot, move on to art/audio, or investigate reef-3
  difficulty directly. Chose to investigate reef 3, explicitly
  independent of bot skill — deliberately did **not** keep iterating on
  the bot itself, since the sim's own aggregate outcome stats had already
  been flagged as untrustworthy and further bot tuning was diminishing
  returns for a chat session.
- 2026-09-28: Concluded, via bot-independent arithmetic/data analysis
  (enemy density per maze cell, enemy speed vs. boat max speed, and
  reading every archetype's actual steady-state equilibrium distance
  from the boat directly in `enemies.mjs`) rather than any sim run, that
  reef 3 is **not** inherently over-tuned: density is lower than earlier
  reefs, most enemies are slower than the boat and fully kiteable, and
  every archetype's designed equilibrium position sits outside the
  contact-damage radius except the two enemies whose whole identity is
  "fast, fragile, must be killed on sight" (Rigger, Gullswarm Harpy) and
  the one archetype whose attack is a deliberate contact dive (Flyer).
  Made **no balance changes** as a result — a considered "the design is
  fine" conclusion is as legitimate an outcome of a balance pass as a
  retune, and forcing a change here would have had no arithmetic
  justification, unlike the Flame Barrels fix.
- 2026-09-28: Started post-slice direction with the combat triangle
  specifically (not the Hub/Workshop expansion, not playable-faction UI
  polish) — it's the PRD's own headline mechanic for this phase and the
  one piece every other post-slice idea (playable factions, the Workshop)
  builds on top of, so it's the right first slice per the project's own
  "start with a strong core, then expand" build philosophy.
- 2026-09-28: Playable Factions (data/meta.mjs) is built as a literal
  *extension* of the existing Ship Hulls/Cargo Loadouts/Captain's Charms
  tracks — reusing their exact fields/mechanics (a hull id, a weapon id,
  an existing charm's effect) rather than inventing new stat systems —
  because that's what the PRD explicitly asked for ("implemented as an
  extension... not a bolted-on separate system") and because every one of
  those three mechanics is already built, tested, and playtested; a new
  bespoke passive/bonus system would be exactly the kind of "stack two
  unproven systems" the project has repeatedly avoided elsewhere (the
  faction/weapon-counter stacking itself, the card-game pivot's own
  lesson).
- 2026-09-28: `triangleMultiplier`'s no-op rule (1x whenever either side is
  missing a faction) does double duty: it makes The Kraken's Anchor
  faction-less "for free" (no special-casing at any resolveHits/stepBurn
  call site — the missing `faction` field alone is enough) and it makes
  every pre-existing call site and test that predates factions keep
  working completely unchanged with no faction ever selected. One rule,
  two problems solved, rather than a boss-specific exception plus a
  separate backward-compatibility shim.
- 2026-09-28: Selecting a faction overrides the player's separately
  chosen Ship Hull rather than living alongside it — matches the PRD's
  literal wording ("determining their starting ship hull") and avoids a
  confusing double-selection UI (which hull "wins" if they conflict). The
  player's own hull choice is preserved in `meta.selectedHull` and simply
  resumes the moment they select "Unaligned" again, so nothing is lost by
  picking a faction.
- 2026-09-28: Found and fixed a flaky (not deterministic) new test via
  repeated `node --test` runs, not a single pass — the new Flame Barrels
  faction-multiplier test used the default `Math.random` rng in `tryFire`
  without accounting for Flame Barrels' non-zero `spreadRad`, so an
  unlucky spread roll could very occasionally fail the assertion. Fixed
  with a fixed `() => 0.5` rng, matching the project's existing
  seeded-rng-for-determinism convention. Worth remembering as a general
  lesson: `tryFire` in a test needs a fixed/seeded rng for any weapon with
  `spreadRad > 0` — only Cannonballs and Depth Charges (spreadRad 0) are
  safe with the default. Re-running a new test file several times in a
  row (not just once) before trusting it is now the standard this project
  holds itself to for anything touching `tryFire`.
- 2026-09-28: Did the triangle-multiplier TTK check with a proper
  sustained-fire model for Flame Barrels (direct hit + overlapping burn
  ticks), not the same naive "direct damage only, repeated per shot"
  model the original Flame Barrels retune used — the naive model would
  have significantly understated Flame Barrels' real damage (burn ticks
  land between every shot at its 0.35s interval vs. the weapon's 0.8s
  cooldown) and could have led to an unnecessary retune here. No
  shortfall found even under the triangle's worst case (disadvantage), so
  no numbers changed. **CORRECTED by the Opus review below:** it's two
  ticks per shot, not one, and — more importantly — the claim that "the
  original Flame Barrels fix happened to reach the right conclusion" is
  wrong. That 4→5 retune assumed a Brigand needed 15 direct hits at
  damage 4; with burn included it dies in ~5 shots at damage 4. The
  retune's stated rationale ("one cache can't finish the kill") was false.
  Left at 5 rather than silently reverted — it's a tuning call for the
  project owner — see Known open questions. General lesson stands and is
  now sharper: **verify TTK claims empirically through the real engine
  loop** (a 20-line script driving tryFire/stepCombat/resolveHits/
  stepBurn), not by hand-modelling tick overlap — both hand models in
  this log got it wrong.
- 2026-09-28: Kraken Scales (the Workshop's rare-drop currency) are
  earned only by defeating The Kraken's Anchor, never purchasable with
  Salvage — a deliberate choice to make Workshop upgrades genuinely
  gated behind a real boss kill rather than "Salvage under a different
  name," matching the PRD's "Salvage AND rare drops" framing rather than
  collapsing it to one resource.
- 2026-09-28: `resolveHits` gained a THIRD multiplier parameter
  (`getWeaponMultiplier`, for Workshop crafting) rather than folding it
  into the existing `getFactionMultiplier` callback or combining them
  before the call — they're independent axes (one keyed by the enemy
  being hit, one by the weapon firing), and keeping them as separate
  parameters (each defaulting to a no-op) means every future multiplier
  source can be added the same way without the existing ones needing to
  change shape.

- 2026-09-28: Factions use the "cover your weakness" weapon-bias rule
  (enforced by a test), not "hunter". It was measured, not picked by
  taste. The roster is heavily skewed: Reavers are ~70% of enemy HP, and
  Iron Accord was absent until reef 3. "Hunter" gives the already-dominant
  faction (Wyrdtide) the best early weapon, while "cover your weakness"
  puts each faction's help exactly where its triangle hurts most.
- 2026-09-28: Balance decisions about speed now use the evasive bot plus
  a speed-independent metric (per-reef sink rate given the reef was
  entered). Raw "sunk %" is confounded: slow ships time out before
  reef 3, which is a bot artifact since players don't time out, so they
  looked safer than they were. And the old non-evasive bot gave every
  hull identical contact damage, so it couldn't value speed at all.
  General lesson: check whether a measuring tool is blind to the exact
  variable being tuned before trusting it.
- 2026-09-28: The triangle applies both ways, but asymmetrically: x1.3
  incoming from a predator, only x0.9 from prey. The two damage flows are
  skewed in OPPOSITE directions. Outgoing HP is mostly Reaver Skimmers
  (they orbit outside contact range); incoming damage is ~65% Wyrdtide
  Harpies (the only deliberate contact attackers). So a symmetric x0.75
  became a shield for Iron Accord (the faction that preys on Wyrdtide).
  Chosen from a sweep of 600 voyages per faction per setting.
- 2026-09-28: Fixed the roster skew at the source (Brigands added to the
  reef-2 pool, per the PRD's "later reefs mix in ... Brigands") rather
  than tuning triangle magnitudes to hide it. Cost: reef 2 is ~3-5pp
  harder for everyone, measured.
- 2026-09-28: Retuned the Skiff and the Longboat standalone. They were a
  trap and a must-buy respectively (45% vs 19% sunk; 91% vs 67% voyage
  survival). Both are now a sidegrade band around the Sloop: Skiff ~71%,
  Longboat ~79%, Sloop ~67%. Faction balance followed from fixing them;
  it wasn't patched per faction.
- 2026-09-28: Damage-number styling is a pure function with WCAG contrast
  tests, not a renderer detail, so legibility can't silently regress.
  Red is reserved for damage the player took. The weapon match and the
  faction match are separate channels (number colour vs glyph colour), so
  they stack instead of overwriting each other.
- 2026-09-28: Flame Barrels damage 5 was decided by driving the real
  engine (`tools/ttk-check.mjs`) and a live browser boss fight, not by
  hand arithmetic. The deciding case was the boss's phase-2 counter, not
  the Brigand. A committed balance test guards it.
- 2026-09-28: Landscape moves controls to the side, not the top/bottom
  bands: the weapon grid sits in the right-thumb zone above the fire
  button, and the camera reserves a right band. Vertical space is the
  scarce axis in landscape. Weapon targets stay 44px minimum; a 2-column
  grid is used because a single 44px column doesn't fit above the fire
  button on 360px-tall phones.
- 2026-09-28: Set Sail is a sticky footer in the Hub at every
  orientation. The Hub grows with every unlock track, and the one action
  you always want shouldn't move further down each time a shop is added.

- 2026-09-28: Turn drift was halved with a keel (lateral-only damping),
  not more drag. Drag would also have shortened straight coasting and
  top-speed feel, which weren't the complaint.
- 2026-09-28: Depth Charges got a proximity fuse rather than a shorter
  fuse. A shorter fuse would have broken the long-range lob. It only
  triggers on surfaced targets, which keeps the "time the surfacing"
  identity from the PRD.

## Known open questions (do not silently resolve — ask)

- See the PRD's "Open Risks & Provisional Decisions" section
  (firing control choice — implemented as aim-assist, still provisional;
  one-handed weapon-select UX; Depth Charges' prediction-based design;
  hull-carryover fairness across reefs, now directly testable since step
  6 actually carries hull between reefs).
- **All the faction/hull numbers are bot-derived.** The bot now evades
  and the metric controls for speed, but a skilled human dodges better
  than any heuristic. So the Skiff/Reavers may be stronger in real hands
  than these numbers suggest. Validate with human play before further
  tuning.
- **The Hub is still several screens of shops** (3 in portrait, ~5 in
  landscape). The sticky Set Sail fixes access, but browsing is long.
  Tabs per track, or collapsing owned items, would help as more tracks
  arrive.
- **The enemy matchup pips add clutter to Skimmer packs** (one pip per
  Skimmer, 3-5 per pack). Fine at current densities; revisit with real
  art.

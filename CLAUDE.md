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
- **Not built yet:** the real 3-reef run structure with Salvage banking
  and permadeath stakes (step 6 — `run.salvage` is still a flat
  single-reef tally, not banked-per-reef), meta-progression/Captain's Hub
  (step 7), art pass, audio, juice (step 8).
- **Next up:** step 6, roguelike run structure — multi-reef progression
  (3 reefs/run per the PRD), the exit leading to the *next* reef instead
  of a fresh unrelated run, permadeath (a `sunk` outcome should end the
  whole run, not just the current reef), Salvage banking per-reef, and a
  run summary screen. Step 4 (enemy content) remains folded into ongoing
  playtesting per its own step-3 assessment — no separate action needed
  unless a specific balance issue turns up.

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

## Known open questions (do not silently resolve — ask)

None blocking step 4 as of 2026-09-28 — see the PRD's "Open Risks &
Provisional Decisions" section for items to revisit during implementation
(firing control choice — now implemented as aim-assist per the decision
above, but still provisional; one-handed weapon-select UX; Depth Charges'
prediction-based design; reef count per run; hull-carryover fairness).

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
3. Combat core — weapons, projectiles, hit detection, enemy AI with
   niches (the Overboard hook: wrong weapon = little/no effect)
4. Enemy content — 5-6 distinct enemy types + a boss, each with a real
   tactical identity
5. Loot/economy — weapon pickups, ammo as a resource, in-run currency
6. Roguelike run structure — multi-room progression, exit, permadeath,
   run summary screen
7. Meta-progression hub — persistent currency + unlocks (localStorage)
8. Polish — juice (particles, screen shake, hit-stop, damage numbers),
   audio hooks, mobile safe-area/UX pass

Each step its own commit, each step end-to-end testable headless before
depending on the next, matching how the archived project was built.

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
- **Not built yet:** everything past step 2 — no weapons, no enemies, no
  combat other than wall-impact hull damage, no loot, no run structure
  (permadeath/exit-to-hub beyond "sink = tap to retry"), no meta-
  progression, no art pass, no audio.
- **Next up:** step 3, combat core (weapons, projectiles, hit detection,
  enemy AI with niches).

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

## Known open questions (do not silently resolve — ask)

None blocking step 3 as of 2026-09-28 — see the PRD's "Open Risks &
Provisional Decisions" section for items to revisit during implementation
(firing control choice, one-handed weapon-select UX, Depth Charges'
prediction-based design, reef count per run, hull-carryover fairness).

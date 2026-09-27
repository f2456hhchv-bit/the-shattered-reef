# The Shattered Reef — build log

Read this file first, every session. It replaces a handoff report — update
the "Current status" and "Decisions log" sections at the end of every
session, before anything else.

## What this is

A mobile, single-player Battlegrounds-style auto-battler. Full design (core
loop, all 6 factions, AI opponent system, progression) lives in the PRD doc
— ask the project owner for the link if it's not already in context. This
file tracks *build* status only.

## Stack rules — do not deviate without discussion

- **Vanilla JS, ES modules (`.mjs`), no build step, no `node_modules`.**
  TypeScript/bundlers were considered and rejected — they need a compile
  step, which conflicts with "push to `main`, GitHub Pages serves it
  immediately." Do not reintroduce a bundler.
- No dependencies. `node --test` (built into Node 22) for tests, no test
  framework.
- Data-driven content: minions/factions live in `src/data/*.mjs` as plain
  objects, not scattered through engine code. Adding a card should never
  require touching the combat/economy engine.
- DOM + CSS for the board and shop UI, not Canvas — a card game needs crisp
  text and easy hit-testing more than it needs pixel-level rendering
  control. (Contrast with Briarbloom/Keyfall, which are Canvas 2D — that's
  right for those, not for this.)
- Touch-first from day one: no feature ships that only works with a mouse.

## Build order (agreed with project owner)

Systems before UI, each step its own commit, each end-to-end testable
headless before anything touches a screen:

1. **Data schema** (minions/factions/keywords) — ✅ done
2. **Combat simulator** (pure function, two boards in → resolution out) — ✅ done
3. **Economy/shop logic** (buy/sell/reroll/upgrade) — ✅ done
4. **AI decision engine** (sits on top of 2 + 3) — ✅ done
5. **Board/shop UI, touch input, positioning** — ✅ done
6. Round loop, health, win/loss — next
7. Reef Shard + Fathom visuals/feedback
8. Polish pass

This is phase 3 (Vertical Slice) of the PRD's 8 build phases. Full 6-faction
content, tiers 4-6, and everything past this slice is phase 5 (Content) —
do not add it early even if it's tempting.

## Vertical slice scope

Exactly two factions, tiers 1-3 only:

- **Blacksail Reavers** (aggro) — 8 minions
- **Wyrdtide** (gamble, Reef Shard/Fathom mechanic) — 8 minions
- **Neutral** pool — 5 minions

21 cards total. Chosen because Reavers exercise a simple synergy archetype
and Wyrdtide exercises the chance mechanic — between them they should prove
whether the core loop and the AI can handle both.

## Current status (update this every session)

- **Phase:** 3 (Vertical Slice), step 3 of 8 (economy/shop engine) complete,
  plus a same-session follow-up patch closing a gap that step introduced.
- **Just shipped:** `src/engine/economy.mjs` — shared card pool (finite
  copies, contested pool ready for AI to draw from in step 4), player
  state, income (`round+2`, capped at 10, no gold carryover), tavern-tier-
  weighted shop draws (tier cap 3 for the slice), buy/sell/reroll/freeze/
  upgrade, all battlecry action types the slice's cards use, and the full
  Reef Shard event flow: `isReefShardRound`, `offerReefShardChoices`
  (choice of 3, Lesser rounds 3-10 / Greater 11+), `applyReefShardChoice`
  (universal lockout + Fathom growth, Shoal Call/Bargain Tide/Drowned Favor
  shop effects, The Kraken's Due exception).
- **Data fix along the way:** Fathom Priestess's battlecry was still
  `gain_reef_shard`, a leftover from the old "shards appear in the shop"
  design. Changed to `trigger_bonus_shard_event` (queues a bonus Lesser-pool
  choice) to match the locked scheduled-event design — updated
  `src/data/minions.mjs` and `src/data/keywords.mjs`'s `ACTION_TYPES`.
- **Follow-up patch, same session (gap closed immediately per standing
  instruction — always patch inconsistencies as soon as they're found,
  never defer):** `combat.mjs` now reads `instance.shardAbilities` and
  fully implements all five Board-type shard abilities in a real fight —
  Titanic still needs no combat-time logic since it doubles base stats
  immediately in `economy.mjs`.
  - Added `maxHealth` to `instantiate()` (`src/data/minions.mjs`) — a new
    "full health" reference point, since Vampiric needs to know what
    "full" means. Every existing permanent-stat-buff site in both
    `combat.mjs` and `economy.mjs` (deathrattle buffs, `on_fathom_growth`
    reactions, `end_of_combat_won buff_self`, battlecry buffs, Titanic's
    doubling, The Kraken's Due's passive) now keeps `maxHealth` in sync
    alongside `health`. Damage still only touches `health`.
  - Vampiric: heals to `maxHealth` whenever the tagged minion's hit (main
    exchange or its own Riptide splash) kills an enemy, provided it
    survives the exchange itself.
  - Barnacled: +1/+1 (and `maxHealth`), the first time it's the defender
    and survives an exchange, tracked via a per-combat `Set` so it can
    only fire once even though it may be attacked many more times in the
    same fight.
  - Riptide: attacking also splashes 1 damage onto a second random living
    enemy, distinct from the primary defender.
  - Undying: the first time this minion would drop to ≤0 health each
    combat, it's set to 1 instead — tracked via a per-combat `Set`, checked
    inside `processDeaths()` before the dead-filter runs, so a saved
    minion is never treated as dead.
  - Twinned: deathrattle effects fire twice.
  - Maelstrom: after its own deathrattle resolves on death, its
    deathrattle effects (never the Maelstrom tag itself, to avoid
    unbounded recursive spread) are copied permanently onto two other
    random living friendly minions.
  - New tests for all five in `tests/combat.test.mjs` (Titanic was already
    covered in `tests/economy.test.mjs`). **49/49 tests pass** across the
    whole repo.
- **Phase:** 3 (Vertical Slice), step 4 of 8 (AI decision engine) complete.
- **Just shipped:** `src/engine/ai.mjs` + `src/data/ai-tuning.mjs` — an
  AI-controlled player's full shopping-phase logic, built entirely on top
  of economy.mjs's own public functions (never touching player state
  directly), so it's indistinguishable from a human player to every other
  system.
  - `scoreMinion` — heuristic value from stats + keywords + effects
    (weighted by how reliably each trigger actually pays off — see
    `TRIGGER_WEIGHT` in the tuning file).
  - `synergyBonus` — rewards committing to the board's dominant faction,
    capped so it can't swamp raw stats.
  - `runAiTurn(state, pool, round, rng)` — one full round: upgrades the
    tavern opportunistically toward a round-based target tier, then loops
    buy → (sell-and-swap once the board is full) → reroll, spending the
    *entire* budget every round on the theory that unspent gold is wasted
    (confirmed by rereading economy.mjs: gold never carries over between
    rounds, so there's no genre-typical "banking" strategy here — hoarding
    is strictly worse than spending). Freezes the shop instead of
    rerolling it away when it's holding something good it can't yet
    afford, so that card survives to next round's bigger budget.
  - `chooseReefShardPick(state, choices)` — picks the best-fitting board
    minion for whichever offered ability scores highest net value (fit
    minus a faction-lockout penalty that scales with how committed the
    board already is), or declines (always free) when the board is empty.
  - All tuning numbers (weights, thresholds, the tavern curve, shard-fit
    formulas) live in `src/data/ai-tuning.mjs`, not the engine, matching
    the project's data-driven-content rule — retuning AI behavior should
    never mean touching `ai.mjs` itself.
  - Small economy.mjs tidy-up along the way: exported `BOARD_CAP`,
    `MAX_TAVERN_TIER`, `rerollCost()` and `nextUpgradeCost()` (previously
    internal constants/inline formulas) so the AI engine — and any other
    future caller — never has to re-derive them.
  - New tests in `tests/ai.test.mjs` (scoring, synergy, full-turn spending
    behavior, board-cap/swap correctness, freeze-vs-reroll, all six Reef
    Shard fit heuristics, a 15-round simulation staying within the tavern
    cap). **61/61 tests pass** across the whole repo.
- **Phase:** 3 (Vertical Slice), step 5 of 8 (board/shop UI, touch input,
  positioning) complete.
- **Just shipped:** a real, playable shop/board screen — `src/ui/app.mjs`
  (controller), `src/ui/cards.mjs` (card rendering), `src/ui/dragdrop.mjs`
  (touch reordering), `src/ui/styles.css`. DOM+CSS throughout, no Canvas,
  per the stack rule. `src/main.mjs` now boots this instead of the old
  data-loaded proof text.
  - HUD: round, gold/maxGold, health, tavern tier + upgrade button.
  - Board: 7 touch-reorderable slots. Cards render in a **compact token
    form** (cost badge, keyword icons, atk/hp only — no name or rules
    text) rather than full shop-card layout: 7 columns on a phone screen
    genuinely don't have the width for name + rules text per card (tried
    it, looked bad — see decisions log), and real mobile Battlegrounds-
    likes handle a full board the same way. Tap a board card to open a
    sell confirmation sheet.
  - Shop: 3(+bonus) full-size cards with name, keywords, rules text
    (added a `text` field to all 21 minion definitions in
    `src/data/minions.mjs` for this — they had `flavor` but no rules text
    before), cost badge, and a dimmed/grayscale unaffordable state. Tap to
    buy.
  - Controls: Reroll (shows live cost), Freeze (single-use per round, per
    economy.mjs — button disables once active), End Turn.
  - Reef Shard tags on a fed minion show as a small badge + a lock icon;
    picking/declining a Shard event itself is NOT built here — that's
    step 7 per the build order. `onEndTurn` detects a Reef Shard round
    (`isReefShardRound`) and surfaces it as a toast so the gap is visible,
    not silently skipped.
  - `onEndTurn` is a deliberate placeholder: it only advances the
    shop/economy round (`startRound`). No opponent, no combat, no
    health loss, no win/loss yet — that's step 6. Health is displayed but
    static at 25 until step 6 wires up something that can change it.
  - Verified end-to-end in a real headless browser (Playwright, Chromium)
    rather than just `node --check`: buy, sell, reroll, freeze, upgrade,
    round-advance, and drag-to-reorder all confirmed working with no
    console errors, plus a couple of screenshots to sanity-check layout.
- **Not built yet:** opponents, combat, health/win-loss, Reef Shard picker
  UI, Fathom visuals.
- **Next up:** step 6, round loop + health + win/loss. The AI engine
  (step 4) is ready to drive up to 7 opponent players headlessly once this
  exists to call it each round; combat.mjs (step 2) is ready to resolve
  the fights.

## Reef Shard / Fathom design

Spec lives in `docs/design/reef-shards.md` — implemented in
`src/engine/economy.mjs` (see Current status above for what's wired up and
what's still a gap in `combat.mjs`).

## Decisions log

- 2026-09-27: Rejected TypeScript/Vite in favour of vanilla JS, no build —
  matches the project owner's other tools and avoids the exact stack that
  caused rework on a previous project (Briarbloom).
- 2026-09-27: DOM+CSS over Canvas for board/shop UI — text-heavy card game,
  not a scene-rendering game.
- 2026-09-27: cost = tier + 2 for the vertical slice (3g/4g/5g). Not
  necessarily final once tiers 4-6 exist.
- 2026-09-27: The Kraken's Due is implemented as a `passive` block on its
  data entry, not a `trigger` — it reacts to *another* minion being
  shard-fed, which the trigger system doesn't model. First case of this
  pattern; if more cards need it, consider a proper passive-effect system
  rather than one-off flags.
- 2026-09-27: Reef Shard events are scheduled (every 4 rounds from round 3,
  choice of 3), not randomly available in the shop — researched Battlegrounds
  Trinkets, TFT Augments and Storybook Brawl Treasures first; none of them
  use pure random-availability, all use scheduled guaranteed choices. Full
  ability pool locked in `docs/design/reef-shards.md`.
- 2026-09-27: Tavern odds table (which tier of minion appears at which
  tavern tier), the 16/14/12 shared-pool copy counts, and income schedule
  are approximations in the genre's spirit, not measured against a live
  game — expect to retune during step 7 (Testing) once there's real play
  data.
- 2026-09-27: When `combat.mjs` was found not to read the `shardAbilities`
  tags `economy.mjs` already attaches, patched it immediately in the same
  session rather than deferring to step 4 — per standing instruction:
  always patch an inconsistency against already-written work as soon as
  it's found. Introduced `maxHealth` on minion instances as part of that
  patch (needed for Vampiric's "heal to full").
- 2026-09-27: The AI always spends its entire gold budget every round
  (buying, upgrading, or rerolling to find something worth buying) rather
  than ever holding gold back — a direct consequence of economy.mjs's own
  no-carryover rule, not an independent design choice. If gold carryover is
  ever added (it isn't planned to be), this behavior needs revisiting.
- 2026-09-27: AI tuning numbers (score weights, buy/swap/freeze thresholds,
  the tavern-upgrade curve, Reef Shard ability-fit formulas) live in
  `src/data/ai-tuning.mjs`, separate from `src/engine/ai.mjs` — same
  data-driven-content principle as minion/faction data, so retuning the AI
  never means touching engine logic.
- 2026-09-27: Board minions render as compact tokens (icons + stats, no
  name/text), shop minions render as full cards (name + keywords + rules
  text). Tried full-text cards on the board first — 7 columns on a phone
  screen makes each card ~45-50px wide, and cramming a name plus rules
  text in there looked broken, not just tight. Real mobile Battlegrounds
  clients handle a full board the same compact way; tapping a board
  minion (which opens the sell sheet) is where its full name shows.
- 2026-09-27: Added a `text` field (short rules text, e.g. "Battlecry:
  Give another random friendly Reaver +1/+0.") to every minion in
  `src/data/minions.mjs`. They only had `flavor` (mood text) before —
  fine for step 1-4 since nothing rendered a card, but the shop UI needs
  actual rules text, not flavor, to be legible.

## Known open questions (do not silently resolve — ask)

- Exact UI copy/flavor text for the 10 shard abilities — deferred to step 5.
- Whether Shoal Call and Drowned Favor stack cleanly if both are rolled in
  one run — provisionally yes, revisit if playtesting shows it's degenerate.

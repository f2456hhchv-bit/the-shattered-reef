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
4. **AI decision engine** (sits on top of 2 + 3) — next
5. Board/shop UI, touch input, positioning
6. Round loop, health, win/loss
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

- **Phase:** 3 (Vertical Slice), step 3 of 8 (economy/shop engine) complete.
- **Just shipped:** `src/engine/economy.mjs` — shared card pool (finite
  copies, contested pool ready for AI to draw from in step 4), player
  state, income (`round+2`, capped at 10, no gold carryover), tavern-tier-
  weighted shop draws (tier cap 3 for the slice), buy/sell/reroll/freeze/
  upgrade, all battlecry action types the slice's cards use, and the full
  Reef Shard event flow: `isReefShardRound`, `offerReefShardChoices`
  (choice of 3, Lesser rounds 3-10 / Greater 11+), `applyReefShardChoice`
  (universal lockout + Fathom growth, Shoal Call/Bargain Tide/Drowned Favor
  shop effects, The Kraken's Due exception). 43/43 tests pass across the
  whole repo (`tests/economy.test.mjs` + existing combat/data tests).
- **Data fix along the way:** Fathom Priestess's battlecry was still
  `gain_reef_shard`, a leftover from the old "shards appear in the shop"
  design. Changed to `trigger_bonus_shard_event` (queues a bonus Lesser-pool
  choice) to match the locked scheduled-event design — updated
  `src/data/minions.mjs` and `src/data/keywords.mjs`'s `ACTION_TYPES`.
- **Known gap, not silently skipped:** the five Board-type shard abilities
  (Vampiric, Barnacled, Riptide, Undying, Twinned, Maelstrom) are recorded
  as tags on the instance (`instance.shardAbilities`), but `combat.mjs` was
  built in step 2, before this existed, and doesn't read that array yet.
  Titanic is the exception — it mutates base stats immediately, so it
  already works in combat with no further wiring. **This needs a follow-up
  patch to `combat.mjs`** before Reef Shard board abilities actually do
  anything in a fight — flag it if picking up step 4 or 5 without
  addressing this first.
- **Not built yet:** AI, all UI. `src/main.mjs` only proves the data loads
  in a browser — there is nothing to play yet.
- **Next up:** AI decision engine (step 4) — but consider patching the
  shard-ability gap in `combat.mjs` first, since the AI engine will need to
  evaluate boards that may carry these tags.

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

## Known open questions (do not silently resolve — ask)

- Exact UI copy/flavor text for the 10 shard abilities — deferred to step 5.
- Whether Shoal Call and Drowned Favor stack cleanly if both are rolled in
  one run — provisionally yes, revisit if playtesting shows it's degenerate.
- **combat.mjs doesn't yet read `instance.shardAbilities`** — see Current
  status. Needs a patch before Vampiric/Barnacled/Riptide/Undying/Twinned/
  Maelstrom do anything in a real fight.

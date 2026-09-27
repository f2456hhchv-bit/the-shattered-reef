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

1. **Data schema** (minions/factions/keywords) — ✅ done, this commit
2. **Combat simulator** (pure function, two boards in → resolution out) — next
3. **Economy/shop logic** (buy/sell/reroll/upgrade)
4. **AI decision engine** (sits on top of 2 + 3)
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

- **Phase:** 3 (Vertical Slice), step 2 of 8 (combat simulator) complete.
- **Just shipped:** `src/engine/combat.mjs` — pure function, two boards +
  each side's Fathom in, full resolution out (winner, damage, surviving
  boards, external effects for the caller to persist, an event log).
  Handles: alternating turns with a per-side cycling attacker pointer,
  taunt-respecting random targeting, simultaneous damage, chained deaths
  (a deathrattle killing a second minion resolves fully before combat
  continues), all 5 deathrattle/end-of-combat action types the slice's 21
  cards use, and the Fathom growing + `on_fathom_growth` reacting within
  the same fight. 21/21 tests pass (`tests/combat.test.mjs`), seeded via
  `src/engine/rng.mjs` for reproducibility.
- **Known simplification carried forward:** deathrattle summons append to
  the end of the board array rather than the dead minion's exact slot (see
  the comment block at the top of `combat.mjs`).
- **Not built yet:** economy/shop, AI, all UI. `src/main.mjs` only proves
  the data loads in a browser — there is nothing to play yet.
- **Next up:** economy/shop logic (step 3) — buy/sell/reroll/upgrade, and
  the Reef Shard shop mechanics, now fully specced in
  `docs/design/reef-shards.md` (locked 2026-09-27, see Decisions log).

## Reef Shard / Fathom design

Spec lives in `docs/design/reef-shards.md` — read it before building the
economy engine, since shard-feeding is a shop-phase action. **Locked**:
scheduled events every 4 rounds from round 3, choice of 3 from a Lesser/
Greater ability pool (10 abilities total, Board + Shop types), Fathom only
grows.

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

## Known open questions (do not silently resolve — ask)

- Exact UI copy/flavor text for the 10 shard abilities — deferred to step 5.
- Whether Shoal Call and Drowned Favor stack cleanly if both are rolled in
  one run — provisionally yes, revisit if playtesting shows it's degenerate.

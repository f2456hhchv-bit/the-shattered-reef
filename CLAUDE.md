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
- **Not built yet:** AI, all UI. `src/main.mjs` only proves the data loads
  in a browser — there is nothing to play yet.
- **Next up:** AI decision engine (step 4) — the shard-ability gap that
  would have complicated it is now closed, so step 4 can proceed cleanly.

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

## Known open questions (do not silently resolve — ask)

- Exact UI copy/flavor text for the 10 shard abilities — deferred to step 5.
- Whether Shoal Call and Drowned Favor stack cleanly if both are rolled in
  one run — provisionally yes, revisit if playtesting shows it's degenerate.

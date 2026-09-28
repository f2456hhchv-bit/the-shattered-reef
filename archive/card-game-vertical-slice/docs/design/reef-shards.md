# Reef Shards & the Fathom

The chance mechanic, and Wyrdtide's identity. **Locked 2026-09-27** — this
spec is what the economy engine (step 3) builds against; the two open
questions that used to block that work are resolved below.

## Reef Shard events — scheduled, not random appearance

Researched how the closest genre analogues handle this before locking it
(Hearthstone Battlegrounds Trinkets, TFT Augments, Storybook Brawl
Treasures) — none of them use pure random-availability. All of them use
scheduled, guaranteed choice moments, with power scaling to game stage.
Reef Shards follow the same pattern:

- A Reef Shard event fires **every 4 rounds, starting round 3** — round 3,
  7, 11, 15, 19, 23... — for the entire run, however long it runs. This is
  deliberate: it keeps giving a run that reaches round 25 fresh decisions,
  not just bigger numbers (see the Core Loop section of the PRD on
  unbounded run length).
- Each event offers a **choice of 3** abilities drawn from the tier pool
  below (never a single blind assignment) and the player assigns the one
  they pick to **any one minion currently on their board**.
- **Declining is always free** — skip the event entirely with no cost.
  This has to stay free, or the Blacksail Reavers side of the whole
  mechanic (gambling is optional, and costly when taken) collapses.
- Rounds 3–10 draw from the **Lesser** pool; round 11 onward draws from the
  **Greater** pool — mirroring Trinkets' Lesser/Greater split.

## The ability pool

Two kinds of ability, both live in the same pool and get offered
together — a Board ability changes the fed minion directly; a Shop ability
changes the run's economy instead and doesn't care which minion it's
nominally fed to.

| Tier | Ability | Type | Effect |
| --- | --- | --- | --- |
| Lesser | Vampiric | Board | Heals to full whenever it kills an enemy minion |
| Lesser | Barnacled | Board | +1/+1 permanently, every combat it's attacked and survives |
| Lesser | Riptide | Board | Attacking also splashes 1 damage to a second random enemy |
| Lesser | Shoal Call | Shop | Shop gains one extra slot for the rest of the run, biased toward your most-common faction |
| Lesser | Bargain Tide | Shop | Shop rerolls cost 1 less gold (min 0) for the rest of the run |
| Greater | Twinned | Board | Deathrattle fires twice |
| Greater | Titanic | Board | Doubles this minion's attack and health immediately |
| Greater | Undying | Board | The first time it would die each combat, survives at 1 health instead |
| Greater | Drowned Favor | Shop | Shop always includes a minion of your most-common faction, for the rest of the run |
| Greater | Maelstrom | Board | Deathrattle also copies itself onto two random friendly minions, permanently |

Whichever type is rolled, **the cost still applies**: the fed minion is
locked out of its own faction's buffs for the rest of the run, even on a
Shop-type roll where that minion gets no direct payoff. You don't know
which type you'll get before picking among the 3 offered — that
uncertainty is part of the gamble.

## The cost (unchanged)

- Feeding a Shard to a minion locks it out of its own faction's buffs for
  the rest of the run. A shard-fed Reaver no longer receives Reaver buffs
  (Cutlass Hand, Captain Vex, etc.), even though it's still visually and
  mechanically a Reaver.
- This lockout is a global engine rule, not a per-minion flag — it applies
  to every minion of every faction, including ones added later.

## The Fathom

- A per-player entity, not a minion on the board. Starts at 0/0. **Only
  grows, never decays** (confirmed).
- Every Reef Shard fed anywhere on your board — on any faction's minion,
  whichever ability type is rolled — grows the Fathom by +1/+1, in
  addition to whatever the rolled ability does.
- Wyrdtide minions read and grow the Fathom further through their own
  effects (`fathom_grow`, `fathom_double`, `fathom_to_board`,
  `on_fathom_growth` — see `src/data/keywords.mjs`).
- Non-Wyrdtide players still grow a Fathom if they feed shards, they just
  have no minions that read it — so a Fathom sits latent unless a run
  reroutes into Wyrdtide (a possible late-game pivot worth playtesting).

## The Kraken's Due exception

Blacksail Reavers are normally punished for gambling: a shard-fed Reaver
stops getting Reaver buffs. **The Kraken's Due** inverts this at the
faction level — it grows whenever *another* friendly Reaver is shard-fed
(any ability type), turning what looks like a cost into fuel for one
specific card. Implemented as a `passive` block on its data entry
(`onFriendlyReaverShardFed`), not a `trigger`, since it reacts to something
happening to a *different* minion — see CLAUDE.md's decisions log.

## Still open (flag before assuming an answer)

- Exact UI copy/flavor text for each ability — not needed for the engine,
  only for step 5 (UI).
- Whether Shoal Call and Drowned Favor's "extra slot" / "guaranteed
  minion" interact if a player rolls both in one run (currently: they
  stack independently, no special interaction — revisit if playtesting
  shows it's degenerate).

## Sources consulted

- [Hearthstone Battlegrounds Trinkets](https://hearthstone.wiki.gg/wiki/Battlegrounds/Trinket) — turn 6/9 fixed offerings, Lesser/Greater tiers, pivot discount
- [TFT Augments](https://wiki.leagueoflegends.com/en-us/TFT:Augment) — fixed offering points, choice of 3, rarity tiers scaling with game stage
- [Storybook Brawl](https://en.wikipedia.org/wiki/Storybook_Brawl) — weaker precedent, treasures bought from the shop pool directly

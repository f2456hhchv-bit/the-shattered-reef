# Reef Shards & the Fathom

The chance mechanic, and Wyrdtide's identity. Not yet implemented in the
engine — this is the spec the economy/combat engine (phase 4) builds against.

## Reef Shards

- A Reef Shard occasionally appears in the shop, like a minion would.
- Feeding a Shard to a minion on your board grants that minion one random,
  powerful, permanent ability from a fixed shard-ability pool (TBD — needs
  its own list before engine work starts).
- **The cost:** a shard-fed minion is locked out of its own faction's buffs
  for the rest of the run. A shard-fed Reaver no longer receives Reaver
  buffs (from Cutlass Hand, Captain Vex, etc.), even though it's still
  visually and mechanically a Reaver.
- This lockout is a global engine rule, not a per-minion flag — it applies
  to every minion of every faction, including ones added later.

## The Fathom

- A per-player entity, not a minion on the board. Starts at 0/0.
- Every Reef Shard fed anywhere on your board — on any faction's minion —
  grows the Fathom. (Exact growth amount TBD; provisionally +1/+1 per feed
  unless a minion's effect specifies otherwise, e.g. Shard Diver's battlecry.)
- Wyrdtide minions read and grow the Fathom directly through their own
  effects (`fathom_grow`, `fathom_double`, `fathom_to_board`,
  `on_fathom_growth` — see `src/data/keywords.mjs`).
- Non-Wyrdtide players still grow a Fathom if they feed shards, they just
  have no minions that read it — so a Fathom sits latent unless a run
  reroutes into Wyrdtide (a possible late-game pivot worth playtesting).

## The Kraken's Due exception

Blacksail Reavers are normally punished for gambling: a shard-fed Reaver
stops getting Reaver buffs. **The Kraken's Due** inverts this at the
faction level — it grows whenever *another* friendly Reaver is shard-fed,
turning what looks like a cost into fuel for one specific card. This is
implemented as a `passive` block on the minion's data entry
(`onFriendlyReaverShardFed`), not a `trigger`, because it must react to
something happening to a *different* minion, which the effect-trigger
system (battlecry/deathrattle/etc.) doesn't cover.

## Open questions before engine work starts

- What's in the shard-ability pool? (e.g. permanent Windfury, permanent
  +4/+4, "attacks twice", etc.) Needs its own short list.
- Shard appearance rate in the shop — needs a number, not just "occasionally".
- Does the Fathom decay, or only grow? (Provisional: only grows.)

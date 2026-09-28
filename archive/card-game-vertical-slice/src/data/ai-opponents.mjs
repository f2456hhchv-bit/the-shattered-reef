// Flavor for the AI-controlled seats at the table. Purely cosmetic — the
// AI engine (src/engine/ai.mjs) doesn't read anything from here, it just
// needs a player-state to act on. Capped at 7 so an 8-seat lobby (1 human +
// up to 7 of these) matches the original "plays against 8" design intent.

export const AI_OPPONENTS = [
  { name: 'Marrow Kess', blurb: 'Reaver quartermaster. Never met a fair fight she liked.' },
  { name: 'The Gullwrack', blurb: 'Wyrdtide zealot. Feeds the Fathom whatever it asks for.' },
  { name: 'Old Tallow', blurb: 'Neutral drifter. Takes whatever the tide brings in.' },
  { name: 'Bosun Fray', blurb: 'Reaver up through the ranks. Believes in more cutlasses.' },
  { name: 'Ysolde Pel', blurb: 'Wyrdtide diver. Has fed more shards than she can count.' },
  { name: "Cinder O'Rourke", blurb: 'Reaver captain, retired twice, un-retired twice.' },
  { name: 'The Drowned Choir', blurb: 'Wyrdtide cult, spoken of as one voice.' },
];

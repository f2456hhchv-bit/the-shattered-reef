// The home base (2026-09-28): the harbour you return to between voyages.
// Data only. engine/base.mjs builds the world from this and
// engine/baseRenderer.mjs draws it. Each building opens one real system in
// the Hub (main.mjs `panel` ids); nothing here is decoration pretending to
// be a feature.
//
// Buildings sit on a ring of islands around a sheltered lagoon. The ring is
// an ellipse, taller than it is wide, so the whole base fits a portrait
// phone. `angleDeg` is screen-space: -90 is north, 0 east, 90 south.

export const BASE_BUILDINGS = Object.freeze([
  { id: 'shipyard', name: 'Shipyard', sub: 'Ship hulls', icon: '⛵', panel: 'hulls', angleDeg: -90 },
  // Reef Defence (2026-09-29): the lighthouse island is the Tower Yard — a
  // lighthouse is one of the reef's towers. The Captain's Log it used to
  // open is on the captain chip at the top of the harbour.
  { id: 'lighthouse', name: 'Tower Yard', sub: 'Reef defences', icon: '🏰', panel: 'towers', angleDeg: -150 },
  { id: 'shrine', name: 'Charm Shrine', sub: 'Charms', icon: '🔮', panel: 'charms', angleDeg: -30 },
  { id: 'armory', name: 'Armory', sub: 'Cargo & ammo', icon: '💣', panel: 'cargo', angleDeg: 150 },
  { id: 'workshop', name: 'Workshop', sub: 'Crafting', icon: '⚒️', panel: 'workshop', angleDeg: 30 },
  { id: 'hall', name: 'Faction Hall', sub: 'Factions', icon: '🏴', panel: 'factions', angleDeg: 90 },
]);

export const BASE_LAYOUT = Object.freeze({
  tiles: 150, // world is tiles × 16px square (wide enough to fill a landscape view)
  seed: 0xba5e2026,
  ringRx: 182, // px from the lagoon centre to each building island
  ringRy: 245,
  islandRadius: 86,
  lagoonRadius: 138,
  channelHalfWidth: 26, // px — open water between neighbouring islands
  boatOrbit: { rx: 62, ry: 88, secondsPerLap: 38 },
  islets: 14, // small decorative islands out in the surrounding sea
  // What the camera must keep on screen. World px from the lagoon centre:
  // the tallest building's top above the ring, and each label's anchor
  // below its building. Labels are fixed-size DOM chips, so their size is
  // in screen px and is fitted separately (they don't shrink with the map).
  spriteAbove: 95, // building art reaches this far above its anchor
  spriteHalfWidth: 75,
  labelOffset: 38, // label anchor below the building (26 × BUILDING_SCALE)
  labelPx: { w: 136, h: 48 }, // a label chip, screen px incl. its badge
});

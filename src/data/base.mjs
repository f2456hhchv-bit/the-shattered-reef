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
  { id: 'lighthouse', name: "Captain's Log", sub: 'Your record', icon: '📜', panel: 'log', angleDeg: -150 },
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
  // Half-extent (px) the camera must keep on screen: ring + island + label.
  fitHalfWidth: 285,
  fitHalfHeight: 372,
});

Art inventory page (published as the "Shattered Reef Art Inventory" artifact).

Full refresh (2026-10-11), from a scratch work dir, with the repo served on
port 8940 (`python3 -m http.server 8940` in the repo root):

1. Copy `build_inv.py` and `inv_template.html` into the work dir, plus the
   last `prev-data.json` (its non-captured categories carry over).
2. `node <repo>/tools/art-inventory/galdata.mjs` — every code-drawn tile from
   tools/asset-gallery.html → gallery-data.json.
3. `node <repo>/tools/art-inventory/spritedata.mjs` — the real sprites
   (ships, creatures, bosses, buildings) via sprites.html → sprite-data.json.
4. `python3 <repo>/tools/art-inventory/capture/emoji_scan.py` — emoji used in
   src/ with counts and example names → emoji.json.
5. Captures from the live game (each takes a minute or three):
   - `node capture/capture-ui.mjs <caps>/shots-ui` — every UI · item
   - `node capture/capture-game.mjs <caps>/shots-game arena` — terrain-N.png
     per biome (also: `lineup` = every stage's roster at true scale next to
     the player's sloop, `td` = all Reef Defence maps, `land` = landscape)
   - `node capture/capture-weather.mjs <caps>/shots-weather` — all 35 events
   - `python3 capture/make_prev.py <caps> <workdir>` → prev-data.json
6. `python3 build_inv.py` → art-inventory.html (copy to index.html here, then
   republish the artifact). Verdicts per category live in build_inv.py (CAT,
   SIMPLE, TOY_PRI); the prompt kit (header, batches) in inv_template.html.

`capture/sheet.py out.png cellW cellH cols files…` makes a contact sheet for
eyeballing a batch of captures.

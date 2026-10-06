Art inventory page (published as the "Shattered Reef Art Inventory" artifact).

1. Serve the repo (`python3 -m http.server 8940`) and run `node galdata.mjs`
   to export every code-drawn tile from tools/asset-gallery.html.
2. Terrain/weather/UI screenshots and emoji.json come from capture scripts
   run against the live game (see git history of this folder's commit).
3. `python3 build_inv.py` merges them into art-inventory.html from
   inv_template.html. Verdicts per category live in build_inv.py (CAT, FX).

4. `node spritedata.mjs` (with the server running) renders the real sprites
   via sprites.html into sprite-data.json, so done/old-style tiles show the
   in-game image. Style status (toy / old painted / code) and restyle
   priorities live in build_inv.py (TOY, EARLY); the prompt kit (header,
   batches A-G) lives in inv_template.html.

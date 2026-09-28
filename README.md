# The Shattered Reef

A mobile, single-player nautical roguelite: captain a ship through
procedurally generated maze-like reef levels, fight enemies that each
demand reading their niche and countering with the right weapon, and push
deeper before you die — permadeath runs, meta-progression between them.
Inspired by *Overboard!* (PS1, 1997), with a roguelite structure added on
top. Canvas 2D, vanilla JS, no build step.

This repo previously held a different game (a card-game auto-battler —
see `archive/card-game-vertical-slice/`) before pivoting. Build status for
the current game is tracked in `CLAUDE.md`.

## Running it locally

No install, no build. Either:

- Open `index.html` directly in a browser, or
- `python3 -m http.server` in this folder, then visit `http://localhost:8000`
  — needed if you want to test on your phone over the same wifi
  (`http://<your-computer's-LAN-IP>:8000`).

## Testing

```
node --test tests/
```

Pure Node, no dependencies, no bundler.

## Playing on your phone

Once pushed to `main`, GitHub Pages serves this repo directly (no build
step in between). Open the Pages URL on your phone and **Add to Home
Screen** for a full-screen, app-like shortcut — reopen it after every push
to see the latest build.

# The Shattered Reef

A mobile, single-player, Hearthstone Battlegrounds-style auto-battler. You
build a crew across rounds against 7 AI captains — pirates and fantasy,
original world, no build step.

Full design doc: see the PRD (linked from the project owner's docs). This
repo tracks build status in `CLAUDE.md`.

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

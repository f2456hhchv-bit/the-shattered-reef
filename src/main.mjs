// Entry point. Boots the board/shop UI (step 5 of the build order — see
// CLAUDE.md). No opponents, combat, or win/loss yet (step 6); no Reef Shard
// picker yet (step 7) — src/ui/app.mjs flags that gap with a toast rather
// than silently skipping it.
import { startApp } from './ui/app.mjs';

startApp(document.getElementById('app'));

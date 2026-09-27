// Entry point. Right now this only proves the data layer loads cleanly in
// a real browser — no engine, no UI yet (see CLAUDE.md, phase log).
import { MINIONS } from './data/minions.mjs';
import { FACTIONS } from './data/factions.mjs';

const boot = document.getElementById('boot');

const counts = Object.fromEntries(
  Object.keys(FACTIONS).map((f) => [f, MINIONS.filter((m) => m.faction === f).length])
);

boot.innerHTML = `THE SHATTERED REEF<br>
<span style="font-size:.6em;opacity:.7">data loaded — ${MINIONS.length} minions
(${Object.entries(counts).map(([f, n]) => `${FACTIONS[f].name}: ${n}`).join(', ')})<br>
engine + board not built yet</span>`;

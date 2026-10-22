// Crew barks (2026-10-22): a crewmate's face and a line in a bubble, on
// the moments that matter (a boss, low hull, an evolution, a key turned).
// After Hades: the crew notice what you do. Throttled so it's flavour, not
// noise: one at a time, a few seconds apart, the big moments jump the queue.

import { CREW } from '../data/crew.mjs';
import { CHARACTERS } from '../data/story.mjs';
import { portraitEl } from './storyScene.mjs';

const GAP = 9; // seconds between ordinary barks
const PRIORITY = new Set(['boss', 'key', 'evolve']);

export function createBarks(root) {
  const el = document.createElement('div');
  el.id = 'crew-bark'; el.hidden = true;
  root.appendChild(el);
  let cool = 2; let life = 0; let last = null;
  return {
    // `aboard`: crew ids; `event`: a CREW[...].barks key.
    say(aboard, event, rng = Math.random) {
      if (!aboard?.length) return false;
      if (cool > 0 && !PRIORITY.has(event)) return false;
      const who = aboard.filter((id) => CREW[id]?.barks?.[event]?.length);
      if (!who.length) return false;
      // Don't let the same crewmate talk twice in a row if someone else can.
      const pool = who.length > 1 ? who.filter((id) => id !== last) : who;
      const id = pool[Math.floor(rng() * pool.length)];
      const lines = CREW[id].barks[event];
      const c = CHARACTERS[id];
      el.replaceChildren(portraitEl(id, 34));
      const t = document.createElement('div');
      t.innerHTML = '<b></b><span></span>';
      t.querySelector('b').textContent = c.name.split(' ')[0];
      t.querySelector('span').textContent = lines[Math.floor(rng() * lines.length)];
      el.appendChild(t);
      el.style.setProperty('--pc', c.colour);
      el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      life = 3.2; cool = GAP; last = id;
      return true;
    },
    // Any character, any line (Nana in the harbour, Hollis cheating death).
    sayLine(charId, text, seconds = 4.5) {
      const c = CHARACTERS[charId]; if (!c) return;
      el.replaceChildren(portraitEl(charId, 34));
      const t = document.createElement('div');
      t.innerHTML = '<b></b><span></span>';
      t.querySelector('b').textContent = c.name;
      t.querySelector('span').textContent = text;
      el.appendChild(t);
      el.style.setProperty('--pc', c.colour);
      el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      life = seconds; cool = GAP; last = charId;
    },
    tick(dt) {
      cool -= dt;
      if (life > 0) { life -= dt; if (life <= 0) el.hidden = true; }
    },
    clear() { el.hidden = true; life = 0; cool = 2; },
  };
}

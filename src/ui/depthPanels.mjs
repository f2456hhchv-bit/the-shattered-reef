// Harbour panels for the depth systems (2026-10-22): the crew, the keys
// (in the Charm Shrine), the Gunsmith (in the Armory), refits and wakes (in
// the Shipyard) and the story so far (in the Captain's Log). Each renders
// into a container and calls `onChange` after a purchase or a choice, so
// main.mjs can save and refresh. Rows use the harbour's shop row styles.

import { CHARACTERS, CHAPTERS, PROLOGUE } from '../data/story.mjs';
import { CREW, CREW_IDS, BOND_LEVELS } from '../data/crew.mjs';
import { KEYS, KEY_IDS, KEY_MAX_LEVEL } from '../data/keys.mjs';
import { SV_WEAPONS, SV_WEAPON_IDS } from '../data/survival.mjs';
import { REFIT_TRACKS, REFIT_MAX, MASTERY_MAX, CREW_QUARTERS, WAKES, SHIP_PERSONA, refitCap, masteryCap } from '../data/shop.mjs';
import {
  bondProgress, toggleCrew, purchaseCrewQuarters, equipKey, keyLevel, nextKeyPrice, purchaseKeyLevel,
  refitLevel, nextRefitPrice, purchaseRefit, masteryLevel, nextMasteryPrice, purchaseMastery,
  purchaseWake, selectWake, meetsRequires, stagesCleared,
} from '../engine/depth.mjs';
import { keyStats } from '../engine/keys.mjs';
import { portraitEl } from './storyScene.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const price = (p) => `${p.salvage.toLocaleString('en-GB')} ⚓${p.scales ? ` + ${p.scales} 🦑` : ''}`;
const canPay = (meta, p) => meta.salvage >= p.salvage && (meta.krakenScales || 0) >= (p.scales || 0);

function row({ icon = null, portrait = null, name, desc, stats = '', button, disabled = false, onClick, cls = '' }) {
  const r = document.createElement('div');
  r.className = `hub-item ${cls}`;
  r.innerHTML = `<span class="hub-item-icon"></span><div class="hub-item-info"><span class="hub-item-name"></span><span class="hub-item-desc"></span>${stats ? '<span class="hull-stats"></span>' : ''}</div><button type="button" class="hub-item-btn"></button>`;
  const ic = r.querySelector('.hub-item-icon');
  if (portrait) ic.replaceWith(portraitEl(portrait, 48)); else ic.textContent = icon || '';
  r.querySelector('.hub-item-name').textContent = name;
  r.querySelector('.hub-item-desc').textContent = desc;
  if (stats) r.querySelector('.hull-stats').innerHTML = stats;
  const b = r.querySelector('button');
  b.textContent = button; b.disabled = disabled;
  if (onClick) b.addEventListener('click', onClick);
  return r;
}
function head(el, text, note = '') {
  const h = document.createElement('h3'); h.className = 'hub-subhead'; h.textContent = text; el.appendChild(h);
  if (note) { const p = document.createElement('p'); p.className = 'hub-section-note'; p.textContent = note; el.appendChild(p); }
}

// --- Crew --------------------------------------------------------------------
export function renderCrewPanel(el, meta, { onChange, onTalk }) {
  el.replaceChildren();
  head(el, `Aboard · ${meta.crewAboard.length}/${meta.crewSlots}`, 'Tap a crewmate to bring them aboard or send them ashore. Sailing together builds their bond, and each bond level makes their gift 10% stronger.');
  for (const id of CREW_IDS) {
    const c = CREW[id]; const ch = CHARACTERS[id];
    const owned = meta.crewOwned.includes(id); const aboard = meta.crewAboard.includes(id);
    if (!owned) {
      const chapter = CHAPTERS.find((x) => x.recruit === id);
      el.appendChild(row({ portrait: id, name: '???', desc: `Joins after Stage ${chapter?.stage}: ${chapter?.title}.`, button: '🔒', disabled: true, cls: 'locked-row' }));
      continue;
    }
    const b = bondProgress(meta, id);
    const pips = '♥'.repeat(b.level) + '♡'.repeat(BOND_LEVELS.length - b.level);
    const r = row({
      portrait: id, name: `${ch.name} · ${c.role}`, desc: c.passive,
      stats: `<b>${pips}</b> bond ${b.level}/${BOND_LEVELS.length}${b.level < BOND_LEVELS.length ? ` · ${Math.round(b.into * 100)}% to next` : ''}`,
      button: aboard ? 'Aboard ✓' : 'Bring aboard', cls: aboard ? 'aboard' : '',
      onClick: () => { toggleCrew(meta, id); onChange(); },
    });
    r.querySelector('.portrait')?.addEventListener('click', () => onTalk?.(id));
    el.appendChild(r);
  }
  if (meta.crewSlots < 3) {
    head(el, 'Crew Quarters');
    const ok = meetsRequires(meta, CREW_QUARTERS.requires);
    const p = { salvage: CREW_QUARTERS.cost, scales: CREW_QUARTERS.scales };
    el.appendChild(row({
      icon: '🛏️', name: 'A third berth', desc: 'Knock through the hold: three crew sail with you instead of two.',
      button: ok ? price(p) : `🔒 Stage ${CREW_QUARTERS.requires}`, disabled: !ok || !canPay(meta, p),
      onClick: () => { purchaseCrewQuarters(meta); onChange(); },
    }));
  }
}

// --- Keys (the Charm Shrine) ---------------------------------------------------
export function renderKeysSection(el, meta, { onChange }) {
  el.replaceChildren();
  head(el, 'The Keys', 'Carry one key on a voyage. Sinking enemies charges it; tap the key button to turn it. Each stage boss holds a key.');
  for (const id of KEY_IDS) {
    const k = KEYS[id];
    if (!meta.keysOwned.includes(id)) {
      el.appendChild(row({ icon: '🔒', name: '???', desc: `Held by the boss of Stage ${k.stage}.`, button: 'Lost', disabled: true, cls: 'locked-row' }));
      continue;
    }
    const lv = keyLevel(meta, id); const st = keyStats(id, lv); const eq = meta.keyEquipped === id;
    const r = row({
      icon: k.icon, name: `${k.name} · ${k.power}`, desc: k.desc,
      stats: `Lv ${lv}/${KEY_MAX_LEVEL} · ${st.need} sinks to charge · <i>${esc(k.lore)}</i>`,
      button: eq ? 'Carried ✓' : 'Carry', disabled: eq, cls: eq ? 'aboard' : '',
      onClick: () => { equipKey(meta, id); onChange(); },
    });
    const np = nextKeyPrice(meta, id);
    if (np) {
      const up = document.createElement('button');
      up.type = 'button'; up.className = 'hub-item-btn up-btn';
      up.textContent = `Keysmith → Lv ${np.level} · ${price(np)}`;
      up.disabled = !canPay(meta, np);
      up.addEventListener('click', () => { purchaseKeyLevel(meta, id); onChange(); });
      r.querySelector('.hub-item-info').appendChild(up);
    }
    el.appendChild(r);
  }
}

// --- Gunsmith (the Armory) -------------------------------------------------------
export function renderGunsmith(el, meta, { onChange }) {
  el.replaceChildren();
  const cap = masteryCap(stagesCleared(meta));
  head(el, 'Gunsmith', `Weapon mastery, for every voyage: +6% damage a level, a faster reload at 5, one more shot per volley at 10. You can master up to level ${cap}; clearing stages raises it.`);
  for (const id of SV_WEAPON_IDS) {
    const w = SV_WEAPONS[id]; const lv = masteryLevel(meta, id); const np = nextMasteryPrice(meta, id);
    const label = !np ? 'Mastered' : np.capped ? `🔒 Clear Stage ${Math.ceil((np.level - 2) / 2)}` : price(np);
    el.appendChild(row({
      icon: w.icon, name: `${w.name} · mastery ${lv}/${MASTERY_MAX}`,
      desc: lv >= 10 ? 'Mastered: +60% damage, faster reload, an extra shot.' : `Now +${lv * 6}% damage${lv >= 5 ? ', faster reload' : ''}.`,
      stats: `<b>${'▰'.repeat(lv)}${'▱'.repeat(MASTERY_MAX - lv)}</b>`,
      button: label, disabled: !np || np.capped || !canPay(meta, np),
      onClick: () => { purchaseMastery(meta, id); onChange(); },
    }));
  }
}

// --- Refits and wakes (the Shipyard) ------------------------------------------------
export function renderRefits(el, meta, hullId, { onChange }) {
  el.replaceChildren();
  const persona = SHIP_PERSONA[hullId];
  const cap = refitCap(stagesCleared(meta));
  head(el, `Refits · ${persona?.shipName || hullId}`, `Every refit stays with this ship. Up to level ${cap} for now; clearing stages lets the yard go further.`);
  for (const tr of REFIT_TRACKS) {
    const lv = refitLevel(meta, hullId, tr.id); const np = nextRefitPrice(meta, hullId, tr.id);
    const label = !np ? 'Maxed' : np.capped ? `🔒 Clear Stage ${Math.ceil((np.level - 2) / 2)}` : price(np);
    el.appendChild(row({
      icon: tr.icon, name: `${tr.name} · ${lv}/${REFIT_MAX}`, desc: `Each level: ${tr.per}.`,
      stats: `<b>${'▰'.repeat(lv)}${'▱'.repeat(REFIT_MAX - lv)}</b>`,
      button: label, disabled: !np || np.capped || !canPay(meta, np) || !meta.ownedHulls.includes(hullId),
      onClick: () => { purchaseRefit(meta, hullId, tr.id); onChange(); },
    }));
  }
}

export function renderWakes(el, meta, { onChange }) {
  el.replaceChildren();
  head(el, 'Wakes', 'The trail behind your ship. Pure show-off.');
  for (const w of WAKES) {
    const owned = meta.wakesOwned.includes(w.id); const sel = meta.wake === w.id;
    const ok = meetsRequires(meta, w.requires);
    const r = row({
      icon: '〰️', name: w.name, desc: w.desc,
      button: sel ? 'Sailing ✓' : owned ? 'Use' : !ok ? `🔒 Stage ${w.requires}` : `${w.cost.toLocaleString('en-GB')} ⚓`,
      disabled: sel || (!owned && (!ok || meta.salvage < w.cost)), cls: sel ? 'aboard' : '',
      onClick: () => { if (owned) selectWake(meta, w.id); else purchaseWake(meta, w.id); onChange(); },
    });
    const sw = r.querySelector('.hub-item-icon');
    if (sw) { sw.textContent = ''; sw.className = 'hub-item-icon wake-swatch'; sw.style.background = `linear-gradient(90deg, ${w.colours.join(', ')})`; }
    el.appendChild(r);
  }
}

// --- The story so far (the Captain's Log) ---------------------------------------
export function renderStoryTab(el, meta, { onReplay }) {
  el.replaceChildren();
  const p = document.createElement('p'); p.className = 'hub-section-note';
  p.textContent = 'The Great Reef broke twenty years ago and its ten keys were lost. Bring them home before someone turns them.';
  el.appendChild(p);
  const entries = [{ key: 'prologue', title: 'Prologue: The tide runs backwards', script: PROLOGUE }];
  for (const c of CHAPTERS) {
    entries.push({ key: `intro:${c.stage}`, title: `Stage ${c.stage}: ${c.title}`, script: c.intro, stage: c.stage });
    entries.push({ key: `outro:${c.stage}`, title: `Stage ${c.stage}: the ${KEYS[c.key].name}`, script: c.outro, stage: c.stage });
  }
  for (const e of entries) {
    const seen = meta.storySeen?.[e.key];
    el.appendChild(row({
      icon: seen ? '📖' : '🔒', name: seen ? e.title : '???', desc: seen ? `${e.script.length} lines` : 'Not yet told.',
      button: seen ? 'Replay' : '—', disabled: !seen, onClick: () => onReplay(e.script, e.title),
    }));
  }
}

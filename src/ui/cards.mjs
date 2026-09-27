// Builds the DOM for a single minion card. Shared by the shop (renders a
// def, with a cost badge and an affordability state) and the board (renders
// a live instance, with its current — possibly buffed — stats and any Reef
// Shard tags it's carrying). Pure DOM construction, no event wiring here —
// app.mjs attaches listeners to whatever this returns.

import { MINION_BY_ID } from '../data/minions.mjs';
import { SHARD_ABILITIES } from '../engine/economy.mjs';

const SHARD_LABEL_BY_ID = Object.fromEntries(
  [...SHARD_ABILITIES.lesser, ...SHARD_ABILITIES.greater].map((a) => [a.id, a.label])
);

const KEYWORD_ICON = {
  taunt: '🛡',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// `minion` is either a board instance (has instanceId/attack/health/etc.)
// or a shop slot's def (from MINION_BY_ID) — both share attack/health/
// keywords/faction/text, which is all a card needs to render.
//
// `compact` renders the board's small token form (icons + stats only, no
// name or rules text — there simply isn't width for it across 7 columns on
// a phone screen, and it's how real mobile Battlegrounds-likes handle a
// full board too). The shop, with only 3-6 slots, always gets the full card.
export function buildCard(minion, { cost, affordable, locked = false, compact = false } = {}) {
  const def = MINION_BY_ID[minion.defId ?? minion.id];
  const card = el('div', compact ? 'card card-compact' : 'card');
  card.dataset.faction = def.faction;
  if (locked) card.classList.add('card-locked');
  if (affordable === false) card.classList.add('unaffordable');

  if (cost != null) {
    const costBadge = el('div', 'card-cost', String(cost));
    card.appendChild(costBadge);
  }

  if (compact) {
    if (minion.keywords.length) {
      const kwRow = el('div', 'card-keywords card-keywords-icons');
      for (const kw of minion.keywords) kwRow.appendChild(el('span', 'card-keyword-icon', KEYWORD_ICON[kw] ?? kw[0].toUpperCase()));
      card.appendChild(kwRow);
    }
  } else {
    card.appendChild(el('div', 'card-name', def.name));

    if (minion.keywords.length) {
      const kwRow = el('div', 'card-keywords');
      for (const kw of minion.keywords) kwRow.appendChild(el('span', 'card-keyword', kw));
      card.appendChild(kwRow);
    }

    card.appendChild(el('div', 'card-text', def.text || def.flavor));
  }

  if (minion.shardAbilities?.length) {
    const tagRow = el('div', 'card-shard-tags');
    for (const id of minion.shardAbilities) {
      tagRow.appendChild(el('span', 'card-shard-tag', compact ? '⟡' : (SHARD_LABEL_BY_ID[id] ?? id)));
    }
    card.appendChild(tagRow);
  }

  const footer = el('div', 'card-footer');
  const stats = el('div', 'card-stats');
  stats.appendChild(el('span', 'card-stat-attack', String(minion.attack)));
  stats.appendChild(el('span', 'card-stat-health', String(minion.health)));
  footer.appendChild(stats);
  card.appendChild(footer);

  return card;
}

export function buildEmptySlot() {
  return el('div', 'card-empty', '·');
}

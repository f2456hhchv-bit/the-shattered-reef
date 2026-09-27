// The UI controller: wires economy.mjs's own functions to touch input and
// re-renders the DOM after every state change. This is step 5 of the build
// order (board/shop UI, touch input, positioning) — there is deliberately
// no opponent, no combat, and no win/loss here yet (that's step 6), and no
// Reef Shard picker UI yet (that's step 7, see the toast note below). "End
// Turn" is a placeholder that only advances the shop/economy round so this
// step is playable and testable on its own.

import {
  createSharedPool, createPlayerState, startRound, refreshShop, freezeShop,
  buyMinion, sellMinion, upgradeTavern, isReefShardRound,
  BOARD_CAP, MAX_TAVERN_TIER, rerollCost, nextUpgradeCost,
} from '../engine/economy.mjs';
import { MINION_BY_ID } from '../data/minions.mjs';
import { buildCard, buildEmptySlot } from './cards.mjs';
import { enableBoardReorder } from './dragdrop.mjs';

export function startApp(root) {
  const pool = createSharedPool();
  const state = createPlayerState();
  const rng = Math.random;
  let round = 1;
  let pendingSellInstanceId = null;

  root.innerHTML = '';
  const hud = el('header', 'hud-bar');
  hud.id = 'hud';
  const boardWrap = el('section');
  boardWrap.id = 'board-wrap';
  const boardTitle = el('div', '', 'Your Board');
  boardTitle.id = 'board-title';
  const board = el('div');
  board.id = 'board';
  boardWrap.append(boardTitle, board);

  const controls = el('div');
  controls.id = 'controls';

  const shopWrap = el('section');
  shopWrap.id = 'shop-wrap';
  const shopTitle = el('div', '', 'Tavern');
  shopTitle.id = 'shop-title';
  const shop = el('div');
  shop.id = 'shop';
  shopWrap.append(shopTitle, shop);

  root.append(hud, boardWrap, controls, shopWrap);

  const overlay = el('div');
  overlay.id = 'overlay';
  overlay.className = 'hidden';
  const sheet = el('div');
  sheet.id = 'action-sheet';
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) closeSheet(); });

  const toast = el('div');
  toast.id = 'toast';
  document.body.appendChild(toast);
  let toastTimer = null;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function closeSheet() {
    overlay.classList.add('hidden');
    pendingSellInstanceId = null;
  }

  function openSellSheet(instanceId) {
    const minion = state.board.find((m) => m.instanceId === instanceId);
    if (!minion) return;
    const def = MINION_BY_ID[minion.defId];
    pendingSellInstanceId = instanceId;
    sheet.innerHTML = '';
    sheet.appendChild(el('h3', '', `Sell ${def.name}?`));
    sheet.appendChild(el('p', '', 'You’ll get 1 gold back and a copy returns to the shared pool.'));
    const buttons = el('div', 'sheet-buttons');
    const cancel = el('button', '', 'Keep it');
    cancel.addEventListener('click', closeSheet);
    const confirm = el('button', 'confirm-sell', 'Sell for 1g');
    confirm.addEventListener('click', () => {
      try {
        sellMinion(state, pool, instanceId);
        closeSheet();
        render();
      } catch (err) {
        showToast(err.message);
      }
    });
    buttons.append(cancel, confirm);
    sheet.appendChild(buttons);
    overlay.classList.remove('hidden');
  }

  function safely(action) {
    try {
      action();
    } catch (err) {
      showToast(err.message);
    }
    render();
  }

  function onBuy(shopIndex) {
    safely(() => buyMinion(state, shopIndex));
  }

  function onReroll() {
    safely(() => refreshShop(state, pool, rng));
  }

  function onFreeze() {
    if (state.frozen) return; // freeze is single-use per round in economy.mjs — nothing to undo mid-round
    safely(() => freezeShop(state));
  }

  function onUpgrade() {
    safely(() => upgradeTavern(state));
  }

  function onEndTurn() {
    round += 1;
    startRound(state, pool, round, rng);
    if (isReefShardRound(round)) {
      // Reef Shard picker UI is step 7 (see CLAUDE.md build order) — the
      // event exists in the engine (economy.mjs) but isn't presented here
      // yet. Flagged visibly rather than silently skipped.
      showToast('⟡ A Reef Shard event is available this round (UI arrives in step 7)');
    }
    render();
  }

  function onReorder(fromIndex, toIndex) {
    if (fromIndex !== toIndex) {
      const [moved] = state.board.splice(fromIndex, 1);
      state.board.splice(toIndex, 0, moved);
    }
    render();
  }

  controls.append(
    button('reroll', `Reroll <span class="sub">${rerollCost(state)}g</span>`, onReroll),
    button('freeze', 'Freeze', onFreeze),
    button('end-turn', 'End Turn ▶', onEndTurn)
  );

  startRound(state, pool, round, rng);
  render();

  function render() {
    renderHud();
    renderBoard();
    renderControls();
    renderShop();
  }

  function renderHud() {
    hud.innerHTML = '';
    hud.appendChild(hudStat('Round', round));
    hud.appendChild(hudStat('Gold', `${state.gold}/${state.maxGold}`));
    const healthStat = hudStat('Health', state.health);
    healthStat.classList.add('health');
    hud.appendChild(healthStat);
    hud.appendChild(el('div', 'hud-spacer'));

    const canUpgrade = state.tavernTier < MAX_TAVERN_TIER;
    const upgradeBtn = el('button', 'hud-upgrade');
    const dots = el('span', 'tier-dots');
    for (let i = 1; i <= MAX_TAVERN_TIER; i++) {
      dots.appendChild(el('span', i <= state.tavernTier ? 'filled' : ''));
    }
    upgradeBtn.append(
      document.createTextNode(`Tier ${state.tavernTier} `),
      dots,
      document.createTextNode(canUpgrade ? ` · Upgrade (${nextUpgradeCost(state)}g)` : ' · Max')
    );
    upgradeBtn.disabled = !canUpgrade || state.gold < nextUpgradeCost(state);
    upgradeBtn.addEventListener('click', onUpgrade);
    hud.appendChild(upgradeBtn);
  }

  function hudStat(label, value) {
    const wrap = el('div', 'hud-stat');
    wrap.append(el('div', 'label', label), el('div', 'value', String(value)));
    return wrap;
  }

  function renderBoard() {
    board.innerHTML = '';
    const slotEls = [];
    for (let i = 0; i < BOARD_CAP; i++) {
      const slot = el('div', 'board-slot');
      const minion = state.board[i];
      if (minion) {
        const card = buildCard(minion, { locked: !!minion.shardLocked, compact: true });
        card.dataset.instanceId = minion.instanceId;
        slot.appendChild(card);
      } else {
        slot.appendChild(buildEmptySlot());
      }
      board.appendChild(slot);
      slotEls.push(slot);
    }
    enableBoardReorder(board, slotEls, {
      onTap: (instanceId) => { if (instanceId) openSellSheet(instanceId); },
      onReorder,
    });
  }

  function renderControls() {
    const [rerollBtn, freezeBtn] = controls.children;
    rerollBtn.innerHTML = `Reroll <span class="sub">${rerollCost(state)}g</span>`;
    rerollBtn.disabled = state.gold < rerollCost(state);
    freezeBtn.classList.toggle('active', state.frozen);
    freezeBtn.disabled = state.frozen;
  }

  function renderShop() {
    shop.innerHTML = '';
    state.shop.forEach((slot, index) => {
      const wrap = el('div', 'shop-slot');
      if (slot) {
        const def = MINION_BY_ID[slot.defId];
        const affordable = state.gold >= def.cost;
        const card = buildCard(def, { cost: def.cost, affordable });
        card.addEventListener('click', () => onBuy(index));
        wrap.appendChild(card);
      } else {
        wrap.appendChild(buildEmptySlot());
      }
      shop.appendChild(wrap);
    });
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, html, onClick) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.innerHTML = html;
  btn.addEventListener('click', onClick);
  return btn;
}

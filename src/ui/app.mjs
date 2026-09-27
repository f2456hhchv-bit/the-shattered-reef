// The UI controller. Step 6 turns this from a shop toy into an actual
// match: an 8-seat lobby (you + 7 AI), a real round loop (shop → Reef
// Shard event → combat → elimination), health, and win/loss — see
// src/engine/roundloop.mjs for the engine side of all of this.
//
// The Reef Shard picker built here is functional but plain — no glow,
// no Fathom-bar animation, no growth flourish. That polish is step 7
// ("Reef Shard + Fathom visuals/feedback") on purpose; this step's job was
// just making the event resolvable at all, since the round loop can't
// skip it — Wyrdtide's entire mechanic depends on it.

import {
  createSharedPool, createPlayerState, isReefShardRound, offerReefShardChoices,
  buyMinion, sellMinion, refreshShop, freezeShop, upgradeTavern,
  BOARD_CAP, MAX_TAVERN_TIER, effectiveRerollCost, nextUpgradeCost,
} from '../engine/economy.mjs';
import {
  createLobby, beginRound, runAiShopPhase, runAiReefShardPhase,
  resolveHumanReefShardChoice, runCombatPhase, checkGameOver,
} from '../engine/roundloop.mjs';
import { MINION_BY_ID } from '../data/minions.mjs';
import { AI_OPPONENTS } from '../data/ai-opponents.mjs';
import { buildCard, buildEmptySlot } from './cards.mjs';
import { enableBoardReorder } from './dragdrop.mjs';

const LOBBY_SIZE = 8;

export function startApp(root) {
  const rng = Math.random;
  const pool = createSharedPool();
  const playerDefs = [{ id: 'you', name: 'You', isHuman: true, state: createPlayerState() }];
  const opponents = shuffleCopy(AI_OPPONENTS, rng).slice(0, LOBBY_SIZE - 1);
  opponents.forEach((opp, i) => {
    playerDefs.push({ id: `ai${i}`, name: opp.name, isHuman: false, state: createPlayerState() });
  });
  const lobby = createLobby(playerDefs, pool);
  const human = lobby.players[0];
  const state = human.state; // kept as a short local alias — used constantly below
  let round = 0;
  let pendingSellInstanceId = null;

  root.innerHTML = '';
  const hud = el('header', 'hud-bar');
  hud.id = 'hud';
  const standings = el('div');
  standings.id = 'standings';

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

  root.append(hud, standings, boardWrap, controls, shopWrap);

  const overlay = el('div');
  overlay.id = 'overlay';
  overlay.className = 'hidden';
  const sheet = el('div');
  sheet.id = 'action-sheet';
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  let overlayDismissible = true;
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay && overlayDismissible) closeSheet(); });

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
  function openSheet({ dismissible = true } = {}) {
    overlayDismissible = dismissible;
    overlay.classList.remove('hidden');
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
    openSheet();
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
    if (state.frozen) return;
    safely(() => freezeShop(state));
  }
  function onUpgrade() {
    safely(() => upgradeTavern(state));
  }
  function onReorder(fromIndex, toIndex) {
    if (fromIndex !== toIndex) {
      const [moved] = state.board.splice(fromIndex, 1);
      state.board.splice(toIndex, 0, moved);
    }
    render();
  }

  // ---------------------------------------------------------------- round loop

  function startRoundFlow(nextRound) {
    round = nextRound;
    beginRound(lobby, round, rng);

    if (isReefShardRound(round)) {
      // Every AI resolves its own independent draw of 3 (same as a human
      // would get) via runAiReefShardPhase; the human gets their own draw
      // too and picks through the sheet below. Nothing requires everyone
      // at the table to see the same trio — if anything, an independent
      // draw per seat matches genre precedent (Battlegrounds Trinkets,
      // TFT Augments) better than a shared one would.
      runAiReefShardPhase(lobby, round, rng);
      if (human.state.health > 0) {
        openReefShardSheet(offerReefShardChoices(round, rng), () => render());
      }
    }
    render();
  }

  function openReefShardSheet(choices, onDone) {
    sheet.innerHTML = '';
    sheet.appendChild(el('h3', '', '⟡ A Reef Shard surfaces'));
    sheet.appendChild(el('p', '', 'Feed it to a minion on your board, or let it go — declining always costs nothing.'));

    let selectedAbility = null;
    const abilityRow = el('div', 'shard-ability-row');
    const abilityButtons = [];
    for (const ability of choices) {
      const btn = el('button', 'shard-ability-btn');
      btn.appendChild(el('div', 'shard-ability-label', ability.label));
      btn.appendChild(el('div', 'shard-ability-text', ability.text));
      btn.addEventListener('click', () => {
        selectedAbility = ability;
        for (const b of abilityButtons) b.classList.remove('selected');
        btn.classList.add('selected');
        renderTargets();
      });
      abilityRow.appendChild(btn);
      abilityButtons.push(btn);
    }
    sheet.appendChild(abilityRow);

    const targetRow = el('div', 'shard-target-row');
    sheet.appendChild(targetRow);

    function renderTargets() {
      targetRow.innerHTML = '';
      if (!state.board.length) {
        targetRow.appendChild(el('p', '', 'You have no minion to feed it to.'));
        return;
      }
      for (const minion of state.board) {
        const def = MINION_BY_ID[minion.defId];
        const chip = el('button', 'shard-target-chip', `${def.name} (${minion.attack}/${minion.health})`);
        chip.addEventListener('click', () => {
          resolveHumanReefShardChoice(state, { instanceId: minion.instanceId, ability: selectedAbility });
          closeSheet();
          onDone();
        });
        targetRow.appendChild(chip);
      }
    }

    const buttons = el('div', 'sheet-buttons');
    const decline = el('button', '', 'Decline');
    decline.addEventListener('click', () => { closeSheet(); onDone(); });
    buttons.appendChild(decline);
    sheet.appendChild(buttons);

    openSheet({ dismissible: false });
  }

  function onEndTurn() {
    runAiShopPhase(lobby, round, rng);
    const reports = runCombatPhase(lobby, round, rng);
    const humanReport = reports.find((r) => r.aId === human.id || r.bId === human.id);
    render(); // reflect this round's health/board changes immediately, behind the result sheet
    showCombatResult(humanReport, () => afterCombat());
  }

  function afterCombat() {
    const gameOver = checkGameOver(lobby);
    if (gameOver.over) {
      showGameOver(gameOver);
      return;
    }
    if (human.state.health <= 0) {
      autoSimulateToCompletion();
      return;
    }
    startRoundFlow(round + 1);
  }

  // The human died but the match isn't over — keep resolving AI-only
  // rounds headlessly (no UI needed, nobody's choices are pending) until
  // there's a winner, so the human still learns their final placement.
  function autoSimulateToCompletion() {
    let guard = 0;
    let result = checkGameOver(lobby);
    while (!result.over && guard++ < 200) {
      round += 1;
      beginRound(lobby, round, rng);
      if (isReefShardRound(round)) runAiReefShardPhase(lobby, round, rng);
      runAiShopPhase(lobby, round, rng);
      runCombatPhase(lobby, round, rng);
      result = checkGameOver(lobby);
    }
    render(); // so the board/standings behind the game-over sheet reflect the final state, not the last round the human was alive for
    showGameOver(result);
  }

  function showCombatResult(report, onContinue) {
    sheet.innerHTML = '';
    if (!report || report.bId == null) {
      // bye round — human has no opponent this round
      sheet.appendChild(el('h3', 'combat-banner', 'A quiet round'));
      sheet.appendChild(el('p', '', 'No opponent this round — you sit it out unharmed.'));
    } else {
      const youAreA = report.aId === human.id;
      const opponentId = youAreA ? report.bId : report.aId;
      const opponent = lobby.players.find((p) => p.id === opponentId);
      const youWon = (youAreA && report.winner === 'A') || (!youAreA && report.winner === 'B');
      const draw = report.winner === 'draw';
      const title = draw ? 'A draw' : youWon ? 'Victory!' : 'Defeat';
      sheet.appendChild(el('h3', `combat-banner ${draw ? '' : youWon ? 'won' : 'lost'}`, title));
      sheet.appendChild(el('p', '', `vs. ${opponent ? opponent.name : 'an empty seat'}${draw ? '' : youWon ? ' — they take ' + report.damage + ' damage.' : ' — you take ' + report.damage + ' damage.'}`));
      sheet.appendChild(el('p', '', `Your health: ${human.state.health}`));
    }
    const buttons = el('div', 'sheet-buttons');
    const cont = el('button', 'confirm', 'Continue');
    cont.addEventListener('click', () => { closeSheet(); onContinue(); });
    buttons.appendChild(cont);
    sheet.appendChild(buttons);
    openSheet({ dismissible: false });
  }

  function showGameOver(result) {
    sheet.innerHTML = '';
    const place = result.placements.findIndex((p) => p.id === human.id) + 1;
    sheet.appendChild(el('h3', 'combat-banner', place === 1 ? 'You win The Shattered Reef!' : `You placed ${ordinal(place)} of ${result.placements.length}`));
    const list = el('ol', 'placement-list');
    for (const p of result.placements) {
      const li = el('li', p.id === human.id ? 'you' : '', p.name);
      list.appendChild(li);
    }
    sheet.appendChild(list);
    const buttons = el('div', 'sheet-buttons');
    const again = el('button', 'confirm', 'Play Again');
    again.addEventListener('click', () => { closeSheet(); startApp(root); });
    buttons.appendChild(again);
    sheet.appendChild(buttons);
    openSheet({ dismissible: false });
  }

  controls.append(
    button('reroll', rerollLabel(), onReroll),
    button('freeze', 'Freeze', onFreeze),
    button('end-turn', 'End Turn ▶', onEndTurn)
  );

  startRoundFlow(1);

  function rerollLabel() {
    const cost = effectiveRerollCost(state);
    return `Reroll <span class="sub">${cost === 0 ? 'Free' : cost + 'g'}</span>`;
  }

  function render() {
    renderHud();
    renderStandings();
    renderBoard();
    renderControls();
    renderShop();
  }

  function renderHud() {
    hud.innerHTML = '';
    hud.appendChild(hudStat('Round', round));
    hud.appendChild(hudStat('Gold', `${state.gold}/${state.maxGold}`));
    const healthStat = hudStat('Health', Math.max(0, state.health));
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

  function renderStandings() {
    standings.innerHTML = '';
    for (const p of lobby.players) {
      const chip = el('div', `standing-chip${p.state.health <= 0 ? ' dead' : ''}${p.isHuman ? ' you' : ''}`);
      chip.appendChild(el('span', 'standing-name', p.isHuman ? 'You' : p.name.split(' ')[0]));
      const bar = el('div', 'standing-bar');
      const fill = el('div', 'standing-bar-fill');
      fill.style.width = `${Math.max(0, Math.min(100, (p.state.health / 25) * 100))}%`;
      bar.appendChild(fill);
      chip.appendChild(bar);
      standings.appendChild(chip);
    }
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
    rerollBtn.innerHTML = rerollLabel();
    rerollBtn.disabled = state.gold < effectiveRerollCost(state);
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

function shuffleCopy(list, rng) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

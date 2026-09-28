// Touch-first drag-to-reorder for the board row, using Pointer Events (one
// API for touch, mouse and pen — nothing here is mouse-only). A short tap
// (movement under the threshold) is treated as a tap rather than a drag, so
// the same gesture space can open the sell action sheet.

const DRAG_THRESHOLD_PX = 8;

// `boardEl` is the #board grid; `slotEls` is its ordered array of
// .board-slot elements. `onTap(instanceId)` fires for a plain tap on an
// occupied slot's card. `onReorder(fromIndex, toIndex)` fires once a drag
// ends over a different slot than it started in.
export function enableBoardReorder(boardEl, slotEls, { onTap, onReorder }) {
  let dragging = null; // { card, fromIndex, startX, startY, offsetX, offsetY, pointerId }

  boardEl.addEventListener('pointerdown', (event) => {
    const card = event.target.closest('.card');
    if (!card) return;
    const slot = card.closest('.board-slot');
    if (!slot) return;
    const fromIndex = slotEls.indexOf(slot);
    if (fromIndex === -1) return;

    const rect = card.getBoundingClientRect();
    dragging = {
      card,
      fromIndex,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      pointerId: event.pointerId,
      moved: false,
      currentIndex: fromIndex,
    };
  });

  boardEl.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const dx = event.clientX - dragging.startX;
    const dy = event.clientY - dragging.startY;

    if (!dragging.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      dragging.moved = true;
      dragging.card.setPointerCapture(dragging.pointerId);
      dragging.card.classList.add('dragging');
      dragging.card.style.width = `${dragging.width}px`;
      dragging.card.style.height = `${dragging.height}px`;
      document.body.appendChild(dragging.card);
    }

    dragging.card.style.left = `${event.clientX - dragging.offsetX}px`;
    dragging.card.style.top = `${event.clientY - dragging.offsetY}px`;

    const nearest = nearestSlotIndex(slotEls, event.clientX, event.clientY);
    for (const slot of slotEls) slot.classList.remove('drop-target');
    if (nearest != null) slotEls[nearest].classList.add('drop-target');
    dragging.currentIndex = nearest;
  });

  function endDrag(event) {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    for (const slot of slotEls) slot.classList.remove('drop-target');

    if (!dragging.moved) {
      const card = dragging.card;
      dragging = null;
      onTap(card.dataset.instanceId);
      return;
    }

    const { fromIndex, currentIndex } = dragging;
    dragging = null;
    if (currentIndex != null && currentIndex !== fromIndex) {
      onReorder(fromIndex, currentIndex);
    } else {
      // Dropped back where it started, or off the board entirely — the
      // next render() call will put the card back in place regardless.
      onReorder(fromIndex, fromIndex);
    }
  }

  boardEl.addEventListener('pointerup', endDrag);
  boardEl.addEventListener('pointercancel', endDrag);
}

function nearestSlotIndex(slotEls, x, y) {
  let best = null;
  let bestDist = Infinity;
  slotEls.forEach((slot, index) => {
    const rect = slot.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(x - cx, y - cy);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}

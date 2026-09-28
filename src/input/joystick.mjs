// A single on-screen virtual joystick, Pointer-Events-based so it works
// uniformly for touch/mouse/pen. Renders its own base+knob DOM (positioned
// wherever the finger first lands, "floating" style, which is friendlier
// for one-thumb reach on a phone than a fixed-position stick) and exposes
// a live { x, y } vector in roughly [-1, 1] per axis via `getVector()`.
export function createJoystick(container, { maxRadius = 46 } = {}) {
  const base = document.createElement('div');
  base.className = 'joystick-base';
  const knob = document.createElement('div');
  knob.className = 'joystick-knob';
  base.appendChild(knob);
  base.style.display = 'none';
  container.appendChild(base);

  let activePointerId = null;
  let originX = 0;
  let originY = 0;
  let vecX = 0;
  let vecY = 0;

  function show(x, y) {
    originX = x;
    originY = y;
    base.style.left = `${x - maxRadius}px`;
    base.style.top = `${y - maxRadius}px`;
    base.style.width = base.style.height = `${maxRadius * 2}px`;
    base.style.display = 'block';
    knob.style.transform = 'translate(-50%, -50%)';
  }

  function hide() {
    base.style.display = 'none';
    vecX = 0;
    vecY = 0;
  }

  function update(x, y) {
    const dx = x - originX;
    const dy = y - originY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;
    knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    vecX = kx / maxRadius;
    vecY = ky / maxRadius;
  }

  container.addEventListener('pointerdown', (e) => {
    if (activePointerId !== null) return;
    activePointerId = e.pointerId;
    container.setPointerCapture(e.pointerId);
    const rect = container.getBoundingClientRect();
    show(e.clientX - rect.left, e.clientY - rect.top);
  });
  container.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId) return;
    const rect = container.getBoundingClientRect();
    update(e.clientX - rect.left, e.clientY - rect.top);
  });
  function release(e) {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    hide();
  }
  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', release);

  return {
    getVector: () => ({ x: vecX, y: vecY }),
    isActive: () => activePointerId !== null,
  };
}

// A simple follow-camera: smoothly chases a target world position, clamped
// so it never shows past the map edge (once the map is bigger than the
// viewport — for a small map it just centers, clamp is a no-op then).
export function createCamera() {
  return { x: 0, y: 0 };
}

export function updateCamera(camera, targetX, targetY, dt, smoothing = 8) {
  const t = 1 - Math.exp(-smoothing * dt); // frame-rate-independent lerp
  camera.x += (targetX - camera.x) * t;
  camera.y += (targetY - camera.y) * t;
}

// World -> screen transform origin: call at the start of a frame, after
// ctx.save(), to center the camera in the viewport. `shakeOffset` (step 8,
// engine/juice.mjs's updateShake) is an optional {x,y} in screen pixels,
// added on top of the clamped follow position — kept as a separate additive
// term rather than folded into `camera.x/y` so shake never fights the
// follow-camera's own smoothing or gets clamped against the map edge.
export function applyCameraTransform(ctx, camera, viewportWidth, viewportHeight, mapWidthPx, mapHeightPx, shakeOffset = null) {
  let cx = camera.x;
  let cy = camera.y;
  if (mapWidthPx > viewportWidth) {
    cx = Math.max(viewportWidth / 2, Math.min(mapWidthPx - viewportWidth / 2, cx));
  } else {
    cx = mapWidthPx / 2;
  }
  if (mapHeightPx > viewportHeight) {
    cy = Math.max(viewportHeight / 2, Math.min(mapHeightPx - viewportHeight / 2, cy));
  } else {
    cy = mapHeightPx / 2;
  }
  const sx = shakeOffset ? shakeOffset.x : 0;
  const sy = shakeOffset ? shakeOffset.y : 0;
  ctx.translate(viewportWidth / 2 - cx + sx, viewportHeight / 2 - cy + sy);
  return { cx, cy };
}

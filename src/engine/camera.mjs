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

const NO_INSETS = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

// Pure math behind applyCameraTransform, split out so it's unit-testable
// without a canvas. `insets` are screen-pixel bands covered by HUD (the
// top status/weapon bar, the fire button) — the camera centers and clamps
// within the *usable* region between them, not the full screen. Without
// this, the camera clamps the map edge to the screen edge, and since every
// reef's spawn is the maze's top-left start cell, the player's own boat
// began every reef hidden under the weapon bar on a portrait phone (found
// in a real headless playtest screenshot, 2026-09-28). The map edge now
// sits at the inset boundary instead, so HUD overlays open water off the
// map rather than the boat.
//
// Returns the clamped camera center, the translate to apply, and the
// world-space rect actually visible on screen (for tile culling — with
// asymmetric insets the camera center is no longer the screen center, so
// culling off `cx ± vw/2` would drop rows that are really on screen).
export function computeCameraView(camera, viewportWidth, viewportHeight, mapWidthPx, mapHeightPx, insets = NO_INSETS) {
  const usableW = Math.max(1, viewportWidth - insets.left - insets.right);
  const usableH = Math.max(1, viewportHeight - insets.top - insets.bottom);
  const anchorX = insets.left + usableW / 2; // screen point the camera center maps to
  const anchorY = insets.top + usableH / 2;

  let cx = camera.x;
  let cy = camera.y;
  if (mapWidthPx > usableW) {
    cx = Math.max(usableW / 2, Math.min(mapWidthPx - usableW / 2, cx));
  } else {
    cx = mapWidthPx / 2;
  }
  if (mapHeightPx > usableH) {
    cy = Math.max(usableH / 2, Math.min(mapHeightPx - usableH / 2, cy));
  } else {
    cy = mapHeightPx / 2;
  }

  const translateX = anchorX - cx;
  const translateY = anchorY - cy;
  return {
    cx, cy, translateX, translateY,
    visible: {
      left: -translateX,
      top: -translateY,
      right: viewportWidth - translateX,
      bottom: viewportHeight - translateY,
    },
  };
}

// World -> screen transform origin: call at the start of a frame, after
// ctx.save(). `shakeOffset` (step 8, engine/juice.mjs's updateShake) is an
// optional {x,y} in screen pixels, added on top of the clamped follow
// position — kept as a separate additive term rather than folded into
// `camera.x/y` so shake never fights the follow-camera's own smoothing or
// gets clamped against the map edge.
export function applyCameraTransform(ctx, camera, viewportWidth, viewportHeight, mapWidthPx, mapHeightPx, shakeOffset = null, insets = NO_INSETS) {
  const view = computeCameraView(camera, viewportWidth, viewportHeight, mapWidthPx, mapHeightPx, insets);
  const sx = shakeOffset ? shakeOffset.x : 0;
  const sy = shakeOffset ? shakeOffset.y : 0;
  ctx.translate(view.translateX + sx, view.translateY + sy);
  return view;
}

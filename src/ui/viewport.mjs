// Full-screen height on iPhone home-screen apps (2026-09-29). With
// `black-translucent` status bars, iOS standalone mode lays the page out
// from the very top of the screen but reports window.innerHeight minus the
// status bar, which left a dark band along the bottom of every screen.
// Standalone only: in a normal browser tab innerHeight is right.

export function viewH() {
  const ih = window.innerHeight;
  if (!navigator.standalone || !window.screen) return ih;
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  const sh = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  return Math.max(ih, sh);
}

export function installViewportFix() {
  const set = () => document.documentElement.style.setProperty('--app-h', `${viewH()}px`);
  set();
  window.addEventListener('resize', set);
  window.addEventListener('orientationchange', () => setTimeout(set, 250));
}

// Swaps emoji in the DOM for the game's own toy icons (assets/icons/ui).
// Each mapped emoji is wrapped as <span class="emo"><span class="emo-t">⚓</span></span>:
// the image is the span's background and the glyph stays inside, invisible, so an
// element's textContent never changes (code that compares text keeps working).
// Canvas text (tdArt, enemy/warlord marks) is not covered.

const I = 'assets/icons/ui/';
export const EMOJI_ICONS = {
  '⚓': 'anchor', '🪙': 'coin', '💰': 'bag', '📦': 'chest', '💎': 'gem', '📜': 'scroll', '🗺': 'map',
  '🔭': 'spyglass', '⛵': 'sloop', '⚔': 'cutlass', '🗡': 'cutlass', '⚫': 'cannon', '💣': 'bomb',
  '🔱': 'harpoons', '🔫': 'swivel', '🧨': 'broadside', '🔥': 'fire', '🌀': 'vortex', '🌊': 'wave',
  '❤': 'heart', '💔': 'heartbreak', '🛡': 'shield', '✈': 'wing', '⚡': 'lightning', '☠': 'skull',
  '❄': 'snowflake', '🎯': 'target', '✦': 'star', '⏱': 'hourglass', '🧲': 'magnet', '🏰': 'tower',
  '🗼': 'lighthouse', '🔮': 'portal', '🛠': 'tools', '⚒': 'tools', '🔧': 'gear', '🏆': 'trophy',
  '👑': 'crown', '🪢': 'rope', '🔗': 'link', '⛓': 'link', '🦑': 'squid', '🔒': 'lock', '✓': 'check',
  '🔊': 'sound', '🔇': 'mute', '📅': 'calendar', '📖': 'book', '🎨': 'palette', '🏴': 'flag',
  '⚠': 'warning', '✕': 'cross', '🌫': 'fog', '🌧': 'rain', '⛈': 'storm', '🌩': 'storm', '🌬': 'gale',
  '🌪': 'tornado', '🪨': 'rocks', '🧊': 'ice', '🌋': 'volcano', '✨': 'sparkles', '👻': 'ghost',
  '🪵': 'log', '♨': 'vent', '☄': 'comet', '🏜': 'sand', '🌈': 'rainbow', '🌑': 'darkness',
  '🕯': 'candle', '🐟': 'fish', '🐙': 'evo_kraken', '🎇': 'evo_ship_line', '🌨': 'evo_hailstorm',
  '🛟': '../../pickups/ring',
};

export function iconUrl(emoji) {
  const f = EMOJI_ICONS[emoji.replace(/️/g, '')];
  return f ? `${I}${f}.png` : null;
}

const KEYS = Object.keys(EMOJI_ICONS).sort((a, b) => b.length - a.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE = new RegExp(`(?:${KEYS.map(esc).join('|')})\\uFE0F?`, 'gu');
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'CANVAS', 'TITLE']);

/** Wraps every mapped emoji in the text nodes under `root`. Returns how many it wrapped. */
export function wrapEmoji(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentNode;
      if (!p || SKIP.has(p.nodeName) || (p.classList && (p.classList.contains('emo-t') || p.classList.contains('no-emo')))) return NodeFilter.FILTER_REJECT;
      if (p.closest && p.closest('.no-emo, .selectable')) return NodeFilter.FILTER_REJECT;
      RE.lastIndex = 0;
      return RE.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  let count = 0;
  for (const n of nodes) {
    const text = n.data;
    const frag = document.createDocumentFragment();
    let last = 0;
    RE.lastIndex = 0;
    for (let m = RE.exec(text); m; m = RE.exec(text)) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const outer = document.createElement('span');
      outer.className = 'emo';
      outer.style.backgroundImage = `url(${iconUrl(m[0])})`;
      const inner = document.createElement('span');
      inner.className = 'emo-t';
      inner.textContent = m[0];
      outer.appendChild(inner);
      frag.appendChild(outer);
      last = m.index + m[0].length;
      count++;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    n.parentNode.replaceChild(frag, n);
  }
  return count;
}

/** Keeps `root` wrapped as the UI changes. */
export function startEmojiIcons(root = document.body) {
  if (typeof MutationObserver === 'undefined') return null;
  wrapEmoji(root);
  const pending = new Set();
  let queued = false;
  const flush = () => {
    queued = false;
    obs.disconnect();
    for (const el of pending) if (el.isConnected) wrapEmoji(el);
    pending.clear();
    obs.observe(root, { childList: true, subtree: true, characterData: true });
  };
  const obs = new MutationObserver((list) => {
    for (const r of list) {
      const t = r.type === 'characterData' ? r.target.parentNode : r.target;
      if (t && !(t.classList && t.classList.contains('emo-t'))) pending.add(t);
    }
    if (!queued) { queued = true; queueMicrotask(flush); }
  });
  obs.observe(root, { childList: true, subtree: true, characterData: true });
  return obs;
}

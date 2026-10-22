// Story scenes (2026-10-22): a portrait, a name and a line at a time, the
// way mobile games tell a story without stopping the game for long. Tap to
// advance (a tap mid-line finishes it), Skip to leave. Lines come from
// data/story.mjs as [speakerId, text].
//
// Portraits are drawn art once they exist (assets/portraits/<id>.png,
// listed in data/portraits.mjs so a missing file is never requested);
// until then each character is their emoji on their colour.

import { CHARACTERS } from '../data/story.mjs';
import { PORTRAIT_FILES } from '../data/portraits.mjs';

export function portraitEl(id, size = 64) {
  const c = CHARACTERS[id] || CHARACTERS.narrator;
  const el = document.createElement('span');
  el.className = 'portrait';
  el.style.setProperty('--pc', c.colour);
  el.style.width = el.style.height = `${size}px`;
  if (PORTRAIT_FILES.has(id)) {
    const img = document.createElement('img');
    img.src = `assets/portraits/${id}.png`; img.alt = ''; img.draggable = false;
    el.appendChild(img);
  } else {
    const t = document.createElement('i');
    t.textContent = c.emoji; t.style.fontSize = `${Math.round(size * 0.5)}px`;
    el.appendChild(t);
  }
  return el;
}

export function createStoryScene(root, { onLine = () => {} } = {}) {
  const el = document.createElement('div');
  el.id = 'story-scene'; el.hidden = true;
  el.innerHTML = `
    <div class="ss-title" hidden><small></small><b></b></div>
    <div class="ss-card">
      <div class="ss-portrait"></div>
      <div class="ss-body"><div class="ss-name"><b></b><small></small></div><p class="ss-text"></p><span class="ss-more">tap ▸</span></div>
    </div>
    <button type="button" class="ss-skip">Skip ›</button>`;
  root.appendChild(el);
  const card = el.querySelector('.ss-card');
  let lines = []; let i = 0; let shown = 0; let full = ''; let timer = 0; let done = null; let raf = 0;

  function typeTick() {
    shown = Math.min(full.length, shown + 2);
    el.querySelector('.ss-text').textContent = full.slice(0, shown);
    if (shown < full.length) raf = requestAnimationFrame(typeTick);
  }
  function showLine() {
    const [who, text] = lines[i];
    const c = CHARACTERS[who] || CHARACTERS.narrator;
    const pane = el.querySelector('.ss-portrait');
    pane.replaceChildren(who === 'narrator' ? document.createElement('span') : portraitEl(who, 72));
    pane.hidden = who === 'narrator';
    card.classList.toggle('narrator', who === 'narrator');
    card.classList.toggle('whisper', who === 'undertow');
    card.style.setProperty('--pc', c.colour);
    el.querySelector('.ss-name b').textContent = c.name;
    el.querySelector('.ss-name small').textContent = c.title && who !== 'undertow' ? c.title : '';
    full = text; shown = 0;
    cancelAnimationFrame(raf); typeTick();
    card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    onLine(who);
  }
  function advance() {
    if (el.hidden) return;
    if (shown < full.length) { shown = full.length; el.querySelector('.ss-text').textContent = full; cancelAnimationFrame(raf); return; }
    i++;
    if (i >= lines.length) close(); else showLine();
  }
  function close() {
    cancelAnimationFrame(raf); clearTimeout(timer);
    el.hidden = true;
    const d = done; done = null;
    if (d) d();
  }
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ss-skip')) return;
    e.preventDefault(); e.stopPropagation(); advance();
  });
  el.querySelector('.ss-skip').addEventListener('click', (e) => { e.stopPropagation(); close(); });

  return {
    // Plays `script` ([[who, text]...]) with an optional title card.
    play(script, { title = null, eyebrow = '', onDone = null } = {}) {
      if (!script?.length) { if (onDone) onDone(); return; }
      lines = script; i = 0; done = onDone;
      const t = el.querySelector('.ss-title');
      t.hidden = !title;
      if (title) { t.querySelector('small').textContent = eyebrow; t.querySelector('b').textContent = title; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go'); }
      el.hidden = false;
      showLine();
    },
    isOpen: () => !el.hidden,
    advance,
    close,
  };
}

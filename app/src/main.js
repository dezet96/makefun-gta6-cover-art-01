// Vice Cover Lab — bootstrap.
//
// Loads the sample photos, wires the editor, and honours the ?shot= modes the
// screenshot pass uses: ?shot=cover draws one exported cover full-frame,
// ?shot=editor opens the editor with a sample loaded.

import { defaultState, drawCover, EXPORT_SIZES, LAYOUTS, GRADES, layoutLabel, gradeLabel } from './cover.js';
import { initEditor, loadImageUrl } from './editor.js';

const SAMPLES = ['samples/pier.jpg', 'samples/boulevard.jpg'];

function buildPickers(container, items, labelFn, attr) {
  items.forEach((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset[attr] = id;
    b.textContent = labelFn(id);
    container.appendChild(b);
  });
  return Array.from(container.querySelectorAll('button'));
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  const state = defaultState();

  // Query overrides for the cover shot: layout, grade, size, title.
  if (params.get('layout') && LAYOUTS.includes(params.get('layout'))) state.layout = params.get('layout');
  if (params.get('grade') && GRADES.includes(params.get('grade'))) state.grade = params.get('grade');
  if (params.get('size') && EXPORT_SIZES[params.get('size')]) state.size = params.get('size');
  if (params.get('title')) state.title = params.get('title');
  if (params.get('subtitle') !== null && params.get('subtitle') !== undefined) state.subtitle = params.get('subtitle');
  if (params.get('heat')) state.heat = Math.max(0, Math.min(5, Number(params.get('heat')) || 4));

  // Load the two bundled samples into slots 1 and 2 so the app opens with
  // photos already in it; slot 3 starts empty for the user's own photo.
  const loaded = await Promise.allSettled(SAMPLES.map((u) => loadImageUrl(u)));
  loaded.forEach((r, i) => { if (r.status === 'fulfilled') state.photos[i] = r.value; });
  state.panels[0].photo = 0;
  state.panels[1].photo = 1;
  state.panels[2].photo = 0;
  state.panels[3].photo = 1;

  if (shot === 'cover') {
    // Full-frame cover: the canvas fills the viewport, nothing else shows.
    document.body.classList.add('shot-cover');
    const canvas = document.getElementById('shot-canvas');
    const size = EXPORT_SIZES[state.size];
    canvas.width = size.w;
    canvas.height = size.h;
    drawCover(canvas.getContext('2d'), state, size.w, size.h);
    document.title = 'Vice Cover Lab — cover';
    return;
  }

  // Editor mode.
  const layoutButtons = buildPickers(document.getElementById('layout-picks'), LAYOUTS, layoutLabel, 'layout');
  const gradeButtons = buildPickers(document.getElementById('grade-picks'), GRADES, gradeLabel, 'grade');
  const heatButtons = Array.from(document.querySelectorAll('#heat-picks button'));
  const slots = Array.from(document.querySelectorAll('.slot'));

  const editor = initEditor(state, {
    preview: document.getElementById('preview'),
    slots,
    layoutButtons,
    gradeButtons,
    heatButtons,
    titleInput: document.getElementById('title-input'),
    subtitleInput: document.getElementById('subtitle-input'),
    frameToggle: document.getElementById('frame-toggle'),
    grainToggle: document.getElementById('grain-toggle'),
    halftoneToggle: document.getElementById('halftone-toggle'),
    sizeSelect: document.getElementById('size-select'),
    exportButton: document.getElementById('export-btn'),
    panelNote: document.getElementById('panel-note'),
    status: document.getElementById('status'),
  });

  document.getElementById('title-input').value = state.title;
  document.getElementById('subtitle-input').value = state.subtitle;
  editor.render();

  // Keyboard: 1-4 pick a layout, G cycles grades, E exports.
  document.addEventListener('keydown', (ev) => {
    if (ev.target.matches('input, select, textarea')) return;
    const n = Number(ev.key);
    if (n >= 1 && n <= LAYOUTS.length) {
      state.layout = LAYOUTS[n - 1];
      editor.render();
    } else if (ev.key === 'g' || ev.key === 'G') {
      const i = (GRADES.indexOf(state.grade) + 1) % GRADES.length;
      state.grade = GRADES[i];
      editor.render();
    } else if (ev.key === 'e' || ev.key === 'E') {
      document.getElementById('export-btn').click();
    }
  });
}

boot().catch((err) => {
  const status = document.getElementById('status');
  if (status) status.textContent = 'Something failed to start: ' + err.message;
  console.error(err);
});

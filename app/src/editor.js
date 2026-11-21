// Vice Cover Lab — editor wiring.
//
// Owns the state the engine draws: photo slots, panel choice, drag-to-pan and
// wheel zoom on the preview, the control buttons, and the PNG export.

import {
  drawCover, renderToCanvas, EXPORT_SIZES, LAYOUTS, GRADES,
  layoutLabel, gradeLabel, panelRectsFor,
} from './cover.js';

export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
    img.src = url;
  });
}

export function loadImageUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + url));
    img.src = url;
  });
}

export function initEditor(state, ui) {
  let selectedPanel = 0;
  let dragging = null;

  const preview = ui.preview;
  const pctx = preview.getContext('2d');

  function previewSize() {
    const size = EXPORT_SIZES[state.size] || EXPORT_SIZES.square;
    const maxW = 620;
    const scale = Math.min(1, maxW / size.w);
    return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
  }

  function render() {
    const { w, h } = previewSize();
    if (preview.width !== w || preview.height !== h) {
      preview.width = w;
      preview.height = h;
    }
    drawCover(pctx, state, w, h);
    // Selection outline on the preview only, never on the export.
    const rects = panelRectsFor(state.layout, w, h);
    const r = rects[Math.min(selectedPanel, rects.length - 1)];
    if (r) {
      pctx.save();
      pctx.strokeStyle = '#ffe259';
      pctx.lineWidth = 3;
      pctx.setLineDash([10, 6]);
      pctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      pctx.restore();
    }
    refreshSlots();
    refreshButtons();
  }

  function refreshSlots() {
    ui.slots.forEach((slot, i) => {
      const img = state.photos[i];
      const thumb = slot.querySelector('.slot-thumb');
      const label = slot.querySelector('.slot-label');
      if (img) {
        if (!thumb.dataset.filled) {
          thumb.innerHTML = '';
          const c = document.createElement('canvas');
          c.width = 96;
          c.height = 72;
          const cc = c.getContext('2d');
          const s = Math.max(96 / img.width, 72 / img.height);
          cc.drawImage(img, (96 - img.width * s) / 2, (72 - img.height * s) / 2, img.width * s, img.height * s);
          thumb.appendChild(c);
          thumb.dataset.filled = '1';
        }
        label.textContent = 'Photo ' + (i + 1) + ' loaded';
      } else {
        thumb.dataset.filled = '';
        thumb.innerHTML = '<span>+</span>';
        label.textContent = 'Photo ' + (i + 1) + ' — empty';
      }
      slot.classList.toggle('active', state.panels[selectedPanel] && state.panels[selectedPanel].photo === i);
    });
    ui.panelNote.textContent = 'Panel ' + (selectedPanel + 1) + ' uses Photo ' +
      ((state.panels[selectedPanel] ? state.panels[selectedPanel].photo : 0) + 1) +
      '. Drag the preview to move it, scroll to zoom.';
  }

  function refreshButtons() {
    ui.layoutButtons.forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
    ui.gradeButtons.forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
    ui.heatButtons.forEach((b) => b.classList.toggle('on', Number(b.dataset.heat) === state.heat));
    ui.frameToggle.checked = state.frame;
    ui.grainToggle.checked = state.grain;
    ui.halftoneToggle.checked = state.halftone;
    ui.sizeSelect.value = state.size;
  }

  function setSlotPhoto(i, img) {
    state.photos[i] = img;
    render();
  }

  // Photo slots: file input, sample buttons, click-to-assign to selected panel.
  ui.slots.forEach((slot, i) => {
    const input = slot.querySelector('input[type=file]');
    slot.querySelector('.slot-pick').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const img = await loadImageFile(file);
        setSlotPhoto(i, img);
      } catch (e) {
        ui.status.textContent = e.message;
      }
      input.value = '';
    });
    slot.querySelector('.slot-sample').addEventListener('click', async () => {
      try {
        const img = await loadImageUrl(slot.dataset.sample);
        setSlotPhoto(i, img);
      } catch (e) {
        ui.status.textContent = e.message;
      }
    });
    slot.addEventListener('click', (ev) => {
      if (ev.target.closest('button') || ev.target.closest('input')) return;
      state.panels[selectedPanel].photo = i;
      render();
    });
  });

  // Layout and grade pickers.
  ui.layoutButtons.forEach((b) => b.addEventListener('click', () => {
    state.layout = b.dataset.layout;
    render();
  }));
  ui.gradeButtons.forEach((b) => b.addEventListener('click', () => {
    state.grade = b.dataset.grade;
    render();
  }));
  ui.heatButtons.forEach((b) => b.addEventListener('click', () => {
    state.heat = Number(b.dataset.heat);
    render();
  }));

  // Caption and toggles.
  ui.titleInput.addEventListener('input', () => { state.title = ui.titleInput.value; render(); });
  ui.subtitleInput.addEventListener('input', () => { state.subtitle = ui.subtitleInput.value; render(); });
  ui.frameToggle.addEventListener('change', () => { state.frame = ui.frameToggle.checked; render(); });
  ui.grainToggle.addEventListener('change', () => { state.grain = ui.grainToggle.checked; render(); });
  ui.halftoneToggle.addEventListener('change', () => { state.halftone = ui.halftone.checked; render(); });
  ui.sizeSelect.addEventListener('change', () => { state.size = ui.sizeSelect.value; render(); });

  // Preview interaction: click a panel to select it, drag to pan its photo,
  // scroll to zoom it.
  function panelAt(mx, my) {
    const rect = preview.getBoundingClientRect();
    const x = (mx - rect.left) * (preview.width / rect.width);
    const y = (my - rect.top) * (preview.height / rect.height);
    const rects = panelRectsFor(state.layout, preview.width, preview.height);
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return 0;
  }

  preview.addEventListener('pointerdown', (ev) => {
    selectedPanel = panelAt(ev.clientX, ev.clientY);
    dragging = { x: ev.clientX, y: ev.clientY, ox: state.panels[selectedPanel].ox, oy: state.panels[selectedPanel].oy };
    preview.setPointerCapture(ev.pointerId);
    render();
  });
  preview.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const panel = state.panels[selectedPanel];
    const rect = preview.getBoundingClientRect();
    panel.ox = clamp(dragging.ox + (ev.clientX - dragging.x) / rect.width * 2, -1, 1);
    panel.oy = clamp(dragging.oy + (ev.clientY - dragging.y) / rect.height * 2, -1, 1);
    render();
  });
  preview.addEventListener('pointerup', () => { dragging = null; });
  preview.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const panel = state.panels[selectedPanel];
    panel.zoom = clamp(panel.zoom * (ev.deltaY < 0 ? 1.12 : 0.89), 1, 3);
    render();
  }, { passive: false });

  // Export: render at full size and download the PNG.
  ui.exportButton.addEventListener('click', () => {
    const canvas = renderToCanvas(state, state.size);
    const size = EXPORT_SIZES[state.size];
    canvas.toBlob((blob) => {
      if (!blob) {
        ui.status.textContent = 'Export failed — try another size.';
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vice-cover-' + size.w + 'x' + size.h + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      ui.status.textContent = 'Saved ' + a.download + ' — share it anywhere.';
    }, 'image/png');
  });

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  return {
    render,
    get selectedPanel() { return selectedPanel; },
    setSelectedPanel(i) { selectedPanel = i; render(); },
  };
}

export { LAYOUTS, GRADES, layoutLabel, gradeLabel };

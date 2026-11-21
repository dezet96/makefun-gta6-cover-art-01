// Vice Cover Lab — cover render engine.
//
// One draw function renders the poster to any canvas. The live preview in the
// editor and the exported PNG are the same picture, so what you see is what
// you share. Every photo stays on the machine: nothing here uploads anything.

export const LAYOUTS = ['hero', 'grid', 'bleed', 'tilt'];
export const GRADES = ['sunset', 'neon', 'gold', 'noir'];

export const EXPORT_SIZES = {
  square: { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  portrait: { label: 'Story 1080 x 1350', w: 1080, h: 1350 },
  wide: { label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
};

const LAYOUT_LABELS = {
  hero: 'Hero + 3',
  grid: 'Four-panel grid',
  bleed: 'Full bleed',
  tilt: 'Tilted snapshots',
};

const GRADE_LABELS = {
  sunset: 'Vice Sunset',
  neon: 'Neon Night',
  gold: 'Golden Hour',
  noir: 'Mono Noir',
};

export function layoutLabel(id) { return LAYOUT_LABELS[id] || id; }
export function gradeLabel(id) { return GRADE_LABELS[id] || id; }

export function defaultState() {
  return {
    // Three photo slots; a panel points at a slot by index.
    photos: [null, null, null],
    panels: [
      { photo: 0, zoom: 1.0, ox: 0, oy: 0 },
      { photo: 1, zoom: 1.0, ox: 0, oy: 0 },
      { photo: 2, zoom: 1.0, ox: 0, oy: 0 },
      { photo: 0, zoom: 1.0, ox: 0, oy: 0 },
    ],
    layout: 'hero',
    grade: 'sunset',
    title: 'VICE CITY',
    subtitle: 'where the sun never sets',
    heat: 4,
    frame: true,
    grain: true,
    halftone: false,
    size: 'square',
  };
}

// ---------------------------------------------------------------------------
// Grades: a canvas filter for the photos plus a tinted overlay for the mood.
// ---------------------------------------------------------------------------

const GRADE_DEFS = {
  sunset: {
    filter: 'saturate(1.35) contrast(1.08) sepia(0.18)',
    tint: ['rgba(255, 110, 60, 0.16)', 'rgba(255, 41, 117, 0.14)', 'rgba(140, 30, 255, 0.10)'],
  },
  neon: {
    filter: 'saturate(1.7) contrast(1.15) hue-rotate(-12deg)',
    tint: ['rgba(255, 41, 117, 0.20)', 'rgba(0, 229, 255, 0.14)', 'rgba(140, 30, 255, 0.16)'],
  },
  gold: {
    filter: 'saturate(1.25) contrast(1.05) sepia(0.35) brightness(1.06)',
    tint: ['rgba(255, 190, 60, 0.20)', 'rgba(255, 120, 40, 0.10)', 'rgba(120, 60, 0, 0.06)'],
  },
  noir: {
    filter: 'grayscale(1) contrast(1.25) brightness(1.04)',
    tint: ['rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.10)', 'rgba(0, 0, 0, 0.16)'],
  },
};

// ---------------------------------------------------------------------------
// Geometry: where each panel sits for a layout, in fractions of the canvas.
// ---------------------------------------------------------------------------

function panelRects(layout, W, H) {
  const gap = Math.round(Math.min(W, H) * 0.012);
  const pad = Math.round(Math.min(W, H) * 0.028);
  const inner = { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 };
  if (layout === 'grid') {
    const hw = (inner.w - gap) / 2;
    const hh = (inner.h - gap) / 2;
    return [
      { x: inner.x, y: inner.y, w: hw, h: hh },
      { x: inner.x + hw + gap, y: inner.y, w: hw, h: hh },
      { x: inner.x, y: inner.y + hh + gap, w: hw, h: hh },
      { x: inner.x + hw + gap, y: inner.y + hh + gap, w: hw, h: hh },
    ];
  }
  if (layout === 'bleed') {
    return [{ x: 0, y: 0, w: W, h: H }];
  }
  if (layout === 'tilt') {
    const pw = inner.w * 0.62;
    const ph = inner.h * 0.52;
    return [
      { x: inner.x + inner.w * 0.04, y: inner.y + inner.h * 0.05, w: pw, h: ph, rot: -0.055 },
      { x: inner.x + inner.w * 0.34, y: inner.y + inner.h * 0.24, w: pw, h: ph, rot: 0.045 },
      { x: inner.x + inner.w * 0.06, y: inner.y + inner.h * 0.46, w: pw, h: ph, rot: -0.03 },
    ];
  }
  // hero: one big panel on the left, three stacked on the right.
  const bigW = inner.w * 0.62;
  const smallW = inner.w - bigW - gap;
  const smallH = (inner.h - gap * 2) / 3;
  return [
    { x: inner.x, y: inner.y, w: bigW, h: inner.h },
    { x: inner.x + bigW + gap, y: inner.y, w: smallW, h: smallH },
    { x: inner.x + bigW + gap, y: inner.y + smallH + gap, w: smallW, h: smallH },
    { x: inner.x + bigW + gap, y: inner.y + (smallH + gap) * 2, w: smallW, h: smallH },
  ];
}

// Public helper for the editor's click-to-select: panel boxes in pixels.
export function panelRectsFor(layout, W, H) {
  return panelRects(layout, W, H);
}

// ---------------------------------------------------------------------------
// Photo drawing: cover-fit with zoom and pan, plus a painted stand-in when a
// panel has no photo yet so the cover never looks empty.
// ---------------------------------------------------------------------------

function drawPhotoCover(ctx, img, r, panel) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  if (!img) {
    drawStandIn(ctx, r);
  } else {
    const base = Math.max(r.w / img.width, r.h / img.height) * panel.zoom;
    const dw = img.width * base;
    const dh = img.height * base;
    const dx = r.x + (r.w - dw) / 2 + panel.ox * Math.max(0, dw - r.w) / 2;
    const dy = r.y + (r.h - dh) / 2 + panel.oy * Math.max(0, dh - r.h) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  ctx.restore();
}

function drawStandIn(ctx, r) {
  const sky = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  sky.addColorStop(0, '#2b1055');
  sky.addColorStop(0.55, '#ff2975');
  sky.addColorStop(1, '#ffb347');
  ctx.fillStyle = sky;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // Low sun and a palm silhouette so the empty panel still reads "Vice".
  const cx = r.x + r.w * 0.5;
  const cy = r.y + r.h * 0.62;
  const sunR = Math.min(r.w, r.h) * 0.2;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 2.4);
  glow.addColorStop(0, 'rgba(255, 240, 180, 0.9)');
  glow.addColorStop(1, 'rgba(255, 240, 180, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 8, 40, 0.85)';
  ctx.fillRect(r.x, r.y + r.h * 0.78, r.w, r.h * 0.22);
  drawPalm(ctx, r.x + r.w * 0.82, r.y + r.h * 0.8, Math.min(r.w, r.h) * 0.22);
}

function drawPalm(ctx, x, y, s) {
  ctx.strokeStyle = 'rgba(20, 8, 40, 0.9)';
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.08, y - s * 0.55, x + s * 0.3, y - s * 0.85);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.95 + i * 0.28);
    const ex = x + s * 0.3 + Math.cos(a) * s * 0.42;
    const ey = y - s * 0.85 + Math.sin(a) * s * 0.3 + s * 0.18;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, y - s * 0.85);
    ctx.quadraticCurveTo(
      x + s * 0.3 + Math.cos(a) * s * 0.25, y - s * 0.85 + Math.sin(a) * s * 0.12,
      ex, ey,
    );
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Finish: grade tint, title block, heat pill, frame, grain, halftone, vignette.
// ---------------------------------------------------------------------------

let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const t = document.createElement('canvas');
  t.width = 140;
  t.height = 140;
  const c = t.getContext('2d');
  const img = c.createImageData(140, 140);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  grainTile = t;
  return t;
}

function drawTitleBlock(ctx, state, W, H) {
  const pad = Math.min(W, H) * 0.045;
  const titleSize = Math.round(Math.min(W, H) * 0.105);
  const subSize = Math.round(titleSize * 0.34);
  // Title baseline sits high enough that the subtitle line below it still
  // clears the bottom edge of the cover.
  const baseY = H - pad - subSize * 1.7;
  ctx.save();
  ctx.translate(pad, baseY);
  ctx.rotate(-0.035);
  ctx.font = `${titleSize}px Anton, 'Arial Black', sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const grad = ctx.createLinearGradient(0, -titleSize, 0, 0);
  grad.addColorStop(0, '#ffe259');
  grad.addColorStop(0.45, '#ff7e5f');
  grad.addColorStop(0.75, '#ff2975');
  grad.addColorStop(1, '#b537f2');
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, titleSize * 0.09);
  ctx.strokeStyle = 'rgba(16, 4, 32, 0.95)';
  const title = (state.title || 'VICE CITY').toUpperCase();
  ctx.strokeText(title, 0, 0);
  ctx.fillStyle = grad;
  ctx.fillText(title, 0, 0);
  ctx.font = `${subSize}px Pacifico, cursive`;
  ctx.shadowColor = '#ff2975';
  ctx.shadowBlur = Math.round(subSize * 0.45);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(state.subtitle || '', 0, subSize * 1.5);
  ctx.restore();
}

function drawHeatPill(ctx, state, W, H) {
  const pad = Math.min(W, H) * 0.035;
  const pillH = Math.round(Math.min(W, H) * 0.052);
  const pillW = Math.round(pillH * 4.6);
  const x = W - pad - pillW;
  const y = pad;
  ctx.save();
  ctx.fillStyle = 'rgba(12, 4, 28, 0.82)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(2, pillH * 0.06);
  roundRect(ctx, x, y, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.stroke();
  const fs = Math.round(pillH * 0.52);
  ctx.font = `${fs}px Anton, 'Arial Black', sans-serif`;
  ctx.fillStyle = '#ffe259';
  ctx.textBaseline = 'middle';
  ctx.fillText('HEAT', x + pillH * 0.5, y + pillH / 2 + 1);
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.heat ? '★' : '☆';
  ctx.font = `${fs}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(stars, x + pillH * 1.9, y + pillH / 2 + 1);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(8,2,20,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawHalftone(ctx, W, H) {
  const step = Math.max(9, Math.round(Math.min(W, H) / 90));
  ctx.save();
  ctx.fillStyle = 'rgba(255, 41, 117, 0.10)';
  for (let y = H * 0.55; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const r = step * 0.16 * (0.6 + 0.4 * ((y / H) - 0.55) / 0.45);
      ctx.beginPath();
      ctx.arc(x + step / 2, y + step / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The one draw function: preview and export call exactly this.
// ---------------------------------------------------------------------------

export function drawCover(ctx, state, W, H) {
  ctx.clearRect(0, 0, W, H);
  const grade = GRADE_DEFS[state.grade] || GRADE_DEFS.sunset;

  // Backdrop: a deep sunset wash so tilted snapshots sit on something.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1b0b3b');
  bg.addColorStop(0.55, '#7b1e6e');
  bg.addColorStop(1, '#ff7e5f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const rects = panelRects(state.layout, W, H);
  ctx.save();
  ctx.filter = grade.filter;
  rects.forEach((r, i) => {
    const panel = state.panels[Math.min(i, state.panels.length - 1)];
    if (r.rot) {
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate(r.rot);
      ctx.translate(-r.w / 2, -r.h / 2);
      drawPhotoCover(ctx, state.photos[panel.photo] || null, { x: 0, y: 0, w: r.w, h: r.h }, panel);
      ctx.restore();
      // White snapshot border around the tilted panel.
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate(r.rot);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(3, Math.min(W, H) * 0.008);
      ctx.strokeRect(-r.w / 2, -r.h / 2, r.w, r.h);
      ctx.restore();
    } else {
      drawPhotoCover(ctx, state.photos[panel.photo] || null, r, panel);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = Math.max(1, Math.min(W, H) * 0.002);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
  });
  ctx.restore();

  // Grade tint over the whole cover.
  const tint = ctx.createLinearGradient(0, 0, W, H);
  tint.addColorStop(0, grade.tint[0]);
  tint.addColorStop(0.55, grade.tint[1]);
  tint.addColorStop(1, grade.tint[2]);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, H);

  if (state.halftone) drawHalftone(ctx, W, H);
  drawVignette(ctx, W, H);

  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = ctx.createPattern(getGrainTile(), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  drawTitleBlock(ctx, state, W, H);
  drawHeatPill(ctx, state, W, H);

  if (state.frame) {
    const fw = Math.max(4, Math.round(Math.min(W, H) * 0.014));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = fw;
    ctx.strokeRect(fw / 2, fw / 2, W - fw, H - fw);
  }
}

export function renderToCanvas(state, sizeKey) {
  const size = EXPORT_SIZES[sizeKey] || EXPORT_SIZES.square;
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas.getContext('2d'), state, size.w, size.h);
  return canvas;
}

const HEIGHTS = {low: 0.45, medium: 0.60, high: 0.75};

/**
 * Advance one Doom-fire step. The input is never changed, making this useful
 * both for the renderer and deterministic tests.
 */
export function stepFire(cells, width, height, rng = Math.random, wind = 0, bias = 0) {
  const next = new Uint8Array(width * height);
  const source = Math.max(0, Math.min(36, 36 - bias));
  for (let x = 0; x < width; x++) {
    const position = x / Math.max(1, width - 1);
    const falloff = position < 0.3 || position > 0.7
      ? 0
      : Math.min(1, (position - 0.3) / 0.1, (0.7 - position) / 0.1);
    next[(height - 1) * width + x] = Math.max(0, Math.min(36,
      Math.round(source * falloff * (0.9 + rng() * 0.2))));
  }
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const below = (y + 1) * width + x;
      const offset = Math.max(-1, Math.min(1, Math.round(wind + (rng() * 2 - 1))));
      const targetX = Math.max(0, Math.min(width - 1, x + offset));
      const decay = Math.floor(rng() * 3);
      next[y * width + targetX] = Math.max(0, cells[below] - decay - (decay & 1));
    }
  }
  return next;
}

function palette() {
  const colors = ['00000000', '1f0707ff', '4b0d06ff', '741806ff', '9f2f07ff', 'bd4307ff', 'df5f07ff',
    'e97812ff', 'efa71fff', 'dfcf6fff', 'efefc7ff'];
  return new Uint32Array(colors.map(hex => {
    const n = Number.parseInt(hex, 16);
    return ((n >>> 24) << 24) | (((n >>> 16) & 255) << 16) | (((n >>> 8) & 255) << 8) | (n & 255);
  }));
}

export function createFireplace(root, options = {}) {
  const canvas = root?.querySelector?.('#fire') || root?.ownerDocument?.createElement?.('canvas');
  if (!canvas || !root) return {start() {}, stop() {}, setIntensity() {}};
  canvas.width = 160; canvas.height = 90; canvas.id = canvas.id || 'fire';
  if (!canvas.parentNode) root.append(canvas);
  const ctx = canvas.getContext?.('2d');
  const image = ctx?.createImageData?.(canvas.width, canvas.height);
  const rng = options.rng || Math.random;
  const colors = palette();
  let cells = new Uint8Array(canvas.width * canvas.height);
  let intensity = options.intensity || 'medium';
  let frame = 0, running = false, last = 0, accumulator = 0, raf = 0;
  const setIntensity = value => { if (HEIGHTS[value]) intensity = value; };
  const draw = now => {
    if (!running || document.hidden) { raf = 0; return; }
    if (!last) last = now;
    accumulator += Math.min(100, now - last); last = now;
    while (accumulator >= 1000 / 30) {
      cells = stepFire(cells, canvas.width, canvas.height, rng, Math.sin(now / 1700), Math.round((1 - HEIGHTS[intensity]) * 8));
      accumulator -= 1000 / 30;
    }
    if (image && ctx) {
      const view = new Uint32Array(image.data.buffer);
      for (let i = 0; i < cells.length; i++) view[i] = colors[Math.min(10, Math.round(cells[i] / 3.6))];
      ctx.putImageData(image, 0, 0);
    }
    root.style?.setProperty('--glow', String(0.75 + 0.25 * (Math.sin(now * .0023) + Math.sin(now * .0007)) / 2));
    raf = requestAnimationFrame(draw);
  };
  return {
    start() { if (running) return; running = true; last = 0; accumulator = 0; raf = requestAnimationFrame(draw); },
    stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    setIntensity
  };
}

const CURATED = {
  '34': '#E50914', '44': '#FF0033', '45': '#FF0033', '33': '#00A8E1',
  '76': '#113CCF', '19': '#1CE783', '128': '#002BE7', '40': '#E5A00D',
  '88': '#F5C518', '9': '#0064FF', '90': '#FA382F', '91': '#A1A1A6',
  '12': '#FFF200', '150': '#1E9BE9'
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), lightness = (max + min) / 2;
  let hue = 0, saturation = 0, delta = max - min;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return [hue, saturation, lightness];
}

function hslToHex(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = lightness - chroma / 2;
  const [r, g, b] = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] :
    hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] :
      hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return `#${[r, g, b].map(value => Math.round((value + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** Derive a stable, readable brand colour from a small ImageData sample. */
export function deriveBrandColor(imageData) {
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const alpha = imageData.data[i + 3] / 255;
    if (!alpha) continue;
    const red = imageData.data[i] / 255, green = imageData.data[i + 1] / 255, blue = imageData.data[i + 2] / 255;
    const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    if (luma < 0.08 || luma > 0.92) continue;
    r += red; g += green; b += blue; count++;
  }
  if (!count) return null;
  const [hue, saturation, lightness] = rgbToHsl(r / count * 255, g / count * 255, b / count * 255);
  return hslToHex(hue, Math.max(0.45, saturation), clamp(lightness, 0.40, 0.60));
}

export function curatedBrandColor(catalogId) {
  return CURATED[String(catalogId)] || null;
}

export function resolveBrandColor(shortcut, fallback = '#f0f2f1') {
  if (shortcut?.brandColor) return shortcut.brandColor;
  return curatedBrandColor(shortcut?.catalogId ?? shortcut?.appId) ||
    (shortcut?.kind === 'input' ? '#7C8CFF' : shortcut?.kind === 'system' ? '#9AA3B2' : fallback);
}

export function getCachedBrandColor(catalogId, storage = globalThis.localStorage) {
  try { return storage?.getItem(`fmv.brand.${catalogId}`) || null; } catch { return null; }
}

export function cacheBrandColor(catalogId, color, storage = globalThis.localStorage) {
  if (!catalogId || !color) return color;
  try { storage?.setItem(`fmv.brand.${catalogId}`, color); } catch { /* storage can be unavailable */ }
  return color;
}

export const curatedBrandColors = Object.freeze({...CURATED});

import {resolveBrandColor} from '../../shared/brand-colors.js';

const parse = value => {
  const m = String(value).match(/^#([0-9a-f]{6})$/i);
  return m ? [0, 2, 4].map(i => Number.parseInt(m[1].slice(i, i + 2), 16)) : [74, 168, 255];
};
export function lerpTint(brand, background = [7, 8, 11], amount = .22) {
  const rgb = parse(brand);
  return `rgb(${rgb.map((v, i) => Math.round(background[i] + (v - background[i]) * amount)).join(' ')})`;
}
let active = 'a', timer;
export function createBackdrop(root = document.querySelector('#backdrop')) {
  if (!root) return {setBrand() {}};
  const layers = [...root.querySelectorAll('.bg-tint')];
  function setBrand(shortcut, accent = '#4aa8ff') {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const layer = layers.find(item => item.dataset.layer !== active);
      if (!layer) return;
      layer.style.backgroundColor = lerpTint(resolveBrandColor(shortcut, accent));
      root.dataset.active = layer.dataset.layer;
      active = layer.dataset.layer;
    }, 250);
  }
  return {setBrand};
}

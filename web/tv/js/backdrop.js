import {resolveBrandColor} from '../../shared/brand-colors.js';

let active = 'a';
let timer;

export function createBackdrop(root = document.querySelector('#backdrop')) {
  if (!root) return {setBrand() {}};
  const layers = [...root.querySelectorAll('.backdrop-layer')];
  function setBrand(shortcut, accent = '#4aa8ff') {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const color = resolveBrandColor(shortcut, accent);
      const next = active === 'a' ? 'b' : 'a';
      const layer = layers.find(item => item.dataset.layer === next);
      if (!layer) return;
      layer.style.setProperty('--brand', color);
      layer.style.setProperty('--accent', accent);
      root.dataset.active = next;
      active = next;
    }, 120);
  }
  return {setBrand};
}

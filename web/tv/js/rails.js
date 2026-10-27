const DEFAULT_LEAD = 148;
const DEFAULT_FADE = 48;

export function scrollTrackToFocus(track, card, { lead = DEFAULT_LEAD, fade = DEFAULT_FADE } = {}) {
  if (!track || !card) return 0;
  const geometry = track._fmvGeometry;
  if (!geometry) {
    const trackRect = track.getBoundingClientRect?.(), cardRect = card.getBoundingClientRect?.();
    if (!trackRect || !cardRect) return 0;
    const current = Number(track.dataset.scrollOffset || 0);
    const max = Math.max(0, (track.scrollWidth || trackRect.width) - (track.clientWidth || trackRect.width));
    const rightSafeEdge = trackRect.right - Math.max(lead, fade);
    let next = current;
    if (cardRect.right > rightSafeEdge) next += cardRect.right - rightSafeEdge;
    if (cardRect.left < trackRect.left) next -= trackRect.left - cardRect.left;
    next = Math.max(0, Math.min(max, next)); track.dataset.scrollOffset = String(next);
    track.style.transform = next ? `translate3d(${-next}px, 0, 0)` : ''; track.dataset.overflow = max > 0 ? 'true' : 'false';
    return next;
  }
  const cardRect = geometry.cards.find(item => item.card === card);
  if (!cardRect) return 0;
  const current = Number(track.dataset.scrollOffset || 0);
  const max = Math.max(0, geometry.scrollWidth - geometry.width);
  let next = current;
  const rightSafeEdge = geometry.width - Math.max(lead, fade);
  if (cardRect.right - current > rightSafeEdge) next += cardRect.right - current - rightSafeEdge;
  if (cardRect.left - current < 0) next -= current - cardRect.left;
  next = Math.max(0, Math.min(max, next));
  track.dataset.scrollOffset = String(next);
  track.style.transform = next ? `translate3d(${-next}px, 0, 0)` : '';
  track.dataset.overflow = max > 0 ? 'true' : 'false';
  return next;
}

export function updateRailFocus(rowIndex) {
  const rails = document.querySelector('#rails');
  if (!rails) return;
  rails.dataset.focusRow = String(rowIndex);
  rails.style.transform = `translate3d(0, ${rowIndex ? -76 - (rowIndex - 1) * 208 : 0}px, 0)`;
  const focusMode = rowIndex > 0;
  document.body.classList.toggle('focus-mode', focusMode);
  const track = rails.querySelector(`.rail[data-row="${rowIndex}"] .row`);
  rails.querySelectorAll('.row').forEach(item => {
    const width = item._fmvGeometry?.width ?? item.clientWidth;
    const scrollWidth = item._fmvGeometry?.scrollWidth ?? item.scrollWidth;
    item.dataset.overflow = scrollWidth > width ? 'true' : 'false';
  });
  const tile = track?.querySelector(':focus');
  if (track && tile) scrollTrackToFocus(track, tile);
  rails.querySelectorAll('.rail-fade').forEach((fade, index) => fade.hidden = index !== rowIndex || track?.dataset.overflow !== 'true');
}

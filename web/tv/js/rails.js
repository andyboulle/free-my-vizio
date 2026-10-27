const DEFAULT_LEAD = 148;
const DEFAULT_FADE = 48;

export function scrollTrackToFocus(track, card, { lead = DEFAULT_LEAD, fade = DEFAULT_FADE } = {}) {
  if (!track || !card?.getBoundingClientRect) return 0;
  const trackRect = track.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const current = Number(track.dataset.scrollOffset || 0);
  const max = Math.max(0, (track.scrollWidth || trackRect.width) - (track.clientWidth || trackRect.width));
  let next = current;
  const rightSafeEdge = trackRect.right - Math.max(lead, fade);
  if (cardRect.right > rightSafeEdge) next += cardRect.right - rightSafeEdge;
  if (cardRect.left < trackRect.left) next -= trackRect.left - cardRect.left;
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
  rails.style.setProperty('--focus-row', String(rowIndex));
  rails.style.setProperty('--rail-shift', rowIndex ? `${-76 - (rowIndex - 1) * 208}px` : '0px');
  const focusMode = rowIndex > 0;
  document.body.classList.toggle('focus-mode', focusMode);
  document.querySelectorAll('.row').forEach((track) => {
    const row = track.closest('.rail');
    const tile = row?.querySelector(':focus');
    if (tile) scrollTrackToFocus(track, tile);
    const max = Math.max(0, (track.scrollWidth || 0) - (track.clientWidth || 0));
    track.dataset.overflow = max > 0 ? 'true' : 'false';
  });
}

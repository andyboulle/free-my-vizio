export function reconcileFocus(grid, focusedId, previous = {row: 0, column: 0}) {
  for (let row = 0; row < grid.length; row++) {
    const column = (grid[row] || []).indexOf(focusedId);
    if (column !== -1) return {row, column};
  }
  const rows = grid.map((row, index) => ({row: index, length: (row || []).length})).filter(({length}) => length);
  if (!rows.length) return {row: 0, column: 0};
  const row = Math.max(0, Math.min(grid.length - 1, previous.row));
  const nearest = rows.reduce((best, candidate) =>
    Math.abs(candidate.row - row) < Math.abs(best.row - row) ? candidate : best);
  return {row: nearest.row, column: Math.max(0, Math.min(nearest.length - 1, previous.column))};
}

export function shouldRerender(previous, next) {
  return JSON.stringify(previous) !== JSON.stringify(next);
}

export async function activateTile(tile, id, request, onError) {
  tile.disabled = true;
  tile.classList.add('loading');
  try {
    await request('/api/tv/activate', {
      method: 'POST',
      body: JSON.stringify({shortcutId: id})
    });
  } catch {
    onError();
  } finally {
    tile.classList.remove('loading');
    tile.disabled = false;
  }
}

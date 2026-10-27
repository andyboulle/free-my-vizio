const widths = { app: 148, input: 220, system: 180 };
const gap = 24;

export function buildGrid(sections = []) {
  return sections.map(section => (section.shortcuts || []).map(shortcut => shortcut.id));
}

export function buildGeometry(sections = []) {
  return sections.map((section, row) => {
    let x = 0;
    return (section.shortcuts || []).map((shortcut, column) => {
      const width = widths[shortcut.kind] || widths.system;
      const item = { id: shortcut.id, row, column, width, left: x, right: x + width, center: x + width / 2 };
      x += width + gap;
      return item;
    });
  });
}

/**
 * D-pad focus is deliberately a pure calculation. Vertical moves choose the
 * card whose centre is closest to the remembered horizontal centre; horizontal
 * moves clamp at the rail edge and never wrap.
 */
export function moveFocus(grid, position, direction, memory = {}) {
  const rows = Array.isArray(grid) ? grid : [];
  const row = rows[position.row] || [];
  if ((direction === 'left' || direction === 'right') && row.length) {
    const column = Math.max(0, Math.min(row.length - 1, position.column + (direction === 'left' ? -1 : 1)));
    memory[position.row] = column;
    return { row: position.row, column };
  }
  if (direction !== 'up' && direction !== 'down') return position;
  const step = direction === 'up' ? -1 : 1;
  let targetRow = position.row + step;
  while (targetRow >= 0 && targetRow < rows.length && !rows[targetRow]?.length) targetRow += step;
  if (targetRow < 0 || targetRow >= rows.length || !rows[targetRow]?.length) return position;
  const remembered = memory[targetRow];
  const source = row[position.column] ?? row[Math.max(0, Math.min(row.length - 1, position.column))];
  const center = item => item && typeof item === 'object'
  ? (item.center ?? ((item.x ?? item.left ?? 0) + (item.width ?? ((item.right ?? 0) - (item.left ?? 0))) / 2))
  : undefined;
  const sourceCenter = center(source) ?? (position.column + 0.5);
  const geometric = rows[targetRow].reduce((best, item, index) =>
  Math.abs((center(item) ?? index + 0.5) - sourceCenter) <
    Math.abs((center(rows[targetRow][best]) ?? best + 0.5) - sourceCenter) ? index : best, 0);
  // A remembered card is useful when it is still nearby, but must not defeat
  // spatial navigation after a row has materially changed.
  let column = remembered !== undefined && Math.abs(remembered - geometric) <= 1 ? remembered : geometric;
  column = Math.max(0, Math.min(rows[targetRow].length - 1, column));
  memory[targetRow] = column;
  return { row: targetRow, column };
}

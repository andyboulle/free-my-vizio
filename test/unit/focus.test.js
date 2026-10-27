import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid, moveFocus } from '../../web/tv/js/focus.js';
test('focus clamps horizontally and skips empty rows', () => {
  const grid = buildGrid([{ shortcuts: [{ id: 'a' }, { id: 'b' }] }, { shortcuts: [] }, { shortcuts: [{ id: 'c' }] }]);
  assert.deepEqual(moveFocus(grid, { row: 0, column: 0 }, 'left'), { row: 0, column: 0 });
  assert.deepEqual(moveFocus(grid, { row: 0, column: 1 }, 'down'), { row: 2, column: 0 });
  assert.deepEqual(moveFocus(grid, { row: 2, column: 0 }, 'up'), { row: 0, column: 0 });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeometry, buildGrid, moveFocus } from '../../web/tv/js/focus.js';
test('focus clamps horizontally and skips empty rows', () => {
  const grid = buildGrid([{ shortcuts: [{ id: 'a' }, { id: 'b' }] }, { shortcuts: [] }, { shortcuts: [{ id: 'c' }] }]);
  assert.deepEqual(moveFocus(grid, { row: 0, column: 0 }, 'left'), { row: 0, column: 0 });
  assert.deepEqual(moveFocus(grid, { row: 0, column: 1 }, 'down'), { row: 2, column: 0 });
  assert.deepEqual(moveFocus(grid, { row: 2, column: 0 }, 'up'), { row: 0, column: 0 });
});

test('geometry navigation uses mixed card centres and remembers nearby row positions', () => {
  const geometry = buildGeometry([
    { shortcuts: [{ id: 'app', kind: 'app' }, { id: 'input', kind: 'input' }] },
    { shortcuts: [{ id: 'wide', kind: 'input' }, { id: 'pill', kind: 'system' }, { id: 'app2', kind: 'app' }] }
  ]);
  assert.deepEqual(moveFocus(geometry, { row: 0, column: 1 }, 'down'), { row: 1, column: 1 });
  assert.deepEqual(moveFocus(geometry, { row: 1, column: 2 }, 'up', { 0: 0 }), { row: 0, column: 0 });
  assert.deepEqual(moveFocus(geometry, { row: 1, column: 1 }, 'right'), { row: 1, column: 2 });
  assert.deepEqual(moveFocus(geometry, { row: 1, column: 2 }, 'left', { 1: 2 }), { row: 1, column: 1 });
  assert.deepEqual(moveFocus(geometry, { row: 0, column: 0 }, 'left'), { row: 0, column: 0 });
  assert.deepEqual(moveFocus(geometry, { row: 0, column: 1 }, 'right'), { row: 0, column: 1 });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { activateTile, reconcileFocus, shouldRerender } from '../../web/tv/js/state.js';

test('reconcileFocus keeps the same id after a re-render', () => {
  assert.deepEqual(reconcileFocus([['a', 'b'], ['c']], 'c'), {row: 1, column: 0});
});
test('reconcileFocus selects the nearest neighbour when an id is removed', () => {
  assert.deepEqual(reconcileFocus([['a'], ['c', 'd']], 'b', {row: 0, column: 1}), {row: 0, column: 0});
});
test('reconcileFocus returns the origin for an empty grid', () => {
  assert.deepEqual(reconcileFocus([], 'missing'), {row: 0, column: 0});
});
test('shouldRerender skips unchanged JSON', () => {
  assert.equal(shouldRerender({title: 'Home'}, {title: 'Home'}), false);
  assert.equal(shouldRerender({title: 'Home'}, {title: 'Other'}), true);
});

test('activateTile shows loading until activation succeeds', async () => {
  const classes = new Set();
  const tile = {
    disabled: false,
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); }
    }
  };
  let resolve;
  const request = async () => new Promise((done) => { resolve = done; });
  const activation = activateTile(tile, 'netflix', request, () => {});

  assert.equal(tile.disabled, true);
  assert.equal(classes.has('loading'), true);
  resolve();
  await activation;
  assert.equal(tile.disabled, false);
  assert.equal(classes.has('loading'), false);
});

test('activateTile clears loading and reports activation errors', async () => {
  const classes = new Set();
  const tile = {
    disabled: false,
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); }
    }
  };
  let errorShown = false;
  await activateTile(tile, 'netflix', async () => { throw new Error('offline'); }, () => { errorShown = true; });

  assert.equal(tile.disabled, false);
  assert.equal(classes.has('loading'), false);
  assert.equal(errorShown, true);
});

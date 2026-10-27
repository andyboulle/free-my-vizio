import test from 'node:test';
import assert from 'node:assert/strict';
import {stepFire} from '../../web/tv/js/fireplace.js';

const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

test('stepFire is deterministic and keeps values bounded', () => {
  const cells = new Uint8Array(12 * 8);
  cells[12 * 7 + 5] = 36;
  const a = stepFire(cells, 12, 8, seeded(7), 0, 0);
  const b = stepFire(cells, 12, 8, seeded(7), 0, 0);
  assert.deepEqual(a, b);
  assert.equal(a.length, cells.length);
  assert.ok([...a].every(value => value >= 0 && value <= 36));
});

test('stepFire shapes the source to the log bed and applies intensity bias', () => {
  const low = stepFire(new Uint8Array(20 * 4), 20, 4, () => 0.5, 0, 8);
  const high = stepFire(new Uint8Array(20 * 4), 20, 4, () => 0.5, 0, 0);
  assert.equal(low[60], 0);
  assert.equal(low[79], 0);
  assert.ok(high[60 + 10] > low[60 + 10]);
  assert.ok(high[60 + 10] > 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY_CODES } from '../../src/tv/keys.ts';

test('key table includes verified power and unique codes', () => {
  assert.deepEqual(KEY_CODES.POWER_ON, [11, 1]);
  assert.deepEqual(KEY_CODES.POWER_OFF, [11, 0]);
  assert.deepEqual(KEY_CODES.HOME, [4, 15]);
  const values = Object.values(KEY_CODES).map(String);
  assert.equal(new Set(values).size, values.length);
});

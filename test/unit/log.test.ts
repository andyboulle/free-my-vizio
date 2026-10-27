import test from 'node:test';
import assert from 'node:assert/strict';
import { log } from '../../src/util/log.ts';
test('logger redacts nested sensitive keys and secret substrings', () => {
  log.registerSecret('secret-value');
  log.info('test', { nested: { authorization: 'secret-value', url: 'http://h/#k=secret-value' } });
  const line = log.getRing().at(-1) ?? '';
  assert.equal(line.includes('secret-value'), false);
  assert.equal(line.includes('[REDACTED]'), true);
});

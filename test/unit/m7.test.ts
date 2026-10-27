import assert from 'node:assert/strict';
import test from 'node:test';
import { matchByDeviceId } from '../../src/tv/discovery.ts';

test('rediscovery matches the configured TV device ID, not its old address', () => {
  const found = matchByDeviceId([
    { host: '192.168.1.20', model: 'Other', deviceId: 'other' },
    { host: '192.168.1.42', model: 'M65Q6-L4', deviceId: 'target' },
  ], 'target');
  assert.deepEqual(found, { host: '192.168.1.42', model: 'M65Q6-L4', deviceId: 'target' });
  assert.equal(matchByDeviceId([], 'target'), undefined);
});

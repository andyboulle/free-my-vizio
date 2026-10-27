import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockTv } from '../mock-tv/mock-tv.ts';
import { scanBaseForHost, scanSubnet } from '../../src/tv/discovery.ts';
test('discovery finds mock TV device info', async () => {
  const tv = await createMockTv();
  try {
    const found = await scanSubnet('127.0.0.1', { port: tv.connection.port, concurrency: 32, timeoutMs: 1500 });
    assert.equal(found[0]?.model, 'M65Q6-L4');
  } finally { await tv.close(); }
});

test('rediscovery scans the TV subnet instead of the Docker bridge subnet', () => {
  assert.equal(scanBaseForHost('192.168.1.42'), '192.168.1.0');
});

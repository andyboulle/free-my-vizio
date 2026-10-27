import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockTv } from '../mock-tv/mock-tv.ts';
import { scanSubnet } from '../../src/tv/discovery.ts';
test('discovery finds mock TV device info', async () => {
  const tv = await createMockTv();
  try {
    const found = await scanSubnet('127.0.0.1', { port: tv.connection.port, concurrency: 254, timeoutMs: 100 });
    assert.equal(found[0]?.model, 'M65Q6-L4');
  } finally { await tv.close(); }
});

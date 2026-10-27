import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockTv } from '../mock-tv/mock-tv.ts';
import { TvConnection } from '../../src/tv/transport.ts';
import { SmartCastClient } from '../../src/tv/smartcast-client.ts';
import { TvAuthError, TvPairingError, TvUnreachableError } from '../../src/tv/errors.ts';

test('client integrates with mock TV over TLS', async () => {
  const tv = await createMockTv({ raceOnce: true });
  try {
    const connection = new TvConnection(tv.connection);
    const client = new SmartCastClient({ connection });
    const info = await client.getDeviceInfo();
    assert.equal(info.model, 'M65Q6-L4'); assert.equal(info.firmware, '86.910.19.2-1'); assert.equal(info.chipsetKey, 'MT5586');
    await assert.rejects(() => client.getCurrentApp(), TvAuthError);
    const challenge = await client.startPairing(info.deviceId, 'test');
    await assert.rejects(() => client.finishPairing(info.deviceId, challenge, 'wrong'), TvPairingError);
    connection.update({ authToken: await client.finishPairing(info.deviceId, challenge, tv.controls.pin) });
    await client.setInput('HDMI1');
    await client.setSetting('picture/foo', 1);
    assert.equal(tv.controls.currentInput, 'hdmi1');
    tv.controls.unreachable = true;
    await assert.rejects(() => client.getCurrentApp({ timeoutMs: 20 }), TvUnreachableError);
  } finally { await tv.close(); }
});

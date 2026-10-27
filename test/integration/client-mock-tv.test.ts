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
    await assert.rejects(() => client.finishPairing(info.deviceId, challenge, 'wrong'), error => error instanceof TvPairingError && error.result === 'PAIRING_DENIED');
    const token = await client.finishPairing(info.deviceId, challenge, tv.controls.pin);
    connection.update({ authToken: token });
    assert.equal(connection.authToken, tv.controls.pairedToken);
    await client.setInput('HDMI1');
    await client.setSetting('picture/foo', 1);
    assert.equal(tv.controls.currentInput, 'hdmi1');
    tv.controls.unreachable = true;
    await assert.rejects(() => client.getCurrentApp({ timeoutMs: 20 }), TvUnreachableError);
  } finally { await tv.close(); }
});

test('pairing cancellation sends the pending challenge to the TV', async () => {
  const tv = await createMockTv();
  try {
    const connection = new TvConnection(tv.connection);
    const client = new SmartCastClient({ connection });
    const challenge = await client.startPairing('device', 'test');
    await client.cancelPairing('device', challenge);
    const cancel = tv.requests.find(request => request.path === '/pairing/cancel');
    assert.deepEqual(cancel?.body, { DEVICE_ID: 'device', PAIRING_REQ_TOKEN: 42, CHALLENGE_TYPE: 1 });
  } finally { await tv.close(); }
});

test('setInput uses a fresh hash and rejects display names', async () => {
  const tv = await createMockTv();
  try {
    const client = new SmartCastClient({ connection: new TvConnection({ ...tv.connection, authToken: 'token' }) });
    await client.setInput('hdmi1');
    const inputRequests = tv.requests.filter(request => request.path.endsWith('/current_input'));
    assert.equal(inputRequests[0]?.method, 'GET');
    assert.deepEqual(inputRequests[1]?.body, { REQUEST: 'MODIFY', VALUE: 'hdmi1', HASHVAL: 1001 });
    await assert.rejects(() => client.setInput('HDMI-1'), /FAILURE/);
  } finally { await tv.close(); }
});

test('concurrent settings serialize and a failed transaction releases the mutex', async () => {
  const tv = await createMockTv();
  try {
    const client = new SmartCastClient({ connection: new TvConnection({ ...tv.connection, authToken: 'token' }) });
    await Promise.all([client.setSetting('picture/foo', 1), client.setSetting('picture/foo', 2)]);
    assert.equal(tv.controls.hashvals.setting, 2003);
    tv.controls.failSetting = true;
    await assert.rejects(() => client.setSetting('picture/foo', 3), /FAILURE/);
    tv.controls.failSetting = false;
    await client.setSetting('picture/foo', 4);
    assert.equal(tv.controls.hashvals.setting, 2004);
  } finally { await tv.close(); }
});

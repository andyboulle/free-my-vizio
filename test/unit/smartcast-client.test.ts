import test from 'node:test';
import assert from 'node:assert/strict';
import { SmartCastClient } from '../../src/tv/smartcast-client.ts';
import type { TvTransport } from '../../src/tv/transport.ts';

function fake(responses: Array<Record<string, unknown>>): { transport: TvTransport; calls: unknown[] } {
  const calls: unknown[] = [];
  return { calls, transport: { request: async (...args) => { calls.push(args); return { status: 200, json: responses.shift() ?? { STATUS: { RESULT: 'SUCCESS' } }, text: '' }; } } };
}
test('client creates exact launch, URL, and key payloads', async () => {
  const f = fake([{ STATUS: { RESULT: 'SUCCESS' } }, { STATUS: { RESULT: 'SUCCESS' } }, { STATUS: { RESULT: 'SUCCESS' } }]);
  const client = new SmartCastClient({ connection: { host: 'x' } as never, transport: f.transport });
  await client.launchApp({ nameSpace: 4, appId: 'abc', message: null });
  await client.launchUrl('https://example.test');
  await client.sendKey('POWER_ON');
  assert.deepEqual((f.calls[0] as unknown[])[2], { VALUE: { NAME_SPACE: 4, APP_ID: 'abc', MESSAGE: null } });
  assert.deepEqual((f.calls[1] as unknown[])[2], { VALUE: { NAME_SPACE: 4, APP_ID: '17', MESSAGE: 'https://example.test' } });
  assert.deepEqual((f.calls[2] as unknown[])[2], { KEYLIST: [{ CODESET: 11, CODE: 1, ACTION: 'KEYPRESS' }] });
});

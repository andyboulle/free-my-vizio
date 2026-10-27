import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockTv } from '../mock-tv/mock-tv.ts';
import { SmartCastClient } from '../../src/tv/smartcast-client.ts';
import { TvConnection } from '../../src/tv/transport.ts';
import { TakeoverSupervisor } from '../../src/supervisor/takeover.ts';
import { DEFAULT_CONFIG } from '../../src/config/schema.ts';
import { m65q6L4 } from '../../src/tv/profiles/m65q6-l4.ts';

test('mock TV receives the exact takeover launch payload', async () => {
  const tv = await createMockTv();
  try {
    tv.controls.currentApp = { NAME_SPACE: 4, APP_ID: '1', MESSAGE: '{"app":"home","bundle":"bundles/home"}' };
    const client = new SmartCastClient({ connection: new TvConnection({ ...tv.connection, authToken: 'mock-auth-token' }) });
    const config = structuredClone(DEFAULT_CONFIG); config.takeover.confirmDelayMs = 0;
    const supervisor = new TakeoverSupervisor({ client, config, tvUiUrlPrefix: 'http://host/tv/', tvUiToken: 'token',
      nativeHome: m65q6L4.nativeHome, isNativeHome: m65q6L4.isNativeHome });
    await supervisor.tick();
    const launch = tv.requests.find(r => r.path === '/app/launch');
    assert.deepEqual(launch?.body, { VALUE: { NAME_SPACE: 4, APP_ID: '17', MESSAGE: 'http://host/tv/#k=token' } });
  } finally { await tv.close(); }
});

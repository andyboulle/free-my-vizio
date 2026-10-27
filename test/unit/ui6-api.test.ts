import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHttpServer } from '../../src/server/http-server.ts';
import { DEFAULT_CONFIG } from '../../src/config/schema.ts';

test('UI6 admin pause and resume endpoints authenticate and validate', async () => {
  const calls: string[] = [];
  const supervisor = {
    suppress: (value: number | 'untilStandby') => calls.push(`pause:${value}`),
    resume: () => calls.push('resume'),
    status: () => ({ state: 'PAUSED', power: 1, appClass: 'NATIVE_HOME', lastLaunchAt: null, lastError: null, suppressedUntil: 0, launchesInWindow: 0, lastTvContactAt: Date.now() }),
  } as never;
  const config = structuredClone(DEFAULT_CONFIG);
  const server = createHttpServer({ config, secrets: { adminToken: 'secret', tvUiToken: 'ui', tvPairingDeviceId: 'device' }, admin: { supervisor } });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const request = (path: string, value?: unknown, token = 'secret') => new Promise<number>(resolve => {
    const req = http.request({ host: '127.0.0.1', port, path, method: value === undefined ? 'GET' : 'POST', headers: { Host: `127.0.0.1:${port}`, Authorization: `Bearer ${token}`, ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode ?? 0)); });
    req.end(value === undefined ? undefined : JSON.stringify(value));
  });
  try {
    assert.equal(await request('/api/admin/takeover/pause', { minutes: 15 }, 'wrong'), 401);
    assert.equal(await request('/api/admin/takeover/pause', { minutes: 0 }), 400);
    assert.equal(await request('/api/admin/takeover/pause', { minutes: 'untilStandby' }), 200);
    assert.equal(await request('/api/admin/takeover/resume', {}), 200);
    assert.equal(await request('/api/admin/screensaver/preview', {}), 404);
    assert.deepEqual(calls, ['pause:untilStandby', 'resume']);
  } finally { server.close(); }
});

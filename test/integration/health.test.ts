import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHttpServer } from '../../src/server/http-server.ts';
import { DEFAULT_CONFIG } from '../../src/config/schema.ts';

async function health(lastTvContactAt: number | null): Promise<unknown> {
  const server = createHttpServer({
    config: structuredClone(DEFAULT_CONFIG),
    secrets: { adminToken: 'admin', tvUiToken: 'ui', tvPairingDeviceId: 'fmv-test' },
    tv: { config: structuredClone(DEFAULT_CONFIG), takeoverStatus: () => ({
      state: 'IDLE', power: null, appClass: null, lastLaunchAt: null, lastError: null,
      suppressedUntil: 0, launchesInWindow: 0, lastTvContactAt,
    }), nativeHome: async () => {} },
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  try {
    return await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: '/healthz', headers: { Host: `127.0.0.1:${port}` } }, response => {
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(Buffer.from(chunk)));
        response.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
      }).on('error', reject);
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

test('/healthz reports unknown reachability before first TV contact', async () => {
  assert.equal((await health(null) as { tvReachable: boolean | null }).tvReachable, null);
});

test('/healthz reports recent contact reachable and stale contact unreachable', async () => {
  assert.equal((await health(Date.now()) as { tvReachable: boolean | null }).tvReachable, true);
  assert.equal((await health(Date.now() - 10_001) as { tvReachable: boolean | null }).tvReachable, false);
});

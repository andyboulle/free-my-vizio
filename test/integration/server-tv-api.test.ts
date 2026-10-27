import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHttpServer } from '../../src/server/http-server.ts';
import { DEFAULT_CONFIG } from '../../src/config/schema.ts';
test('TV home and activation are token protected', async () => {
  let activated = '';
  const server = createHttpServer({ config: structuredClone(DEFAULT_CONFIG), secrets: { adminToken: 'admin', tvUiToken: 'ui', tvPairingDeviceId: 'fmv-test' }, tv: { config: structuredClone(DEFAULT_CONFIG), nativeHome: async () => {}, client: { launchApp: async () => {}, setInput: async (x: string) => { activated = x; }, sendKey: async () => {} } as never } });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const request = (path: string, method: string, token?: string, data?: unknown) => new Promise<{ status: number; body: string }>((resolve, reject) => { const req = http.request({ host: '127.0.0.1', port, path, method, headers: { Host: `127.0.0.1:${port}`, ...(token ? { 'X-FMV-Token': token } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) } }, res => { const chunks: Buffer[] = []; res.on('data', x => chunks.push(x)); res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() })); }); req.on('error', reject); if (data) req.end(JSON.stringify(data)); else req.end(); });
  try { assert.equal((await request('/api/tv/home', 'GET')).status, 401); assert.equal((await request('/api/tv/home', 'GET', 'ui')).status, 200); const result = await request('/api/tv/activate', 'POST', 'ui', { shortcutId: 'hdmi1' }); assert.equal(result.status, 200); assert.equal(activated, 'hdmi1'); } finally { server.close(); }
});

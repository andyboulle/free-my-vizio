import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHttpServer } from '../../src/server/http-server.ts';
import { DEFAULT_CONFIG } from '../../src/config/schema.ts';

test('admin API authenticates and validates config without exposing secrets', async () => {
  const dataDir = path.join(process.cwd(), 'test', '.admin-api-data');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const config = structuredClone(DEFAULT_CONFIG);
  const server = createHttpServer({
    config,
    secrets: { adminToken: 'admin-secret', tvUiToken: 'ui-secret', tvPairingDeviceId: 'fmv-test' },
    admin: { dataDir },
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const request = (pathname: string, method: string, token?: string, value?: unknown) => new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method, headers: { Host: `127.0.0.1:${port}`, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(value !== undefined ? { 'Content-Type': 'application/json' } : {}) } }, response => {
      const chunks: Buffer[] = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString() }));
    }); req.on('error', reject); if (value !== undefined) req.end(JSON.stringify(value)); else req.end();
  });
  try {
    assert.equal((await request('/api/admin/config', 'GET')).status, 401);
    const good = await request('/api/admin/config', 'GET', 'admin-secret');
    assert.equal(good.status, 200); assert.equal(good.body.includes('admin-secret'), false); assert.equal(good.body.includes('ui-secret'), false);
    const invalid = structuredClone(DEFAULT_CONFIG); invalid.home.sections[2].shortcuts[0].hidden = true;
    assert.equal((await request('/api/admin/config', 'PUT', 'admin-secret', invalid)).status, 400);
    assert.equal((await request('/api/admin/config', 'GET', 'admin-secret')).body.includes('"hidden":false'), true);
  } finally { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

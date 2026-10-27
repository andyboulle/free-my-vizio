import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHttpServer } from '../../src/server/http-server.ts';
import { DEFAULT_CONFIG } from '../../src/config/schema.ts';
import { TvConnection } from '../../src/tv/transport.ts';
import { SmartCastClient } from '../../src/tv/smartcast-client.ts';

test('admin API authenticates and validates config without exposing secrets', async () => {
  const dataDir = path.join(process.cwd(), 'test', '.admin-api-data');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const config = structuredClone(DEFAULT_CONFIG);
  const server = createHttpServer({
    config,
    secrets: { adminToken: 'admin-secret', tvUiToken: 'ui-secret', tvPairingDeviceId: 'fmv-test' },
    admin: { dataDir },
  });

  test('admin config PUT updates the live TV connection', async () => {
    const dataDir = path.join(process.cwd(), 'test', '.admin-api-connection-data');
    fs.rmSync(dataDir, { recursive: true, force: true });
    const config = structuredClone(DEFAULT_CONFIG);
    config.tv.host = '192.0.2.10';
    const connection = new TvConnection({ host: config.tv.host, port: config.tv.port });
    const client = new SmartCastClient({ connection, transport: { request: async () => ({ status: 200, json: { STATUS: { RESULT: 'SUCCESS' } }, text: '' }) } });
    const server = createHttpServer({
      config,
      secrets: { adminToken: 'admin-secret', tvUiToken: 'ui-secret', tvPairingDeviceId: 'fmv-test' },
      admin: { dataDir, connection, client },
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    const req = (value: unknown) => new Promise<number>((resolve, reject) => {
      const request = http.request({ host: '127.0.0.1', port, path: '/api/admin/config', method: 'PUT',
        headers: { Host: `127.0.0.1:${port}`, Authorization: 'Bearer admin-secret', 'Content-Type': 'application/json' } },
        response => { response.resume(); response.on('end', () => resolve(response.statusCode ?? 0)); });
      request.on('error', reject); request.end(JSON.stringify(value));
    });
    try {
      const next = structuredClone(config); next.tv.host = '192.0.2.11'; next.tv.port = 7445;
      assert.equal(await req(next), 200);
      assert.equal(connection.host, '192.0.2.11'); assert.equal(connection.port, 7445);
    } finally { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
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
    assert.equal((await request('/api/admin/key', 'POST', 'admin-secret', { key: 'NOT_A_KEY' })).status, 400);
    const invalid = structuredClone(DEFAULT_CONFIG); invalid.home.sections[2].shortcuts[0].hidden = true;
    assert.equal((await request('/api/admin/config', 'PUT', 'admin-secret', invalid)).status, 400);
    assert.equal((await request('/api/admin/config', 'GET', 'admin-secret')).body.includes('"hidden":false'), true);
  } finally { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHttpServer } from '../../src/server/http-server.ts';
import { DEFAULT_CONFIG } from '../../src/config/schema.ts';
import { Catalog } from '../../src/catalog/catalog.ts';
import { tvHome } from '../../src/server/routes-tv.ts';
test('TV home and activation are token protected', async () => {
  let activated = '';
  const server = createHttpServer({ config: structuredClone(DEFAULT_CONFIG), secrets: { adminToken: 'admin', tvUiToken: 'ui', tvPairingDeviceId: 'fmv-test' }, tv: { config: structuredClone(DEFAULT_CONFIG), nativeHome: async () => {}, client: { launchApp: async () => {}, setInput: async (x: string) => { activated = x; }, sendKey: async () => {} } as never } });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const request = (path: string, method: string, token?: string, data?: unknown) => new Promise<{ status: number; body: string }>((resolve, reject) => { const req = http.request({ host: '127.0.0.1', port, path, method, headers: { Host: `127.0.0.1:${port}`, ...(token ? { 'X-FMV-Token': token } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) } }, res => { const chunks: Buffer[] = []; res.on('data', x => chunks.push(x)); res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() })); }); req.on('error', reject); if (data) req.end(JSON.stringify(data)); else req.end(); });
  try { assert.equal((await request('/api/tv/home', 'GET')).status, 401); assert.equal((await request('/api/tv/home', 'GET', 'ui')).status, 200); const result = await request('/api/tv/activate', 'POST', 'ui', { shortcutId: 'hdmi1' }); assert.equal(result.status, 200); assert.equal(activated, 'hdmi1'); } finally { server.close(); }
});

test('TV home omits uncached icons and includes cached icons', async () => {
  const cacheDir = await fs.mkdtemp(path.join(process.cwd(), '.icon-test-'));
  try {
    const catalog = new Catalog([{ catalogId: '34', name: 'Netflix', iconUrl: 'https://example.test/34.png', payload: { nameSpace: 3, appId: '1', message: null }, verifiedOnTarget: true }], { cacheDir });
    const config = structuredClone(DEFAULT_CONFIG);
    const homeWithoutIcon = tvHome({ config, catalog, nativeHome: async () => {} });
    assert.equal('icon' in homeWithoutIcon.sections[0].shortcuts[0], false);
    await fs.mkdir(path.join(cacheDir, 'icons'), { recursive: true });
    await fs.writeFile(path.join(cacheDir, 'icons', '34.png'), 'icon');
    const homeWithIcon = tvHome({ config, catalog, nativeHome: async () => {} });
    assert.equal(homeWithIcon.sections[0].shortcuts[0].icon, '/icons/34.png');
  } finally {
    await fs.rm(cacheDir, { recursive: true, force: true });
  }
});

test('TV home preserves system actions for client-side confirmation', () => {
  const config = structuredClone(DEFAULT_CONFIG);
  config.home.sections[2].shortcuts.push({
    id: 'power-off',
    kind: 'system',
    label: 'Turn off TV',
    action: 'power-off',
    hidden: false
  });
  const home = tvHome({ config, nativeHome: async () => {} });
  const power = home.sections[2].shortcuts.find(shortcut => shortcut.id === 'power-off');
  assert.equal(power?.action, 'power-off');
});

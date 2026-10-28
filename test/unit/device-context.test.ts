import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Catalog, loadCatalog } from '../../src/catalog/catalog.ts';
import { DeviceContext } from '../../src/tv/device-context.ts';
import type { SmartCastClient } from '../../src/tv/smartcast-client.ts';
import apps from '../../docs/evidence/catalog/vizio_apps_prod.sample.json' with { type: 'json' };
import availability from '../../docs/evidence/catalog/app_availability_prod.sample.json' with { type: 'json' };

const catalog = (name: string) => new Catalog([{
  catalogId: name, name, payload: { nameSpace: 3, appId: name, message: null }, verifiedOnTarget: false,
}], { cacheDir: path.join(os.tmpdir(), 'fmv-test-catalog') });

test('catalog refresh keeps the current catalog when fetch fails and replaces it when fetch succeeds', async () => {
  const client = {} as SmartCastClient;
  const context = new DeviceContext(client, catalog('old'));
  const cacheDir = path.join(os.tmpdir(), `fmv-r12-catalog-test-${process.pid}`);
  await fs.rm(cacheDir, { recursive: true, force: true });

  try {
    assert.equal(await context.refreshCatalog(() => loadCatalog({
      cacheDir, fresh: true, fetch: async () => { throw new Error('offline'); },
    })), false);
    assert.equal(context.catalog.resolvePayload('old')?.appId, 'old');

    assert.equal(await context.refreshCatalog(() => loadCatalog({
      cacheDir, fresh: true,
      fetch: async url => url.includes('vizio_apps') ? apps : availability,
    })), true);
    assert.equal(context.catalog.resolvePayload('old'), null);
    assert.ok(context.catalog.resolvePayload('33'));
  } finally {
    await fs.rm(cacheDir, { recursive: true, force: true });
  }
});

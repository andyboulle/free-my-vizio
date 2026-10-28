import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Catalog, loadCatalog } from '../../src/catalog/catalog.ts';
import { compareFirmware, inRange } from '../../src/catalog/version.ts';
import { classifyApp } from '../../src/tv/app-identity.ts';
import { m65q6L4, selectProfile } from '../../src/tv/profiles/index.ts';
import type { DeviceInfo } from '../../src/tv/smartcast-client.ts';
import apps from '../../docs/evidence/catalog/vizio_apps_prod.sample.json' with { type: 'json' };
import availability from '../../docs/evidence/catalog/app_availability_prod.sample.json' with { type: 'json' };

const info = (model = 'M65Q6-L4', firmware = '86.910.19.2-1'): DeviceInfo => ({
  model, firmware, apiVersion: '', vizios: 'mtk5586-1', chipsetKey: 'MT5586',
  deviceId: '', castName: '', capabilities: {}, raw: {},
});

test('firmware versions compare numerically and support open bounds', () => {
  assert.equal(compareFirmware('86.900.61.1-1', '86.910.19.2-1'), -1);
  assert.equal(inRange('86.910.19.2-1', null, '86.910.19.2-1'), true);
});

test('catalog chooses exact chipset before wildcard', () => {
  const catalog = new Catalog([{ catalogId: '34', name: 'Netflix', payload: { nameSpace: 0, appId: 'fallback', message: null }, verifiedOnTarget: true }], { cacheDir: path.join(os.tmpdir(), 'fmv-m3-test') }, new Map([
    ['34', [
      { chipset: '*', payload: { nameSpace: 2, appId: 'wild', message: null }, minimum: null, maximum: null },
      { chipset: 'MT5586', payload: { nameSpace: 3, appId: 'exact', message: null }, minimum: null, maximum: null },
    ]],
  ]));
  assert.equal(catalog.resolvePayload('34', info())?.appId, 'exact');
});

test('catalog omits chipset-specific apps and selects the compatible Prime Video payload', async () => {
  const catalog = await loadCatalog({
    cacheDir: path.join(os.tmpdir(), 'fmv-m3-test'),
    fetch: async url => url.includes('vizio_apps') ? apps : availability,
  });
  const listed = catalog.listAvailableApps(info());

  assert.equal(catalog.resolvePayload('2583', info()), null);
  assert.equal(listed.some(entry => entry.catalogId === '2583'), false);
  assert.deepEqual(catalog.resolvePayload('33', info()), { nameSpace: 3, appId: '3', message: null });
});

test('unknown devices use wildcard-or-first payload fallback', () => {
  const catalog = new Catalog([{ catalogId: 'x', name: 'X', payload: { nameSpace: 0, appId: 'entry', message: null }, verifiedOnTarget: false }], { cacheDir: path.join(os.tmpdir(), 'fmv-m3-test') }, new Map([
    ['x', [
      { chipset: 'OTHER', payload: { nameSpace: 2, appId: 'first', message: null }, minimum: null, maximum: null },
    ]],
  ]));
  assert.equal(catalog.resolvePayload('x')?.appId, 'first');
});

test('profiles and app identity use verified target rules', () => {
  assert.equal(selectProfile(info()).profile, m65q6L4);
  assert.equal(selectProfile(info('OTHER')).verified, false);
  assert.equal(classifyApp(1, { nameSpace: 4, appId: '1', message: null }, { tvUiUrlPrefix: 'http://tv/tv/', profile: m65q6L4 }), 'NATIVE_HOME');
  assert.equal(classifyApp(1, { nameSpace: 4, appId: '17', message: 'http://tv/tv/' }, { tvUiUrlPrefix: 'http://tv/tv/', profile: m65q6L4 }), 'FMV_UI');
  assert.equal(classifyApp(0, null, { tvUiUrlPrefix: '', profile: m65q6L4 }), 'STANDBY');
});

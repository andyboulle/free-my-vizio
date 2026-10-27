import assert from 'node:assert/strict';
import test from 'node:test';
import { Catalog } from '../../src/catalog/catalog.ts';
import { compareFirmware, inRange } from '../../src/catalog/version.ts';
import { classifyApp } from '../../src/tv/app-identity.ts';
import { m65q6L4, selectProfile } from '../../src/tv/profiles/index.ts';
import type { DeviceInfo } from '../../src/tv/smartcast-client.ts';

const info = (model = 'M65Q6-L4', firmware = '86.910.19.2-1'): DeviceInfo => ({
  model, firmware, apiVersion: '', vizios: 'mtk5586-1', chipsetKey: 'MT5586',
  deviceId: '', castName: '', capabilities: {}, raw: {},
});

test('firmware versions compare numerically and support open bounds', () => {
  assert.equal(compareFirmware('86.900.61.1-1', '86.910.19.2-1'), -1);
  assert.equal(inRange('86.910.19.2-1', null, '86.910.19.2-1'), true);
});

test('catalog chooses exact chipset before wildcard', () => {
  const catalog = new Catalog([{ catalogId: '34', name: 'Netflix', payload: { nameSpace: 0, appId: 'fallback', message: null }, verifiedOnTarget: true }], { cacheDir: 'unused' }, new Map([
    ['34', [
      { chipset: '*', payload: { nameSpace: 2, appId: 'wild', message: null }, minimum: null, maximum: null },
      { chipset: 'MT5586', payload: { nameSpace: 3, appId: 'exact', message: null }, minimum: null, maximum: null },
    ]],
  ]));
  assert.equal(catalog.resolvePayload('34', info())?.appId, 'exact');
});

test('profiles and app identity use verified target rules', () => {
  assert.equal(selectProfile(info()).profile, m65q6L4);
  assert.equal(selectProfile(info('OTHER')).verified, false);
  assert.equal(classifyApp(1, { nameSpace: 4, appId: '1', message: null }, { tvUiUrlPrefix: 'http://tv/tv/', profile: m65q6L4 }), 'NATIVE_HOME');
  assert.equal(classifyApp(1, { nameSpace: 4, appId: '17', message: 'http://tv/tv/' }, { tvUiUrlPrefix: 'http://tv/tv/', profile: m65q6L4 }), 'FMV_UI');
  assert.equal(classifyApp(0, null, { tvUiUrlPrefix: '', profile: m65q6L4 }), 'STANDBY');
});

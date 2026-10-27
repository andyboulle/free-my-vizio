import test from 'node:test';
import assert from 'node:assert/strict';
import { detectIconFormat } from '../../src/catalog/catalog.ts';
import { migrateConfig, validateConfig } from '../../src/config/schema.ts';

test('UI0 detects icon formats from magic bytes', () => {
  assert.equal(detectIconFormat(Buffer.from('RIFFxxxxWEBP')), 'webp');
  assert.equal(detectIconFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
  assert.equal(detectIconFormat(Buffer.from([0xff, 0xd8, 0xff])), 'jpeg');
  assert.equal(detectIconFormat(Buffer.from('not-an-image')), null);
});

test('UI0 migrates v1 config to validated v2 defaults', () => {
  const config = migrateConfig({ schemaVersion: 1, home: { theme: 'dark', showClock: false } });
  assert.equal(config.schemaVersion, 2);
  assert.equal(config.home.theme, 'cinematic');
  assert.equal(config.home.clock.showDate, true);
  assert.equal(validateConfig(config).ok, true);
});

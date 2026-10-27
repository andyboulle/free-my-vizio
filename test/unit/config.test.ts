import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONFIG, validateConfig } from '../../src/config/schema.ts';
import { loadSecrets, saveConfig } from '../../src/config/store.ts';
test('default config validates and native home is required', () => {
  assert.equal(validateConfig(DEFAULT_CONFIG).ok, true);
  const hidden = structuredClone(DEFAULT_CONFIG); hidden.home.sections[2].shortcuts[0].hidden = true;
  assert.equal(validateConfig(hidden).ok, false);
});
test('config rejects duplicate shortcuts and secrets are private', () => {
  const duplicate = structuredClone(DEFAULT_CONFIG); duplicate.home.sections[1].shortcuts[0].id = 'netflix';
  assert.equal(validateConfig(duplicate).ok, false);
  const dir = path.join(process.cwd(), `.config-test-${process.pid}`); fs.rmSync(dir, { recursive: true, force: true });
  const secrets = loadSecrets(dir); assert.equal(fs.statSync(path.join(dir, 'secrets.json')).mode & 0o777, 0o600);
  saveConfig(DEFAULT_CONFIG, dir); assert.equal(fs.existsSync(path.join(dir, 'config.json.tmp')), false);
  fs.rmSync(dir, { recursive: true, force: true }); assert.ok(secrets.adminToken.length > 20);
});

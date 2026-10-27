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
test('config validation covers R6 scalar and shortcut rules', () => {
  const cases: Array<[string, (c: typeof DEFAULT_CONFIG) => void]> = [
    ['timeout', c => { c.takeover.requestTimeoutMs = 499; }],
    ['confirm', c => { c.takeover.confirmDelayMs = 5001; }],
    ['cooldown', c => { c.takeover.cooldownMs = 60001; }],
    ['suppress', c => { c.takeover.suppressMinutes = 1441; }],
    ['launches', c => { c.takeover.loopGuard.maxLaunches = 21; }],
    ['window', c => { c.takeover.loopGuard.windowMs = 999; }],
    ['pause', c => { c.takeover.loopGuard.pauseMinutes = 0; }],
    ['port', c => { c.server.port = 65536; }],
    ['theme', c => { c.home.theme = 'bad' as typeof c.home.theme; }],
    ['accent', c => { c.home.accent = 'bad'; }],
    ['url', c => { c.server.publicBaseUrl = 'ftp://example.test'; }],
    ['app', c => { delete c.home.sections[0].shortcuts[0].catalogId; }],
    ['input', c => { c.home.sections[1].shortcuts[0].cname = ''; }],
    ['system', c => { c.home.sections[2].shortcuts[0].action = 'bad'; }],
    ['label', c => { c.home.sections[0].shortcuts[0].label = ''; }],
  ];
  for (const [name, mutate] of cases) { const c = structuredClone(DEFAULT_CONFIG); mutate(c); assert.equal(validateConfig(c).ok, false, name); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, migrateConfig, validateConfig } from '../../src/config/schema.ts';

test('fireplace screensaver is removed from defaults and legacy migrations', () => {
  assert.equal('screensaver' in DEFAULT_CONFIG, false);
  assert.equal(DEFAULT_CONFIG.home.sections.flatMap(section => section.shortcuts).some(shortcut => shortcut.id === 'fireplace'), false);
  const legacy = migrateConfig({
    ...structuredClone(DEFAULT_CONFIG),
    schemaVersion: 2,
    home: { ...structuredClone(DEFAULT_CONFIG.home), sections: [{ id: 'system', title: 'System', shortcuts: [
      { id: 'fireplace', kind: 'system', label: 'Fireplace', action: 'fireplace', hidden: false },
      { id: 'native-home', kind: 'system', label: 'SmartCast Home', action: 'native-home', hidden: false },
    ] }] },
    screensaver: { enabled: true },
  });
  assert.equal('screensaver' in legacy, false);
  assert.equal(legacy.home.sections.flatMap(section => section.shortcuts).some(shortcut => shortcut.id === 'fireplace'), false);
  assert.equal(validateConfig(legacy).ok, true);
});

test('UI7 drafts preserve reorder, hide/unhide, and appearance values', () => {
  const draft = structuredClone(DEFAULT_CONFIG);
  const apps = draft.home.sections[0].shortcuts;
  [apps[0], apps[1]] = [apps[1], apps[0]];
  apps[0].hidden = true;
  draft.home.theme = 'oled';
  draft.home.accent = '#2bd4c9';
  assert.equal(validateConfig(draft).ok, true);
  apps[0].hidden = false;
  assert.equal(validateConfig(draft).ok, true);
  assert.equal(draft.home.sections[0].shortcuts[0].label, 'YouTube');
  assert.equal(draft.home.accent, '#2bd4c9');
});

test('UI7 config validation keeps SmartCast Home visible', () => {
  const draft = structuredClone(DEFAULT_CONFIG);
  draft.home.sections[2].shortcuts[0].hidden = true;
  const result = validateConfig(draft);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /native-home|SmartCast Home/i);
});

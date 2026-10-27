import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveBrandColor, resolveBrandColor} from '../../web/shared/brand-colors.js';

test('derives a saturated colour from non-white, non-black ImageData pixels', () => {
  const data = new Uint8ClampedArray([
    230, 20, 20, 255, 230, 20, 20, 255,
    255, 255, 255, 255, 0, 0, 0, 255
  ]);
  assert.equal(deriveBrandColor({data}), '#e61414');
});

test('returns null when the icon has no useful pixels', () => {
  assert.equal(deriveBrandColor({data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255])}), null);
});

test('resolves overrides, curated colours, and kind fallbacks', () => {
  assert.equal(resolveBrandColor({brandColor: '#123456', catalogId: 34}), '#123456');
  assert.equal(resolveBrandColor({catalogId: 34}), '#E50914');
  assert.equal(resolveBrandColor({kind: 'input'}), '#7C8CFF');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { scrollTrackToFocus } from '../../web/tv/js/rails.js';

function box(left, right) {
  return { left, right, width: right - left };
}

test('horizontal rail scrolling keeps a focused lower-row app visible with a lead', () => {
  const track = {
    clientWidth: 1000,
    scrollWidth: 1900,
    dataset: {},
    style: {},
    getBoundingClientRect: () => box(64, 1064)
  };
  const card = { getBoundingClientRect: () => box(1500, 1648) };
  assert.equal(scrollTrackToFocus(track, card), 732);
  assert.equal(track.style.transform, 'translate3d(-732px, 0, 0)');
  assert.equal(track.dataset.overflow, 'true');
});

test('horizontal rail scrolling clamps at the left edge', () => {
  const track = {
    clientWidth: 1000,
    scrollWidth: 1900,
    dataset: { scrollOffset: '300' },
    style: {},
    getBoundingClientRect: () => box(64, 1064)
  };
  const card = { getBoundingClientRect: () => box(20, 168) };
  assert.equal(scrollTrackToFocus(track, card), 256);
  assert.equal(track.style.transform, 'translate3d(-256px, 0, 0)');
});

test('a 12-app rail reports overflow for manual right and left navigation', () => {
  const track = {
    clientWidth: 1000,
    scrollWidth: 12 * 148 + 11 * 24,
    dataset: {},
    style: {},
    getBoundingClientRect: () => box(64, 1064)
  };
  for (let index = 0; index < 12; index += 1) {
    const left = 64 + index * 172;
    scrollTrackToFocus(track, { getBoundingClientRect: () => box(left, left + 148) });
  }
  assert.equal(track.dataset.overflow, 'true');
  assert.ok(Number(track.dataset.scrollOffset) > 0);
});

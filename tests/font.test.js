import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fontMetrics} from '../src/font.js';

test('normal text uses nine GUI units with twelve-unit line spacing', () => {
  assert.deepEqual(fontMetrics({font_size: 'normal'}), {fontSize: 9, lineHeight: 12});
  assert.deepEqual(fontMetrics(), {fontSize: 9, lineHeight: 12});
});

test('font scale applies once to named and numeric sizes', () => {
  assert.deepEqual(fontMetrics({font_size: 'normal', font_scale_factor: 0.5}), {fontSize: 4.5, lineHeight: 6});
  assert.deepEqual(fontMetrics({font_size: 18, font_scale_factor: 1.5}), {fontSize: 27, lineHeight: 36});
  assert.deepEqual(fontMetrics({font_size: 'normal', font_scale_factor: 0}), {fontSize: 0, lineHeight: 0});
  assert.equal(fontMetrics({font_size: 'small'}).fontSize, 8);
  assert.equal(fontMetrics({font_size: 'large'}).fontSize, 12);
});

test('unresolved or invalid font values use finite default metrics', () => {
  assert.deepEqual(fontMetrics({font_size: '$unknown', font_scale_factor: 'bad'}), {fontSize: 9, lineHeight: 12});
  assert.deepEqual(fontMetrics({font_size: -1, font_scale_factor: -2}), {fontSize: 9, lineHeight: 12});
});

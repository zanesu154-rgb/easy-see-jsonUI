import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buttonControlVisible} from '../src/button-states.js';

const button = {default_control: 'idle', hover_control: 'tip', pressed_control: 'down'};
test('only the selected button branch is visible while common content remains visible', () => {
  for (const [state, active] of [['default', 'idle'], ['hover', 'tip'], ['pressed', 'down']]) {
    for (const name of ['idle', 'tip', 'down']) {
      assert.equal(buttonControlVisible(button, name, state), name === active);
    }
    assert.equal(buttonControlVisible(button, 'shared_icon', state), true);
  }
});

test('state selectors match inherited instance names and shared branches', () => {
  assert.equal(buttonControlVisible(button, 'tip@demo.tooltip', 'hover'), true);
  assert.equal(buttonControlVisible(button, 'tip@demo.tooltip'), false);
  const shared = {default_control: 'same', hover_control: 'same', pressed_control: 'down'};
  assert.equal(buttonControlVisible(shared, 'same', 'hover'), true);
  assert.equal(buttonControlVisible(shared, 'same', 'pressed'), false);
});

test('missing hover or pressed states fall back without hiding ordinary controls', () => {
  assert.equal(buttonControlVisible({default_control: 'idle'}, 'idle', 'pressed'), true);
  assert.equal(buttonControlVisible({default_control: 'idle', hover_control: 'tip'}, 'tip', 'pressed'), true);
  assert.equal(buttonControlVisible({hover_control: 'tip'}, 'tip', 'default'), false);
  assert.equal(buttonControlVisible({}, 'icon', 'hover'), true);
});

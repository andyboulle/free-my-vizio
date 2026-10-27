import test from 'node:test';
import assert from 'node:assert/strict';
import { createPowerDialog } from '../../web/tv/js/dialog.js';

class Node {
  constructor() { this.hidden = true; this.listeners = {}; this.focused = false; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  focus() { this.focused = true; globalThis.document.activeElement = this; }
  setAttribute() {}
  removeAttribute() {}
}

test('power dialog opens on Cancel and Back closes without confirming', () => {
  const cancel = new Node(), confirm = new Node(), dialog = new Node(), app = new Node();
  dialog.querySelector = selector => selector.includes('cancel') ? cancel : confirm;
  globalThis.document = {
    activeElement: null,
    querySelector: selector => selector === '#confirm-dialog' ? dialog : app,
    addEventListener: (name, fn, capture) => { if (capture) globalThis.keydown = fn; },
  };
  let confirmed = false;
  const controller = createPowerDialog({onConfirm: () => { confirmed = true; }});
  controller.open();
  assert.equal(dialog.hidden, false);
  assert.equal(document.activeElement, cancel);
  globalThis.keydown({key: 'Backspace', keyCode: 8, preventDefault() {}, stopPropagation() {}});
  assert.equal(dialog.hidden, true);
  assert.equal(confirmed, false);
});

test('power dialog traps focus and confirms only from Turn off', () => {
  const cancel = new Node(), confirm = new Node(), dialog = new Node(), app = new Node();
  dialog.querySelector = selector => selector.includes('cancel') ? cancel : confirm;
  globalThis.document = {activeElement: null, querySelector: selector => selector === '#confirm-dialog' ? dialog : app, addEventListener: (name, fn, capture) => { if (capture) globalThis.keydown = fn; }};
  let confirmed = false;
  const controller = createPowerDialog({onConfirm: () => { confirmed = true; }});
  controller.open();
  globalThis.keydown({key: 'ArrowRight', preventDefault() {}, stopPropagation() {}});
  assert.equal(document.activeElement, confirm);
  globalThis.keydown({key: 'Enter', preventDefault() {}, stopPropagation() {}});
  assert.equal(confirmed, true);
  assert.equal(controller.isOpen(), false);
});

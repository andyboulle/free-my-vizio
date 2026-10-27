import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, renderHome } from '../../web/tv/js/render.js';

class Element {
  constructor() {
    this.children = [];
    this.style = { setProperty: (name, value) => { this.properties[name] = value; } };
    this.properties = {};
    this.dataset = {};
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener() {}
}

test('renderHome applies the configured accent and clock visibility', () => {
  const elements = {
    '#title': new Element(),
    '#clock': new Element(),
    '#sections': new Element()
  };
  globalThis.document = {
    body: new Element(),
    documentElement: new Element(),
    querySelector(selector) { return elements[selector]; },
    createElement() { return new Element(); }
  };

  const home = {theme: 'dark', title: 'Living Room', accent: '#123456', showClock: true, sections: []};
  renderHome(home, () => {});

  assert.equal(document.documentElement.dataset.accent, '#123456');
  assert.equal(elements['#clock'].hidden, false);
  assert.equal(elements['#clock'].textContent, formatClock());

  home.showClock = false;
  renderHome(home, () => {});
  assert.equal(elements['#clock'].hidden, true);
});

test('formatClock supports an explicit 24-hour format', () => {
  const value = formatClock(new Date(2026, 9, 27, 22, 42), '24h');
  assert.match(value, /22:42/);
});

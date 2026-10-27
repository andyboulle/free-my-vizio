import test from 'node:test';
import assert from 'node:assert/strict';
import { safeStaticPath } from '../../src/server/static.ts';
test('static paths cannot escape root or use encoded traversal', () => {
  assert.equal(safeStaticPath('/web/tv', '/../secrets.json'), null);
  assert.equal(safeStaticPath('/web/tv', '/%2e%2e/%2e%2e/secrets.json'), null);
  assert.equal(safeStaticPath('/web/tv', '/%252e%252e/x'), null);
  assert.equal(safeStaticPath('/web/tv', '/..%5c..%5cx'), null);
});

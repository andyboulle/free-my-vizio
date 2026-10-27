import test from 'node:test';
import assert from 'node:assert/strict';
import { adminAuthorized, canonicalHost, hostAllowed } from '../../src/server/auth.ts';
test('auth requires a single Bearer token and compares safely', () => {
  assert.equal(adminAuthorized({ headers: { authorization: 'bearer abc' } } as never, 'abc'), true);
  assert.equal(adminAuthorized({ headers: { authorization: 'Bearer  abc' } } as never, 'abc'), false);
  assert.equal(adminAuthorized({ headers: {} } as never, 'abc'), false);
});
test('host parser handles ports and bracketed IPv6', () => {
  assert.equal(canonicalHost('[::1]:8730'), '::1');
  assert.equal(hostAllowed('127.0.0.1:8730', ['127.0.0.1']), true);
  assert.equal(hostAllowed('evil.example:8730', ['127.0.0.1']), false);
});

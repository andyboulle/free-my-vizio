import test from 'node:test';
import assert from 'node:assert/strict';
import { pickLanAddress } from '../../src/util/net.ts';
test('pickLanAddress returns an IPv4 address', () => assert.match(pickLanAddress('192.0.2.1'), /^\d+\.\d+\.\d+\.\d+$/));

import test from 'node:test';
import assert from 'node:assert/strict';
import { TakeoverSupervisor } from '../../src/supervisor/takeover.ts';
import { DEFAULT_CONFIG, type Config } from '../../src/config/schema.ts';
import type { AppRef, PowerState } from '../../src/tv/smartcast-client.ts';

class FakeClock {
  value = 0;
  now = () => this.value;
  sleep = async (ms: number) => { this.value += ms; };
}
function harness(overrides: Partial<{ power: PowerState; app: AppRef | null; launchError: boolean }> = {}) {
  const clock = new FakeClock(), calls: AppRef[] = [];
  const client = {
    getPowerState: async () => overrides.power ?? 1,
    getCurrentApp: async () => overrides.app ?? { nameSpace: 4, appId: '1', message: '{"app":"home"}' },
    launchApp: async (app: AppRef) => { calls.push(app); if (overrides.launchError) throw new Error('offline'); },
  };
  const config = structuredClone(DEFAULT_CONFIG) as Config;
  config.takeover.confirmDelayMs = 400; config.takeover.cooldownMs = 5000;
  const supervisor = new TakeoverSupervisor({ client, config, clock, tvUiUrlPrefix: 'http://host/tv/', tvUiToken: 'secret',
    nativeHome: { nameSpace: 4, appId: '1', message: '{"app":"home"}' }, isNativeHome: app => app.nameSpace === 4 && app.appId === '1' });
  return { supervisor, clock, calls, config };
}
test('launches only after native home survives confirmation and payload is exact', async () => {
  const { supervisor, calls } = harness();
  await supervisor.tick();
  assert.deepEqual(calls, [{ nameSpace: 4, appId: '17', message: 'http://host/tv/#k=secret' }]);
});
test('suppression during confirmation prevents launch and cooldown applies', async () => {
  const h = harness();
  h.config.takeover.confirmDelayMs = 1;
  const original = h.clock.sleep;
  h.clock.sleep = async ms => { await h.supervisor.suppressAndOpenNativeHome(); await original(ms); };
  await h.supervisor.tick();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].appId, '1');
});
test('standby clears suppression and unreachable does not reset power memory', async () => {
  const h = harness({ power: 0 });
  await h.supervisor.suppressAndOpenNativeHome();
  await h.supervisor.tick();
  assert.equal(h.supervisor.status().suppressedUntil, 0);
  assert.equal(h.supervisor.status().appClass, 'STANDBY');
});
test('failed launches count toward loop guard', async () => {
  const h = harness({ launchError: true });
  h.config.takeover.cooldownMs = 0; h.config.takeover.loopGuard.maxLaunches = 3;
  await h.supervisor.tick(); await h.supervisor.tick(); await h.supervisor.tick();
  assert.equal(h.supervisor.status().state, 'PAUSED');
  assert.equal(h.supervisor.status().launchesInWindow, 3);
});

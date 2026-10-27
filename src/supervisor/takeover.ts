import type { Config } from '../config/schema.ts';
import type { AppRef, PowerState } from '../tv/smartcast-client.ts';
import { TvAuthError } from '../tv/errors.ts';
import type { Clock } from '../util/clock.ts';
import { systemClock } from '../util/clock.ts';

export type AppClass = 'UNREACHABLE' | 'STANDBY' | 'UNKNOWN' | 'FMV_UI' | 'NATIVE_HOME' | 'INPUT_OR_SYSTEM' | 'APP';
export type SupervisorState = 'IDLE' | 'RUNNING' | 'UNREACHABLE' | 'NEEDS_PAIRING' | 'PAUSED';
export type TakeoverClient = {
  getPowerState(options?: { timeoutMs?: number }): Promise<PowerState>;
  getCurrentApp(options?: { timeoutMs?: number }): Promise<AppRef | null>;
  launchApp(app: AppRef, options?: { timeoutMs?: number }): Promise<void>;
};
export type TakeoverStatus = {
  state: SupervisorState; power: PowerState | null; appClass: AppClass | null;
  lastLaunchAt: number | null; lastError: string | null; suppressedUntil: number;
  launchesInWindow: number;
};

export function classifyApp(power: PowerState, app: AppRef | null, tvUiUrlPrefix: string, isNativeHome: (app: AppRef) => boolean): AppClass {
  if (power === 0) return 'STANDBY';
  if (!app || typeof app !== 'object' || !Number.isFinite(app.nameSpace) || typeof app.appId !== 'string') return 'UNKNOWN';
  if (app.nameSpace === 4 && (app.message ?? '').startsWith(tvUiUrlPrefix)) return 'FMV_UI';
  if (isNativeHome(app)) return 'NATIVE_HOME';
  if (app.nameSpace === 0 && (app.message === '' || app.message === null)) return 'INPUT_OR_SYSTEM';
  return 'APP';
}

export class TakeoverSupervisor {
  private readonly options: {
    client: TakeoverClient; config: Config; tvUiUrlPrefix: string; tvUiToken: string;
    nativeHome: AppRef; isNativeHome: (app: AppRef) => boolean; clock?: Clock;
    log?: { warn?: (event: string, data?: unknown) => void };
  };
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private lastObservedPower: PowerState | null = null;
  private lastPowerOnAt = 0;
  private launchedSincePowerOn = false;
  private suppressedUntil = 0;
  private suppressGeneration = 0;
  private launchAttempts: number[] = [];
  private lastLaunchAt: number | null = null;
  private lastError: string | null = null;
  private power: PowerState | null = null;
  private appClass: AppClass | null = null;
  private state: SupervisorState = 'IDLE';
  constructor(options: {
    client: TakeoverClient; config: Config; tvUiUrlPrefix: string; tvUiToken: string;
    nativeHome: AppRef; isNativeHome: (app: AppRef) => boolean; clock?: Clock;
    log?: { warn?: (event: string, data?: unknown) => void };
  }) { this.options = options; }
  start(): void { if (this.running) return; this.running = true; this.schedule(); }
  stop(): void { this.running = false; if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
  status(): TakeoverStatus {
    const now = this.clock.now();
    return { state: this.state, power: this.power, appClass: this.appClass, lastLaunchAt: this.lastLaunchAt,
      lastError: this.lastError, suppressedUntil: this.suppressedUntil,
      launchesInWindow: this.launchAttempts.filter(x => now - x <= this.options.config.takeover.loopGuard.windowMs).length };
  }
  async suppressAndOpenNativeHome(): Promise<void> {
    const now = this.clock.now();
    this.suppressGeneration++;
    this.suppressedUntil = now + this.options.config.takeover.suppressMinutes * 60_000;
    await this.options.client.launchApp(this.options.nativeHome, { timeoutMs: this.options.config.takeover.requestTimeoutMs });
  }
  async tick(): Promise<void> {
    const t = this.options.config.takeover;
    if (!t.enabled || t.mode === 'off' || this.state === 'NEEDS_PAIRING') { this.state = 'IDLE'; return; }
    let power: PowerState;
    try { power = await this.options.client.getPowerState({ timeoutMs: t.requestTimeoutMs }); }
    catch (error) { if (error instanceof TvAuthError) this.state = 'NEEDS_PAIRING'; else this.state = 'UNREACHABLE'; this.appClass = 'UNREACHABLE'; this.lastError = error instanceof Error ? error.message : String(error); return; }
    const previousPower = this.lastObservedPower;
    this.power = power; this.lastObservedPower = power;
    if (power === 0) {
      this.appClass = 'STANDBY'; this.state = 'RUNNING'; this.launchedSincePowerOn = false;
      if (t.suppressUntilStandby) this.suppressedUntil = 0;
      return;
    }
    if (previousPower !== 1) { this.lastPowerOnAt = this.clock.now(); this.launchedSincePowerOn = false; }
    try {
      const app = await this.options.client.getCurrentApp({ timeoutMs: t.requestTimeoutMs });
      this.appClass = classifyApp(power, app, this.options.tvUiUrlPrefix, this.options.isNativeHome);
      this.state = 'RUNNING';
      if (this.appClass !== 'NATIVE_HOME' || !this.eligible(this.clock.now())) return;
      const generation = this.suppressGeneration;
      await this.clock.sleep(t.confirmDelayMs);
      const confirmedPower = await this.options.client.getPowerState({ timeoutMs: t.requestTimeoutMs });
      const confirmedApp = confirmedPower === 1 ? await this.options.client.getCurrentApp({ timeoutMs: t.requestTimeoutMs }) : null;
      if (confirmedPower !== 1 || classifyApp(confirmedPower, confirmedApp, this.options.tvUiUrlPrefix, this.options.isNativeHome) !== 'NATIVE_HOME' ||
          generation !== this.suppressGeneration || !this.eligible(this.clock.now())) return;
      const now = this.clock.now(); this.launchAttempts.push(now); this.lastLaunchAt = now; this.launchedSincePowerOn = true;
      this.pruneAttempts(now);
      try { await this.options.client.launchApp({ nameSpace: 4, appId: '17', message: `${this.options.tvUiUrlPrefix}#k=${this.options.tvUiToken}` }, { timeoutMs: t.requestTimeoutMs }); }
      catch (error) { this.lastError = error instanceof Error ? error.message : String(error); }
      if (this.launchAttempts.length >= t.loopGuard.maxLaunches) {
        this.suppressedUntil = now + t.loopGuard.pauseMinutes * 60_000;
        this.state = 'PAUSED'; this.options.log?.warn?.('takeover_loop_guard', { launches: this.launchAttempts.length });
      }
    } catch (error) {
      if (error instanceof TvAuthError) this.state = 'NEEDS_PAIRING';
      else { this.state = 'UNREACHABLE'; this.lastError = error instanceof Error ? error.message : String(error); }
    }
  }
  private get clock(): Clock { return this.options.clock ?? systemClock; }
  private pruneAttempts(now: number): void { const w = this.options.config.takeover.loopGuard.windowMs; this.launchAttempts = this.launchAttempts.filter(x => now - x <= w); }
  private eligible(now: number): boolean {
    const t = this.options.config.takeover; this.pruneAttempts(now);
    const last = this.launchAttempts.at(-1) ?? -Infinity;
    return now >= this.suppressedUntil && now - last >= t.cooldownMs &&
      (t.mode === 'always' || (!this.launchedSincePowerOn && now - this.lastPowerOnAt <= 30_000));
  }
  private schedule(): void { if (this.running) this.timer = setTimeout(async () => { await this.tick(); this.schedule(); }, this.options.config.takeover.pollMs); }
}

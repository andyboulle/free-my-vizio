import type { AppRef, PowerState } from './smartcast-client.ts';
import type { TvProfile } from './profiles/types.ts';

export type AppClass = 'UNREACHABLE' | 'STANDBY' | 'UNKNOWN' | 'FMV_UI' | 'NATIVE_HOME' | 'INPUT_OR_SYSTEM' | 'APP';
export function classifyApp(power: PowerState | null, app: AppRef | null, ctx: { tvUiUrlPrefix: string; profile: TvProfile }): AppClass {
  if (power === null) return 'UNREACHABLE';
  if (power === 0 || (app?.nameSpace === 345 && app.appId === '707')) return 'STANDBY';
  if (power === 1 && (!app || !Number.isFinite(app.nameSpace) || !app.appId)) return 'UNKNOWN';
  if (app?.nameSpace === 4 && app.message?.startsWith(ctx.tvUiUrlPrefix)) return 'FMV_UI';
  if (app && ctx.profile.isNativeHome(app)) return 'NATIVE_HOME';
  if (app?.nameSpace === 0 && (app.message === '' || app.message === null)) return 'INPUT_OR_SYSTEM';
  return 'APP';
}

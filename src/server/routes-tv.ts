import type { Config } from '../config/schema.ts';
import type { Catalog } from '../catalog/catalog.ts';
import type { SmartCastClient } from '../tv/smartcast-client.ts';
import type { TvProfile } from '../tv/profiles/types.ts';
import type { DeviceInfo } from '../tv/smartcast-client.ts';
import type { TakeoverStatus } from '../supervisor/takeover.ts';
import type { DeviceContext } from '../tv/device-context.ts';

export interface TvRouteDeps { config: Config; catalog?: Catalog; client?: SmartCastClient; profile?: TvProfile; device?: DeviceInfo; context?: DeviceContext; nativeHome: () => Promise<void>; takeoverStatus?: () => TakeoverStatus; }
export function tvHome(deps: TvRouteDeps) {
  const device = deps.context?.device ?? deps.device;
  return { title: deps.config.home.title, theme: deps.config.home.theme, accent: deps.config.home.accent, clock: deps.config.home.clock, appearance: deps.config.home.appearance, screensaver: deps.config.screensaver,
    sections: deps.config.home.sections.map(section => ({ id: section.id, title: section.title, shortcuts: section.shortcuts.filter(s => !s.hidden).map(s => ({
      id: s.id, label: s.label, kind: s.kind,
      subtitle: s.kind === 'input' ? s.label : s.kind === 'system' ? (s.action === 'fireplace' ? 'Ambient fire' : 'Return to SmartCast') : (deps.catalog?.listAvailableApps(device ?? ({ chipsetKey: '*', firmware: '' } as DeviceInfo)).find(app => app.catalogId === s.catalogId)?.description ?? ''),
      available: s.kind !== 'app' || Boolean(s.payload ?? (s.catalogId && deps.catalog?.resolvePayload(s.catalogId, device))),
      ...(s.brandColor ? { brandColor: s.brandColor } : {}),
      ...(s.catalogId && deps.catalog?.hasCachedIcon(s.catalogId) ? { icon: `/icons/${s.catalogId}.${deps.catalog.iconExtension(s.catalogId)}` } : {}),
    })) })) };
}
export async function activateShortcut(deps: TvRouteDeps, id: string): Promise<void> {
  const shortcut = deps.config.home.sections.flatMap(s => s.shortcuts).find(s => s.id === id);
  if (!shortcut) { const e = new Error('shortcut not found'); (e as Error & { code?: string }).code = 'NOT_FOUND'; throw e; }
  if (!deps.client) throw new Error('TV is not configured');
  if (shortcut.kind === 'app') {
    const context = deps.context;
    const device = context ? await context.ensureDevice() : deps.device;
    const catalog = context?.catalog ?? deps.catalog;
    const payload = shortcut.payload ?? catalog?.resolvePayload(shortcut.catalogId ?? '', device ?? ({ chipsetKey: '*', firmware: '' } as DeviceInfo));
    if (!payload) throw new Error('app is unavailable');
    await deps.client.launchApp(payload);
  } else if (shortcut.kind === 'input') await deps.client.setInput(shortcut.cname ?? '');
  else if (shortcut.action === 'native-home' || shortcut.id === 'native-home') await deps.nativeHome();
  else if (shortcut.action === 'fireplace') return;
  else if (shortcut.action === 'power-off') await deps.client.sendKey('POWER_OFF');
}

import type { Config } from '../config/schema.ts';
import type { Catalog } from '../catalog/catalog.ts';
import type { SmartCastClient } from '../tv/smartcast-client.ts';
import type { TvProfile } from '../tv/profiles/types.ts';
import type { DeviceInfo } from '../tv/smartcast-client.ts';
import type { TakeoverStatus } from '../supervisor/takeover.ts';

export interface TvRouteDeps { config: Config; catalog?: Catalog; client?: SmartCastClient; profile?: TvProfile; device?: DeviceInfo; nativeHome: () => Promise<void>; takeoverStatus?: () => TakeoverStatus; }
export function tvHome(deps: TvRouteDeps) {
  return { title: deps.config.home.title, theme: deps.config.home.theme, accent: deps.config.home.accent, showClock: deps.config.home.showClock,
    sections: deps.config.home.sections.map(section => ({ id: section.id, title: section.title, shortcuts: section.shortcuts.filter(s => !s.hidden).map(s => ({ id: s.id, label: s.label, kind: s.kind, icon: s.catalogId ? `/icons/${s.catalogId}.png` : undefined })) })) };
}
export async function activateShortcut(deps: TvRouteDeps, id: string): Promise<void> {
  const shortcut = deps.config.home.sections.flatMap(s => s.shortcuts).find(s => s.id === id);
  if (!shortcut) { const e = new Error('shortcut not found'); (e as Error & { code?: string }).code = 'NOT_FOUND'; throw e; }
  if (!deps.client) throw new Error('TV is not configured');
  if (shortcut.kind === 'app') {
    const payload = shortcut.payload ?? deps.catalog?.resolvePayload(shortcut.catalogId ?? '', deps.device as DeviceInfo);
    if (!payload) throw new Error('app is unavailable');
    await deps.client.launchApp(payload);
  } else if (shortcut.kind === 'input') await deps.client.setInput(shortcut.cname ?? '');
  else if (shortcut.action === 'native-home' || shortcut.id === 'native-home') await deps.nativeHome();
  else if (shortcut.action === 'power-off') await deps.client.sendKey('POWER_OFF');
}

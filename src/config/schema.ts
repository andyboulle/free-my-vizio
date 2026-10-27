export interface Shortcut { id: string; kind: 'app' | 'input' | 'system'; label: string; catalogId?: string; cname?: string; action?: string; hidden: boolean }
export interface Section { id: string; title: string; shortcuts: Shortcut[] }
export interface Config {
  schemaVersion: 1;
  tv: { host: string | null; port: number; deviceId: string | null };
  server: { port: number; bindHost: string; publicBaseUrl: string | null };
  takeover: { enabled: boolean; mode: 'always' | 'power-on-only' | 'off'; pollMs: number; requestTimeoutMs: number; confirmDelayMs: number; cooldownMs: number; suppressMinutes: number; suppressUntilStandby: boolean; loopGuard: { maxLaunches: number; windowMs: number; pauseMinutes: number } };
  home: { title: string; theme: 'dark' | 'light' | 'oled'; accent: string; showClock: boolean; sections: Section[] };
  catalog: { refreshHours: number };
}
export interface Secrets { adminToken: string; tvUiToken: string; tvPairingDeviceId: string; tvAuthToken?: string }
export const DEFAULT_CONFIG: Config = {
  schemaVersion: 1, tv: { host: null, port: 7345, deviceId: null },
  server: { port: 8730, bindHost: '0.0.0.0', publicBaseUrl: null },
  takeover: { enabled: true, mode: 'always', pollMs: 1000, requestTimeoutMs: 2500, confirmDelayMs: 400, cooldownMs: 5000, suppressMinutes: 10, suppressUntilStandby: true, loopGuard: { maxLaunches: 3, windowMs: 60000, pauseMinutes: 10 } },
  home: { title: 'Living Room', theme: 'dark', accent: '#4aa8ff', showClock: true, sections: [
    { id: 'apps', title: 'Apps', shortcuts: [{ id: 'netflix', kind: 'app', label: 'Netflix', catalogId: '34', hidden: false }, { id: 'youtube', kind: 'app', label: 'YouTube', catalogId: '44', hidden: false }] },
    { id: 'inputs', title: 'Inputs', shortcuts: [{ id: 'hdmi1', kind: 'input', label: 'HDMI 1', cname: 'hdmi1', hidden: false }] },
    { id: 'system', title: 'System', shortcuts: [{ id: 'native-home', kind: 'system', label: 'SmartCast Home', action: 'native-home', hidden: false }] },
  ] },
  catalog: { refreshHours: 24 },
};
export function validateConfig(x: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!x || typeof x !== 'object') return { ok: false, errors: ['config must be an object'] };
  const c = x as Partial<Config>;
  if (c.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!c.tv || typeof c.tv !== 'object' || (c.tv.port !== undefined && (!Number.isInteger(c.tv.port) || c.tv.port < 1 || c.tv.port > 65535))) errors.push('tv.port is invalid');
  if (!c.takeover || typeof c.takeover !== 'object') errors.push('takeover is required');
  else {
    const t = c.takeover;
    if (!Number.isInteger(t.pollMs) || t.pollMs < 250 || t.pollMs > 10000) errors.push('takeover.pollMs must be 250–10000');
  }
  const ids = new Set<string>(); let native = false;
  for (const section of c.home?.sections ?? []) for (const s of section.shortcuts ?? []) {
    if (ids.has(s.id)) errors.push(`duplicate shortcut id: ${s.id}`); ids.add(s.id);
    if (s.action === 'native-home' || s.id === 'native-home') { native = true; if (s.hidden) errors.push('native-home cannot be hidden'); }
    if (s.cname !== undefined && !/^[a-z0-9_]+$/.test(s.cname)) errors.push(`invalid cname: ${s.cname}`);
  }
  if (!native) errors.push('native-home shortcut is required');
  return { ok: errors.length === 0, errors };
}
export function migrateConfig(x: unknown): Config {
  const result = x as Config;
  return result?.schemaVersion === 1 ? result : structuredClone(DEFAULT_CONFIG);
}

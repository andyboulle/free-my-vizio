export interface Shortcut { id: string; kind: 'app' | 'input' | 'system'; label: string; catalogId?: string; payload?: { nameSpace: number; appId: string; message: string | null }; cname?: string; action?: string; hidden: boolean; brandColor?: string }
export interface Section { id: string; title: string; shortcuts: Shortcut[] }
export interface Config {
  schemaVersion: 2;
  tv: { host: string | null; port: number; deviceId: string | null };
  server: { port: number; bindHost: string; publicBaseUrl: string | null };
  takeover: { enabled: boolean; mode: 'always' | 'power-on-only' | 'off'; pollMs: number; requestTimeoutMs: number; confirmDelayMs: number; cooldownMs: number; suppressMinutes: number; suppressUntilStandby: boolean; loopGuard: { maxLaunches: number; windowMs: number; pauseMinutes: number } };
  home: { title: string; theme: 'cinematic' | 'oled' | 'light'; accent: string; clock: { format: 'auto' | '12h' | '24h'; showDate: boolean; greeting: boolean }; appearance: { backdrop: 'ambient' | 'still' | 'off'; labels: 'focused' | 'always'; reduceMotion: boolean; effects: 'lite' | 'enhanced' }; sections: Section[] };
  catalog: { refreshHours: number };
}
export interface Secrets { adminToken: string; tvUiToken: string; tvPairingDeviceId: string; tvAuthToken?: string }
export const DEFAULT_CONFIG: Config = {
  schemaVersion: 2, tv: { host: null, port: 7345, deviceId: null },
  server: { port: 8730, bindHost: '0.0.0.0', publicBaseUrl: null },
  takeover: { enabled: true, mode: 'always', pollMs: 1000, requestTimeoutMs: 2500, confirmDelayMs: 400, cooldownMs: 5000, suppressMinutes: 10, suppressUntilStandby: true, loopGuard: { maxLaunches: 3, windowMs: 60000, pauseMinutes: 10 } },
  home: { title: 'Living Room', theme: 'cinematic', accent: '#f0f2f1', clock: { format: 'auto', showDate: true, greeting: false }, appearance: { backdrop: 'ambient', labels: 'focused', reduceMotion: false, effects: 'lite' }, sections: [
    { id: 'apps', title: 'Apps', shortcuts: [{ id: 'netflix', kind: 'app', label: 'Netflix', catalogId: '34', hidden: false }, { id: 'youtube', kind: 'app', label: 'YouTube', catalogId: '44', hidden: false }] },
    { id: 'inputs', title: 'Inputs', shortcuts: [{ id: 'hdmi1', kind: 'input', label: 'HDMI 1', cname: 'hdmi1', hidden: false }] },
    { id: 'system', title: 'System', shortcuts: [{ id: 'native-home', kind: 'system', label: 'SmartCast Home', action: 'native-home', hidden: false }] },
  ] },
  catalog: { refreshHours: 24 },
};
export function validateConfig(x: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!x || typeof x !== 'object') return { ok: false, errors: ['config must be an object'] };
  const c = x as Partial<Config> & Record<string, unknown>;
  if (c.schemaVersion !== 2) errors.push('schemaVersion must be 2');
  const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const stringField = (value: unknown, name: string, nonEmpty = false) => {
    if (typeof value !== 'string' || (nonEmpty && value.trim() === '')) errors.push(`${name} must be a${nonEmpty ? ' non-empty' : ''} string`);
  };
  const integerRange = (value: unknown, name: string, min: number, max: number) => {
    if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) errors.push(`${name} must be ${min}–${max}`);
  };
  if (!record(c.tv)) errors.push('tv is required');
  else {
    if (c.tv.host !== null) stringField(c.tv.host, 'tv.host', true);
    if (c.tv.deviceId !== null) stringField(c.tv.deviceId, 'tv.deviceId', true);
    integerRange(c.tv.port, 'tv.port', 1, 65535);
  }
  if (!record(c.server)) errors.push('server is required');
  else {
    integerRange(c.server.port, 'server.port', 1, 65535);
    stringField(c.server.bindHost, 'server.bindHost', true);
    if (c.server.publicBaseUrl !== null) {
      if (typeof c.server.publicBaseUrl !== 'string') errors.push('server.publicBaseUrl must be null or an http(s) URL');
      else {
        try {
          const url = new URL(c.server.publicBaseUrl);
          if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error();
        } catch { errors.push('server.publicBaseUrl must be null or an http(s) URL'); }
      }
    }
  }
  if (!record(c.takeover)) errors.push('takeover is required');
  else {
    const t = c.takeover;
    if (typeof t.enabled !== 'boolean') errors.push('takeover.enabled must be boolean');
    if (!['always', 'power-on-only', 'off'].includes(t.mode as string)) errors.push('takeover.mode is invalid');
    integerRange(t.pollMs, 'takeover.pollMs', 250, 10000);
    integerRange(t.requestTimeoutMs, 'takeover.requestTimeoutMs', 500, 10000);
    integerRange(t.confirmDelayMs, 'takeover.confirmDelayMs', 0, 5000);
    integerRange(t.cooldownMs, 'takeover.cooldownMs', 0, 60000);
    integerRange(t.suppressMinutes, 'takeover.suppressMinutes', 0, 1440);
    if (typeof t.suppressUntilStandby !== 'boolean') errors.push('takeover.suppressUntilStandby must be boolean');
    if (!record(t.loopGuard)) errors.push('takeover.loopGuard is required');
    else {
      integerRange(t.loopGuard.maxLaunches, 'takeover.loopGuard.maxLaunches', 1, 20);
      integerRange(t.loopGuard.windowMs, 'takeover.loopGuard.windowMs', 1000, 3600000);
      integerRange(t.loopGuard.pauseMinutes, 'takeover.loopGuard.pauseMinutes', 1, 1440);
    }
  }
  if (!record(c.home)) errors.push('home is required');
  else {
    stringField(c.home.title, 'home.title', true);
    if (!['cinematic', 'light', 'oled'].includes(c.home.theme as string)) errors.push('home.theme is invalid');
    if (typeof c.home.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(c.home.accent)) errors.push('home.accent is invalid');
    if (!record(c.home.clock)) errors.push('home.clock is required');
    else {
      if (!['auto', '12h', '24h'].includes(c.home.clock.format as string)) errors.push('home.clock.format is invalid');
      if (typeof c.home.clock.showDate !== 'boolean') errors.push('home.clock.showDate must be boolean');
      if (typeof c.home.clock.greeting !== 'boolean') errors.push('home.clock.greeting must be boolean');
    }
    if (!record(c.home.appearance)) errors.push('home.appearance is required');
    else {
      if (!['ambient', 'still', 'off'].includes(c.home.appearance.backdrop as string)) errors.push('home.appearance.backdrop is invalid');
      if (!['focused', 'always'].includes(c.home.appearance.labels as string)) errors.push('home.appearance.labels is invalid');
      if (typeof c.home.appearance.reduceMotion !== 'boolean') errors.push('home.appearance.reduceMotion must be boolean');
      if (!['lite', 'enhanced'].includes(c.home.appearance.effects as string)) errors.push('home.appearance.effects is invalid');
    }
  }
  const ids = new Set<string>(); let native = false;
  const sections = record(c.home) && Array.isArray(c.home.sections) ? c.home.sections : [];
  if (!record(c.home) || !Array.isArray(c.home.sections)) errors.push('home.sections must be an array');
  for (const section of sections) {
    if (!record(section)) { errors.push('section must be an object'); continue; }
    stringField(section.id, 'section.id', true); stringField(section.title, 'section.title', true);
    if (!Array.isArray(section.shortcuts)) { errors.push('section.shortcuts must be an array'); continue; }
    for (const shortcut of section.shortcuts) {
      if (!record(shortcut)) { errors.push('shortcut must be an object'); continue; }
      stringField(shortcut.id, 'shortcut.id', true); stringField(shortcut.label, 'shortcut.label', true);
      if (typeof shortcut.hidden !== 'boolean') errors.push(`shortcut ${String(shortcut.id)}.hidden must be boolean`);
      if (shortcut.brandColor !== undefined && (typeof shortcut.brandColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(shortcut.brandColor))) errors.push(`shortcut ${String(shortcut.id)}.brandColor is invalid`);
      const id = typeof shortcut.id === 'string' ? shortcut.id : '';
      if (ids.has(id)) errors.push(`duplicate shortcut id: ${id}`); ids.add(id);
      if (!['app', 'input', 'system'].includes(shortcut.kind as string)) errors.push(`shortcut ${id}.kind is invalid`);
      if (shortcut.kind === 'app') {
        const hasCatalog = typeof shortcut.catalogId === 'string' && shortcut.catalogId.trim() !== '';
        if (!hasCatalog) {
          if (!record(shortcut.payload)) errors.push(`shortcut ${id} needs catalogId or payload`);
          else {
            if (!Number.isInteger(shortcut.payload.nameSpace)) errors.push(`shortcut ${id}.payload.nameSpace is invalid`);
            stringField(shortcut.payload.appId, `shortcut ${id}.payload.appId`, true);
            if (shortcut.payload.message !== null && typeof shortcut.payload.message !== 'string') errors.push(`shortcut ${id}.payload.message is invalid`);
          }
        }
      } else if (shortcut.kind === 'input') {
        if (typeof shortcut.cname !== 'string' || !/^[a-z0-9_]+$/.test(shortcut.cname)) errors.push(`invalid cname: ${String(shortcut.cname)}`);
      } else if (shortcut.kind === 'system' && !['native-home', 'power-off', 'blank-screen'].includes(shortcut.action as string)) {
        errors.push(`shortcut ${id}.action is invalid`);
      }
      if (shortcut.action === 'native-home' || shortcut.id === 'native-home') { native = true; if (shortcut.hidden) errors.push('native-home cannot be hidden'); }
    }
  }
  if (!native) errors.push('native-home shortcut is required');
  if (!record(c.catalog) || !Number.isInteger(c.catalog.refreshHours) || (c.catalog.refreshHours as number) < 1) errors.push('catalog.refreshHours must be a positive integer');
  return { ok: errors.length === 0, errors };
}
export function migrateConfig(x: unknown): Config {
  if (!x || typeof x !== 'object') return structuredClone(DEFAULT_CONFIG);
  const source = x as Record<string, unknown>;
  if (source.schemaVersion === 2) {
    const migrated = structuredClone(source) as unknown as Config;
    migrated.home ??= structuredClone(DEFAULT_CONFIG.home);
    migrated.home.appearance ??= structuredClone(DEFAULT_CONFIG.home.appearance);
    migrated.home.appearance.effects ??= 'lite';
    migrated.home.sections = migrated.home.sections.map(section => ({
      ...section,
      shortcuts: section.shortcuts.filter(shortcut => shortcut.action !== 'fireplace' && shortcut.id !== 'fireplace'),
    }));
    delete (migrated as Partial<Config> & Record<string, unknown>).screensaver;
    return migrated;
  }
  if (source.schemaVersion !== 1) return structuredClone(DEFAULT_CONFIG);
  const old = source.home as Record<string, unknown> | undefined;
  const migrated = structuredClone(DEFAULT_CONFIG);
  if (old) {
    migrated.home.title = typeof old.title === 'string' ? old.title : migrated.home.title;
    migrated.home.theme = old.theme === 'dark' ? 'cinematic' : old.theme === 'oled' || old.theme === 'light' ? old.theme : migrated.home.theme;
    migrated.home.accent = typeof old.accent === 'string' ? old.accent : migrated.home.accent;
    migrated.home.clock.showDate = true;
    migrated.home.sections = Array.isArray(old.sections) ? old.sections as Section[] : migrated.home.sections;
  }
  for (const key of ['tv', 'server', 'takeover', 'catalog'] as const) if (source[key] && typeof source[key] === 'object') Object.assign(migrated[key], source[key]);
  migrated.home.sections = migrated.home.sections.map(section => ({
    ...section,
    shortcuts: section.shortcuts.filter(shortcut => shortcut.action !== 'fireplace' && shortcut.id !== 'fireplace'),
  }));
  return migrated;
}

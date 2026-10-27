import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import type { DeviceInfo } from '../tv/smartcast-client.ts';
import { inRange } from './version.ts';
import fallback from './fallback-catalog.json' with { type: 'json' };

export interface CatalogEntry { catalogId: string; name: string; description?: string; iconUrl?: string; payload: { nameSpace: number; appId: string; message: string | null }; verifiedOnTarget: boolean }
export interface CatalogDevice extends DeviceInfo {}
export interface CatalogOptions { fetch?: (url: string, init?: { signal: AbortSignal }) => Promise<Response | unknown>; cacheDir: string; now?: () => number; fresh?: boolean }
type RawApp = { id: string; name: string; country: string[]; mobileAppInfo?: { description?: string; app_icon_image_url?: string } };
type RawAvailability = { id: string | null; chipsets: Record<string, Array<{ app_type_payload: string; firmwareMinimum: string | null; firmwareMaximum: string | null }>> };
const base = 'https://scfs.vizio.com/appservice/';
const urls = ['vizio_apps_prod.json', 'app_availability_prod.json'] as const;
const asEntries = fallback as CatalogEntry[];

async function readJson(file: string): Promise<unknown> { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function fetchJson(options: CatalogOptions, url: string): Promise<unknown> {
  const fetcher = options.fetch ?? ((input: string, init?: { signal: AbortSignal }) => fetch(input, init));
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
  try { const result = await fetcher(url, { signal: controller.signal }); return result instanceof Response ? result.json() : result; }
  finally { clearTimeout(timer); }
}
function payloadOf(raw: string): CatalogEntry['payload'] | null {
  try { const value = JSON.parse(raw) as Record<string, unknown>; if (typeof value.NAME_SPACE !== 'number' || typeof value.APP_ID !== 'string') return null; return { nameSpace: value.NAME_SPACE, appId: value.APP_ID, message: value.MESSAGE == null ? null : String(value.MESSAGE) }; } catch { return null; }
}

export class Catalog {
  private readonly entries: CatalogEntry[];
  private readonly options: CatalogOptions;
  private readonly payloads: Map<string, Array<{ payload: CatalogEntry['payload']; minimum: string | null; maximum: string | null; chipset: string }>>;
  constructor(entries: CatalogEntry[], options: CatalogOptions, payloads = new Map<string, Array<{ payload: CatalogEntry['payload']; minimum: string | null; maximum: string | null; chipset: string }>>()) {
    this.entries = entries; this.options = options; this.payloads = payloads;
  }
  listAvailableApps(device: CatalogDevice): Array<CatalogEntry> {
    return this.entries.flatMap(entry => {
      const payload = this.resolvePayload(entry.catalogId, device);
      return payload ? [{ ...entry, payload }] : [];
    });
  }
  resolvePayload(catalogId: string, device?: CatalogDevice): CatalogEntry['payload'] | null {
    const entry = this.entries.find(candidate => candidate.catalogId === catalogId); if (!entry) return null;
    const choices = this.payloads.get(catalogId) ?? [];
    if (!device) return choices.find(item => item.chipset === '*')?.payload ?? choices[0]?.payload ?? entry.payload;
    const chipset = choices.find(item => item.chipset === device.chipsetKey && inRange(device.firmware, item.minimum, item.maximum));
    const wildcard = choices.find(item => item.chipset === '*' && inRange(device.firmware, item.minimum, item.maximum));
    if (chipset || wildcard) return (chipset ?? wildcard)!.payload;
    return this.payloads.has(catalogId) ? null : entry.payload;
  }
  async refreshIcons(): Promise<void> {
    await fs.mkdir(path.join(this.options.cacheDir, 'icons'), { recursive: true });
    for (const entry of this.entries) {
      if (!entry.iconUrl || !/^[0-9]+$/.test(entry.catalogId)) continue;
      const file = path.join(this.options.cacheDir, 'icons', `${entry.catalogId}.png`);
      try { await fs.access(file); continue; } catch { /* download */ }
      try { const fetcher = this.options.fetch ?? ((input: string, init?: { signal: AbortSignal }) => fetch(input, init)); const response = await fetcher(entry.iconUrl, { signal: AbortSignal.timeout(5_000) }); if (!(response instanceof Response) || !response.ok) continue; await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, Buffer.from(await response.arrayBuffer())); } catch { /* icons are optional */ }
    }
  }
  hasCachedIcon(catalogId: string): boolean {
    if (!/^[0-9]+$/.test(catalogId)) return false;
    return fsSync.existsSync(path.join(this.options.cacheDir, 'icons', `${catalogId}.png`));
  }
}

export async function loadCatalog(options: CatalogOptions): Promise<Catalog> {
  await fs.mkdir(options.cacheDir, { recursive: true });
  await fs.mkdir(path.join(options.cacheDir, 'icons'), { recursive: true });
  let apps: RawApp[] | null = null, availability: RawAvailability[] | null = null;
  let networkFailure = false;
  for (let i = 0; i < urls.length; i++) {
    try { const value = await fetchJson(options, base + urls[i]); await fs.writeFile(path.join(options.cacheDir, urls[i]), JSON.stringify(value)); if (i === 0) apps = value as RawApp[]; else availability = value as RawAvailability[]; } catch {
      networkFailure = true;
      try { const value = await readJson(path.join(options.cacheDir, urls[i])); if (i === 0) apps = value as RawApp[]; else availability = value as RawAvailability[]; } catch { /* fallback below */ }
    }
  }
  if (options.fresh && networkFailure) throw new Error('catalog refresh failed');
  if (!apps || !availability) return new Catalog(asEntries, options);
  const byId = new Map<string, RawApp>(); for (const app of apps) if (!byId.has(app.id) && app.country.some(country => country === '*' || country === 'USA')) byId.set(app.id, app);
  const entries: CatalogEntry[] = [], payloads = new Map<string, Array<{ payload: CatalogEntry['payload']; minimum: string | null; maximum: string | null; chipset: string }>>();
  for (const record of availability) {
    if (!record.id || !byId.has(record.id)) continue;
    const app = byId.get(record.id)!;
    const choices = Object.entries(record.chipsets).flatMap(([chipset, items]) => items.flatMap(item => { const payload = payloadOf(item.app_type_payload); return payload ? [{ payload, minimum: item.firmwareMinimum, maximum: item.firmwareMaximum, chipset }] : []; }));
    const payload = choices[0]?.payload ?? asEntries.find(item => item.catalogId === record.id)?.payload;
    if (!payload) continue;
    payloads.set(record.id, choices);
    entries.push({ catalogId: record.id, name: app.name, description: app.mobileAppInfo?.description, iconUrl: app.mobileAppInfo?.app_icon_image_url, payload, verifiedOnTarget: asEntries.some(item => item.catalogId === record.id && item.verifiedOnTarget) });
  }
  return new Catalog(entries.length ? entries : asEntries, options, payloads);
}

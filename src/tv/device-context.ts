import type { Config } from '../config/schema.ts';
import { saveConfig } from '../config/store.ts';
import type { Catalog } from '../catalog/catalog.ts';
import type { DeviceInfo, SmartCastClient } from './smartcast-client.ts';
import { genericSmartCast, selectProfile } from './profiles/index.ts';
import type { TvProfile } from './profiles/types.ts';

export class DeviceContext {
  device?: DeviceInfo;
  profile: TvProfile = genericSmartCast;
  verified = false;
  lastTvContactAt: number | null = null;
  private inFlight?: Promise<DeviceInfo | undefined>;
  private readonly client: SmartCastClient;
  private currentCatalog: Catalog;
  private readonly config?: Config;
  private readonly dataDir?: string;
  constructor(client: SmartCastClient, catalog: Catalog, config?: Config, dataDir?: string) {
    this.client = client; this.currentCatalog = catalog; this.config = config; this.dataDir = dataDir;
  }
  get catalog(): Catalog { return this.currentCatalog; }
  async refreshCatalog(load: () => Promise<Catalog>): Promise<boolean> {
    try {
      const next = await load();
      await next.refreshIcons();
      this.currentCatalog = next;
      return true;
    } catch { return false; }
  }
  recordTvContact(at = Date.now()): void { this.lastTvContactAt = at; }
  async ensureDevice(): Promise<DeviceInfo | undefined> {
    if (this.device) return this.device;
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.readDevice();
    try { return await this.inFlight; } finally { this.inFlight = undefined; }
  }
  private async readDevice(): Promise<DeviceInfo | undefined> {
    try {
      const info = await this.client.getDeviceInfo({ timeoutMs: 2500 });
      this.recordTvContact();
      this.device = info;
      const selection = selectProfile(info); this.profile = selection.profile; this.verified = selection.verified;
      if (this.config && !this.config.tv.deviceId) { this.config.tv.deviceId = info.deviceId; saveConfig(this.config, this.dataDir); }
      return info;
    } catch { return undefined; }
  }
}

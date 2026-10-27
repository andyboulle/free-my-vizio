import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config, Secrets } from '../config/schema.ts';
import { saveConfig, saveSecrets } from '../config/store.ts';
import { validateConfig } from '../config/schema.ts';
import type { Catalog } from '../catalog/catalog.ts';
import type { DeviceInfo, InputInfo, SmartCastClient } from '../tv/smartcast-client.ts';
import type { TvProfile } from '../tv/profiles/types.ts';
import type { TakeoverSupervisor } from '../supervisor/takeover.ts';
import { log } from '../util/log.ts';

export interface AdminRouteDeps {
  config: Config;
  secrets: Secrets;
  dataDir?: string;
  client?: SmartCastClient;
  catalog?: Catalog;
  device?: DeviceInfo;
  profile?: TvProfile;
  supervisor?: TakeoverSupervisor;
  openUi?: () => Promise<void>;
  onPaired?: (token: string) => void;
  readBody: (req: IncomingMessage) => Promise<unknown>;
  pairState?: { challenge?: { pairingReqToken: number; challengeType: number } };
}

function reply(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function publicConfig(config: Config): Config { return structuredClone(config); }

export async function handleAdminRoute(pathname: string, method: string, req: IncomingMessage, res: ServerResponse, deps: AdminRouteDeps): Promise<boolean | void> {
  if (!pathname.startsWith('/api/admin/')) return false;
  try {
    if (pathname === '/api/admin/config' && method === 'GET') return void reply(res, 200, publicConfig(deps.config));
    if (pathname === '/api/admin/config' && method === 'PUT') {
      const value = await deps.readBody(req);
      const check = validateConfig(value);
      if (!check.ok) return void reply(res, 400, { ok: false, errors: check.errors });
      saveConfig(value as Config, deps.dataDir);
      Object.assign(deps.config, value as Config);
      return void reply(res, 200, publicConfig(deps.config));
    }
    if (pathname === '/api/admin/catalog' && method === 'GET') return void reply(res, 200, deps.catalog && deps.device ? deps.catalog.listAvailableApps(deps.device) : []);
    if (pathname === '/api/admin/inputs' && method === 'GET') {
      const inputs: InputInfo[] = deps.client ? await deps.client.getInputs() : [];
      return void reply(res, 200, inputs);
    }
    if (pathname === '/api/admin/pair/start' && method === 'POST') {
      if (!deps.client) return void reply(res, 503, { ok: false, error: 'TV unavailable' });
      const challenge = await deps.client.startPairing(deps.secrets.tvPairingDeviceId, deps.device?.castName ?? 'Free My Vizio');
      (deps.pairState ?? (deps.pairState = {})).challenge = challenge;
      return void reply(res, 200, { ok: true, challengeType: challenge.challengeType });
    }
    if (pathname === '/api/admin/pair/finish' && method === 'POST') {
      if (!deps.client || !deps.pairState?.challenge) return void reply(res, 409, { ok: false, error: 'pairing not started' });
      const value = await deps.readBody(req) as { pin?: unknown };
      if (typeof value.pin !== 'string' || !/^[0-9]{4,8}$/.test(value.pin)) return void reply(res, 400, { ok: false, error: 'invalid pin' });
      const token = await deps.client.finishPairing(deps.secrets.tvPairingDeviceId, deps.pairState.challenge, value.pin);
      deps.secrets.tvAuthToken = token;
      saveSecrets(deps.secrets, deps.dataDir);
      deps.onPaired?.(token);
      delete deps.pairState.challenge;
      return void reply(res, 200, { ok: true });
    }
    if (pathname === '/api/admin/pair/cancel' && method === 'POST') {
      if (deps.client) await deps.client.cancelPairing(deps.secrets.tvPairingDeviceId, deps.pairState?.challenge);
      if (deps.pairState) delete deps.pairState.challenge;
      return void reply(res, 200, { ok: true });
    }
    if (pathname === '/api/admin/open-ui' && method === 'POST') {
      if (!deps.openUi) return void reply(res, 503, { ok: false, error: 'TV unavailable' });
      await deps.openUi(); return void reply(res, 200, { ok: true });
    }
    if (pathname === '/api/admin/takeover' && method === 'POST') {
      const value = await deps.readBody(req) as { enabled?: unknown; mode?: unknown; suppressMinutes?: unknown };
      if (typeof value.enabled === 'boolean') deps.config.takeover.enabled = value.enabled;
      if (value.mode === 'always' || value.mode === 'power-on-only' || value.mode === 'off') deps.config.takeover.mode = value.mode;
      if (typeof value.suppressMinutes === 'number' && Number.isFinite(value.suppressMinutes) && value.suppressMinutes >= 0) deps.config.takeover.suppressMinutes = value.suppressMinutes;
      saveConfig(deps.config, deps.dataDir);
      return void reply(res, 200, { ok: true, takeover: deps.config.takeover });
    }
    if (pathname === '/api/admin/diagnostics' && method === 'GET') {
      return void reply(res, 200, {
        profile: deps.profile ? { id: deps.profile.id, verified: Boolean(deps.device && deps.profile.verifiedFirmware.includes(deps.device.firmware)), model: deps.device?.model, firmware: deps.device?.firmware } : null,
        paired: Boolean(deps.secrets.tvAuthToken), takeover: deps.supervisor?.status() ?? null, events: log.getRing().slice(-200),
      });
    }
    if (pathname === '/api/admin/key' && method === 'POST') {
      const value = await deps.readBody(req) as { key?: string };
      const key = value.key;
      if (!deps.client || typeof key !== 'string') return void reply(res, 400, { ok: false, error: 'invalid key' });
      await deps.client.sendKey(key as Parameters<SmartCastClient['sendKey']>[0]);
      return void reply(res, 200, { ok: true });
    }
    reply(res, 404, { error: 'not found' }); return true;
  } catch (error) {
    log.warn('admin_request_failed', { path: pathname, message: error instanceof Error ? error.message : String(error) });
    const status = (error as { status?: number }).status ?? 502;
    reply(res, status, status < 500 ? { ok: false, error: error instanceof Error ? error.message : 'invalid request' } : { ok: false, error: 'request failed' }); return true;
  }
}

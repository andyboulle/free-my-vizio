import { KEY_CODES, type KeyName } from './keys.ts';
import { TvAuthError, TvCommandError, TvHashvalError, TvPairingError, TvProtocolError } from './errors.ts';
import { createTvTransport, TvConnection, type TvTransport, type TvResponse } from './transport.ts';

export type AppRef = { nameSpace: number; appId: string; message: string | null };
export type PowerState = 0 | 1;
export type CallOptions = { timeoutMs?: number };
export interface DeviceInfo { model: string; firmware: string; apiVersion: string; vizios: string; chipsetKey: string; deviceId: string; castName: string; capabilities: Record<string, unknown>; conjureVersion?: string; raw: unknown }
export interface InputInfo { cname: string; name: string; label: string; readOnly: boolean }
export interface SettingItem { path: string; cname: string; type: string; name: string; value: unknown; hashval?: number; readOnly: boolean; hidden: boolean; enabled: boolean; elements?: string[] }

type JsonRecord = Record<string, unknown>;
const uriOf = (r: TvResponse, path: string) => typeof r.json === 'object' && r.json && typeof (r.json as JsonRecord).URI === 'string' ? (r.json as JsonRecord).URI as string : path;
const resultOf = (r: TvResponse) => typeof r.json === 'object' && r.json && typeof (r.json as JsonRecord).STATUS === 'object' && (r.json as JsonRecord).STATUS
  ? String(((r.json as JsonRecord).STATUS as JsonRecord).RESULT ?? '') : '';
const detailOf = (r: TvResponse) => typeof r.json === 'object' && r.json && typeof (r.json as JsonRecord).STATUS === 'object' && (r.json as JsonRecord).STATUS
  ? String(((r.json as JsonRecord).STATUS as JsonRecord).DETAIL ?? '') : r.text;

export class SmartCastClient {
  private readonly transport: TvTransport;
  private lock: Promise<void> = Promise.resolve();
  constructor(opts: { connection: TvConnection; transport?: TvTransport }) { this.transport = opts.transport ?? createTvTransport(opts.connection); }
  private async request(method: string, path: string, body?: unknown, options?: CallOptions & { auth?: boolean }): Promise<JsonRecord> {
    const response = await this.transport.request(method, path, body, { auth: options?.auth, timeoutMs: options?.timeoutMs });
    const result = resultOf(response).toUpperCase();
    const uri = uriOf(response, path);
    if (response.status === 200 && result === 'SUCCESS') return (response.json ?? {}) as JsonRecord;
    if (response.json === undefined) throw new TvProtocolError(`Unparseable response: ${response.text}`, uri);
    if (response.status === 401 || response.status === 403 || result === 'REQUIRES_PAIRING') throw new TvAuthError(result || `HTTP ${response.status}`, uri);
    if (result === 'HASHVAL_ERROR' || (result === 'INVALID_PARAMETER' && method === 'PUT')) throw new TvHashvalError(result, uri);
    if (['PAIRING_DENIED', 'CHALLENGE_INCORRECT', 'BLOCKED', 'MAX_CHALLENGES_EXCEEDED'].includes(result)) throw new TvPairingError(result, uri);
    throw new TvCommandError(result || `HTTP ${response.status}`, detailOf(response), uri);
  }
  private async locked<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const prior = this.lock; this.lock = new Promise(resolve => { release = resolve; });
    await prior;
    try { return await fn(); } finally { release(); }
  }
  async getDeviceInfo(o?: CallOptions): Promise<DeviceInfo> { return this.parseDeviceInfo(await this.request('GET', '/state/device/deviceinfo', undefined, { ...o, auth: false })); }
  parseDeviceInfo(raw: unknown): DeviceInfo {
    const item = ((raw as JsonRecord).ITEMS as JsonRecord[] | undefined)?.[0] ?? {};
    const v = (item.VALUE ?? {}) as JsonRecord, sys = (v.SYSTEM_INFO ?? {}) as JsonRecord, bins = (v.BINARIES ?? {}) as JsonRecord;
    const vizios = String(bins.ViziOS ?? ''), chipsetKey = (vizios.split('-')[0] ?? '').replace(/^mtk/i, 'MT').toUpperCase();
    return { model: String(v.MODEL_NAME ?? ''), firmware: String(sys.VERSION ?? ''), apiVersion: String(v.API_VERSION ?? ''), vizios, chipsetKey, deviceId: String(sys.DIID ?? ''), castName: String(v.CAST_NAME ?? ''), capabilities: (v.CAPABILITIES ?? {}) as Record<string, unknown>, conjureVersion: bins.conjure as string | undefined, raw };
  }
  async getPowerState(o?: CallOptions): Promise<PowerState> { const r = await this.request('GET', '/state/device/power_mode', undefined, { ...o, auth: false }); return Number(((r.ITEMS as JsonRecord[])[0]?.VALUE)) as PowerState; }
  async startPairing(deviceId: string, deviceName: string, o?: CallOptions) { const r = await this.request('PUT', '/pairing/start', { DEVICE_ID: deviceId, DEVICE_NAME: deviceName }, { ...o, auth: false }); const v = (r.ITEM as JsonRecord | undefined) ?? ((r.ITEMS as JsonRecord[] | undefined)?.[0]?.VALUE as JsonRecord) ?? r; return { pairingReqToken: Number(v.PAIRING_REQ_TOKEN ?? v.PAIRING_REQTOKEN), challengeType: Number(v.CHALLENGE_TYPE) }; }
  async finishPairing(deviceId: string, challenge: { pairingReqToken: number; challengeType: number }, pin: string, o?: CallOptions): Promise<string> {
    const r = await this.request('PUT', '/pairing/pair', { DEVICE_ID: deviceId, CHALLENGE_TYPE: challenge.challengeType, RESPONSE_VALUE: String(pin), PAIRING_REQ_TOKEN: challenge.pairingReqToken }, { ...o, auth: false });
    const v = (r.ITEM as JsonRecord | undefined) ?? ((r.ITEMS as JsonRecord[] | undefined)?.[0]?.VALUE as JsonRecord) ?? r; return String(v.AUTH_TOKEN ?? v.AUTH ?? v);
  }
  async cancelPairing(deviceId: string, challenge?: { pairingReqToken: number; challengeType: number }, o?: CallOptions) { await this.request('PUT', '/pairing/cancel', { DEVICE_ID: deviceId, ...(challenge ? { PAIRING_REQ_TOKEN: challenge.pairingReqToken, CHALLENGE_TYPE: challenge.challengeType } : {}) }, { ...o, auth: false }); }
  async getCurrentApp(o?: CallOptions): Promise<AppRef | null> {
    const r = await this.request('GET', '/app/current', undefined, o);
    const item = r.ITEM as JsonRecord | undefined;
    const v = (item?.VALUE as JsonRecord | undefined) ?? item ??
      ((r.ITEMS as JsonRecord[] | undefined)?.[0]?.VALUE as JsonRecord | undefined);
    return v ? { nameSpace: Number(v.NAME_SPACE ?? v.NAMESPACE), appId: String(v.APP_ID ?? v.APPID), message: v.MESSAGE == null ? null : String(v.MESSAGE) } : null;
  }
  async launchApp(app: AppRef, o?: CallOptions) { await this.request('PUT', '/app/launch', { VALUE: { NAME_SPACE: app.nameSpace, APP_ID: app.appId, MESSAGE: app.message } }, o); }
  async launchUrl(url: string, appId = '17', o?: CallOptions) { await this.launchApp({ nameSpace: 4, appId, message: url }, o); }
  async sendKey(key: KeyName, action: 'KEYPRESS' | 'KEYDOWN' | 'KEYUP' = 'KEYPRESS', o?: CallOptions) { const [codeset, code] = KEY_CODES[key]; await this.request('PUT', '/key_command/', { KEYLIST: [{ CODESET: codeset, CODE: code, ACTION: action }] }, o); }
  async getInputs(o?: CallOptions): Promise<InputInfo[]> { const r = await this.request('GET', '/menu_native/dynamic/tv_settings/devices/name_input', undefined, o); return ((r.ITEMS ?? []) as JsonRecord[]).map(x => ({ cname: String(x.CNAME ?? ''), name: String(x.NAME ?? ''), label: String(x.LABEL ?? x.NAME ?? ''), readOnly: Boolean(x.READONLY) })); }
  async getCurrentInput(o?: CallOptions) { const r = await this.request('GET', '/menu_native/dynamic/tv_settings/devices/current_input', undefined, o); const x = (r.ITEMS as JsonRecord[])[0] ?? r; return { value: String(x.VALUE ?? ''), hashval: Number(x.HASHVAL ?? (r as JsonRecord).HASHVAL) }; }
  async setInput(cname: string, o?: CallOptions) { await this.locked(async () => { const current = await this.getCurrentInput(o); await this.request('PUT', '/menu_native/dynamic/tv_settings/devices/current_input', { REQUEST: 'MODIFY', VALUE: cname.toLowerCase(), HASHVAL: current.hashval }, o); }); }
  async getSetting(path: string, o?: CallOptions): Promise<SettingItem[]> { const r = await this.request('GET', `/menu_native/dynamic/tv_settings/${path.replace(/^\/+/, '')}`, undefined, o); return ((r.ITEMS ?? []) as JsonRecord[]).map(x => ({ path, cname: String(x.CNAME ?? ''), type: String(x.TYPE ?? ''), name: String(x.NAME ?? ''), value: x.VALUE, hashval: x.HASHVAL == null ? undefined : Number(x.HASHVAL), readOnly: Boolean(x.READONLY), hidden: Boolean(x.HIDDEN), enabled: x.ENABLED !== false, elements: x.ELEMENTS as string[] | undefined })); }
  async setSetting(path: string, value: string | number, o?: CallOptions) { await this.locked(async () => { for (let attempt = 0; attempt < 2; attempt++) { try { const items = await this.getSetting(path, o); const hashval = items.find(x => x.hashval !== undefined)?.hashval; await this.request('PUT', `/menu_native/dynamic/tv_settings/${path.replace(/^\/+/, '')}`, { REQUEST: 'MODIFY', VALUE: value, HASHVAL: hashval }, o); return; } catch (e) { if (!(e instanceof TvHashvalError) || attempt !== 0) throw e; } } }); }
  async triggerAction(path: string, o?: CallOptions) { if (path === 'support/factory_reset' || path === 'support/restart_tv' || path === 'support/check_for_updates' || path.startsWith('network/') || path.startsWith('system/parental_controls/')) throw new TvCommandError('DENIED', 'Action is not permitted', path); await this.locked(async () => { const item = (await this.getSetting(path, o))[0]; await this.request('PUT', `/menu_native/dynamic/tv_settings/${path}`, { REQUEST: 'ACTION', HASHVAL: item?.hashval }, o); }); }
}

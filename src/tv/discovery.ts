import https from 'node:https';
export interface DiscoveredTv { host: string; model: string; deviceId: string }
export interface DiscoveryOptions { concurrency?: number; timeoutMs?: number; port?: number }
function probe(host: string, port: number, timeoutMs: number): Promise<DiscoveredTv | null> {
  return new Promise(resolve => { const req = https.get({ host, port, path: '/state/device/deviceinfo', rejectUnauthorized: false, timeout: timeoutMs }, res => { const chunks: Buffer[] = []; res.on('data', c => chunks.push(Buffer.from(c))); res.on('end', () => { try { const root = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>; const item = ((root.ITEMS as Record<string, unknown>[] | undefined)?.[0]?.VALUE ?? {}) as Record<string, unknown>; const sys = (item.SYSTEM_INFO ?? {}) as Record<string, unknown>; const model = String(item.MODEL_NAME ?? ''); resolve(model ? { host, model, deviceId: String(sys.DIID ?? '') } : null); } catch { resolve(null); } }); }); req.on('error', () => resolve(null)); req.on('timeout', () => req.destroy()); }); }
export async function scanSubnet(baseIp: string, options: DiscoveryOptions = {}): Promise<DiscoveredTv[]> {
  const [a, b, c] = baseIp.split('.').map(Number); const hosts = Array.from({ length: 254 }, (_, i) => `${a}.${b}.${c}.${i + 1}`); const out: DiscoveredTv[] = []; let next = 0;
  async function worker(): Promise<void> { while (next < hosts.length) { const host = hosts[next++]; const found = await probe(host, options.port ?? 7345, options.timeoutMs ?? 1500); if (found) out.push(found); } }
  const concurrency = Math.min(options.concurrency ?? 32, 32, hosts.length);
  await Promise.all(Array.from({ length: concurrency }, () => worker())); return out;
}
export function matchByDeviceId(tvs: DiscoveredTv[], deviceId: string): DiscoveredTv | undefined {
  return tvs.find(tv => tv.deviceId === deviceId);
}

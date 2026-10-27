import readline from 'node:readline';
import { loadConfig, loadSecrets, saveConfig, saveSecrets, generateToken } from './config/store.ts';
import { resolveDataDir } from './config/paths.ts';
import { scanSubnet } from './tv/discovery.ts';
import { TvConnection } from './tv/transport.ts';
import { SmartCastClient } from './tv/smartcast-client.ts';
import { pickLanAddress } from './util/net.ts';
import { selectProfile } from './tv/profiles/index.ts';
import { classifyApp } from './tv/app-identity.ts';

async function pinPrompt(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return await new Promise((resolve, reject) => { rl.question('PIN: ', answer => { rl.close(); resolve(answer.trim()); }); rl.on('SIGINT', () => { rl.close(); reject(new Error('cancelled')); }); });
}
async function main(args: string[]): Promise<void> {
  const command = args[0]; const dir = resolveDataDir();
  if (command === 'config-path') { console.log(dir); return; }
  if (command === 'rotate-tokens') { const s = loadSecrets(dir); s.adminToken = generateToken(); s.tvUiToken = generateToken(); saveSecrets(s, dir); return; }
  const config = loadConfig(dir);
  if (command === 'discover') { const host = config.tv.host ?? pickLanAddress('0.0.0.0'); for (const tv of await scanSubnet(host)) console.log(`${tv.host} ${tv.model}`); return; }
  if (command === 'admin-url') {
    if (!process.stdout.isTTY) { process.exitCode = 1; return; }
    const s = loadSecrets(dir); const host = config.server.publicBaseUrl ?? `http://${pickLanAddress(config.tv.host ?? '0.0.0.0')}`; console.log(`${host}:${config.server.port}/admin/#t=${s.adminToken}`); return;
  }
  if (command === 'open') {
    if (!config.tv.host) throw new Error('TV is not configured');
    const s = loadSecrets(dir); const client = new SmartCastClient({ connection: new TvConnection({ host: config.tv.host, port: config.tv.port, authToken: s.tvAuthToken }) });
    const base = config.server.publicBaseUrl ?? `http://${pickLanAddress(config.tv.host)}:${config.server.port}`;
    const debug = args.includes('--debug'); const baseline = args.includes('--baseline');
    const query = [debug && 'debug=1', baseline && 'fx=none'].filter(Boolean).join('&');
    await client.launchUrl(`${base}/tv/${query ? `?${query}` : ''}#k=${s.tvUiToken}`); console.log('opened'); return;
  }
  if (command === 'pair') {
    const host = args[args.indexOf('--host') + 1] || config.tv.host; if (!host) throw new Error('pair requires --host <ip>');
    const s = loadSecrets(dir); const connection = new TvConnection({ host, port: config.tv.port }); const client = new SmartCastClient({ connection }); const info = await client.getDeviceInfo(); let challenge: { pairingReqToken: number; challengeType: number } | undefined;
    try { await client.cancelPairing(info.deviceId); } catch { /* no pending challenge is normal */ }
    try { challenge = await client.startPairing(info.deviceId, s.tvPairingDeviceId); const token = await client.finishPairing(info.deviceId, challenge, await pinPrompt()); s.tvAuthToken = token; config.tv.host = host; config.tv.deviceId = info.deviceId; saveSecrets(s, dir); saveConfig(config, dir); console.log('paired'); }
    catch (error) { try { await client.cancelPairing(info.deviceId, challenge); } catch { /* preserve original error */ } throw error; }
    return;
  }
  if (command === 'status' || command === 'doctor') {
    if (!config.tv.host) throw new Error('TV is not configured'); const s = loadSecrets(dir); const client = new SmartCastClient({ connection: new TvConnection({ host: config.tv.host, port: config.tv.port, authToken: s.tvAuthToken }) }); const info = await client.getDeviceInfo();
    const selection = selectProfile(info);
    if (command === 'status') {
      const power = await client.getPowerState(); const app = await client.getCurrentApp();
      const prefix = `${config.server.publicBaseUrl ?? ''}/tv/`;
      console.log(JSON.stringify({ power, app, appClass: classifyApp(power, app, { tvUiUrlPrefix: prefix, profile: selection.profile }), profile: selection.profile.id, verified: selection.verified, paired: Boolean(s.tvAuthToken) }));
    } else console.log(JSON.stringify({ model: info.model, firmware: info.firmware, apiVersion: info.apiVersion, conjureVersion: info.conjureVersion, capabilities: info.capabilities, profile: selection.profile.id, verified: selection.verified, reachable: true, paired: Boolean(s.tvAuthToken) }));
    return;
  }
  throw new Error(`Unknown command: ${command ?? ''}`);
}
if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

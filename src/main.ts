import { loadConfig, loadSecrets } from './config/store.ts';
import { resolveDataDir } from './config/paths.ts';
import { createHttpServer } from './server/http-server.ts';
import { log } from './util/log.ts';
import { pickLanAddress } from './util/net.ts';
import { TvConnection } from './tv/transport.ts';
import { SmartCastClient } from './tv/smartcast-client.ts';
import { selectProfile } from './tv/profiles/index.ts';
import { loadCatalog } from './catalog/catalog.ts';
import { TakeoverSupervisor } from './supervisor/takeover.ts';

export async function start(): Promise<ReturnType<typeof createHttpServer>> {
  const dir = resolveDataDir(), config = loadConfig(dir), secrets = loadSecrets(dir);
  const tvHost = config.tv.host ?? pickLanAddress('0.0.0.0');
  const serverBaseUrl = config.server.publicBaseUrl ?? `http://${pickLanAddress(tvHost)}:${config.server.port}`;
  let client: SmartCastClient | undefined, profile: ReturnType<typeof selectProfile>['profile'] | undefined, device;
  if (config.tv.host) { client = new SmartCastClient({ connection: new TvConnection({ host: tvHost, port: config.tv.port, authToken: secrets.tvAuthToken }) }); try { device = await client.getDeviceInfo(); profile = selectProfile(device).profile; } catch { /* server remains usable while TV is offline */ } }
  const catalog = device ? await loadCatalog({ cacheDir: `${dir}/cache` }) : undefined;
  const supervisor = client && profile ? new TakeoverSupervisor({
    client, config, tvUiUrlPrefix: `${serverBaseUrl}/tv/`,
    tvUiToken: secrets.tvUiToken, nativeHome: profile.nativeHome, isNativeHome: profile.isNativeHome,
  }) : undefined;
  const server = createHttpServer({ config, secrets, version: '0.1.0', tv: { config, client, profile, device, catalog,
    nativeHome: async () => { if (supervisor) await supervisor.suppressAndOpenNativeHome(); else if (client && profile) await client.launchApp(profile.nativeHome); },
    takeoverStatus: () => supervisor?.status() ?? { state: 'IDLE', power: null, appClass: null, lastLaunchAt: null, lastError: null, suppressedUntil: 0, launchesInWindow: 0 },
  } });
  supervisor?.start();
  server.listen(config.server.port, config.server.bindHost, () => { log.info('server_started', { tvUiUrl: `${serverBaseUrl}/tv/` }); log.info('admin_url_hint', { message: 'run `npm run cli -- admin-url` to get the admin link' }); });
  return server;
}
if (import.meta.url === `file://${process.argv[1]}`) start().catch(error => { log.error('server_failed', { message: error instanceof Error ? error.message : 'startup failed' }); process.exitCode = 1; });

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
import { matchByDeviceId, scanSubnet } from './tv/discovery.ts';
import { saveConfig } from './config/store.ts';

export async function start(): Promise<ReturnType<typeof createHttpServer>> {
  const dir = resolveDataDir(), config = loadConfig(dir), secrets = loadSecrets(dir);
  const tvHost = config.tv.host ?? pickLanAddress('0.0.0.0');
  const serverBaseUrl = config.server.publicBaseUrl ?? `http://${pickLanAddress(tvHost)}:${config.server.port}`;
  let client: SmartCastClient | undefined, profile: ReturnType<typeof selectProfile>['profile'] | undefined, device;
  const connection = config.tv.host ? new TvConnection({ host: tvHost, port: config.tv.port, authToken: secrets.tvAuthToken }) : undefined;
  if (connection) { client = new SmartCastClient({ connection }); try { device = await client.getDeviceInfo(); profile = selectProfile(device).profile; } catch { /* server remains usable while TV is offline */ } }
  const catalog = device ? await loadCatalog({ cacheDir: `${dir}/cache` }) : undefined;
  const supervisor = client && profile ? new TakeoverSupervisor({
    client, config, tvUiUrlPrefix: `${serverBaseUrl}/tv/`,
    tvUiToken: secrets.tvUiToken, nativeHome: profile.nativeHome, isNativeHome: profile.isNativeHome,
  }) : undefined;
  const server = createHttpServer({ config, secrets, version: '0.1.0', tv: { config, client, profile, device, catalog,
    nativeHome: async () => { if (supervisor) await supervisor.suppressAndOpenNativeHome(); else if (client && profile) await client.launchApp(profile.nativeHome); },
    takeoverStatus: () => supervisor?.status() ?? { state: 'IDLE', power: null, appClass: null, lastLaunchAt: null, lastError: null, suppressedUntil: 0, launchesInWindow: 0 },
  }, admin: {
    client, profile, device, catalog, supervisor,
    onPaired: token => client?.updateConnection({ authToken: token }),
    openUi: async () => { if (client) await client.launchUrl(`${serverBaseUrl}/tv/#k=${secrets.tvUiToken}`, profile?.conjureAppId ?? '17'); },
  } });
  supervisor?.start();
  let rediscoveryTimer: ReturnType<typeof setInterval> | undefined;
  let unreachableSince: number | undefined;
  let rediscoveryRunning = false;
  if (client && connection && config.tv.deviceId) {
    rediscoveryTimer = setInterval(async () => {
      if (rediscoveryRunning || !supervisor) return;
      if (supervisor.status().state !== 'UNREACHABLE') { unreachableSince = undefined; return; }
      unreachableSince ??= Date.now();
      if (Date.now() - unreachableSince < 10 * 60_000) return;
      rediscoveryRunning = true;
      try {
        const found = matchByDeviceId(await scanSubnet(pickLanAddress('0.0.0.0'), { port: config.tv.port }), config.tv.deviceId);
        if (found && found.host !== connection.host) {
          connection.update({ host: found.host });
          config.tv.host = found.host;
          saveConfig(config, dir);
          log.info('tv_rediscovered', { host: found.host });
        }
        unreachableSince = found ? undefined : Date.now();
      } catch (error) {
        log.warn('tv_rediscovery_failed', { message: error instanceof Error ? error.message : String(error) });
      } finally { rediscoveryRunning = false; }
    }, 60_000);
    rediscoveryTimer.unref();
  }
  server.listen(config.server.port, config.server.bindHost, () => { log.info('server_started', { tvUiUrl: `${serverBaseUrl}/tv/` }); log.info('admin_url_hint', { message: 'run `npm run cli -- admin-url` to get the admin link' }); });
  const shutdown = () => {
    supervisor?.stop();
    if (rediscoveryTimer) clearInterval(rediscoveryTimer);
    server.close(error => { if (error) log.warn('server_shutdown_failed', { message: error.message }); });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return server;
}
if (import.meta.url === `file://${process.argv[1]}`) start().catch(error => { log.error('server_failed', { message: error instanceof Error ? error.message : 'startup failed' }); process.exitCode = 1; });

import { loadConfig, loadSecrets } from './config/store.ts';
import { resolveDataDir } from './config/paths.ts';
import { createHttpServer } from './server/http-server.ts';
import { log } from './util/log.ts';
import { pickLanAddress } from './util/net.ts';
import { TvConnection } from './tv/transport.ts';
import { SmartCastClient } from './tv/smartcast-client.ts';
import { loadCatalog } from './catalog/catalog.ts';
import { TakeoverSupervisor } from './supervisor/takeover.ts';
import { matchByDeviceId, scanBaseForHost, scanSubnet } from './tv/discovery.ts';
import { saveConfig } from './config/store.ts';
import { DeviceContext } from './tv/device-context.ts';

export async function start(): Promise<ReturnType<typeof createHttpServer>> {
  const dir = resolveDataDir(), config = loadConfig(dir), secrets = loadSecrets(dir);
  const tvHost = config.tv.host ?? pickLanAddress('0.0.0.0');
  const serverBaseUrl = config.server.publicBaseUrl ?? `http://${pickLanAddress(tvHost)}:${config.server.port}`;
  let client: SmartCastClient | undefined;
  const connection = config.tv.host ? new TvConnection({ host: tvHost, port: config.tv.port, authToken: secrets.tvAuthToken }) : undefined;
  if (connection) {
    client = new SmartCastClient({ connection });
  }
  const catalog = await loadCatalog({ cacheDir: `${dir}/cache` });
  void catalog.refreshIcons();
  const context = connection && client ? new DeviceContext(client, catalog, config, dir) : undefined;
  if (context) void context.ensureDevice();
  const supervisor = client && context ? new TakeoverSupervisor({
    client, config, tvUiUrlPrefix: `${serverBaseUrl}/tv/`,
    tvUiToken: secrets.tvUiToken, nativeHome: context.profile.nativeHome, isNativeHome: app => context.profile.isNativeHome(app),
    onReachable: () => { void context.ensureDevice(); },
    onTvContact: at => context.recordTvContact(at),
  }) : undefined;
  const server = createHttpServer({ config, secrets, version: '0.1.0', tv: { config, client, catalog, context,
    nativeHome: async () => { if (supervisor) await supervisor.suppressAndOpenNativeHome(); else if (client && context) await client.launchApp(context.profile.nativeHome); },
    takeoverStatus: () => supervisor?.status() ?? { state: 'IDLE', power: null, appClass: null, lastLaunchAt: null, lastError: null, suppressedUntil: 0, launchesInWindow: 0, lastTvContactAt: null },
  }, admin: {
    client, connection, catalog, context, supervisor,
    onPaired: token => client?.updateConnection({ authToken: token }),
    openUi: async () => { if (client) await client.launchUrl(`${serverBaseUrl}/tv/#k=${secrets.tvUiToken}`, context?.profile.conjureAppId ?? '17'); },
  } });
  supervisor?.start();
  let rediscoveryTimer: ReturnType<typeof setInterval> | undefined;
  let catalogRefreshTimer: ReturnType<typeof setInterval> | undefined;
  let catalogRefreshRunning = false;
  if (context) {
    const refreshMs = config.catalog.refreshHours * 60 * 60_000;
    catalogRefreshTimer = setInterval(async () => {
      if (catalogRefreshRunning) return;
      catalogRefreshRunning = true;
      try {
        await context.refreshCatalog(() => loadCatalog({ cacheDir: `${dir}/cache`, fresh: true }));
      } finally {
        catalogRefreshRunning = false;
      }
    }, refreshMs);
    catalogRefreshTimer.unref();
  }
  let unreachableSince: number | undefined;
  let rediscoveryRunning = false;
  const configuredDeviceId = config.tv.deviceId;
  if (client && connection && configuredDeviceId) {
    rediscoveryTimer = setInterval(async () => {
      if (rediscoveryRunning) return;
      let unreachable = supervisor?.status().state === 'UNREACHABLE';
      if (!unreachable) {
        try { await client!.getDeviceInfo({ timeoutMs: 2500 }); }
        catch { unreachable = true; }
      }
      if (!unreachable) { unreachableSince = undefined; return; }
      unreachableSince ??= Date.now();
      if (Date.now() - unreachableSince < 10 * 60_000) return;
      rediscoveryRunning = true;
      try {
        const found = matchByDeviceId(await scanSubnet(scanBaseForHost(config.tv.host ?? connection.host), { port: config.tv.port }), configuredDeviceId);
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
    if (catalogRefreshTimer) clearInterval(catalogRefreshTimer);
    server.close(error => { if (error) log.warn('server_shutdown_failed', { message: error.message }); });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return server;
}
if (import.meta.url === `file://${process.argv[1]}`) start().catch(error => { log.error('server_failed', { message: error instanceof Error ? error.message : 'startup failed' }); process.exitCode = 1; });

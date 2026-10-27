import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { URL } from 'node:url';
import { adminAuthorized, hostAllowed, tvAuthorized, unauthorized } from './auth.ts';
import { serveStatic } from './static.ts';
import { activateShortcut, tvHome, type TvRouteDeps } from './routes-tv.ts';
import type { Config } from '../config/schema.ts';
import type { Secrets } from '../config/schema.ts';

export interface HttpServerOptions { config: Config; secrets: Secrets; tv?: TvRouteDeps; version?: string; }
function json(res: http.ServerResponse, status: number, value: unknown): void { res.writeHead(status, { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
async function body(req: http.IncomingMessage): Promise<unknown> {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw Object.assign(new Error('json required'), { status: 415 });
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > 65536) throw Object.assign(new Error('body too large'), { status: 413 }); chunks.push(Buffer.from(chunk)); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw Object.assign(new Error('invalid json'), { status: 400 }); }
}
export function createHttpServer(options: HttpServerOptions): http.Server {
  const roots = { tv: path.resolve('web/tv'), admin: path.resolve('web/admin'), icons: path.resolve(process.env.FMV_DATA_DIR ?? path.join(process.env.HOME ?? '.', '.free-my-vizio'), 'cache/icons') };
  const own = Object.values(os.networkInterfaces()).flat().filter(x => x && !x.internal).map(x => x!.address);
  const allowed = ['localhost', '127.0.0.1', '::1', ...own, ...(options.config.server.publicBaseUrl ? [new URL(options.config.server.publicBaseUrl).hostname] : [])];
  return http.createServer(async (req, res) => {
    if (!hostAllowed(req.headers.host, allowed)) return json(res, 421, { error: 'misdirected request' });
    const rawPath = (req.url ?? '/').split('?')[0]; const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`); const pathname = rawPath;
    if (pathname === '/healthz' && req.method === 'GET') return json(res, 200, { ok: true, version: options.version ?? 'dev', paired: Boolean(options.secrets.tvAuthToken), tvReachable: false, takeover: options.tv?.takeoverStatus?.() ?? { state: 'IDLE' } });
    if (pathname.startsWith('/tv/')) { if (serveStatic(res, roots.tv, pathname.slice(3) || '/index.html')) return; return json(res, pathname.includes('..') || pathname.includes('%') ? 400 : 404, { error: 'not found' }); }
    if (pathname.startsWith('/admin/')) { if (serveStatic(res, roots.admin, pathname.slice(6) || '/index.html')) return; return json(res, 404, { error: 'not found' }); }
    if (pathname.startsWith('/icons/')) { if (/^\/icons\/[0-9]+\.png$/.test(pathname) && serveStatic(res, roots.icons, pathname.slice(6))) return; return json(res, 404, { error: 'not found' }); }
    if (pathname.startsWith('/api/admin/')) { if (!adminAuthorized(req, options.secrets.adminToken)) return unauthorized(res); }
    if (pathname.startsWith('/api/tv/')) { if (!tvAuthorized(req, options.secrets.tvUiToken)) return unauthorized(res); }
    try {
      if (pathname === '/api/tv/home' && req.method === 'GET' && options.tv) return json(res, 200, tvHome(options.tv));
      if (pathname === '/api/tv/activate' && req.method === 'POST' && options.tv) { const data = await body(req) as { shortcutId?: string }; await activateShortcut(options.tv, String(data.shortcutId ?? '')); return json(res, 200, { ok: true }); }
      if (pathname === '/api/tv/native-home' && req.method === 'POST' && options.tv) { await options.tv.nativeHome(); return json(res, 200, { ok: true }); }
      if (pathname === '/api/tv/status' && req.method === 'GET') { const status = options.tv?.takeoverStatus?.(); return json(res, 200, status ? { ...status, takeoverState: status.state } : { power: null, appClass: null, takeoverState: 'IDLE' }); }
      return json(res, 404, { error: 'not found' });
    } catch (error) { const status = (error as { status?: number; code?: string }).status ?? ((error as { code?: string }).code === 'NOT_FOUND' ? 404 : 502); return json(res, status, { ok: false, error: { code: 'TV_ERROR', message: 'request failed' } }); }
  });
}

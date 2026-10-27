import https from 'node:https';
import type { IncomingMessage } from 'node:http';
import { TvUnreachableError } from './errors.ts';

export class TvConnection {
  private state: { host: string; port: number; authToken?: string };
  constructor(init: { host: string; port?: number; authToken?: string }) {
    this.state = { host: init.host, port: init.port ?? 7345, authToken: init.authToken };
  }
  get host() { return this.state.host; }
  get port() { return this.state.port; }
  get authToken() { return this.state.authToken; }
  update(patch: Partial<{ host: string; port: number; authToken: string | undefined }>) {
    this.state = { ...this.state, ...patch };
  }
}
export interface TvResponse { status: number; json: unknown; text: string }
export interface TvTransport {
  request(method: string, path: string, body?: unknown, options?: { auth?: boolean; timeoutMs?: number }): Promise<TvResponse>;
}
export function createTvTransport(connection: TvConnection): TvTransport {
  const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true, maxSockets: 2 });
  return {
    request(method, path, body, options = {}) {
      const { host, port, authToken } = connection;
      const payload = body === undefined ? undefined : JSON.stringify(body);
      return new Promise((resolve, reject) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (options.auth !== false && authToken) headers.AUTH = authToken;
        if (payload !== undefined) headers['Content-Length'] = String(Buffer.byteLength(payload));
        const req = https.request({ host, port, path, method, agent, headers, timeout: options.timeoutMs ?? 8000 }, (res: IncomingMessage) => {
          const chunks: Buffer[] = [];
          res.on('data', chunk => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let json: unknown;
            try { json = JSON.parse(text); } catch { json = undefined; }
            resolve({ status: res.statusCode ?? 0, json, text });
          });
        });
        const fail = (error: Error) => reject(new TvUnreachableError(error.message, `https://${host}:${port}${path}`));
        req.on('error', fail);
        req.on('timeout', () => { req.destroy(new Error('request timeout')); });
        if (payload !== undefined) req.write(payload);
        req.end();
      });
    },
  };
}

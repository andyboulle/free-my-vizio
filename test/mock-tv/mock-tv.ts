import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

export interface MockTv {
  connection: { host: string; port: number; authToken?: string };
  controls: { power: 0 | 1; currentApp: unknown; currentInput: string; hashvals: Record<string, number>; pairedToken?: string; pin: string; unreachable: boolean; raceOnce: boolean; failSetting: boolean };
  requests: Array<{ method: string; path: string; body: unknown; headers: Record<string, string | string[] | undefined> }>;
  close(): Promise<void>;
}
const fixture = path.resolve(process.cwd(), 'docs/evidence/m65q6-l4_86.910.19.2-1_deviceinfo.json');
export async function createMockTv(options: { pin?: string; raceOnce?: boolean; failSetting?: boolean } = {}): Promise<MockTv> {
  const controls = { power: 1 as 0 | 1, currentApp: null as unknown, currentInput: 'hdmi1', hashvals: { current_input: 1001, setting: 2001 }, pairedToken: undefined as string | undefined, pin: options.pin ?? '1234', unreachable: false, raceOnce: options.raceOnce ?? false, failSetting: options.failSetting ?? false };
  const requests: MockTv['requests'] = [];
  const certDir = path.resolve(process.cwd(), 'test/fixtures/tls');
  const server = https.createServer({ key: fs.readFileSync(path.join(certDir, 'test-key.pem')), cert: fs.readFileSync(path.join(certDir, 'test-cert.pem')) }, (req, res) => {
    if (controls.unreachable) { req.socket.destroy(); return; }
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString();
      let body: unknown; try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
      const headers = { ...req.headers }; if (headers.auth) headers.auth = '<redacted>';
      requests.push({ method: req.method ?? 'GET', path: req.url ?? '/', body, headers });
      const pathName = req.url ?? '/';
      const send = (payload: unknown, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)); };
      const success = (items: unknown[] = []) => send({ STATUS: { RESULT: 'SUCCESS', DETAIL: 'Success' }, URI: pathName, ITEMS: items });
      if (pathName === '/state/device/deviceinfo') return send(JSON.parse(fs.readFileSync(fixture, 'utf8')));
      if (pathName === '/state/device/power_mode') return success([{ VALUE: controls.power }]);
      if (pathName === '/pairing/start') return send({ STATUS: { RESULT: 'SUCCESS', DETAIL: 'Success' }, URI: pathName, ITEM: { PAIRING_REQ_TOKEN: 42, CHALLENGE_TYPE: 1 } });
      if (pathName === '/pairing/pair') {
        if ((body as Record<string, unknown> | undefined)?.RESPONSE_VALUE !== controls.pin) return send({ STATUS: { RESULT: 'PAIRING_DENIED', DETAIL: 'Denied' }, URI: pathName }, 200);
        controls.pairedToken = 'mock-auth-token'; return send({ STATUS: { RESULT: 'SUCCESS', DETAIL: 'Success' }, URI: pathName, ITEM: { AUTH_TOKEN: controls.pairedToken } });
      }
      if (pathName === '/pairing/cancel') return success();
      if (pathName === '/app/current' && !req.headers.auth) return send({ STATUS: { RESULT: 'REQUIRES_PAIRING' }, URI: pathName }, 403);
      if (pathName === '/app/current') return success(controls.currentApp ? [{ VALUE: controls.currentApp }] : []);
      if (pathName === '/app/launch') { controls.currentApp = (body as Record<string, unknown>) ?? null; return success(); }
      if (pathName === '/key_command/') return success();
      if (pathName.endsWith('/name_input')) return success([{ CNAME: 'hdmi1', NAME: 'HDMI 1', LABEL: 'HDMI 1', READONLY: false }]);
      if (pathName.endsWith('/current_input')) {
        if (req.method === 'GET') return success([{ VALUE: controls.currentInput, HASHVAL: controls.hashvals.current_input }]);
        const b = (body ?? {}) as Record<string, unknown>;
        if (b.HASHVAL !== controls.hashvals.current_input) return send({ STATUS: { RESULT: 'HASHVAL_ERROR' }, URI: pathName });
        if (b.VALUE !== 'hdmi1') return send({ STATUS: { RESULT: 'FAILURE', DETAIL: 'cname required' }, URI: pathName });
        controls.currentInput = String(b.VALUE); controls.hashvals.current_input++; return success();
      }
      if (pathName.startsWith('/menu_native/dynamic/tv_settings/')) {
        if (req.method === 'GET') return success([{ CNAME: 'setting', TYPE: 'T_STRING', NAME: 'Setting', VALUE: 'value', HASHVAL: controls.hashvals.setting, READONLY: false, HIDDEN: false, ENABLED: true }]);
        const b = (body ?? {}) as Record<string, unknown>;
        if (controls.failSetting) return send({ STATUS: { RESULT: 'FAILURE', DETAIL: 'forced failure' }, URI: pathName });
        if (controls.raceOnce) { controls.raceOnce = false; return send({ STATUS: { RESULT: 'HASHVAL_ERROR' }, URI: pathName }); }
        if (b.HASHVAL !== controls.hashvals.setting) return send({ STATUS: { RESULT: 'HASHVAL_ERROR' }, URI: pathName });
        controls.hashvals.setting++; return success();
      }
      send({ STATUS: { RESULT: 'FAILURE', DETAIL: 'Not found' }, URI: pathName }, 404);
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return { connection: { host: address.address, port: address.port }, controls, requests, close: () => new Promise(resolve => server.close(() => resolve())) };
}

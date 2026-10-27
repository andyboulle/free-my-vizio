#!/usr/bin/env node
// Disposable proof-of-concept / diagnostic tool for Free My Vizio research.
// NOT production code. Zero dependencies (Node >= 18).
//
// Credentials are stored OUTSIDE the repository in
//   ~/.free-my-vizio/poc-credentials.json  (mode 0600)
// and are never printed.
//
// Usage: node poc/fmv-poc.mjs <command> [...args]   (run with no args for help)

import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CRED_DIR = path.join(os.homedir(), '.free-my-vizio');
const CRED_FILE = path.join(CRED_DIR, 'poc-credentials.json');
const LOG_FILE = path.join(CRED_DIR, 'poc-events.jsonl');

function loadCreds() {
  try { return JSON.parse(fs.readFileSync(CRED_FILE, 'utf8')); } catch { return {}; }
}
function saveCreds(c) {
  fs.mkdirSync(CRED_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CRED_FILE, JSON.stringify(c, null, 2), { mode: 0o600 });
  fs.chmodSync(CRED_FILE, 0o600);
}

const creds = loadCreds();
const TV = process.env.FMV_TV_HOST || creds.host;
const PORT = Number(process.env.FMV_TV_PORT || creds.port || 7345);

// The TV uses a self-signed certificate; verification is disabled only for this TV agent.
const tvAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });

function tvRequest(method, p, body, { auth = true, timeoutMs = 8000 } = {}) {
  if (!TV) throw new Error('No TV host. Run: node poc/fmv-poc.mjs set-host <ip>');
  const data = body === undefined ? undefined : JSON.stringify(body);
  const headers = { 'Content-Type': 'application/json' };
  if (data) headers['Content-Length'] = Buffer.byteLength(data);
  if (auth && creds.authToken) headers.AUTH = creds.authToken;
  return new Promise((resolve, reject) => {
    const req = https.request({ host: TV, port: PORT, path: p, method, headers, agent: tvAgent, timeout: timeoutMs }, (res) => {
      let buf = '';
      res.on('data', (d) => (buf += d));
      res.on('end', () => {
        let json; try { json = JSON.parse(buf); } catch { json = undefined; }
        resolve({ status: res.statusCode, json, text: buf });
      });
    });
    req.on('timeout', () => req.destroy(new Error(`timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function show(r) {
  console.log(`[HTTP ${r.status}]`);
  console.log(r.json ? JSON.stringify(r.json, null, 2) : r.text);
}

// Remote key codes (CODESET, CODE) as documented in exiva/Vizio_SmartCast_API.
const KEYS = {
  up: [3, 8], down: [3, 0], left: [3, 1], right: [3, 7], ok: [3, 2],
  back: [4, 0], exit: [9, 0], home: [4, 15], menu: [4, 8], info: [4, 6],
  'vol-up': [5, 1], 'vol-down': [5, 0], mute: [5, 4], 'mute-off': [5, 2], 'mute-on': [5, 3],
  'power-off': [11, 0], 'power-on': [11, 1], 'power-toggle': [11, 2],
  'input-next': [7, 1], 'ch-up': [8, 1], 'ch-down': [8, 0],
  play: [2, 3], pause: [2, 2], 'cc-toggle': [13, 0],
};

function lanAddress() {
  for (const ifs of Object.values(os.networkInterfaces())) {
    for (const i of ifs || []) if (i.family === 'IPv4' && !i.internal) return i.address;
  }
  return '127.0.0.1';
}

function serve(port) {
  const root = path.join(HERE, 'test-app');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  fs.mkdirSync(CRED_DIR, { recursive: true, mode: 0o700 });
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (u.pathname === '/api/action' && req.method === 'POST') {
      let b = ''; req.on('data', (d) => (b += d)); req.on('end', async () => {
        const { tile } = safeParse(b) || {};
        const result = await pageAction(tile).catch((e) => ({ error: e.message }));
        const line = JSON.stringify({ t: new Date().toISOString(), from: req.socket.remoteAddress, body: { type: 'action', tile, result } });
        fs.appendFileSync(LOG_FILE, line + '\n'); console.log(line);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result));
      });
      return;
    }
    if (u.pathname === '/log' && req.method === 'POST') {
      let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => {
        const line = JSON.stringify({ t: new Date().toISOString(), from: req.socket.remoteAddress, ua: req.headers['user-agent'], body: safeParse(b) });
        fs.appendFileSync(LOG_FILE, line + '\n');
        console.log(line);
        res.writeHead(204); res.end();
      });
      return;
    }
    const file = path.join(root, u.pathname === '/' ? 'index.html' : path.normalize(u.pathname).replace(/^\/+/, ''));
    if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    console.log(new Date().toISOString(), 'GET', u.pathname, 'from', req.socket.remoteAddress, req.headers['user-agent']);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  srv.listen(port, '0.0.0.0', () => console.log(`Serving ${root} at http://${lanAddress()}:${port}/  (events -> ${LOG_FILE})`));
}
function safeParse(s) { try { return JSON.parse(s); } catch { return s; } }

// Launch payloads taken from Vizio's public catalog (scfs.vizio.com/appservice/app_availability_prod.json).
const PAGE_APPS = {
  Netflix: { NAME_SPACE: 3, APP_ID: '1', MESSAGE: null },
  YouTube: { NAME_SPACE: 5, APP_ID: '1', MESSAGE: null },
  'Prime Video': { NAME_SPACE: 3, APP_ID: '3', MESSAGE: null },
  'Disney+': { NAME_SPACE: 2, APP_ID: '75', MESSAGE: null },
  'Exit test': { NAME_SPACE: 4, APP_ID: '1', MESSAGE: '{"app":"home","bundle":"bundles/home"}' },
};
async function pageAction(tile) {
  if (PAGE_APPS[tile]) {
    const r = await tvRequest('PUT', '/app/launch', { VALUE: PAGE_APPS[tile] });
    return { status: r.status, result: r.json?.STATUS?.RESULT };
  }
  const m = /^HDMI (\d)$/.exec(tile || '');
  if (m) {
    const cur = await tvRequest('GET', '/menu_native/dynamic/tv_settings/devices/current_input');
    const hash = cur.json?.ITEMS?.[0]?.HASHVAL;
    // Writes must use the lowercase input CNAME (e.g. "hdmi1"); the display name "HDMI-1" returns FAILURE (verified).
    const r = await tvRequest('PUT', '/menu_native/dynamic/tv_settings/devices/current_input', { REQUEST: 'MODIFY', VALUE: `hdmi${m[1]}`, HASHVAL: hash });
    return { status: r.status, result: r.json?.STATUS?.RESULT, detail: r.json?.STATUS?.DETAIL };
  }
  return { result: 'no-op', tile };
}

const [cmd, ...args] = process.argv.slice(2);
const cmds = {
  async 'set-host'([host, port]) { saveCreds({ ...creds, host, port: Number(port || 7345) }); console.log('saved host'); },
  async info() { show(await tvRequest('GET', '/state/device/deviceinfo', undefined, { auth: false })); },
  async power() { show(await tvRequest('GET', '/state/device/power_mode', undefined, { auth: false })); },
  async 'pair-start'([name = 'Free My Vizio PoC']) {
    const deviceId = creds.deviceId || `fmv-poc-${Math.random().toString(16).slice(2, 10)}`;
    const r = await tvRequest('PUT', '/pairing/start', { DEVICE_ID: deviceId, DEVICE_NAME: name }, { auth: false });
    show(r);
    const item = r.json?.ITEM;
    if (item?.PAIRING_REQ_TOKEN !== undefined) {
      saveCreds({ ...creds, deviceId, pending: { token: item.PAIRING_REQ_TOKEN, challenge: item.CHALLENGE_TYPE } });
      console.log('A PIN should now be displayed on the TV. Run: node poc/fmv-poc.mjs pair-finish <PIN>');
    }
  },
  async 'pair-finish'([pin]) {
    if (!creds.pending) throw new Error('run pair-start first');
    const r = await tvRequest('PUT', '/pairing/pair', {
      DEVICE_ID: creds.deviceId, CHALLENGE_TYPE: creds.pending.challenge, RESPONSE_VALUE: String(pin), PAIRING_REQ_TOKEN: creds.pending.token,
    }, { auth: false });
    const token = r.json?.ITEM?.AUTH_TOKEN;
    console.log(`[HTTP ${r.status}] RESULT=${r.json?.STATUS?.RESULT} DETAIL=${r.json?.STATUS?.DETAIL} token_received=${Boolean(token)}`);
    if (token) { const c = { ...creds, authToken: token, pairedAt: new Date().toISOString() }; delete c.pending; saveCreds(c); console.log('Paired. Token saved to', CRED_FILE); }
  },
  async 'pair-cancel'() {
    show(await tvRequest('PUT', '/pairing/cancel', { DEVICE_ID: creds.deviceId, CHALLENGE_TYPE: 1, RESPONSE_VALUE: '1111', PAIRING_REQ_TOKEN: 0 }, { auth: false }));
  },
  async get([p]) { show(await tvRequest('GET', p)); },
  async 'current-app'() { show(await tvRequest('GET', '/app/current')); },
  async launch([ns, appId, message = 'None']) {
    show(await tvRequest('PUT', '/app/launch', { VALUE: { MESSAGE: message === 'None' ? null : message, NAME_SPACE: Number(ns), APP_ID: String(appId) } }));
  },
  async 'launch-raw'([json]) { show(await tvRequest('PUT', '/app/launch', JSON.parse(json))); },
  async key([name]) {
    const k = KEYS[name]; if (!k) throw new Error(`unknown key; one of: ${Object.keys(KEYS).join(', ')}`);
    show(await tvRequest('PUT', '/key_command/', { KEYLIST: [{ CODESET: k[0], CODE: k[1], ACTION: 'KEYPRESS' }] }));
  },
  async serve([port = '8099']) { serve(Number(port)); },
  // Poll power + current app and log transitions. With --relaunch <url>, re-launch the URL
  // whenever the TV is on and showing the SmartCast home (watchdog auto-launch experiment).
  async watch(argv) {
    const i = argv.indexOf('--relaunch'); const relaunchUrl = i >= 0 ? argv[i + 1] : null;
    const intervalMs = Number(process.env.FMV_POLL_MS || 2000);
    let last = '';
    let lastLaunchAt = 0;
    for (;;) {
      const t0 = Date.now();
      let power = '?', app = '?', appVal = null, err = '';
      try {
        const p = await tvRequest('GET', '/state/device/power_mode', undefined, { auth: false, timeoutMs: 3000 });
        power = String(p.json?.ITEMS?.[0]?.VALUE);
        const a = await tvRequest('GET', '/app/current', undefined, { timeoutMs: 3000 });
        appVal = a.json?.ITEM?.VALUE ?? null;
        app = appVal ? `${appVal.NAME_SPACE}/${appVal.APP_ID}/${String(appVal.MESSAGE).slice(0, 70)}` : `none(${a.json?.STATUS?.RESULT})`;
      } catch (e) { err = e.message; }
      const state = `power=${power} app=${app}${err ? ' err=' + err : ''}`;
      if (state !== last) { console.log(new Date().toISOString(), state, `(${Date.now() - t0}ms)`); last = state; }
      const onHome = power === '1' && appVal && appVal.NAME_SPACE === 4 && appVal.APP_ID === '1' && /"app":"home"/.test(appVal.MESSAGE || '');
      if (relaunchUrl && onHome && Date.now() - lastLaunchAt > 5000) {
        lastLaunchAt = Date.now();
        const r = await tvRequest('PUT', '/app/launch', { VALUE: { MESSAGE: relaunchUrl, NAME_SPACE: 4, APP_ID: '3' } }).catch((e) => ({ status: 0, json: { STATUS: { RESULT: e.message } } }));
        console.log(new Date().toISOString(), `WATCHDOG relaunch -> HTTP ${r.status} ${r.json?.STATUS?.RESULT}`);
      }
      await new Promise((r) => setTimeout(r, Math.max(0, intervalMs - (Date.now() - t0))));
    }
  },
  async 'creds-status'() { console.log({ host: creds.host, port: creds.port, paired: Boolean(creds.authToken), pairedAt: creds.pairedAt, file: CRED_FILE }); },
};

if (!cmd || !cmds[cmd]) {
  console.log(`commands: ${Object.keys(cmds).join(' | ')}\nkeys: ${Object.keys(KEYS).join(', ')}`);
  process.exit(cmd ? 1 : 0);
}
cmds[cmd](args).catch((e) => { console.error('ERROR:', e.message); process.exit(1); });

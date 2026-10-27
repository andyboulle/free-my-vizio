# Architecture Decision Record — Free My Vizio

Status: **Accepted** (2026-10-26). Based on hardware-verified results in
[TECHNICAL_FEASIBILITY.md](TECHNICAL_FEASIBILITY.md). Decisions marked **BINDING** must not be changed by the
implementation agent without the deviation process in [IMPLEMENTATION_AGENT_PROMPT.md](IMPLEMENTATION_AGENT_PROMPT.md).

## 1. Decision summary

Build **one small Node.js service** ("the server") that runs on an always-on LAN host and:

1. talks to the TV's local SmartCast HTTPS API (pairing, state, launch, keys, inputs, settings);
2. serves a **custom TV UI** (static HTML/CSS/ES modules) that the TV opens in its **Conjure** runtime via
   `PUT /app/launch {NAME_SPACE:4, APP_ID:"17", MESSAGE:<url>}`;
3. runs a **Home Takeover supervisor** that polls the TV and relaunches the TV UI whenever the native
   SmartCast home is showing (power-on, Home button);
4. serves an **admin UI** (phone/laptop browser) for pairing, layout and settings;
5. persists configuration in JSON files. No database, no cloud backend, no runtime npm dependencies.

Why: every alternative that avoids an always-on host loses automatic startup (the only verified route to
"TV turns on → our UI"); every alternative that modifies the TV is unproven and risky. The SmartCast API
cannot be called from the TV page directly (cert/CORS — verified), so a backend is required anyway.

```
 ┌──────────────────── LAN (trusted home network) ─────────────────────┐
 │                                                                      │
 │  Always-on host (dev Mac now; Pi/NAS/mini-PC later)                  │
 │  ┌────────────────────────── fmv server (Node) ───────────────────┐ │
 │  │ HTTP :8730                                                      │ │
 │  │  /tv/*    static TV UI  ──────────────┐                         │ │
 │  │  /admin/* static admin UI             │                         │ │
 │  │  /api/tv/*   (X-FMV-Token)            │                         │ │
 │  │  /api/admin/*(Bearer admin token)     │                         │ │
 │  │  /healthz                             │                         │ │
 │  │                                       │                         │ │
 │  │ Supervisor (Home Takeover) ──┐        │                         │ │
 │  │ SmartCast client ────────────┼── HTTPS :7345 (AUTH token) ──┐   │ │
 │  │ Catalog (scfs.vizio.com, cached)      │                     │   │ │
 │  │ Config + secrets (JSON files)         │                     │   │ │
 │  └───────────────────────────────────────┼─────────────────────┼───┘ │
 │                                          │ HTTP GET /tv/        │     │
 │  Vizio M65Q6-L4  ◄───────────────────────┘ fetch /api/tv/*      ▼     │
 │   Conjure (Chrome 128) runs TV UI         SmartCast API (SCPL)        │
 │                                                                      │
 │  Phone/laptop browser ── /admin/ ──► fmv server                      │
 └──────────────────────────────────────────────────────────────────────┘
```

## 2. Technology stack (BINDING)

| Concern | Choice | Rationale |
|---|---|---|
| Server runtime | **Node.js ≥ 22.18** (22 LTS or 24 LTS) | Runs `.ts` directly via built-in type stripping; available on macOS/Linux/Pi; dev machine already has Node; Python on the dev Mac is broken |
| Server language | **TypeScript, erasable syntax only** (no `enum`, `namespace`, parameter properties, decorators); `import type` for types; relative imports end in `.ts` | No build step; `tsc --noEmit` for type checking |
| Runtime dependencies | **None** (Node built-ins: `node:http`, `node:https`, `node:fs`, `node:crypto`, `node:dgram`, `node:test`) | Small attack surface, no supply chain churn, cheap to maintain |
| Dev dependencies | `typescript` (≥ 5.8), `@types/node` (22.x) only | Type checking |
| Tests | `node --test` + `node:assert/strict` | Built in |
| TV UI | Vanilla HTML + CSS + **ES modules**, no framework, no bundler; target Chrome 128 | Verified features on Conjure 128 (§6 of feasibility) |
| Admin UI | Vanilla HTML/CSS/ES modules | Same; tiny |
| Persistence | JSON files in a data directory | Small config; atomic writes |

`tsconfig.json` must set: `"strict": true, "noEmit": true, "module": "nodenext", "moduleResolution": "nodenext",
"target": "es2023", "allowImportingTsExtensions": true, "verbatimModuleSyntax": true, "erasableSyntaxOnly": true,
"types": ["node"]`, `include: ["src", "test"]`. Web code (`web/`) is plain `.js` with JSDoc and is checked with
`node --check` only.

## 3. Repository layout (BINDING paths)

```
package.json                 # "type": "module"; scripts below
tsconfig.json
README.md
docs/                        # research + plans (this folder); docs/evidence = sanitized fixtures
poc/                         # disposable research tool — never imported by src/
src/
  main.ts                    # entry: load config/secrets, build services, start HTTP + supervisor
  cli.ts                     # `fmv` CLI: discover | pair | status | doctor | open | key | admin-url | rotate-tokens | config-path
  config/
    paths.ts                 # resolveDataDir(): $FMV_DATA_DIR || ~/.free-my-vizio
    schema.ts                # Config + Secrets types, DEFAULT_CONFIG, validateConfig(), migrateConfig()
    store.ts                 # loadConfig/saveConfig/loadSecrets/saveSecrets (atomic write, 0600 secrets)
  tv/
    errors.ts                # TvError subclasses (see §6.4)
    transport.ts             # createTvTransport(host, port): scoped insecure TLS, timeouts, JSON envelope parse
    keys.ts                  # KEY_CODES table (§6.3)
    smartcast-client.ts      # SmartCastClient class (§6.2)
    app-identity.ts          # classifyApp() (§5.2)
    discovery.ts             # scanSubnet() for :7345 deviceinfo; matchByDeviceId()
    profiles/
      types.ts               # TvProfile interface
      m65q6-l4.ts            # verified profile for the target
      generic-smartcast.ts   # defaults for unknown models (same rules, flagged unverified)
      index.ts               # selectProfile(deviceInfo)
  catalog/
    catalog.ts               # fetch/cache Vizio catalog, resolveLaunchPayload(), icons cache
    fallback-catalog.json    # bundled minimal catalog (verified payloads)
    version.ts               # compareFirmware()
  supervisor/
    takeover.ts              # HomeTakeover state machine (§5)
  server/
    http-server.ts           # createServer(): routing, host check, security headers, body limits
    static.ts                # safe static file serving (no traversal), content types, no-store for html
    routes-tv.ts             # /api/tv/*
    routes-admin.ts          # /api/admin/*
    auth.ts                  # token checks, constant-time compare
  util/
    log.ts                   # JSON-lines logger with redaction + in-memory ring buffer
    clock.ts                 # injectable clock/sleep for tests
    net.ts                   # pickLanAddress(tvHost)
web/
  tv/index.html  tv/css/base.css  tv/css/themes.css
  tv/js/main.js  tv/js/api.js  tv/js/focus.js (pure)  tv/js/render.js  tv/js/keys.js
  admin/index.html  admin/admin.js  admin/admin.css
test/
  unit/*.test.ts
  integration/*.test.ts
  mock-tv/mock-tv.ts         # HTTPS mock SmartCast server driven by docs/evidence fixtures
  fixtures/tls/              # TEST-ONLY self-signed cert/key (generated with openssl; labeled test-only)
deploy/
  systemd/free-my-vizio.service
  launchd/com.freemyvizio.server.plist
  docker/Dockerfile  docker/compose.yaml   # optional; network_mode: host
```

`package.json` scripts: `start` → `node src/main.ts`; `cli` → `node src/cli.ts`; `test` →
`node --test "test/**/*.test.ts" "test/**/*.test.js"` (`.test.js` is used for tests of plain-JS `web/` modules such as
`focus.js`, which are outside `tsconfig`); `typecheck` → `tsc -p .`; `check:web` → `node --check` over `web/**/*.js`
(via `scripts/check-web.mjs`); `verify` → typecheck + check:web + test.

## 4. Components and responsibilities

| Component | Responsibility | Must not |
|---|---|---|
| **TV integration** (`src/tv/*`) | Transport, pairing, typed API calls, HASHVAL rules, key table, app classification, model profiles, discovery | Know about UI layout or HTTP routes |
| **Catalog** (`src/catalog/*`) | Available-app metadata + launch payload per chipset/firmware; icon cache | Claim an app is installed |
| **Supervisor** (`src/supervisor/takeover.ts`) | Home takeover state machine, suppression, loop guard | Launch anything other than the configured TV UI URL |
| **Server** (`src/server/*`) | HTTP routing, auth, static files, JSON APIs | Accept raw launch payloads from the TV UI |
| **Config** (`src/config/*`) | Load/validate/migrate/save config and secrets | Log secrets |
| **TV UI** (`web/tv`) | Render home, spatial navigation, call `/api/tv/*` | Load third-party scripts; call Companion Library privileged functions |
| **Admin UI** (`web/admin`) | Pairing flow, layout editor, takeover controls, diagnostics | Store the TV AUTH token |

## 5. Home Takeover supervisor (BINDING behavior)

### 5.1 Configuration

```jsonc
"takeover": {
  "enabled": true,
  "mode": "always",          // "always" | "power-on-only" | "off"
  "pollMs": 1000,            // poll period in all states
  "requestTimeoutMs": 2500,
  "confirmDelayMs": 400,     // re-check before launching (avoids power-off race, observed on hardware)
  "cooldownMs": 5000,        // minimum time between launches
  "suppressMinutes": 10,     // after user chooses "SmartCast Home" in our UI
  "suppressUntilStandby": true,
  "loopGuard": { "maxLaunches": 3, "windowMs": 60000, "pauseMinutes": 10 }
}
```

### 5.2 App classification (`classifyApp(power, app, ctx) → AppClass`)

| Class | Rule (evaluated in order) | Evidence |
|---|---|---|
| `UNREACHABLE` | request failed/timed out | observed during standby |
| `STANDBY` | `power_mode == 0` **or** (`NAME_SPACE 345` and `APP_ID "707"`) | VERIFIED |
| `UNKNOWN` | `power==1` and `/app/current` returned null, no `VALUE`, or malformed data | defensive |
| `FMV_UI` | `NAME_SPACE 4` and `MESSAGE` starts with `ctx.tvUiUrlPrefix` (`<publicBaseUrl>/tv/`) | VERIFIED |
| `NATIVE_HOME` | `profile.isNativeHome(app)`; for M65Q6-L4: `NAME_SPACE 4` and `APP_ID "1"` | VERIFIED |
| `INPUT_OR_SYSTEM` | `NAME_SPACE 0` and `MESSAGE` is `""`/null (seen on HDMI / input picker) | VERIFIED |
| `APP` | anything else (optionally annotated with catalog name) | — |

Do **not** treat `NAME_SPACE 0` as home (pyvizio does; wrong on this firmware). Only `NATIVE_HOME` can trigger a launch;
`UNKNOWN` never does.

### 5.3 State machine

Per tick (every `pollMs`): `GET /state/device/power_mode` (no auth), then if `power==1`, `GET /app/current`.
Ticks never overlap (self-scheduling `setTimeout` after the previous tick fully completes, including the confirm wait).

Supervisor memory: `lastObservedPower: 0|1|null` (last *successful* power read; unchanged by UNREACHABLE),
`lastPowerOnAt`, `launchedSincePowerOn`, `suppressedUntil`, `suppressGeneration` (incremented by every suppress call),
`launchAttempts[]` (timestamps of attempts, successful or not), `lastError`.

```
mode=off or enabled=false        -> do nothing (still publish status)
UNREACHABLE                      -> no state changes except status (do NOT clear suppression, do NOT reset flags)
STANDBY (confirmed power=0)      -> lastObservedPower=0; launchedSincePowerOn=false;
                                    if suppressUntilStandby: suppressedUntil=0
power=1 and lastObservedPower!=1 -> lastPowerOnAt=now; lastObservedPower=1   (covers STANDBY->on and STANDBY->UNREACHABLE->on)
NATIVE_HOME (power=1):
   g = suppressGeneration
   if not eligible(now)                         -> no action
   wait confirmDelayMs; re-read power_mode and /app/current
   if power!=1 or class!=NATIVE_HOME            -> no action
   if not eligible(now) or suppressGeneration!=g -> no action   (suppression may start during the wait)
   launchAttempts.push(now); launchedSincePowerOn=true          (recorded BEFORE awaiting the launch)
   try launchTvUi() catch e -> lastError=e (attempt still counts for cooldown and loop guard)
   if count(launchAttempts within windowMs) >= maxLaunches -> suppressedUntil = now + pauseMinutes; log warn
UNKNOWN / FMV_UI / INPUT_OR_SYSTEM / APP -> no action

eligible(now) = now >= suppressedUntil
            and now - lastAttempt >= cooldownMs
            and (mode=="always" or (mode=="power-on-only" and !launchedSincePowerOn and now - lastPowerOnAt <= 30s))
```

`launchTvUi()` = `PUT /app/launch {"VALUE":{"NAME_SPACE":4,"APP_ID":"17","MESSAGE":"<publicBaseUrl>/tv/#k=<tvUiToken>"}}`.
The loop guard protects native dialogs (ToS/update prompts) and users who deliberately want the native home.

**Escape hatch** — `takeover.suppressAndOpenNativeHome()` is one operation: increment `suppressGeneration`, set
`suppressedUntil = now + suppressMinutes`, then launch the native home (`NAME_SPACE 4, APP_ID "1", MESSAGE
"{\"app\":\"home\",\"bundle\":\"bundles/home\"}"` — the exact value read from the TV). Both `POST /api/tv/native-home`
and `POST /api/tv/activate` for a `system/native-home` shortcut must call this same function.

Supervisor status object (exposed via `/healthz` and admin diagnostics):
`{ state, power, appClass, lastLaunchAt, lastError, suppressedUntil, launchesInWindow }`.

## 6. TV integration contracts

### 6.1 Transport (BINDING)

- `https.Agent({ rejectUnauthorized: false })` used **only** for the configured TV host:port. All other HTTPS
  (catalog) uses default verification.
- Header `AUTH: <token>` when paired; `Content-Type: application/json`.
- Default timeout 2500 ms (supervisor) / 8000 ms (interactive), no automatic retries except HASHVAL (§6.2).
- Parse the JSON envelope. Treat **both** HTTP 200 with `STATUS.RESULT != SUCCESS` **and** non-200 statuses as
  errors; inspect the body before classifying (some firmware returns plain 404, S8).
- Serialize every HASHVAL **read-modify-write transaction** (`setInput`, `setSetting`, `triggerAction`: GET hashval →
  PUT → optional retry) through one client-wide async mutex. A rejected transaction must release the mutex so later
  writes proceed. Plain GETs and `launchApp`/`sendKey` are not queued.
- The transport reads `host`, `port`, and `authToken` from a shared `TvConnection` object **on every request**, so
  re-pairing, `SIGHUP` reload, and rediscovery take effect immediately for all consumers without restart.

### 6.2 `SmartCastClient` (BINDING signatures)

```ts
type AppRef = { nameSpace: number; appId: string; message: string | null };
type PowerState = 0 | 1;
type CallOptions = { timeoutMs?: number };     // supervisor passes 2500; default 8000
interface DeviceInfo { model: string; firmware: string; apiVersion: string; vizios: string; chipsetKey: string;
  deviceId: string /* SYSTEM_INFO.DIID – sensitive */; castName: string; capabilities: Record<string, unknown>;
  conjureVersion?: string; raw: unknown }
interface InputInfo { cname: string; name: string; label: string; readOnly: boolean }
interface SettingItem { path: string; cname: string; type: string; name: string; value: unknown;
  hashval?: number; readOnly: boolean; hidden: boolean; enabled: boolean; elements?: string[] }

// src/tv/transport.ts — single shared instance created in main.ts
class TvConnection {
  constructor(init: { host: string; port?: number /*7345*/; authToken?: string });
  get host(): string; get port(): number; get authToken(): string | undefined;
  update(patch: Partial<{ host: string; port: number; authToken: string | undefined }>): void;  // atomic swap
}

class SmartCastClient {
  constructor(opts: { connection: TvConnection; transport?: TvTransport /* injectable for tests */ });
  getDeviceInfo(o?: CallOptions): Promise<DeviceInfo>;                       // no auth
  getPowerState(o?: CallOptions): Promise<PowerState>;                       // no auth
  startPairing(deviceId: string, deviceName: string, o?: CallOptions): Promise<{ pairingReqToken: number; challengeType: number }>;
  finishPairing(deviceId: string, challenge: { pairingReqToken: number; challengeType: number }, pin: string, o?: CallOptions): Promise<string /*authToken*/>;
  cancelPairing(deviceId: string, challenge?: { pairingReqToken: number; challengeType: number }, o?: CallOptions): Promise<void>;
  getCurrentApp(o?: CallOptions): Promise<AppRef | null>;
  launchApp(app: AppRef, o?: CallOptions): Promise<void>;
  launchUrl(url: string, appId?: string /* "17" */, o?: CallOptions): Promise<void>;   // NAME_SPACE 4
  sendKey(key: KeyName, action?: "KEYPRESS" | "KEYDOWN" | "KEYUP", o?: CallOptions): Promise<void>;
  getInputs(o?: CallOptions): Promise<InputInfo[]>;
  getCurrentInput(o?: CallOptions): Promise<{ value: string; hashval: number }>;
  setInput(cname: string, o?: CallOptions): Promise<void>;     // locked: fresh GET current_input HASHVAL, VALUE = lowercase cname
  getSetting(path: string, o?: CallOptions): Promise<SettingItem[]>;   // path relative to /menu_native/dynamic/tv_settings
  setSetting(path: string, value: string | number, o?: CallOptions): Promise<void>;  // locked: GET hashval, PUT MODIFY; retry once on hashval error
  triggerAction(path: string, o?: CallOptions): Promise<void>;          // locked: REQUEST "ACTION"; denylist enforced (§8)
}
```

### 6.3 Key table (`src/tv/keys.ts`, from S1–S4; power codes VERIFIED)

| Key | Codeset,Code | Key | Codeset,Code |
|---|---|---|---|
| SEEK_FWD | 2,0 | HOME | 4,15 |
| SEEK_BACK | 2,1 | VOL_DOWN | 5,0 |
| PAUSE | 2,2 | VOL_UP | 5,1 |
| PLAY | 2,3 | MUTE_TOGGLE | 5,4 (5,2/5,3 behave as toggle on TVs) |
| DOWN | 3,0 | PIC_MODE | 6,0 |
| LEFT | 3,1 | INPUT_NEXT | 7,1 (may be a no-op — prefer `setInput`) |
| OK | 3,2 | CH_DOWN / CH_UP / CH_PREV | 8,0 / 8,1 / 8,2 |
| RIGHT | 3,7 | EXIT | 9,0 |
| UP | 3,8 | POWER_OFF | 11,0 |
| BACK | 4,0 | POWER_ON | 11,1 |
| CC_TOGGLE | 4,4 | POWER_TOGGLE | 11,2 |
| INFO / MENU | 4,6 / 4,8 | ASCII text | 0, charCode |

Unit tests must assert POWER_ON = (11,1) and POWER_OFF = (11,0) (historic inversion bug, pyvizio #163).

### 6.4 Errors

`TvUnreachableError` (network/timeout), `TvAuthError` (403 REQUIRES_PAIRING / 401), `TvPairingError(result)`
(`PAIRING_DENIED`, `CHALLENGE_INCORRECT`, `BLOCKED`, `MAX_CHALLENGES_EXCEEDED`), `TvHashvalError`,
`TvCommandError(result, detail)`, `TvProtocolError` (unparseable). Each carries the URI (never headers).

### 6.5 Model & firmware compatibility strategy

`TvProfile` (`src/tv/profiles/types.ts`):

```ts
interface TvProfile {
  id: string;                                // "vizio-m65q6-l4"
  matches(info: DeviceInfo): boolean;        // model === "M65Q6-L4"
  verifiedFirmware: string[];                // ["86.910.19.2-1"]
  conjureAppId: string;                      // "17"
  nativeHome: AppRef;                        // {4, "1", '{"app":"home","bundle":"bundles/home"}'}
  isNativeHome(app: AppRef): boolean;
  inputWriteUsesCname: true;
  viewport: { width: 1280; height: 720 };
}
```

`selectProfile()` returns the exact profile or `generic-smartcast` (same rules) and sets
`verified=false` when model or firmware is not in the verified list. Unverified ⇒ everything still runs, but
`doctor` and the admin diagnostics show a prominent "unverified model/firmware — run the manual checklist"
warning. Adding a model = add a profile file + a fixture + run the manual checklist; no core changes.

### 6.6 Catalog

- Fetch `https://scfs.vizio.com/appservice/vizio_apps_prod.json` and `.../app_availability_prod.json` at startup
  and every 24 h, each with a **10 s abort timeout** (never block startup: serve cache/fallback immediately and refresh in
  the background); cache raw files in `<dataDir>/cache/`; fall back to cache, then to `src/catalog/fallback-catalog.json`.
- Raw schemas (verified 2026-10-26; samples in `docs/evidence/catalog/`):

```ts
interface RawCatalogApp { id: string; name: string; country: string[] /* "*" or ISO3 like "USA" */;
  mobileAppInfo?: { createDate?: string; featured_sort?: number; description?: string; app_icon_image_url?: string } }
interface RawAvailability { id: string | null; chipsets: Record<string /* "*" | "MT5586" | "MT5586L" | ... */,
  Array<{ app_type_payload: string /* JSON string {"NAME_SPACE":n,"APP_ID":"s","MESSAGE":s|null} */;
          firmwareMinimum: string | null; firmwareMaximum: string | null }>> }
interface CatalogEntry { catalogId: string; name: string; description?: string; iconUrl?: string;
  payload: AppRef; verifiedOnTarget: boolean }      // joined result; also the schema of fallback-catalog.json (array)
```

- Join rules: join on `id`; skip availability records with null/empty `id`; if an `id` appears more than once in the apps
  file keep the first; skip apps whose country list contains neither `"*"` nor `"USA"`; skip entries whose
  `app_type_payload` fails to parse or lacks `NAME_SPACE`/`APP_ID`; an app with no matching payload is omitted.
- Payload selection: chipset key = `BINARIES.ViziOS` prefix (`mtk5586-…` → `MT5586`, exact match — `MT5586L` is a
  different chipset); prefer that chipset's first entry whose `[firmwareMinimum, firmwareMaximum]` contains the TV
  firmware (numeric comparison of segments split on `.` and `-`; null = unbounded), else the first `"*"` entry in range.
- Icons: download `mobileAppInfo.app_icon_image_url` once into `<dataDir>/cache/icons/<id>.png`; serve from
  `/icons/<id>.png` (id must match `/^[0-9]+$/`) so the TV UI never contacts external hosts.
- The catalog lists **available** apps; label them that way in the admin UI.

## 7. Server HTTP API

All JSON. Body limit 64 KB. Unknown routes → 404 JSON.
Static files: decode the path once, reject any `%2e`/`%2f`/`%5c` remaining after decoding, `..` segments or backslashes
(400), resolve against the fixed root (`web/tv`, `web/admin`, `<dataDir>/cache/icons`) and serve only if the resolved path
stays inside that root.

| Route | Auth | Purpose |
|---|---|---|
| `GET /healthz` | none | `{ok, version, paired, tvReachable, takeover:{state,...}}` — no identifiers |
| `GET /tv/*`, `/icons/*` | none (static) | TV UI assets |
| `GET /admin/*` | none (static) | Admin UI assets |
| `GET /api/tv/home` | `X-FMV-Token: tvUiToken` | Visible layout: `{title, theme, accent, showClock, sections:[{id,title,shortcuts:[{id,label,kind,icon}]}]}` |
| `POST /api/tv/activate` `{shortcutId}` | tvUiToken | Execute a configured shortcut (app/input/system). Never accepts raw payloads |
| `POST /api/tv/native-home` | tvUiToken | Suppress takeover and open native SmartCast home |
| `GET /api/tv/status` | tvUiToken | `{power, appClass, takeoverState}` |
| `GET/PUT /api/admin/config` | `Authorization: Bearer adminToken` | Read/replace config (validated; secrets never included) |
| `GET /api/admin/catalog` | admin | Available apps for this TV with resolved payloads |
| `GET /api/admin/inputs` | admin | Inputs with CNAMEs |
| `POST /api/admin/pair/start`, `/pair/finish {pin}`, `/pair/cancel` | admin | Pairing |
| `POST /api/admin/open-ui` | admin | Launch TV UI now |
| `POST /api/admin/takeover` `{enabled?, mode?}` | admin | Toggle takeover |
| `GET /api/admin/diagnostics` | admin | Profile/verification status, capability report (redacted), last 200 log events |
| `POST /api/admin/key` `{key}` | admin | Send a remote key (P2) |

Shortcut kinds (config): `app` (`catalogId` or explicit `payload` set **by admin only**), `input` (`cname`),
`system` (`native-home` | `power-off` | `blank-screen` (P2)).

## 8. Security model (BINDING)

Threat model: trusted home LAN; protect against other LAN devices/web pages triggering TV actions, leaking the
TV AUTH token, and DNS-rebinding attacks from browsers. Not designed for internet exposure.

1. **Secrets** in `<dataDir>/secrets.json` (mode 0600, dir 0700): `tvAuthToken`, `tvPairingDeviceId`,
   `adminToken`, `tvUiToken` (32 random bytes, base64url). Never in config, logs, API responses, or Git.
2. **Logger redaction**: values under keys matching `/token|auth|pin|password|esn|serial|diid|ifa|mac/i` are replaced
   with `"[redacted]"`; additionally every string field (recursively, including messages and URLs) has each known secret
   value replaced **as a substring** (so `.../tv/#k=<tvUiToken>` becomes `.../tv/#k=[redacted]`); the AUTH header is
   never logged. Unit-tested.
3. **Host header allow-list** (DNS-rebinding defense): parse the `Host` header canonically — strip the `:port`, handle
   bracketed IPv6 (`[::1]:8730`), lowercase names — then accept only `localhost`, `127.0.0.1`, `::1`, the
   `publicBaseUrl` host, and the server's own interface IPs; else 421. Test with `Host: <LAN-IP>:8730` (what the TV sends).
4. **Tokens**:
   - Admin API: header exactly `Authorization: Bearer <adminToken>` (scheme case-insensitive, single space; missing,
     malformed, or wrong → 401 with no detail). The admin link `http://<publicBaseUrl host>:<port>/admin/#t=<adminToken>`
     is printed **only** by the interactive CLI command `fmv admin-url` (refuses when stdout is not a TTY) — never by the
     server or the logger. On first start the server logs only "run `npm run cli -- admin-url` to get the admin link".
     The admin UI reads `#t=`, stores it in `localStorage`, and immediately calls `history.replaceState` to remove it.
   - TV UI API: header `X-FMV-Token: <tvUiToken>`; the token is delivered in the launch URL **fragment** (`#k=`), never a
     query string; the TV UI removes it with `history.replaceState` and keeps it in memory only.
   - Comparisons use `crypto.timingSafeEqual` on equal-length buffers. No CORS headers are emitted (same-origin only).
5. **TV UI content**: served only from this server. Response headers on HTML:
   `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'`,
   `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`. Rationale: any page in Conjure can reach the
   Companion Library's privileged functions (`getAuthToken`, `esn`, …) — verified present.
6. **Companion Library**: not loaded in P1. If enabled later (P2 flag), allow-list only
   `http://127.0.0.1:12345` in `script-src` and wrap usage in `web/tv/js/vizio.js` exposing only approved
   functions; never call `getAuthToken`, `getAppAuthToken`, `esn`, `dsn`, `getMACAddress`, `setActivityDataPolicyAccepted`,
   `setPowerMode`, `softPowerCycle`, Bluetooth/HomeKit functions.
7. **Action denylist** in `triggerAction`/`setSetting`: `support/factory_reset`, `support/restart_tv`,
   `support/check_for_updates`, `network/*`, `system/parental_controls/*` → throw. Settings writes are limited to
   an explicit allow-list per milestone.
8. Bind `0.0.0.0` by default (the TV must reach it); docs warn never to port-forward.

## 9. Configuration and persistence

Data dir: `$FMV_DATA_DIR` or `~/.free-my-vizio/` (0700). Files: `config.json`, `secrets.json` (0600),
`cache/catalog-apps.json`, `cache/catalog-availability.json`, `cache/icons/`. Writes are atomic
(write `*.tmp` then `rename`). Corrupt config ⇒ refuse to start with a clear error (do not overwrite).

```jsonc
// config.json (schemaVersion 1)
{
  "schemaVersion": 1,
  "tv": { "host": "192.168.x.y", "port": 7345, "deviceId": null /* DIID, filled after pairing */ },
  "server": { "port": 8730, "bindHost": "0.0.0.0", "publicBaseUrl": null /* auto: LAN IP on TV subnet */ },
  "takeover": { /* §5.1 */ },
  "home": {
    "title": "Living Room", "theme": "dark" /* dark|light|oled */, "accent": "#f0f2f1", "showClock": true,
    "sections": [
      { "id": "apps", "title": "Apps", "shortcuts": [
        { "id": "netflix", "kind": "app", "label": "Netflix", "catalogId": "34", "hidden": false },
        { "id": "youtube", "kind": "app", "label": "YouTube", "catalogId": "44", "hidden": false } ] },
      { "id": "inputs", "title": "Inputs", "shortcuts": [
        { "id": "hdmi1", "kind": "input", "label": "HDMI 1", "cname": "hdmi1", "hidden": false } ] },
      { "id": "system", "title": "System", "shortcuts": [
        { "id": "native-home", "kind": "system", "label": "SmartCast Home", "action": "native-home", "hidden": false } ] }
    ]
  },
  "catalog": { "refreshHours": 24 }
}
```

The `native-home` shortcut is mandatory and cannot be hidden (validation rule) — it is the user's escape hatch.

## 10. TV UI design constraints

- Layout for **1280×720 CSS px** (verified viewport); keep 48 px horizontal / 32 px vertical safe margins.
- Spatial navigation in `web/tv/js/focus.js` as **pure functions** over a grid model
  (`moveFocus(model, current, direction) → next`), unit-testable in Node.
- Keys: `ArrowUp/Down/Left/Right` (38/40/37/39) move; `Enter` (13) activates; `Backspace` (8) = Back: close
  overlay, else return focus to the first tile; never exit. Match on `e.key` with `keyCode` fallback; call
  `preventDefault()` on handled keys.
- Visible focus: ≥4 px outline + scale; tiles ≥ 200×112 px; text ≥ 22 px.
- On load: `GET /api/tv/home`; on failure show an offline banner and retry with backoff (1 s → 30 s); never blank.
- Activation feedback: spinner on tile; on error show toast with a short message.

## 11. Error handling

| Situation | Behavior |
|---|---|
| TV unreachable | Supervisor marks `UNREACHABLE`, keeps polling; admin shows status; no crash |
| 403 REQUIRES_PAIRING / 401 | Supervisor stops launching, status `NEEDS_PAIRING`; admin prompts re-pair |
| Launch fails | Log warn, cooldown applies; loop guard after repeated failures |
| HASHVAL error | Retry once with fresh GET; then surface `TvHashvalError` |
| Catalog fetch fails | Use cache → fallback; log once per refresh |
| Config invalid on PUT | 400 with field errors; nothing written |
| Server crash | Process manager (systemd/launchd/docker restart policy) restarts; TV falls back to native behavior meanwhile |

## 12. Deployment model

- **Dev**: `npm start` on the Mac. Takeover works only while the Mac is awake and on the LAN.
- **Always-on**: any Linux host with Node ≥ 22.18 (Raspberry Pi 4/5, NAS, mini-PC). `deploy/systemd` unit runs
  `node /opt/free-my-vizio/src/main.ts` as an unprivileged user with `Restart=always` and
  `Environment=FMV_DATA_DIR=/var/lib/free-my-vizio`. Docker optional, `network_mode: host` required.
- Recommend DHCP reservations for both TV and host. If the TV IP changes, `fmv discover` (and the supervisor
  after 10 min unreachable) scans the host's /24 for `:7345/state/device/deviceinfo` with matching `DIID`.
- TV prerequisite: **System → Power → Input at Power On = SmartCast** (current value). With "Last Used TV Input" the TV
  may power on to an HDMI input and takeover will (correctly) not trigger. `doctor` reports this setting.

## 13. Testing strategy

| Layer | How | Proves |
|---|---|---|
| Unit | `node:test`, fake transport + fake clock | Payload shapes, key codes, classification, state machine, HASHVAL retry, catalog selection, config validation, redaction, focus logic |
| Integration | `test/mock-tv/mock-tv.ts` HTTPS server (test-only cert) serving `docs/evidence` fixtures; scenario API to set power/app/unreachable | Client against TLS, pairing flow, supervisor end-to-end, HTTP API auth/host checks |
| Manual (hardware) | Checklists in `docs/MANUAL_TESTS.md` (created in M4) | Real TV behavior. **Simulated tests never establish hardware compatibility** |

## 14. Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Firmware modification / root | No method for this chassis; brick/warranty risk; unnecessary for core goals |
| Google Cast custom receiver | Needs Google registration and device whitelisting; remote-key delivery unproven; still no auto-start |
| Serverless page using only the Companion Library (prior art S6) | No automatic startup/takeover; still needs hosting; would rely on privileged in-page APIs. Kept as optional enhancement |
| External streaming box as home via CEC + "Last Used TV Input" | Extra hardware; loses tight native-app integration; valid user alternative, out of scope |
| Reusing `@get-air/vizio` / `pyvizio` / Home Assistant | get-air: fast-moving 0.x with heavy Effect dependency; pyvizio/HA: Python/HA stack and path assumptions that differ from this firmware. Our surface is ~12 endpoints → thin own client, using them as references |
| UI framework / bundler | Unnecessary on Chrome 128; adds build tooling |
| Database / cloud backend | Config is tiny and local |
| WebSocket push from TV | Ports 8005/8006 closed — polling only |

## 15. Remaining architectural uncertainties

Long-standby takeover, cold-boot timing, firmware-update drift, setting-write behavior, extra remote keys, and
interaction with native dialogs (see feasibility §12). The design contains them via: profiles + verification
warnings, loop guard + suppression, `native-home` escape hatch, and fail-safe behavior (if the server is down,
the TV behaves exactly as stock).

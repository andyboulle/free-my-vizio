# Implementation Plan — Free My Vizio

Read first: [ARCHITECTURE.md](ARCHITECTURE.md) (binding contracts), [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md),
[TECHNICAL_FEASIBILITY.md](TECHNICAL_FEASIBILITY.md) §5–§8 (what the TV actually does).

Conventions for every milestone:
- Work only in the files listed; create others only if the architecture names them.
- `npm run verify` (typecheck + web syntax check + all tests) must pass at the end of each milestone.
- "Manual" tests need the real TV and a human; record results in `docs/engineering/MANUAL_TESTS.md` (from M4) with date,
  firmware, pass/fail, notes. Never mark a manual test passed based on mocks.
- Update `README.md` usage sections when commands change. Commit per milestone (no secrets; run the secret check).

Dependency graph:

```
M0 ─► M1 ─► M2 ─► M3 ─► M4 ─► M5 ─► M6 ─► M7
                          └──────────────► M8 (after M6)
                                           M9 (after M5, gated)
```

---

## M0 — Repository scaffold

**Objective** Tooling skeleton that runs TypeScript directly on Node and runs tests.
**Prerequisites** Node ≥ 22.18 (`node --version`). **Dependencies** none.
**Files** `package.json`, `tsconfig.json`, `.gitignore` (exists; keep entries), `README.md`, `scripts/check-web.mjs`,
`test/unit/smoke.test.ts`, `.editorconfig`.

Instructions
1. `package.json`: `"name":"free-my-vizio"`, `"private":true`, `"type":"module"`, `"engines":{"node":">=22.18"}`,
   scripts per ARCHITECTURE §3, devDependencies `typescript@^5.8`, `@types/node@^22`. No runtime dependencies.
2. `tsconfig.json` exactly per ARCHITECTURE §2.
3. `scripts/check-web.mjs`: walk `web/**/*.js`, run `node --check` on each, exit non-zero on failure (handle "no files").
4. Smoke test asserting `1+1===2` to prove the runner works with `.ts`.
5. README: project one-liner, status, link to docs, prerequisites, `npm install`, `npm run verify`.

Tests `npm run verify` passes.
Acceptance `npm install && npm run verify` exits 0 on a clean clone; `npm ls --prod` shows no dependencies.
Risks Node < 22.18 lacks unflagged type stripping → document version check in README.
Deliverables scaffold commit.

---

## M1 — SmartCast client + mock TV

**Objective** Typed, tested client for the TV API (ARCHITECTURE §6.1–6.4).
**Prerequisites** M0. **Dependencies** none external.
**Files** `src/tv/errors.ts`, `src/tv/transport.ts`, `src/tv/keys.ts`, `src/tv/smartcast-client.ts`,
`src/util/clock.ts`, `test/mock-tv/mock-tv.ts`, `test/fixtures/tls/{test-cert.pem,test-key.pem,README.md}`,
`test/unit/keys.test.ts`, `test/unit/smartcast-client.test.ts`, `test/integration/client-mock-tv.test.ts`.

Instructions
1. `transport.ts`: `TvConnection` (ARCHITECTURE §6.2) and `createTvTransport(connection)` returning
   `request(method, path, body?, {auth?: boolean, timeoutMs?}) → {status, json, text}`. Use a dedicated
   `https.Agent({rejectUnauthorized:false, keepAlive:true, maxSockets:2})`. Add `AUTH` header when `auth!==false` and a token
   exists, reading host/port/token from the `TvConnection` on every request. Map socket errors/timeouts to
   `TvUnreachableError`. Export a `TvTransport` interface so tests can inject fakes. HASHVAL transactions are serialized
   by a client-wide async mutex in `smartcast-client.ts` (ARCHITECTURE §6.1), released on success and failure.
2. Envelope handling: success iff HTTP 200 and `json.STATUS.RESULT` (case-insensitive) is `SUCCESS`.
   403 or `REQUIRES_PAIRING` → `TvAuthError`; HASHVAL-related results (`HASHVAL_ERROR`, `INVALID_PARAMETER` on a PUT
   with HASHVAL) → `TvHashvalError`; pairing results → `TvPairingError`; other → `TvCommandError`; unparseable → `TvProtocolError`.
3. `keys.ts`: `KEY_CODES` record exactly per ARCHITECTURE §6.3 and `type KeyName`.
4. `smartcast-client.ts`: implement every method in ARCHITECTURE §6.2. Paths:
   deviceinfo `/state/device/deviceinfo`; power `/state/device/power_mode`; pairing `/pairing/start|pair|cancel`;
   current app `/app/current`; launch `/app/launch`; keys `/key_command/`; inputs
   `/menu_native/dynamic/tv_settings/devices/name_input` and `.../current_input`; settings
   `/menu_native/dynamic/tv_settings/<path>`. `parseDeviceInfo()` maps `ITEMS[0].VALUE` fields
   (`MODEL_NAME`, `SYSTEM_INFO.VERSION`, `API_VERSION`, `BINARIES.ViziOS`, `BINARIES.conjure`, `SYSTEM_INFO.DIID`,
   `CAST_NAME`, `CAPABILITIES`); `chipsetKey` = `BINARIES.ViziOS.split('-')[0].replace(/^mtk/i,'MT').toUpperCase()`.
   `setInput` must GET `current_input` immediately before the PUT and send the lowercase cname.
   `setSetting` retries exactly once on `TvHashvalError`. `triggerAction` sends `{"REQUEST":"ACTION","HASHVAL":h}` and
   enforces the denylist (ARCHITECTURE §8.7).
5. Generate the test-only cert: `openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=BG2.prod.vizio.com" -keyout test-key.pem -out test-cert.pem`; README states "TEST ONLY, not a secret".
6. `mock-tv.ts`: HTTPS server on an ephemeral port implementing the endpoints above using fixtures from
   `docs/evidence/` plus in-memory state: `power`, `currentApp`, `currentInput`, `hashvals`, `paired token`,
   `pin`, `unreachable` (when true, destroy sockets). Rules to reproduce verified behavior: unauthenticated
   `/app/current` → 403 `REQUIRES_PAIRING`; `current_input` PUT with display name → `FAILURE`, with cname → `SUCCESS`
   and HASHVAL rotates; stale HASHVAL → `HASHVAL_ERROR` (configurable "race once"). Expose a control object for tests and
   a request log (method, path, body, headers minus AUTH value).

Tests (automated)
- keys: POWER_ON=(11,1), POWER_OFF=(11,0), HOME=(4,15), every entry unique.
- client against fake transport: exact JSON bodies for launchApp, launchUrl (NS4/"17"), sendKey, setInput, setSetting, pairing.
- integration against mock TV over TLS: pair flow (start→finish→token), wrong PIN → `TvPairingError('PAIRING_DENIED')`,
  getDeviceInfo parses fixture (`model==='M65Q6-L4'`, `firmware==='86.910.19.2-1'`, `chipsetKey==='MT5586'`),
  unauthenticated getCurrentApp → `TvAuthError`, setInput uses cname, HASHVAL race retried once, unreachable → `TvUnreachableError` within timeout,
  `triggerAction('support/factory_reset')` throws without any request being sent.
- AUTH header value never appears in any thrown error message (assert on `String(err)`).
- Two concurrent `setSetting` calls on the same path both succeed (second uses a fresh HASHVAL); a failing transaction
  followed by another succeeds (mutex not poisoned).
- `connection.update({host, authToken})` takes effect on the next call without recreating the client; `CallOptions.timeoutMs` honored.

Acceptance all tests pass; no `any` in public signatures; mock request log shows `AUTH` header present on authed calls only.
Risks fixture paths differ per firmware → client takes paths as data, not hard-coded per model beyond those above.
Deliverables client + mock + tests.

---

## M2 — Config, secrets, logging, CLI (pair / doctor)

**Objective** Persist config and secrets safely; pair with the real TV from the CLI; produce a capability report.
**Prerequisites** M1. **Dependencies** none.
**Files** `src/config/{paths,schema,store}.ts`, `src/util/{log,net}.ts`, `src/tv/discovery.ts`, `src/cli.ts`,
tests `test/unit/{config,log,net,discovery}.test.ts`.

Instructions
1. `schema.ts`: types + `DEFAULT_CONFIG` exactly as ARCHITECTURE §9/§5.1; `validateConfig(x) → {ok, errors[]}` (no library;
   hand-written checks: types, ranges `pollMs 250–10000`, unique shortcut ids, `native-home` present and not hidden,
   `cname` matches `/^[a-z0-9_]+$/`); `migrateConfig()` (identity for v1).
2. `store.ts`: data dir creation (0700), atomic writes, secrets file 0600 (verify with `fs.statSync().mode & 0o777`);
   `generateToken()` = 32 random bytes base64url. On first run create `adminToken`, `tvUiToken`, and a stable
   `tvPairingDeviceId` = `fmv-` + 16 hex.
3. `log.ts`: `log.info/warn/error/debug(event, fields)` → JSON line to stdout; redaction per ARCHITECTURE §8.2
   (recursive, case-insensitive keys; plus **substring** replacement of every known secret value in every string field);
   ring buffer (500). `log.registerSecret(value)` is called for each secret on load and after pairing/rotation.
4. `net.ts`: `pickLanAddress(tvHost)` → IPv4 of a non-internal interface on the same /24 as the TV, else first non-internal IPv4.
5. `discovery.ts`: `scanSubnet(baseIp, {concurrency:32, timeoutMs:1500})` → hosts answering
   `/state/device/deviceinfo` with `MODEL_NAME`; returns `{host, model, deviceId}`; never logs deviceId.
6. `cli.ts` commands:
   - `discover` — scan the host's /24, print host + model.
   - `pair [--host <ip>]` — save host to config, start pairing, prompt for PIN on stdin (`node:readline`), finish, save
     token to secrets and `deviceId` (DIID) to config; on Ctrl-C or error call cancel.
   - `status` — power, current app (class from M3 once available; raw NS/APP_ID now), paired yes/no.
   - `doctor` — model, firmware, API version, Conjure version, profile verification (M3), selected capability flags
     (`BootToSC`, `VIZIOAPPS_IN_CONJURE`, `CONJURE_SYSTEM_UI`), reachability, pairing state. Redacted.
   - `key <KeyName>`, `config-path`, `rotate-tokens` (adminToken, tvUiToken).
   - `admin-url` — prints `http://<publicBaseUrl host>:<port>/admin/#t=<adminToken>`; refuses (exit 1) when stdout is not a TTY.
     This is the only place a token is ever printed.

Tests config validation cases (good default, duplicate ids, hidden native-home rejected), atomic write leaves no tmp file,
secrets mode 0600, redaction (nested objects, header-like keys, secret values inside strings incl. a full
`http://h:8730/tv/#k=<token>` URL), pickLanAddress with mocked interfaces,
discovery against mock TV on 127.0.0.1.

Manual (real TV) M2-MT1: `npm run cli -- pair --host <TV_IP>` → PIN entry → `doctor` prints M65Q6-L4 / 86.910.19.2-1;
`grep -r "<first 6 chars of token>" ~/.free-my-vizio --exclude=secrets.json` finds nothing; stdout contains no token.
Acceptance automated tests pass; M2-MT1 passes.
Risks pairing `BLOCKED` if a previous attempt is pending → `pair` always calls cancel first (ignore its errors).

---

## M3 — Catalog, profiles, app classification

**Objective** Resolve launchable apps for this TV; recognize what the TV is showing.
**Prerequisites** M2. **Files** `src/catalog/{catalog,version}.ts`, `src/catalog/fallback-catalog.json`,
`src/tv/profiles/{types,m65q6-l4,generic-smartcast,index}.ts`, `src/tv/app-identity.ts`,
tests `test/unit/{catalog,version,profiles,app-identity}.test.ts`, fixtures: use `docs/evidence/catalog/vizio_apps_prod.sample.json` and `app_availability_prod.sample.json`
(already trimmed real data; raw schemas in ARCHITECTURE §6.6). They contain ≥ 15 apps incl. Netflix 34, YouTube 44, Prime Video 33 (with MT5586 entries), Disney+ 76, Hulu 19, Plex 40,
Peacock 88, Paramount+ 9, Tubi 90, Apple TV+ 91, WatchFree+ 48, XUMO 27).

Instructions
1. `version.ts`: `compareFirmware(a,b)` splitting on `.`/`-`, numeric compare, missing segments = 0; `inRange(fw,min,max)` with null = unbounded.
2. `catalog.ts`: `loadCatalog({fetch: injectable, cacheDir, now})`, `listAvailableApps(device)` → `[{catalogId,name,iconUrl,payload}]`
   using ARCHITECTURE §6.6 selection; `resolvePayload(catalogId, device)`; `refreshIcons()` downloads icons to cache (skip if exists;
   5 s timeout; ignore failures). Catalog HTTPS uses default TLS verification.
3. `fallback-catalog.json`: same schema as the joined result for the verified apps: Netflix `{3,"1"}`, YouTube `{5,"1"}`,
   Prime Video `{3,"3"}`, Disney+ `{2,"75"}`, Hulu `{2,"3"}`, Plex `{2,"9"}`, Peacock `{2,"88"}`, Paramount+ `{2,"37"}`,
   Tubi `{2,"61"}`, Apple TV+ `{3,"4"}` (all `MESSAGE:null`). Mark only Netflix, YouTube, Prime Video as `"verifiedOnTarget": true`.
4. Profiles per ARCHITECTURE §6.5. `selectProfile(info)` → `{profile, verified}`.
5. `app-identity.ts`: `classifyApp(power, app, {tvUiUrlPrefix, profile})` per ARCHITECTURE §5.2.
6. Wire `doctor`/`status` to show profile verification and app class.

Tests firmware compare (`86.900.61.1-1 < 86.910.19.2-1`), payload selection prefers MT5586 entry within range and falls back
to `*`, Blacknut-style MT5586L entry is not matched by MT5586, fallback used when fetch throws and no cache, classification table
cases taken verbatim from feasibility §8 trace (`4/1/home`→NATIVE_HOME, `4/17/<prefix>`→FMV_UI, `0/3/""`→INPUT_OR_SYSTEM,
`345/707`→STANDBY, `3/1`→APP), unknown model → generic profile with `verified=false`.
Acceptance tests pass; `npm run cli -- doctor` on the real TV reports `profile=vizio-m65q6-l4 verified=true`.

---

## M4 — HTTP server, TV UI, launching

**Objective** The TV shows our home, navigable by remote, launching apps and inputs.
**Prerequisites** M3. **Files** `src/server/{http-server,static,routes-tv,auth}.ts`, `src/main.ts`,
`web/tv/index.html`, `web/tv/css/{base,themes}.css`, `web/tv/js/{main,api,focus,render,keys}.js`,
add CLI `open`, tests `test/unit/focus.test.js` (plain JS, imports `web/tv/js/focus.js`), `test/unit/{auth,static,host}.test.ts`, `test/integration/server-tv-api.test.ts`,
`docs/engineering/MANUAL_TESTS.md`.

Instructions
1. Server per ARCHITECTURE §7–§8: router (method+path map), Host allow-list (421), JSON body parser (64 KB, 415 on
   non-JSON), security headers + CSP on HTML, static serving with traversal protection and `no-store` for HTML.
2. `/api/tv/home` builds the visible layout from config (exclude `hidden`), icon URL `/icons/<catalogId>.png` when cached.
3. `/api/tv/activate`: look up shortcut by id → `app`: resolvePayload + `launchApp`; `input`: `setInput(cname)`;
   `system`: `native-home` → `takeover.suppressAndOpenNativeHome()` (in M4 a stub that only launches the native home;
   M5 adds suppression — both routes must call the same function), `power-off` → `sendKey('POWER_OFF')`.
   Response `{ok:true}` or `{ok:false,error:{code,message}}` with 502 for TV errors, 404 unknown shortcut.
4. `main.ts`: load config/secrets (create defaults), compute `publicBaseUrl` (config or `http://<pickLanAddress>:<port>`),
   start server; log (without tokens) the TV UI base URL and "run `npm run cli -- admin-url` for the admin link".
5. CLI `open`: `launchUrl(publicBaseUrl + '/tv/#k=' + tvUiToken)`.
6. TV UI: on load read token from `location.hash` (`k=`), store in memory only, `history.replaceState` to drop the hash;
   if missing show "Open Free My Vizio from the server" message. Render sections as rows; `focus.js` exports pure
   `buildGrid(sections)` and `moveFocus(grid, pos, dir)` (left/right within row, clamp; up/down to nearest column by x-center,
   skipping empty rows); keys per ARCHITECTURE §10; activation via `POST /api/tv/activate` with spinner/toast; clock if enabled;
   offline banner with backoff retries; re-fetch home on `visibilitychange` and every 30 s.
7. `docs/engineering/MANUAL_TESTS.md`: create with the checklist below and a results table.

Tests focus model (grid edges, uneven rows, empty sections), auth (missing/wrong token 401, constant-time compare used),
Host header parsing (`<LAN-IP>:8730` accepted, `evil.example:8730` → 421, `[::1]:8730` accepted), static traversal on
both `/tv/` and `/icons/` using raw request paths sent via `http.request` (not normalized by a client): `/tv/../secrets.json`,
`/tv/%2e%2e/%2e%2e/secrets.json`, `/tv/%252e%252e/x`, `/tv/..%5c..%5cx`, `/icons/../../x` → all 400/404 and never outside the web root, activate → mock TV received exact payload, hidden shortcuts absent.
Manual MT-4.1 `npm start` then `npm run cli -- open`: UI renders within 3 s, no layout overflow at 1280×720.
MT-4.2 arrows reach every tile; OK on Netflix/YouTube/Prime Video opens each; OK on HDMI 1 switches input. MT-4.3 Back on UI does
not exit. MT-4.4 stop server while UI is open → offline banner within 35 s; restart → recovers without relaunch.
Acceptance automated + MT-4.1..4.4 pass.
Risks focus bugs on uneven grids (covered by tests); icon fetch failures (text-only tiles fallback).

---

## M5 — Home Takeover supervisor

**Objective** Our UI appears automatically after power-on and after Home (ARCHITECTURE §5).
**Prerequisites** M4. **Files** `src/supervisor/takeover.ts`, wire in `src/main.ts`, `/api/tv/native-home`,
`/api/tv/status`, `/healthz`; tests `test/unit/takeover.test.ts`, `test/integration/takeover-mock-tv.test.ts`.

Instructions
1. Implement the state machine exactly per §5.3 with injected `client`, `clock`, `config`, `log`. Use a single
   self-scheduling loop (`setTimeout` after each tick completes) — never overlapping ticks.
2. Status object published for `/healthz` and admin.
3. `native-home` endpoint sets suppression then launches native home payload from the profile.
4. On `TvAuthError` set state `NEEDS_PAIRING` and stop launching until secrets change (re-read on SIGHUP or admin pair).

Tests (fake clock + fake client): launches after confirm when home persists; suppression set during the confirm wait
prevents the launch; `STANDBY→UNREACHABLE→NATIVE_HOME` counts as a new power-on and does not clear suppression during
UNREACHABLE; a permanently failing launch still triggers cooldown and the loop guard; null `/app/current` never launches;
`/api/tv/activate` on the native-home shortcut and `/api/tv/native-home` both suppress; no launch if confirm sees power 0 (power-off race);
cooldown respected; suppression honored and cleared on standby when configured; `power-on-only` launches once per power-on;
loop guard pauses after 3 launches/60 s; no launch on FMV_UI/APP/INPUT_OR_SYSTEM; unreachable does not throw; ticks never overlap
(slow fake client). Integration with mock TV: scripted sequence from feasibility §8 produces exactly the expected launches.
Manual (real TV, record timings with a phone stopwatch or server logs):
MT-5.1 Home from our UI → our UI back ≤ 2.5 s (10 trials). MT-5.2 Netflix → Home → our UI (5 trials). MT-5.3 HDMI input stays on
HDMI (no relaunch) for 2 min. MT-5.4 power off 30 s → on (5 trials). MT-5.5 power off ≥ 10 min → on. MT-5.6 "SmartCast Home" tile → native
home stays ≥ suppressMinutes. MT-5.7 cast a YouTube video from a phone → no relaunch during cast; after stopping, our UI returns.
MT-5.8 overnight standby (≥ 8 h) → on. MT-5.9 Settings > Restart TV (user-initiated from the TV menu, not via API) → UI after boot.
Acceptance automated pass; MT-5.1–5.7 pass; MT-5.8/5.9 results recorded (pass or documented failure with logs). If MT-5.8 fails,
stop and report (critical assumption).

---

## M6 — Admin UI (pairing, layout editor, controls, diagnostics)

**Objective** Configure everything from a phone/laptop browser.
**Prerequisites** M5. **Files** `src/server/routes-admin.ts`, `web/admin/{index.html,admin.js,admin.css}`,
tests `test/integration/server-admin-api.test.ts`.

Instructions
1. Implement admin routes per ARCHITECTURE §7. `PUT /api/admin/config` validates, saves atomically, applies takeover/poll changes
   live, never returns secrets. Pair endpoints wrap the client and persist the token.
2. Admin UI: token read from `#t=`, saved to `localStorage`, then `history.replaceState` removes the fragment; views: Status (supervisor, TV, verification warnings),
   Home layout (sections, add app from catalog list with search, add input from `/api/admin/inputs`, reorder with up/down
   buttons, hide/unhide, rename label, delete; `native-home` cannot be deleted/hidden), Takeover (enabled/mode/suppress minutes),
   Pairing, Diagnostics (recent events). Text: "Hidden here only — apps are not removed from the TV."
3. TV UI picks up changes on its 30 s refresh or `visibilitychange`.

Tests admin auth (401 without token), config round-trip, invalid config 400 with errors and file unchanged, secrets absent from every
admin response (scan JSON for token values), pairing via mock TV.
Manual MT-6.1 hide Netflix in admin → gone from TV UI within 35 s. MT-6.2 reorder → reflected. MT-6.3 restart server → layout persists.
Acceptance automated + MT-6.1–6.3 pass.

---

## M7 — Deployment and resilience

**Objective** Run unattended on an always-on host.
**Prerequisites** M6. **Files** `deploy/systemd/free-my-vizio.service`, `deploy/launchd/com.freemyvizio.server.plist`,
`deploy/docker/{Dockerfile,compose.yaml}`, `docs/INSTALL.md`, rediscovery in `src/main.ts`/`discovery.ts`, tests.

Instructions
1. systemd: `User=fmv`, `Environment=FMV_DATA_DIR=/var/lib/free-my-vizio`, `ExecStart=/usr/bin/node /opt/free-my-vizio/src/main.ts`,
   `Restart=always`, `RestartSec=5`, `NoNewPrivileges=true`, `ProtectSystem=strict`, `ReadWritePaths=/var/lib/free-my-vizio`.
2. launchd plist with `KeepAlive`, `RunAtLoad`, log paths in `~/Library/Logs/free-my-vizio/`.
3. Docker: `node:22-alpine`, copy `src web package.json`, `USER node`, volume `/data`, `FMV_DATA_DIR=/data`; compose with `network_mode: host`.
4. Rediscovery: if TV unreachable > 10 min while `config.tv.deviceId` known, scan /24 every 10 min; on match update `tv.host`.
5. `docs/INSTALL.md`: install steps (Pi OS / Ubuntu / macOS), DHCP reservation advice, firewall note, upgrade, backup of data dir,
   "never port-forward", how to migrate pairing (copy data dir).

Tests rediscovery with mock TV moved to another port/host alias; graceful shutdown on SIGTERM (server closes, loop stops).
Manual MT-7.1 install on the always-on host, reboot host → service up and takeover works. MT-7.2 48 h soak: no crash, memory < 120 MB,
log output < 10 MB per 24 h at the default `info` level (journald/launchd handle storage; document `newsyslog`
rotation for the launchd log path in docs/INSTALL.md).
Acceptance MT-7.1/7.2 pass; product acceptance criteria (PRD §10) evaluated and recorded.

---

## M8 — TV controls and privacy panel (P2)

**Objective** Volume/mute/power/blank and privacy visibility; guarded privacy writes.
**Prerequisites** M6. **Files** extend `routes-admin.ts`, `routes-tv.ts` (system shortcuts), `web/admin`, tests.

Instructions
1. Admin "Remote" card: VOL_UP/VOL_DOWN/MUTE_TOGGLE/POWER_OFF/POWER_ON/BLANK (`triggerAction('system/power/blank_screen')` — path from fixture).
2. Privacy card (read-only): `privacy_and_legal/vizio_viewing_data`, `privacy_and_legal/advertising/limit_ad_tracking`.
3. **Gate**: before enabling writes, perform manual test MT-8.1 with the user's explicit approval: (a) write each privacy
   setting's **current** value back (no-op) via `setSetting` and confirm `SUCCESS`; (b) prove a real change round-trips on a
   harmless setting — `system/power/power_indicator` Off → On → Off — confirming in the TV menu each time. Never toggle a
   privacy setting to the less private value for testing. Only if MT-8.1 passes, enable two buttons:
   "Turn Viewing Data Off" and "Turn Limited Ad Tracking On" (only the privacy-preserving direction), each with a confirm dialog.
   Allow-list exactly these two paths (plus `power_indicator` for the test) for writes.
Tests payloads (MODIFY + HASHVAL), allow-list rejects other paths, UI never offers privacy-reducing writes.
Acceptance tests pass; MT-8.1 recorded.

## M9 — Companion Library enhancements (P2, research-gated)

**Objective** Evaluate `window.VIZIO` features that could improve UX (visibility events, extra keys).
**Prerequisites** M5. Behind config flag `tvUi.companionLibrary=false` by default.
Instructions build `web/tv/js/vizio.js` wrapper loading `http://127.0.0.1:12345/scfs/cl/js/vizio-companion-lib.js` only when enabled;
expose only `registerKeyEvents` experiment, `setVisibilityChangeHandler`, `getCurrentApp`. Add `http://127.0.0.1:12345` to `script-src`
only when enabled. Record findings in `docs/engineering/TECHNICAL_FEASIBILITY.md` §12 items 6.
Acceptance documented results; no prohibited functions referenced (`grep` test over `web/`).

## Not scheduled (P3)
Firmware research, network-filter integration guide, other Vizio models (procedure: capture fixtures with redaction, add profile,
run MT-4/MT-5 checklists).

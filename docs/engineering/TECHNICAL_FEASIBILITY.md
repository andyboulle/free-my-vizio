# Technical Feasibility Report — Free My Vizio

Status: research phase complete for the critical path (2026-10-26). Hardware experiments were run
on the actual target. Remaining open items are listed in §12.

## 1. Target and test environment

| Item | Value | How established |
|---|---|---|
| Model | Vizio **M65Q6-L4** (M-Series Quantum, 65") | `deviceinfo.MODEL_NAME`, AirPlay TXT `model=`, Cast TXT `md=` — **VERIFIED** |
| Firmware | **86.910.19.2-1** | `deviceinfo.SYSTEM_INFO.VERSION`, settings `system/tv_information/tv/firmware`, AirPlay TXT `fv=p20.86.910.19.2-1` — **VERIFIED** |
| "Software 86.910.19.2-1.7" | Not exposed by any API read. The `-1.7` suffix appears only in the on-screen menu; most likely a sub-build of the same firmware line. | **PLAUSIBLE** (no Vizio doc defines it) |
| OS | ViziOS `mtk5586-1.8.1657.1` (Linux, hostname `LinuxTV.local`) | `deviceinfo.BINARIES.ViziOS`, mDNS — **VERIFIED** |
| SoC family | MediaTek MT5586-class (Vizio catalog chipset key `MT5586`) | `ViziOS` prefix `mtk5586`; catalog keys — **DOCUMENTED** (no teardown of this SKU) |
| SmartCast API | `3.7.2-2621.0005` (SCPL), HTTPS port **7345** | `deviceinfo.API_VERSION` — **VERIFIED** |
| HTML runtime | **Conjure 128.1.8**, UA `VIZIO M65Q6-L4 VIZIO SmartCast/1.8.1657.1; AppleWebKit/537.36 Chrome/128.0.6613.194 (Conjure/128.1.8)` | Captured from the TV's own HTTP request — **VERIFIED** |
| Other runtimes | Cobalt 25 LTS (YouTube), Cast built-in (`castshell 0.910.0.20`, cast build 1.68 / 2025-08-29), AirPlay (`vzairplayd 35.910.31`), Apple TV app | `deviceinfo.BINARIES`, `:8008/setup/eureka_info` — **VERIFIED** (presence only) |
| Dev machine | macOS, Node v23.7.0, same /24 Wi-Fi LAN as the TV | — |

Sanitized raw captures: [`docs/evidence/`](../evidence/README.md).

## 2. Evidence classes used

**VERIFIED** (demonstrated on this exact model+firmware, reproducible) · **DOCUMENTED** (reliable
docs/source, not tested here) · **PARTIALLY VERIFIED** · **PLAUSIBLE** · **UNSUPPORTED** (no credible
evidence) · **BLOCKED** (investigated under stated conditions and does not work).

## 3. Key conclusions (one screen)

1. **The TV will load and run our own LAN-hosted HTML app** in its Conjure (Chromium 128) runtime via
   `PUT /app/launch {NAME_SPACE:4, APP_ID:"17", MESSAGE:"http://<server>/..."}`. **VERIFIED.**
2. **Remote navigation works**: D-pad, OK and Back arrive as standard DOM key events
   (ArrowUp/Down/Left/Right 38/40/37/39, Enter 13, Backspace 8). Back is *not* intercepted by the TV. **VERIFIED.**
3. **Our app can launch native apps and switch inputs** through a local backend (SmartCast API), and also
   in-page via the TV's built-in Companion Library (`window.VIZIO.launchApp`). **VERIFIED.**
4. **The native SmartCast home cannot be replaced or re-bound.** Home always returns to the native home
   (itself a Conjure bundle, `NAME_SPACE 4 / APP_ID "1"`). No API to install apps, pin tiles, uninstall,
   or change the startup app was found anywhere. **BLOCKED / UNSUPPORTED.**
5. **Automatic startup is achievable with a workaround**: an always-on backend polls `/app/current`
   and relaunches our app whenever the native home is showing. Measured: native home visible ≈0.4–1.5 s
   after power-on or Home (1 s polling) before our UI replaces it; worked after a 2-minute standby and when
   the TV was powered on via the API. **VERIFIED (short-term)**; overnight/long-standby, full reboot and
   firmware-update behavior are **unverified**.
6. **Firmware modification**: no documented or reproducible root method exists for this 2021+ MediaTek
   chassis; the only Vizio CVEs (2021-27942/3/4) concern 2017–2018 models. **Not recommended.**
7. **Privacy**: "Viewing Data" (ACR) and "Limited Ad Tracking" are exposed in the settings API; on this TV
   they are already **Off** / **On** respectively. Writes are structurally possible but **untested**.

**Overall recommendation: Outcome B — a near-native custom experience** (custom Conjure UI + local backend
+ "home takeover" watchdog). Details in §11.

## 4. Sources

| # | Source | What it supports |
|---|---|---|
| S1 | [exiva/Vizio_SmartCast_API](https://github.com/exiva/Vizio_SmartCast_API) (README) | De-facto protocol reference: pairing, `AUTH` header, key codesets, settings/HASHVAL, app launch, Eco-mode caveat |
| S2 | [raman325/pyvizio](https://github.com/raman325/pyvizio) (`pyvizio/const.py`, `api/_protocol.py`) | Endpoint constants, `APP_HOME` = NS4/APP_ID 1, `EQUIVALENT_NAME_SPACES=(2,4)`, `ssl=False` |
| S3 | [raman325/vizaio](https://github.com/raman325/vizaio) (`client.py`, `apps.py`, `docs/protocol-notes.md`) | Current HA backend: hardware-verified quirks — input writes need CNAME, single HASHVAL retry, `REQUEST:"ACTION"` for action items, token durability, mute collapse, `INPUT_NEXT` no-op |
| S4 | [get-air/vizio](https://github.com/get-air/vizio) (`src/Client.ts` `launchConjureUrl`, `src/Apps.ts`, README) | Conjure launch = NS4 / APP_ID 17 / URL in MESSAGE; states it does **not** install or pin an app; scoped TLS relaxation |
| S5 | Vizio's hosted Conjure launcher `vizio-pm.s3-us-west-1.amazonaws.com/conjure-launcher.html` | First-party confirmation of the APP_ID 17 launch payload and the self-signed-cert workaround |
| S6 | [Chibyume/free-my-tv-vizio](https://github.com/Chibyume/free-my-tv-vizio) (`native-adapter.js`, README) | Prior art: a hosted Conjure launcher page using the Companion Library at `http://127.0.0.1:12345/scfs/cl/js/vizio-companion-lib.js`; states "does not ... start automatically at boot" |
| S7 | Vizio public catalog `https://scfs.vizio.com/appservice/vizio_apps_prod.json` + `app_availability_prod.json` | App names/icons and per-chipset launch payloads (fetched live: 346 apps; NS2=342, NS3=8, NS5=2, NS0=2, NS4=1) |
| S8 | [Home Assistant Vizio integration docs](https://www.home-assistant.io/integrations/vizio/) + issues #181206, #181128, #179254, #176368, #181309 | Eco Mode prevents network power-on; real-world failure modes (404 vs JSON soft errors, missing `volume`, `_UNKNOWN_APP` on HDMI) |
| S9 | L9 Group advisories; NVD CVE-2021-27942/27943/27944 | Historical (2017–18 model) Vizio vulnerabilities; SCPL package install mechanism |
| S10 | [SFC v. Vizio](https://sfconservancy.org/copyleft-compliance/vizio.html) | GPL source not confirmed released; litigation ongoing |
| S11 | arXiv 1911.03447 (Varmarken et al., PETS 2020); arXiv 2409.06203 (Anselmi et al., 2024 ACR study) | Smart-TV tracking literature; **neither measures Vizio** |
| S12 | FTC/NJ 2017 Vizio settlement (via Wikipedia citation chain; FTC site blocked automated fetch) | ACR requires opt-in since 2017 |
| S13 | [shibicb72-design/local_tv_os PR #8](https://github.com/shibicb72-design/local_tv_os/pull/8) | Community port scan of a 2025 VIZIO OS TV: no ADB/SSH/telnet — consistent with our scan |

Detailed research notes with line-level citations were produced during research; the conclusions that
matter for implementation are reproduced in this document.

## 5. SmartCast API capability matrix (target device)

Base: `https://<TV_IP>:7345`, self-signed cert (CN `BG2.prod.vizio.com` per S1) → TLS verification must be
disabled **for the TV host only**. Auth header: `AUTH: <token>` (not `Authorization`).
Responses use a JSON envelope `{"STATUS":{"RESULT":"SUCCESS"|...,"DETAIL":...}, ...}`; unpaired requests
return **HTTP 403** with `RESULT:"REQUIRES_PAIRING"` (VERIFIED).

| Capability | Endpoint / mechanism | Docs | Impl. | Target evidence | Reversible | Notes / failure modes |
|---|---|---|---|---|---|---|
| Discovery | mDNS `_viziocast._tcp` (TXT has `did`, `esn`, MACs, `hsp=7345`); also `_googlecast._tcp`, `_airplay._tcp` | S2,S3 | pyvizio, vizaio, get-air | **VERIFIED** (mDNS). SSDP: TV did **not** answer `ssdp:all` or DIAL STs — **BLOCKED** for SSDP | n/a | Use mDNS or manual IP. TXT contains ESN/MACs → treat as sensitive |
| Device info | `GET /state/device/deviceinfo` (**no auth**) | S1–S3 | all | **VERIFIED** | n/a | Contains serial, DIID, ad ID → never log raw |
| Firmware/model | deviceinfo `SYSTEM_INFO.VERSION`, `MODEL_NAME`; `tv_settings/system/tv_information/tv/*` | — | — | **VERIFIED** | n/a | This tree differs from pyvizio/vizaio hard-coded paths (no `system_information`, no `admin_and_privacy`) → discover, don't hard-code |
| Power state | `GET /state/device/power_mode` (**no auth**) → `VALUE` 1=on, 0=standby | S1 | all | **VERIFIED** | n/a | In standby `/app/current` = NS345/APP 707 `dtv-system://power` |
| Pairing | `PUT /pairing/start` → `/pairing/pair` (PIN) ; `/pairing/cancel` | S1–S5 | all | **VERIFIED** (CHALLENGE_TYPE 1, 4-digit PIN) | Yes (token can be discarded) | Re-pair with same DEVICE_ID invalidates old token (S3). `BLOCKED`/`MAX_CHALLENGES_EXCEEDED` → user must retry later/power-cycle. Always cancel abandoned attempts |
| Token lifetime | — | S3 | — | Worked for the whole session (~20 min) | — | S3: no TTL observed. Long-term: **PLAUSIBLE** |
| Current app | `GET /app/current` | S1–S4 | all | **VERIFIED** | n/a | Native home: `NS4/APP_ID "1"/MESSAGE {"app":"home","bundle":"bundles/home"}`. On HDMI: `NS0/APP_ID "1"` or `"3"`, MESSAGE `""` (VERIFIED; differs from pyvizio's "NS0 = home" assumption) |
| Launch native app | `PUT /app/launch {"VALUE":{NAME_SPACE,APP_ID,MESSAGE}}` | S1–S4,S7 | all | **VERIFIED**: YouTube NS5/1, Netflix NS3/1, Prime Video NS3/3 | Yes | Payload per catalog + chipset/firmware range |
| Launch custom URL (Conjure) | same, `NS4 / APP_ID "17" / MESSAGE <url>` (APP_ID "3" also worked) | S4,S5 | get-air | **VERIFIED** with `http://<LAN IP>:port/` | Yes (transient) | Nothing is installed; no tile created |
| App list (installed) | **none on TV**; cloud catalog S7 | S2–S4 | all use catalog | **UNSUPPORTED** (no TV endpoint) | n/a | Catalog = available apps, not "installed" |
| Inputs list | `GET .../devices/name_input` | S1–S3 | all | **VERIFIED** (cast, hdmi1-3, comp, tuner) | n/a | — |
| Input switch | `PUT .../devices/current_input {"REQUEST":"MODIFY","VALUE":"hdmi1","HASHVAL":<fresh>}` | S3 | vizaio, get-air | **VERIFIED**: CNAME `hdmi1` → SUCCESS; display name `HDMI-1` → FAILURE | Yes | Always GET fresh HASHVAL first |
| Remote keys | `PUT /key_command/ {"KEYLIST":[{"CODESET","CODE","ACTION":"KEYPRESS"}]}` | S1–S4 | all | **VERIFIED**: POW_OFF (11,0), POW_ON (11,1) | Yes | Full table in ARCHITECTURE §6. `INPUT_NEXT` reported no-op (S3); mute codes collapse to toggle on TVs (S3) |
| Power on from standby | key POW_ON | S1,S8 | all | **VERIFIED after ~2 min standby** | Yes | API unreachable for ~1 min windows during standby (observed). Eco mode would block it (S8); no Eco/Quick Start setting exists in this TV's menu tree. Overnight standby: **unverified** |
| Volume/mute | keys (5,x); `audio/volume` leaf | S1,S3 | all | **DOCUMENTED** | Yes | Read `audio/volume` leaf directly (S8 #179254) |
| Settings read | `GET /menu_native/dynamic/tv_settings/...` | S1–S3 | all | **VERIFIED** (415 items crawled) | n/a | Fixture in `docs/evidence` |
| Settings write | `PUT ... {"REQUEST":"MODIFY","HASHVAL","VALUE"}`; action items `REQUEST:"ACTION"` | S1,S3 | all | **DOCUMENTED**, not exercised | Usually | Retry once on HASHVAL error. Do **not** touch `support/factory_reset`, `support/restart_tv` |
| Input at power on | `system/power/input_at_power_on` (T_LIST_X_V1) ∈ {`SmartCast`, `Last Used TV Input`} | — | — | **VERIFIED (read)**; current = SmartCast | Yes (UI) | Writing untested |
| Hide inputs | `system/manage_input_list/hide/hdmi{1..3}` (Visible/Hidden) | — | — | **VERIFIED (read)** | Yes | Write untested |
| Privacy | `privacy_and_legal/vizio_viewing_data` (Off), `.../advertising/limit_ad_tracking` (On), `.../advertising/tvad_id_reset` (action) | — | — | **VERIFIED (read)** | Yes | Write untested |
| Uninstall / hide / disable apps on TV | — | none | none | **UNSUPPORTED** | — | No endpoint in any client, docs, or the official-app route table cited by S3 |
| Change Home button / default launcher | — | none | none | **UNSUPPORTED** (and Home → native home **VERIFIED**) | — | — |
| Push events / websockets | mDNS advertises `wp=8005`/`wsp=8006` | — | none | **BLOCKED**: ports closed | — | Polling is the only state mechanism |
| DIAL | `:8008/apps/*` | S3 | — | **BLOCKED**: 404 for YouTube/Netflix/ChromeCast | — | Not useful |
| Cast receiver route | Cast built-in on :8008/8009 | Google Cast docs | pychromecast | **PLAUSIBLE** (not tested) | — | Requires registered receiver; D-pad delivery to receivers unproven. Inferior to Conjure; not pursued |

## 6. Conjure runtime findings

| Question | Finding | Class |
|---|---|---|
| Launch mechanism | `/app/launch` NS4 + APP_ID "17" (Vizio's own launcher) with URL in MESSAGE; APP_ID "3" also worked | VERIFIED |
| LAN-hosted content | Plain `http://<private IP>:<port>/` loads; no allow-list observed | VERIFIED |
| Engine | Chrome 128.0.6613.194; viewport **1280×720 CSS px**, `devicePixelRatio 1.5` (1080p panel) | VERIFIED |
| Modern web platform | `fetch`, `WebSocket`, Promises, ES modules, optional chaining, CSS Grid, IndexedDB, `localStorage` (persisted across launches: counter reached 8) | VERIFIED |
| Service workers | Unavailable (`isSecureContext=false` on http) | VERIFIED (http only) |
| Backend communication | `fetch` POST to the LAN backend (CORS) works | VERIFIED |
| Direct TV API from page | `fetch('https://127.0.0.1:7345/...')` and `https://<TV_IP>:7345` → `TypeError: Failed to fetch` | BLOCKED (cert/CORS) → backend required for SmartCast API |
| Remote input | ArrowUp/Down/Left/Right, Enter, Backspace(Back) delivered as keydown/keyup. Play/Pause, Info, CC produced **no** events during the test (remote may lack some keys) | VERIFIED / unverified for media keys |
| Home / Exit / app buttons | Handled by the TV: Home → native SmartCast home; app buttons open the app | VERIFIED |
| Companion Library | `http://127.0.0.1:12345/scfs/cl/js/vizio-companion-lib.js` loads into our LAN page; fires `VIZIO_MODULES_READY`, `VIZIO_LIBRARY_DID_LOAD`; `window.VIZIO` has 196 members; `window.VIZIO_MODULES` = App, Bluetooth, Captions, Device, System, TextToSpeech, User, Account, Tuner. `window.VIZIO_APPS` **absent** | VERIFIED |
| In-page app launch | `VIZIO.launchApp(3,"3",null,cb)` → callback `"SUCCESS"`, Prime Video opened | VERIFIED |
| Other library members (unexercised) | `getCurrentApp`, `setVisibilityChangeHandler`, `registerKeyEvents`, `getInputUIList`, `exitApplication`, `gotoPreviousApp`, `setPowerMode`, `getAvailablePowerModes`, `displaySidebarMenu`, TTS, … | DOCUMENTED (presence only) |
| **Security implication** | The library also exposes `getAuthToken`, `getAppAuthToken`, `esn`, `getMACAddress`, `setActivityDataPolicyAccepted`… to **any** page launched in Conjure. Our app must never load third-party/remote scripts. These functions were deliberately **not** called | VERIFIED (presence) |
| Lifecycle on app switch | Launching another app: page gets `blur`, then is torn down (no `pagehide`/`visibilitychange` received by the logger) | VERIFIED |
| Persistence | Page does not survive Home, app launch, input change, or standby; must be relaunched | VERIFIED |
| Auto-start at boot | No setting or API. `Input at Power On` only offers `SmartCast` or `Last Used TV Input` | BLOCKED (native) |

## 7. Application management findings

| Operation | Mechanism | Evidence | Reversible |
|---|---|---|---|
| Enumerate available apps | Vizio public catalog S7, filtered by chipset `MT5586` + firmware range | DOCUMENTED + fetched live | n/a |
| List *installed* apps on TV | none | UNSUPPORTED | — |
| Hide app tiles **in our UI** | Our config | Fully within our control | Yes |
| Hide/disable/uninstall apps **on the TV** | none | UNSUPPORTED | — |
| Prevent apps in native recommendations | none (native home is bypassed instead) | UNSUPPORTED | — |
| Change default launcher / Home button | none | BLOCKED (Home → native, verified) | — |
| Change startup destination | `input_at_power_on` = SmartCast / Last Used TV Input only | VERIFIED (read) | Yes |
| Modify app metadata/order on native home | none | UNSUPPORTED | — |
| Launch apps from our UI | backend `/app/launch` or in-page `VIZIO.launchApp` | VERIFIED | Yes |

Net: "application management" is implementable **only inside our own launcher** (show/hide/reorder/rename),
which — combined with home takeover — removes unwanted apps from the user's day-to-day experience without
modifying the TV. This distinction must be explicit in the UI ("hidden in Free My Vizio", not "uninstalled").

## 8. Startup and lifecycle findings

| Approach | Result | Class |
|---|---|---|
| Native home-screen replacement | No mechanism | UNSUPPORTED |
| Startup-app setting | Not present; only `Input at Power On` (SmartCast / Last Used TV Input) | BLOCKED |
| Pinned/persistent Conjure app | Not offered (S4, S6 state the same) | BLOCKED |
| HDMI-CEC "external box as home" | `CEC Device Control`=Enabled, `One Touch Play` setting exists. An always-on HDMI device could become the start point only with `Last Used TV Input` — out of scope (needs extra hardware) | PLAUSIBLE, not pursued |
| **Watchdog relaunch (backend polls `/app/current`, relaunches our URL when native home shows)** | Works after Home press, after input change + Home, after ~16 s standby, after ~2 min standby (remote power-on), and after API power-on. Native home visible ≈0.4–1.5 s at 1 s polling | **VERIFIED (short-term)** |
| Backend-initiated power-on | `POW_ON` succeeded on first attempt after ~2 min standby | VERIFIED (2 min) |

Observed lifecycle trace (1 s polling):

```
power=1 app=4/17/<our URL>            # our UI
power=1 app=4/1/{"app":"home",...}    # user pressed Home  -> watchdog relaunch (HTTP 200) -> our UI in ~1 s
power=1 app=0/3/""                    # input switching UI / HDMI
power=0 app=345/707/dtv-system://power # standby
power=? timeout                       # API unreachable for ~55 s windows during standby
power=1 app=4/1/home                  # power on -> relaunch in ~0.4-1 s
```

Hazard observed: the watchdog fired once **during the power-off transition** (home reported for one poll
while still `power=1`). Production logic must debounce (require ≥2 consecutive "home" samples) — see
ARCHITECTURE §5.

## 9. Proof-of-concept record (reproducible)

Tooling: [`poc/`](../../poc/README.md). Environment: §1. All steps were run 2026-10-26 with the user at the TV.

| # | Experiment | Command(s) | Result |
|---|---|---|---|
| 1 | Discovery | SSDP M-SEARCH (`ssdp:all`, DIAL); `dns-sd -B _viziocast._tcp`, `_googlecast._tcp`, `_airplay._tcp` | SSDP: no Vizio response. mDNS: found (`hsp=7345`, `wp=8005`, `wsp=8006`) |
| 2 | Port scan (TCP connect, 19 ports) | `nc -z` | Open: 7345, 7000, 8008, 8009, 8443, 56789. Closed: 22, 23, 80, 443, 5555, 7346, 8005, 8006, 9000, 8080, 9080 |
| 3 | Unauthenticated reads | `GET /state/device/deviceinfo`, `/state/device/power_mode` | 200 OK; `/app/current` → 403 REQUIRES_PAIRING |
| 4 | Pairing | `pair-start` → PIN on TV → `pair-finish <PIN>` | SUCCESS, token stored 0600 outside repo |
| 5 | Settings crawl (read-only) | recursive GET | 415 items; power/privacy/input-hide paths found |
| 6 | Conjure launch of LAN page | `launch 4 3 http://<PC_IP>:8099/` and `launch 4 17 ...` | Page loaded; env report received (§6) |
| 7 | Remote navigation | User pressed arrows/OK/Back/Play/Info/CC | Arrows/OK/Back delivered; focus moved; others no event |
| 8 | Launch apps from UI via backend | Select YouTube/Netflix tiles | Apps opened; Home → native home |
| 9 | Watchdog | `watch --relaunch <url>` + Home, HDMI+Home, power cycles (16 s, ~2 min) | Our UI restored every time (≈0.4–1.5 s native home flash) |
| 10 | Companion Library | `?companion=http://127.0.0.1:12345/scfs/cl/js/vizio-companion-lib.js&native=1` | Loaded; in-page `launchApp` opened Prime Video |
| 11 | API power cycle | `key power-off`; wait 125 s; `key power-on` | Power-on SUCCESS on attempt 1; watchdog relaunched UI |
| 12 | Input switch | PUT current_input with `HDMI-1` vs `hdmi1` | `FAILURE` vs `SUCCESS`; relaunch of our UI from HDMI works |

Not performed (by design): settings writes, factory reset, restart, firmware actions, network changes.

## 10. Firmware modification findings

| Claim | Class |
|---|---|
| Network-reachable shell (SSH/telnet/ADB) on target | **BLOCKED** — ports 22/23/5555 closed (an `sshd` package is listed in `BINARIES` but not listening) |
| Public root/jailbreak for 2021–2022 MediaTek Vizio chassis | **UNSUPPORTED** — none found (S13 reached the same conclusion for a 2025 VIZIO OS TV) |
| Unauthenticated SCPL install / USB webroot exec (CVE-2021-27942/27944) | Demonstrated on **other** models (2017–18). Status on this firmware unknown; presumed patched. Exploiting it would be risky and is out of scope |
| Pairing PIN brute force (CVE-2021-27943) | Other models; irrelevant (we pair legitimately) |
| Signed/secure update chain, downgrade protection, recovery | **UNSUPPORTED** (no primary documentation) |
| GPL source availability | Not confirmed released; SFC litigation ongoing (S10) |
| UART/bootloader approaches | Theoretical only; would require opening the TV, risk of bricking, warranty loss |

Consequences of failure (any firmware approach): permanent loss of smart features, unbootable TV with no
documented recovery path, loss of OTA updates, voided warranty. **Recommendation: do not pursue.** The
Conjure + takeover approach already delivers the core user goals without modifying the device.
Any future attempt requires explicit user approval per the project's safety rules.

## 10a. Privacy findings

| Item | Finding | Class |
|---|---|---|
| Viewing Data (ACR, Inscape) | `privacy_and_legal/vizio_viewing_data` = **Off** on this TV; `hal-acr 4.1.0155` component present | VERIFIED (read) |
| Limit Ad Tracking | `privacy_and_legal/advertising/limit_ad_tracking` = **On**; deviceinfo `TVAD_ID.LMT=1` | VERIFIED (read) |
| Reset advertiser ID | `privacy_and_legal/advertising/tvad_id_reset` (action) | VERIFIED (presence) |
| Interactive-TV ads | Capabilities `ITV_CAPABLE`, `ITV_OPT_OUT`, `PROMO_CAPABLE`, `recommendationd` present; no matching user setting in the tree | VERIFIED (presence); controllability UNSUPPORTED |
| Telemetry | `collectd`, `s3logger`, `perfetto`, Sentry DSN in deviceinfo; Cast `opt_in.stats/crash=true` | VERIFIED (presence); volume/content unmeasured |
| Changing settings via API | Generic MODIFY+HASHVAL should work; not exercised | DOCUMENTED |
| Effect on data collection | FTC/NJ 2017 order requires opt-in for ACR (S12). No independent measurement of Vizio traffic exists (S11 covers other brands) | DOCUMENTED / unmeasured |
| Network filtering | Use an existing resolver (Pi-hole, AdGuard Home, NextDNS). Only `tvinteractive.tv` has a cited ACR classification (medium confidence). Blocking `*.vizio.com`/`scfs.vizio.com` would break the app catalog, updates and possibly SmartCast/Conjure apps | PLAUSIBLE; no breakage data |

Recommendation: provide a **read-only privacy status panel** first (P2), then optional guarded writes after a
manual write test (Viewing Data → Off, Limit Ad Tracking → On). Document network filtering as optional and
external; do not build DNS tooling.

## 11. Outcome evaluation

| Outcome | Verdict | Reasoning |
|---|---|---|
| A — Full replacement | **Not feasible** with supported mechanisms | Home button, startup app, and native home cannot be changed (§7–8). Only route would be firmware modification (§10) |
| **B — Near-native custom experience** | **Feasible — recommended** | Verified: custom UI runs on-TV, remote nav, app/input launching, sub-2-second takeover after Home/power-on via always-on backend. Remaining native limitations: brief native-home flash, dependence on an always-on LAN host, native home still reachable when backend is down, no on-TV uninstall |
| C — Controller/companion only | Fallback, subsumed | The same backend + admin UI works as a phone/PC controller if Conjure ever breaks |
| D — Deeper modification | Not credible / high risk | No method for this chassis; not recommended |

## 12. Unresolved questions (must not be assumed)

1. **Long standby**: does takeover/power-on still work after hours/overnight standby (network sleep)? (Only ≤2 min tested.)
2. **Cold boot**: behavior after `Restart TV` or AC power loss (boot time, API availability, first app shown).
3. **Firmware updates**: may change Conjure APP_ID behavior, Companion Library, or app IDs. Re-run the PoC checklist after each update.
4. **Token durability** over weeks and across firmware updates.
5. **Settings writes** on this firmware (privacy toggles, input hide, `input_at_power_on`) — structure suggests writable; untested.
6. **Media/extra keys**: whether `VIZIO.registerKeyEvents` exposes Play/Pause/Info/etc. to the page.
7. **System dialogs**: interaction between takeover and native prompts (ToS, update notices, WatchFree+ prompts) that render inside the home app — risk of hiding them repeatedly.
8. **Cast/AirPlay**: expected to be unaffected (they are not "home"); when a session ends the TV returns home and takeover relaunches — untested.
9. **Meaning of the `-1.7` software suffix**.
10. **Network-level filtering**: no Vizio-specific breakage data; only `tvinteractive.tv` (Inscape ACR) has a cited classification (medium confidence).

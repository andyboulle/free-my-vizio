# Product Requirements — Free My Vizio

Version 1.0 (2026-10-26). Hardware facts referenced here are classified in
[TECHNICAL_FEASIBILITY.md](TECHNICAL_FEASIBILITY.md); "desired" behavior is not a claim of capability.

## 1. Vision

Turn on the TV and land in a clean, customizable, ad-free home screen that the user controls with the normal
remote — instead of the SmartCast home with its sponsored rows — without modifying the TV's firmware.

## 2. Target hardware

| Item | Value |
|---|---|
| TV | Vizio M65Q6-L4, firmware 86.910.19.2-1 (software 86.910.19.2-1.7) |
| Runtime used | SmartCast Conjure (Chrome 128) + local SmartCast API on HTTPS :7345 |
| Host | Any always-on LAN computer with Node.js ≥ 22.18 (dev: macOS laptop) |

Other Vizio SmartCast models are not targeted in v1 but must be addable via a model profile (ARCHITECTURE §6.5).

## 3. User goals (priority order)

1. **Application management** — see only the apps I use; hide the rest.
2. **Customization** — control layout, order, names, appearance, and behavior.
3. **Deeper OS control** — researched; not feasible safely (see §8).
4. **Privacy** — see and (where supported) set privacy-relevant TV settings.
5. **Network filtering** — optional guidance only.

## 4. What is verified vs. desired

| Desired behavior | Status on target | Implementation approach |
|---|---|---|
| Custom UI on the TV | **VERIFIED** | Conjure launch of LAN-hosted page |
| Navigate with the stock remote | **VERIFIED** (arrows, OK, Back) | DOM key events |
| Launch apps / switch inputs from our UI | **VERIFIED** | Backend → SmartCast API |
| Our UI appears automatically at power-on | **VERIFIED short-term** via watchdog; long standby unverified | Home Takeover supervisor on always-on host |
| Home button opens our UI | **Workaround VERIFIED** (native home flashes ≈0.4–1.5 s) | Same supervisor |
| Replace native home / Home binding | **BLOCKED** | — |
| Uninstall/disable TV apps | **UNSUPPORTED** | Hide in our UI only |
| Change privacy settings | **Read VERIFIED**, write untested | Admin panel (P2) |
| Media keys (Play/Pause/Info) in our UI | Not received in test | Research item (P2) |

## 5. Functional requirements

IDs are referenced by the implementation plan. "P" = priority (see §9).

### TV connection (P0/P1)
- **FR-1** Pair with the TV using the on-screen PIN; store the token as a secret; support re-pairing and cancel.
- **FR-2** Read model, firmware, power state, current app, inputs; produce a redacted capability report (`fmv doctor`).
- **FR-3** Detect TV address changes by scanning the host's /24 and matching the TV's device ID.
- **FR-4** Recover automatically from TV unreachability (standby, Wi-Fi drop) without restart.

### Custom home (P1)
- **FR-10** Serve a TV UI optimized for 1280×720 CSS px with sections of shortcut tiles.
- **FR-11** Spatial remote navigation with a clearly visible focus indicator; OK activates; Back never exits.
- **FR-12** Shortcut kinds: native app (from Vizio catalog), TV input (HDMI/COMP/tuner), system (`SmartCast Home`, `Power off`).
- **FR-13** The `SmartCast Home` shortcut always exists and suspends takeover for a configurable period.
- **FR-14** Show a clock (optional) and the TV/room title. No ads, recommendations, or remote content.
- **FR-15** Show offline/error states instead of a blank or frozen screen.

### Startup & lifecycle (P1)
- **FR-20** When enabled, automatically open the TV UI whenever the TV shows the native home (after power-on or Home).
- **FR-21** Modes: `always`, `power-on-only`, `off`.
- **FR-22** Never relaunch while another app, input, cast session, or our UI is active.
- **FR-23** Loop guard: pause takeover after repeated relaunches in a short window.
- **FR-24** Admin can trigger "open UI now".

### Customization & app management (P1/P2)
- **FR-30** Admin UI (phone/laptop browser) to add/remove/reorder/rename shortcuts and sections, pick from the
  catalog of apps available for this TV, and hide items (P1: add/remove/hide/reorder; P2: themes, rename sections).
- **FR-31** UI clearly states that hiding affects only Free My Vizio, not the TV.
- **FR-32** Themes: dark (default), light, OLED-black; accent color (P2).
- **FR-33** Config changes appear on the TV UI on next load, or within 35 s if the UI is already open (the UI re-fetches
  `GET /api/tv/home` on `visibilitychange` and every 30 s).

### TV controls (P2)
- **FR-40** Volume up/down/mute, power off, blank screen from admin and optional TV UI tiles.
- **FR-41** Read-only privacy panel: Viewing Data, Limited Ad Tracking; links to on-TV menu.
- **FR-42** Optional guarded writes for privacy settings after the manual write test passes (Viewing Data=Off,
  Limited Ad Tracking=On) — each requires explicit confirmation in the admin UI.

### Diagnostics (P1)
- **FR-50** `/healthz`, admin diagnostics page with supervisor status, verification status (model/firmware
  verified or not), and recent redacted log events.

## 6. Nonfunctional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | Takeover latency | Our UI visible ≤ 2.5 s after native home appears (target 1.5 s) at default settings |
| NFR-2 | UI responsiveness | Focus move renders < 100 ms after keydown on the TV |
| NFR-3 | Resource use | Server idle RSS < 120 MB; ≤ 2 TV requests/s steady state |
| NFR-4 | Availability | Server survives TV offline for days; restarts cleanly under a process manager |
| NFR-5 | Local-first | Works with no internet except catalog refresh (cache + fallback) |
| NFR-6 | Security | No secrets in logs/Git/API responses; Host allow-list; tokens on all mutating APIs |
| NFR-7 | Fail-safe | If the server is down, the TV behaves exactly as stock |
| NFR-8 | Maintainability | Zero runtime dependencies; `npm run verify` green; each module unit-tested |
| NFR-9 | Portability | macOS (dev) and Linux arm64/x64 (home server) |

## 7. Security requirements

- SR-1 TV token, admin token, TV-UI token stored only in `<dataDir>/secrets.json` (0600).
- SR-2 Logger redaction of tokens, PIN, ESN, serial, device ID, ad ID, MACs.
- SR-3 TV TLS verification disabled only for the TV host; normal verification elsewhere.
- SR-4 TV UI loads nothing from third-party origins; strict CSP; Companion Library privileged calls prohibited.
- SR-5 No destructive TV operations (factory reset, restart, firmware, network settings) are implemented.
- SR-6 Not intended for internet exposure; docs warn against port-forwarding.

## 8. Explicit non-goals (v1)

- Replacing or modifying TV firmware, rooting, bootloader work.
- Uninstalling, disabling, or hiding apps **on the TV** itself.
- Changing what the physical Home button does natively.
- Building a DNS/ad-blocking system (document use of Pi-hole/AdGuard Home/NextDNS instead).
- Cloud accounts, remote access from outside the home, multi-user accounts.
- Content recommendations, streaming-service metadata scraping.
- Support for non-Vizio TVs.

## 9. Feature priorities

| Priority | Scope |
|---|---|
| **P0 (done in research)** | Communication, pairing, Conjure execution, remote nav, startup feasibility, architecture |
| **P1** | Server foundation, pairing CLI, catalog, TV UI with navigation and launch, Home Takeover, admin layout editor (add/remove/hide/reorder), config persistence, diagnostics, deployment to always-on host |
| **P2** | Themes, TV controls, privacy panel (read → guarded write), TV-IP rediscovery, Companion Library enhancements (visibility events, extra keys) after verification, long-standby hardening |
| **P3** | Firmware research, network-filter integration guides, additional Vizio models, CEC/external-box mode |

## 10. Acceptance criteria (product level)

1. With takeover enabled and the server running on an always-on host, pressing Power-On on the remote shows
   the Free My Vizio home within NFR-1 in ≥ 9 of 10 trials (includes ≥ 1 trial after ≥ 8 h standby).
2. Pressing Home from any app returns to Free My Vizio within NFR-1 in ≥ 9 of 10 trials.
3. Every visible tile is reachable using only arrow keys, and OK on each opens the correct app/input.
4. Selecting "SmartCast Home" shows the native home and it stays for `suppressMinutes`.
5. Stopping the server leaves the TV fully usable in stock mode.
6. `npm run verify` passes; secret-scan of the repo finds no tokens; logs contain no secrets.
7. Layout edits in the admin UI persist across server restarts and appear on the TV.

## 11. Known limitations

- The native SmartCast home flashes briefly before our UI appears; it cannot be eliminated without firmware changes.
- Takeover requires an always-on host on the same LAN; laptops that sleep stop it.
- Apps cannot be removed from the TV; Vizio's own apps/ads remain reachable via the native home and app buttons.
- Media keys may not reach our UI; app buttons on the remote bypass our UI (handled by the TV).
- Firmware updates may change behavior; the manual checklist must be re-run after updates.
- The app catalog lists available apps; it cannot tell which apps the user has signed into.

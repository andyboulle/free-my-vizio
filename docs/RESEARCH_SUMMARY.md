# Research Summary — Free My Vizio

Target: Vizio M65Q6-L4, firmware 86.910.19.2-1. Research and hardware experiments: 2026-10-26.
Details: [TECHNICAL_FEASIBILITY.md](TECHNICAL_FEASIBILITY.md) · Design: [ARCHITECTURE.md](ARCHITECTURE.md) ·
Plan: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) · Handoff: [IMPLEMENTATION_AGENT_PROMPT.md](IMPLEMENTATION_AGENT_PROMPT.md)

## What is technically possible?

- Running **our own web app on the TV**: the TV's Conjure runtime (Chrome 128) loads any LAN-hosted page via the
  local SmartCast API (`NAME_SPACE 4`, `APP_ID "17"`, URL in `MESSAGE`).
- **Full remote navigation** (arrows, OK, Back) inside that app.
- **Launching native apps and switching inputs** from our app (via a local server, or in-page via the TV's Companion Library).
- **Automatic display of our app at power-on and after Home**, using a server that watches the TV and relaunches our
  app whenever the native home appears (the native home flashes for ~0.4–1.5 s).
- Reading (and probably writing) TV settings, including privacy settings.

Not possible with supported mechanisms: replacing the native home, rebinding Home, uninstalling/hiding TV apps,
setting a startup app. No credible firmware-modification route exists for this model.

## What has actually been verified (on the exact TV)?

Pairing; device/firmware info; current-app/power polling; Conjure launch of a LAN page; Chrome 128 feature set
(1280×720 viewport); arrow/Enter/Back key events; backend → TV launches (YouTube, Netflix, Prime Video); in-page
`VIZIO.launchApp`; input switching (CNAME only); Home → native home; watchdog relaunch after Home, input change,
16 s and ~2 min standby; API power-off and power-on after ~2 min standby; settings tree read (415 items) including
`Input at Power On`, input hiding, Viewing Data (Off) and Limited Ad Tracking (On).

## Recommended architecture

A zero-dependency **Node.js/TypeScript server** on an always-on LAN host that serves the TV UI and an admin UI, talks
to the TV's SmartCast API, and runs a **Home Takeover supervisor** (1 s polling, confirm re-check, cooldown, suppression,
loop guard). Vanilla HTML/ES-module UIs; JSON-file config; secrets in a 0600 file.

## Most promising route toward a complete SmartCast replacement

Conjure UI + Home Takeover (**Outcome B: near-native**). It delivers automatic startup and Home-button behavior in practice;
the only residual native artifacts are the brief home flash, native app buttons, and the native home when the server is down.
A true replacement (Outcome A) would require firmware modification, which has no known method and high bricking risk.

## Reliable fallback

The same server + admin UI used as a phone/PC controller, plus manually opening the TV UI (`fmv open`) if takeover
were ever blocked by a firmware update (Outcome C).

## Major risks

1. Firmware updates could change Conjure launching, app IDs, or polling behavior.
2. Long/overnight standby and cold boot are untested for takeover.
3. Takeover depends on an always-on host; a sleeping laptop disables it (fails safe to stock behavior).
4. Takeover could fight native dialogs (mitigated by loop guard and the "SmartCast Home" escape tile).
5. Any page launched in Conjure gets privileged Companion Library APIs → serve only our own content, strict CSP.

## What to implement first

M0–M2 (scaffold, SmartCast client with mock TV, config/secrets/pairing CLI), then M3 (catalog/profiles), M4 (TV UI),
M5 (Home Takeover). M5's long-standby test (MT-5.8) is the most important remaining hardware check.

## What requires hardware access or user approval

- **Hardware/user present**: every manual test (pairing PIN, remote navigation, takeover timing, overnight standby, TV restart).
- **Explicit approval**: any settings write (M8 gate), any TV restart triggered by us (we only ask the user to do it from the TV menu),
  router/DNS changes for optional filtering, anything firmware-related (not planned).
- **User action needed now**: choose the always-on host (Pi/NAS/mini-PC or a Mac that doesn't sleep) and give the TV and host DHCP reservations.

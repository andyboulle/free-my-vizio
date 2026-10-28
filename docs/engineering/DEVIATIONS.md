# Deviations

## 2026-10-27 — M7 Docker Desktop networking

- **Decision:** Docker deployment uses host networking so the TV can reach port 8730 and the container can reach the TV API.
- **Problem:** On Docker Desktop for macOS, host networking runs in the Linux VM. The service selected `192.168.65.3` as its public URL, while the TV is on the Mac's LAN. The container could reach the TV API, but the advertised UI address is not the Mac LAN address.
- **Evidence:** Docker Desktop reports `darwin/arm64`; container startup logged `tvUiUrl` using `192.168.65.3`; host access to the stopped host service was separate from the container.
- **Proposed change:** Use Docker bridge networking with port `8730` published to the Mac and set `server.publicBaseUrl` to the Mac's LAN URL for Docker Desktop. Retain host networking for Linux deployments.
- **Impact:** Docker Compose would have platform-specific networking behavior and requires a stable LAN address or DHCP reservation for the host. This must be approved before changing the binding compose configuration.

## 2026-10-27 — UI performance: "Cinematic Lite"

- **Decision affected:** `docs/engineering/DESIGN_SPEC.md` §3.3 (focus shadows), §5.2 (ambient backdrop), §5.5 (card states), §6.2 (fireplace rendering), §10 (effect levels/auto-downgrade), §12 UI2/UI5 FPS criteria.
- **Problem:** On the M65Q6-L4 (Conjure/Chrome 128), rapid Left/Right focus movement dropped to ~12–13 FPS in `fx-high`; automatic fallback to `fx-low` was unreliable.
- **Evidence:** Real-TV debug overlay runs (2026-10-27). Code review attributes the drop to animated large `box-shadow`s, full-screen `radial-gradient(color-mix())` re-rasterisation on brand change, `mask-image` on moving rails, forced layout in `updateRailFocus`, missing key throttle, layout-animated hero, and full-screen per-frame repaint in the fireplace; the downgrade sampled idle-dominated 5 s averages.
- **Change:** Adopt `DESIGN_SPEC.md` §14 — static compositor-friendly scene ("lite" tier default), effects reclassified, fireplace simplified, explicit `enhanced` opt-in replaces auto-downgrade, revised acceptance tests T0–T6 with logged metrics.
- **Impact:** Ambient motion, film grain, blur and large glows are removed on the default tier; layout positions in focus mode may differ ±16 px. No functional requirement, architecture, dependency, or TV-setting behaviour changes.
- **Status:** **Approved by owner 2026-10-27.** Implementation may proceed.

## 2026-10-27 — Fireplace screensaver removal

- **Decision:** Remove the Fireplace system shortcut and the custom fireplace screensaver after T5 failed real-TV performance validation.
- **Evidence:** The M65Q6-L4 could not meet the approved T5 sustained performance budget. The owner approved removing the feature rather than retaining a degraded or intermittently auto-downgraded path.
- **Change:** Fireplace idle/preview/canvas/embers/logs, sound configuration, UI, API payloads, and admin add-sheet entry were removed. Normal Home idle behavior, Cinematic Lite, and UI0–UI7 remain.
- **Status:** **Approved by owner 2026-10-27.** T5 is recorded as Removed in `docs/engineering/MANUAL_TESTS.md`; unrelated TV UI and performance metrics remain.

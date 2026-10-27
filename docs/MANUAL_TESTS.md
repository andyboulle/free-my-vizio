# Manual tests

Run against a real TV; do not mark these passed from mocks.

| ID | Date | Firmware | Result | Notes |
|---|---|---|---|---|
| MT-4.1 | 2026-10-27 | 86.910.19.2-1 | Pass | UI rendered within 3 seconds at 1280×720. |
| MT-4.2 | 2026-10-27 | 86.910.19.2-1 | Pass | Arrows reached every tile; app launch and HDMI 1 switching passed. |
| MT-4.3 | 2026-10-27 | 86.910.19.2-1 | Pass | Backspace did not exit the UI. |
| MT-4.4 | 2026-10-27 | 86.910.19.2-1 | Pass | Offline banner and restart recovery passed. |
| MT-5.1 | 2026-10-27 | 86.910.19.2-1 | Pass | Initial run exposed URL and current-app envelope bugs; after fixes, Home returned to our UI in the retest. |
| MT-5.2 | 2026-10-27 | 86.910.19.2-1 | Pass | Netflix → Home returned to our UI after fixes. |
| MT-5.3 | 2026-10-27 | 86.910.19.2-1 | Pass | HDMI input remained selected and takeover returned to our UI after fixes. |
| MT-5.4 | 2026-10-27 | 86.910.19.2-1 | Pass | 30-second standby/on returned to our UI after fixes. |
| MT-5.5 | 2026-10-27 | 86.910.19.2-1 | Pass | 10-minute standby/on returned to our UI after fixes. |
| MT-5.6 | 2026-10-27 | 86.910.19.2-1 | Pass | Native home escape remained available and takeover behavior passed after fixes. |
| MT-5.7 | 2026-10-27 | 86.910.19.2-1 | Pass | Cast YouTube did not trigger relaunch; our UI returned after casting stopped. |
| MT-5.8 |  |  | Not run | Overnight standby (≥8 hours) → on; user will test tomorrow. |
| MT-5.9 | 2026-10-27 | 86.910.19.2-1 | Pass | TV restart test passed using the available on-screen TV control. |
| MT-6.1 | 2026-10-27 | 86.910.19.2-1 | Pass | Hide and explicit Save removed Netflix from the TV UI; Unhide and Save restored it. |
| MT-6.2 | 2026-10-27 | 86.910.19.2-1 | Pass | Reordered shortcuts in the admin UI, saved, and confirmed the TV UI order changed. |
| MT-6.3 | 2026-10-27 | 86.910.19.2-1 | Pass | Edited layout persisted after restarting the server and reopening the TV UI. |
| MT-7.1 | 2026-10-27 | 86.910.19.2-1 | Pass | Docker Desktop bridge deployment survived Mac reboot; container restarted, pairing/config persisted, health and takeover passed. |
| MT-7.2 |  |  | Not run | 48-hour soak: no crash, memory under 120 MB, and default info logs under 10 MB per 24 hours. |
| MT-UI4.1 |  |  | Not run | Configure at least 12 app shortcuts in one rail. Focus row 1, then row 2: confirm the clock compresses to the upper-right, the focused row remains visible, and the rail scrolls right/left with one-card lead and a 48 px right-edge fade. |

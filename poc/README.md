# Proof-of-concept (disposable)

This directory holds the **disposable** diagnostic tool used during the research phase.
It is **not** production code and must not be imported by the production implementation.
It is kept so the experiments in [`docs/engineering/TECHNICAL_FEASIBILITY.md`](../docs/engineering/TECHNICAL_FEASIBILITY.md) §9 can be reproduced.

- `fmv-poc.mjs` — zero-dependency Node CLI: pairing, read-only queries, app launch, key presses,
  a static/log server for the test page, and a `watch` loop with an optional watchdog relaunch.
- `test-app/index.html` — minimal Conjure test page: focus grid, key logging, lifecycle events,
  environment/feature report, Companion Library probe, backend action calls.

## Safety

- Credentials are stored in `~/.free-my-vizio/poc-credentials.json` (mode 0600), outside the repo.
  Event logs go to `~/.free-my-vizio/poc-events.jsonl`. Neither is ever committed.
- The tool only performs documented, reversible operations (pairing, reads, app launch, key
  presses, input switch, power on/off). It never writes TV settings.
- The server binds to the LAN. Do not expose it to the internet.

## Requirements

- Node.js ≥ 18 on a computer on the same LAN/subnet as the TV.
- The TV powered on, and someone at the TV to read the pairing PIN.
- macOS: allow incoming connections for `node` if the firewall prompts (the TV must reach the server).

## Reproduction procedure

Replace `<TV_IP>` with the TV address (find it with `dns-sd -B _viziocast._tcp` then
`dns-sd -L "<name>" _viziocast._tcp`, or your router's DHCP table) and `<PC_IP>` with this
computer's LAN address.

```sh
node poc/fmv-poc.mjs set-host <TV_IP>
node poc/fmv-poc.mjs info                     # unauthenticated deviceinfo (model, firmware, capabilities)
node poc/fmv-poc.mjs pair-start "Free My Vizio"   # PIN appears on the TV
node poc/fmv-poc.mjs pair-finish <PIN>
node poc/fmv-poc.mjs current-app              # SmartCast home = NAME_SPACE 4, APP_ID "1"

# Terminal A: serve the test page and log events coming back from the TV
node poc/fmv-poc.mjs serve 8099

# Terminal B: launch the page in the TV's Conjure runtime
node poc/fmv-poc.mjs launch 4 17 "http://<PC_IP>:8099/?tv=<TV_IP>"
#   add  &native=1&companion=http%3A%2F%2F127.0.0.1%3A12345%2Fscfs%2Fcl%2Fjs%2Fvizio-companion-lib.js
#   to probe the on-TV Companion Library and in-page launching.

# Lifecycle / watchdog experiment (relaunches the page whenever the native home is showing)
FMV_POLL_MS=1000 node poc/fmv-poc.mjs watch --relaunch "http://<PC_IP>:8099/?attempt=watchdog"

# Other commands
node poc/fmv-poc.mjs key home|back|exit|power-off|power-on|vol-up|...
node poc/fmv-poc.mjs get /menu_native/dynamic/tv_settings/system/power
```

Then, at the TV: press arrows/OK/Back on the page, select tiles, press Home, switch inputs,
power-cycle (short and ≥ 2 minute standby), and compare the server/watch output with the
results recorded in `docs/engineering/TECHNICAL_FEASIBILITY.md` §9.

## Cleanup / reversal

- Stop the server and watch processes (Ctrl-C). Press Home on the remote to return to SmartCast.
- Pairing is harmless to leave in place. To discard the PoC token, delete
  `~/.free-my-vizio/poc-credentials.json`. (No documented unpair endpoint is implemented by any
  client; re-pairing with the same device ID invalidates the previous token.)

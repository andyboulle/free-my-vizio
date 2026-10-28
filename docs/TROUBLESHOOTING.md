# Troubleshooting

First, look at the logs and the TV status:

```sh
docker compose -f deploy/docker/compose.yaml logs --tail 100     # Docker
journalctl -u free-my-vizio -n 100                               # systemd
$FMV status                                                      # see INSTALL.md for $FMV
```

The admin app's **Settings → Diagnostics** shows the same events in plain language. **Copy report** produces a redacted
report (no tokens) you can attach to a GitHub issue.

## Setup

**`discover` finds nothing**
- The TV must be on and on the same network/subnet as the server (guest Wi-Fi and "AP/client isolation" block it).
- On Docker Desktop, discovery can't see your network — use the router's device list or the TV's network info and run
  `pair --host <ip>` directly.
- Test reachability: `curl -k https://<TV_IP>:7345/state/device/deviceinfo` should return JSON.

**No PIN appears on the TV / pairing says `BLOCKED` or `MAX_CHALLENGES_EXCEEDED`**
- The TV has a pending or failed pairing attempt. Wait a minute, make sure the TV is on and showing a normal screen, and
  run `pair` again (it cancels stale attempts first). If it persists, power-cycle the TV.

**Pairing says `PAIRING_DENIED` / `CHALLENGE_INCORRECT`** — the PIN was mistyped; run `pair` again.

**`admin-url` prints nothing / exits with an error** — it only runs in an interactive terminal, so the secret link
isn't written to logs. Use `docker compose … exec` (not `-T`) or run it directly in your SSH session.

**`Unknown command` / `Usage:`** — run `node src/cli.ts help`. Make sure you're in the repository directory.

## The custom screen doesn't appear

1. **Restarted after pairing?** The server reads the pairing at start-up: restart it after `pair` or `rotate-tokens`.
2. **Can the TV reach the server?** From another device on your network open `http://<SERVER_IP>:8730/healthz` — it
   should show `"ok":true`. If not:
   - firewall on the server (allow TCP 8730 from the LAN; on macOS allow incoming connections for `node`);
   - wrong address advertised — check the `tvUiUrl` in the start-up log. On Docker Desktop you **must** set
     `server.publicBaseUrl` ([INSTALL option D](INSTALL.md#option-d--docker-desktop-on-macoswindows)); on a server
     with several network interfaces, set it too.
3. **Is takeover paused?** `/healthz` shows `takeover.state`. `PAUSED` or a future `suppressedUntil` means it is waiting
   (after SmartCast Home was chosen, the loop guard, or a manual pause). Use **Resume** in the admin app.
4. **`NEEDS_PAIRING`** — the TV forgot or replaced the pairing (for example after a factory reset). Pair again and restart.
5. **TV turns on to an HDMI input** — set **Menu → System → Power → Input at Power On → SmartCast**.
6. Open it manually to rule out takeover issues: `$FMV open`.

**The TV shows "Open Free My Vizio from the server"** — the page was opened without its access key (for example from a
bookmark or after `rotate-tokens`). Run `$FMV open`.

**The stock home stays for a long time after the TV turns on** — right after power-on the TV's network API can be
unavailable for a while; takeover resumes as soon as the TV answers. If it never comes back after long standby, please
open an issue with the diagnostics report.

## Using it

**An app tile is greyed out / "Unavailable"** — Vizio's catalog doesn't list a launch command for that app on your
TV's chipset/firmware. Remove it, or report it if the app is installed and works from SmartCast.

**An app opens the wrong thing or nothing** — app launch IDs come from Vizio's catalog and can differ between models;
please report your model and the app.

**Animation stutters** — set **Appearance → Effects → Standard**. Slower TVs can't run the enhanced effects smoothly.

**Changes in the admin app don't show on the TV** — the TV refreshes about every 30 seconds; press Home to reload now.

**Lost the admin link** — run `$FMV admin-url` again. If someone else has it, run `$FMV rotate-tokens`, restart the
server, then `$FMV open`.

**TV got a new IP address** — the server rescans the local network after the TV has been unreachable for 10 minutes and
updates itself. A DHCP reservation for the TV avoids this entirely.

**`ExperimentalWarning: Type Stripping is an experimental feature`** — harmless on some Node versions.

## Still stuck?

[Open an issue](https://github.com/andyboulle/free-my-vizio/issues/new?template=bug_report.md) with your TV model,
firmware (`$FMV doctor`), install method, and the diagnostics **Copy report**. Never post your admin link or
`secrets.json`.

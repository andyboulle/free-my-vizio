# Using Free My Vizio

- [On the TV](#on-the-tv)
- [The admin app (phone/computer)](#the-admin-app-phonecomputer)
- [Takeover: how the custom screen comes back](#takeover-how-the-custom-screen-comes-back)
- [Command-line tool](#command-line-tool)
- [Configuration reference](#configuration-reference)

## On the TV

| Remote button | What happens |
|---|---|
| ◀ ▶ ▲ ▼ | Move between apps |
| **OK** | Open the highlighted app |
| **Back** | Jump back to the first app (never leaves Free My Vizio) |
| **Home** | The TV shows SmartCast Home for a moment, then Free My Vizio returns (see [Takeover](#takeover-how-the-custom-screen-comes-back)) |
| App buttons (Netflix, etc.), **Input**, volume, power | Handled by the TV as usual |

The home screen shows the clock and date, the highlighted app's name, and your **Apps** row. The background takes on
the colour of the highlighted app.

**Want the real SmartCast Home?** In the admin app tap **Pause takeover** (15 minutes), then press Home on the remote.
Takeover also stays out of the way while you're in an app, on an HDMI input, or casting.

## The admin app (phone/computer)

Open the private link from `fmv admin-url` (see [INSTALL](INSTALL.md#first-time-setup-all-options)). Bookmark it or add
it to your phone's home screen.

| Tab | What you can do |
|---|---|
| **Home** | See what the TV is doing, **Open on TV**, **Pause / Resume takeover**, quick-launch apps on the TV, health info |
| **Layout** | Live preview; add apps from Vizio's catalog (search), add inputs, reorder, rename, hide/unhide. Changes save automatically with **Undo** |
| **Remote** | Phone remote: arrows, OK, Back, Home, volume, mute, power off |
| **Appearance** | Theme (Cinematic / OLED / Light), accent colour, background style, clock format, date, labels, effects level |
| **Settings** | Takeover mode, pairing, diagnostics (event log, **Copy report** for bug reports) |

Notes:

- **Hiding an app only hides it in Free My Vizio.** Apps can't be uninstalled from a Vizio TV.
- The app list comes from Vizio's public catalog of apps *available* for your TV model — not necessarily ones you've
  signed into.
- The TV refreshes its layout about every 30 seconds, or immediately when it comes back to the screen.
- **Effects → Standard** is recommended on TVs. "Enhanced" adds motion but can stutter on slower TVs.

## Takeover: how the custom screen comes back

Vizio TVs don't let any app replace the built-in home screen. Instead, the server checks the TV about once per second
and, when it sees SmartCast Home, re-opens Free My Vizio. You'll see the stock home for roughly half a second to
1.5 seconds.

| Mode | Behaviour |
|---|---|
| **Always** (default) | Return whenever SmartCast Home appears (power-on and Home button) |
| **At power-on only** | Return once after the TV turns on; afterwards Home shows SmartCast normally |
| **Off** | Never return automatically; open it from the admin app or `fmv open` |

Safety rules built in:

- It never interrupts an app, an HDMI input, or casting.
- After you choose SmartCast Home / Pause, it waits (default 10 minutes, or until the TV is turned off).
- If it has to relaunch 3 times within a minute (for example, a TV pop-up keeps reappearing), it pauses for 10 minutes.
- If the server is stopped, nothing happens — the TV behaves exactly as stock.

For takeover at power-on, set **Menu → System → Power → Input at Power On → SmartCast** on the TV.

## Command-line tool

Run from the repository directory (`node src/cli.ts <command>`, or `npm run cli -- <command>`); in Docker prefix with
`docker compose -f deploy/docker/compose.yaml exec free-my-vizio`.

| Command | Purpose |
|---|---|
| `discover` | Scan the server's local /24 network for Vizio TVs |
| `pair --host <ip>` | Pair with the TV (enter the PIN shown on screen). Restart the server afterwards |
| `status` | TV power, current app, pairing state (JSON) |
| `doctor` | Model, firmware, API/Conjure versions, compatibility verdict (JSON) |
| `open [--debug]` | Open Free My Vizio on the TV now (`--debug` shows an FPS overlay) |
| `admin-url` | Print the private admin link (interactive terminal only) |
| `rotate-tokens` | Generate new admin and TV links (invalidates old ones). Restart the server afterwards, then reopen the UI with `open` |
| `config-path` | Print the data directory |
| `help` | Show usage |

## Configuration reference

The server keeps everything in its data directory (`config-path` prints it):

| File | Contents |
|---|---|
| `config.json` | Settings and layout (safe to edit while the server is stopped; the admin app edits it for you) |
| `secrets.json` | TV pairing token, admin token, TV link token — **private** (mode 0600) |
| `cache/` | Vizio app catalog and downloaded app icons |

Main `config.json` fields (defaults shown). Invalid values are rejected at start-up with an error message.

| Key | Default | Meaning |
|---|---|---|
| `tv.host` | `null` | TV IP address (set by `pair`) |
| `tv.port` | `7345` | TV API port |
| `server.port` | `8730` | Port the TV and admin app use |
| `server.bindHost` | `0.0.0.0` | Interface to listen on |
| `server.publicBaseUrl` | `null` (auto-detected) | URL the TV uses to reach the server, e.g. `http://192.168.1.50:8730`. Required on Docker Desktop |
| `takeover.enabled` / `takeover.mode` | `true` / `always` | See [Takeover](#takeover-how-the-custom-screen-comes-back) (`always`, `power-on-only`, `off`) |
| `takeover.pollMs` | `1000` | How often the TV is checked (250–10000 ms) |
| `takeover.suppressMinutes` | `10` | Pause after choosing SmartCast Home |
| `takeover.suppressUntilStandby` | `true` | Also end the pause when the TV turns off |
| `takeover.loopGuard` | 3 launches / 60 s → pause 10 min | Protection against relaunch loops |
| `home.title` | `Living Room` | Name shown on the TV |
| `home.theme` | `cinematic` | `cinematic`, `oled`, `light` |
| `home.accent` | `#f0f2f1` | Accent colour (`#RRGGBB`) |
| `home.clock` | `auto`, date on | `format`: `auto`/`12h`/`24h`; `showDate`; `greeting` |
| `home.appearance.effects` | `lite` | `lite` (recommended) or `enhanced` |
| `home.appearance.backdrop` / `labels` / `reduceMotion` | `ambient` / `focused` / `false` | Background style, card labels, reduced motion |
| `home.sections[].shortcuts[]` | Netflix, YouTube, … | `kind` `app` (`catalogId`), `input` (`cname` such as `hdmi1`) or `system`; `hidden`; optional `brandColor` |
| `catalog.refreshHours` | `24` | How often the Vizio app catalog is refreshed |

Environment variables: `FMV_DATA_DIR` (data directory; default `~/.free-my-vizio`).

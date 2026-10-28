# Free My Vizio

**A clean, customizable home screen for Vizio SmartCast TVs — no ads, no firmware hacks.**

Free My Vizio runs a small server on a computer in your home (a Raspberry Pi is perfect). Your TV opens a
custom home screen from that server, and whenever the stock SmartCast home appears — at power-on or when you press
**Home** — Free My Vizio brings its own screen back within about a second. You pick the apps, the order, and the look
from your phone.

> Unofficial project. Not affiliated with, endorsed by, or supported by VIZIO, Inc.

## Features

- 🏠 **Your own home screen** — large clock, your apps as big artwork cards, a background tinted by the focused app.
- 🎮 **Works with the normal remote** — arrows, OK and Back.
- ⚡ **Automatic "takeover"** — the custom screen reappears after power-on and after pressing Home.
- 📱 **Phone admin app** — reorder, hide or add apps, change theme and accent colour, phone remote, status and diagnostics.
- 🔒 **Local and private** — no accounts, no cloud service, no ads or recommendations. Nothing is installed on the TV
  and no TV settings are changed.
- 🧩 **Zero runtime dependencies** — plain Node.js, runs fine on a 1 GB Raspberry Pi (~45 MB RAM).

## What it can and can't do

| ✅ Can | ❌ Can't (TV doesn't allow it) |
|---|---|
| Show a custom home screen on the TV | Replace SmartCast permanently or remap the Home button |
| Bring it back automatically after power-on / Home (the stock home flashes for ~0.5–1.5 s first) | Uninstall or hide apps on the TV itself (hiding only affects Free My Vizio) |
| Launch apps and switch inputs | Start without your server — if the server is off, the TV simply behaves as stock |
| Run entirely on your local network | Change the TV's firmware (no safe method exists; not attempted) |

## Compatibility

| TV | Firmware | Status |
|---|---|---|
| Vizio **M65Q6-L4** (M-Series Quantum) | 86.910.19.2-1 | ✅ Verified |
| Other Vizio SmartCast TVs (≈2018 and newer) | — | ❓ Untested — likely to work if `fmv doctor` shows a Conjure version. Please [report your results](https://github.com/andyboulle/free-my-vizio/issues/new?template=compatibility-report.md)! |

**Server:** any always-on computer on the same network running Node.js **22.18+** or Docker — Raspberry Pi 4/5
(1 GB is enough), Linux box, NAS, or a Mac that doesn't sleep. Wired Ethernet recommended.

## Quick start (Raspberry Pi or Linux with Docker)

You'll need: the TV and the server on the same home network, and the TV turned **on** while you pair.

```sh
# 1. Get the code and start the server
git clone https://github.com/andyboulle/free-my-vizio.git
cd free-my-vizio
docker compose -f deploy/docker/compose.yaml up -d --build

# 2. Find your TV's IP address (or look it up in your router / the TV's network menu)
docker compose -f deploy/docker/compose.yaml exec free-my-vizio node src/cli.ts discover

# 3. Pair — a 4-digit PIN appears on the TV; type it in
docker compose -f deploy/docker/compose.yaml exec free-my-vizio node src/cli.ts pair --host <TV_IP>

# 4. Restart so the server picks up the pairing
docker compose -f deploy/docker/compose.yaml restart

# 5. Get your private admin link and open it on your phone (bookmark it)
docker compose -f deploy/docker/compose.yaml exec free-my-vizio node src/cli.ts admin-url
```

Now press **Home** on the TV remote — Free My Vizio should appear within a couple of seconds.

On the TV, make sure **Menu → System → Power → Input at Power On** is set to **SmartCast** so takeover can run at power-on.

Other ways to install (no Docker, macOS, Docker Desktop) and backups/upgrades: **[docs/INSTALL.md](docs/INSTALL.md)**.

## Documentation

| Guide | What's in it |
|---|---|
| [Install](docs/INSTALL.md) | Raspberry Pi (Docker or native), Linux, macOS, Docker Desktop, upgrades, backup, uninstall |
| [Usage](docs/USAGE.md) | Using the TV screen and the admin app, takeover modes, CLI, configuration reference |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Fixes for pairing, discovery, takeover, network and display problems |
| [Contributing](CONTRIBUTING.md) | Development setup, tests, project layout, compatibility reports |
| [Security](SECURITY.md) | Security model and how to report a vulnerability |
| [Engineering docs](docs/engineering/README.md) | Research, architecture, design spec and decision history |

## Privacy & safety

- The server and the TV API must **only** be reachable on your home network — never port-forward port 8730.
- The TV pairing token and admin link are stored in your data directory (`~/.free-my-vizio` or the Docker volume),
  never in the repository. Treat the admin link like a password.
- Free My Vizio never changes TV settings and never performs firmware, reset or update operations.

## License & trademarks

Code is released under the [MIT License](LICENSE).

VIZIO and SmartCast are trademarks of VIZIO, Inc. App names, logos and icons (including the files in
`web/tv/img/apps/` and icons downloaded from Vizio's public app catalog at runtime) are trademarks of their respective
owners, are **not** covered by the MIT license, and are used only to identify the apps.

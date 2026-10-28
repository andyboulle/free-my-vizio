# Installing Free My Vizio

Free My Vizio is a small server that must run **all the time** on a computer on the same network as your TV. If the
server is off, your TV simply behaves normally.

- [Before you start](#before-you-start)
- [Option A — Raspberry Pi / Linux with Docker (recommended)](#option-a--raspberry-pi--linux-with-docker-recommended)
- [Option B — Raspberry Pi / Linux without Docker (systemd)](#option-b--raspberry-pi--linux-without-docker-systemd)
- [Option C — macOS (Node.js + launchd)](#option-c--macos-nodejs--launchd)
- [Option D — Docker Desktop on macOS/Windows](#option-d--docker-desktop-on-macoswindows)
- [First-time setup (all options)](#first-time-setup-all-options)
- [Upgrading](#upgrading) · [Backup & moving to a new server](#backup--moving-to-a-new-server) · [Uninstalling](#uninstalling)

## Before you start

| Need | Notes |
|---|---|
| A Vizio SmartCast TV | Verified on M65Q6-L4; others untested ([compatibility](../README.md#compatibility)) |
| An always-on server | Raspberry Pi 4/5 (1 GB+), Linux PC/NAS, or a Mac set not to sleep |
| Same network | TV and server on the same home network/subnet (no guest Wi-Fi / client isolation) |
| Fixed IP addresses | In your router, create **DHCP reservations** for the TV *and* the server so their addresses never change |
| TV power on | The TV must be on to pair |

**Raspberry Pi shopping list:** Pi 5 (or 4) 1 GB+, official USB-C power supply (27 W for Pi 5, 15 W for Pi 4), 32 GB+
A2 microSD card, a case with a fan, and an Ethernet cable. Flash **Raspberry Pi OS Lite (64-bit)** with
[Raspberry Pi Imager](https://www.raspberrypi.com/software/) and enable SSH in the Imager settings.

**Network ports:** the TV must reach the server on TCP **8730**; the server must reach the TV on TCP **7345**.
Never forward these ports from your router to the internet.

---

## Option A — Raspberry Pi / Linux with Docker (recommended)

1. Install Docker (once):

   ```sh
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker "$USER"   # then log out and back in
   ```

2. Get the code and start the server:

   ```sh
   git clone https://github.com/andyboulle/free-my-vizio.git
   cd free-my-vizio
   docker compose -f deploy/docker/compose.yaml up -d --build
   ```

   The container uses **host networking** (so the TV can reach it), restarts automatically, and stores its data in the
   Docker volume `free-my-vizio-data`.

3. Continue with [First-time setup](#first-time-setup-all-options), using this command prefix:

   ```sh
   FMV="docker compose -f deploy/docker/compose.yaml exec free-my-vizio node src/cli.ts"
   RESTART="docker compose -f deploy/docker/compose.yaml restart"
   ```

Logs: `docker compose -f deploy/docker/compose.yaml logs -f`

---

## Option B — Raspberry Pi / Linux without Docker (systemd)

Uses the least memory; good for 1 GB Pis.

1. Install Node.js 22 (Raspberry Pi OS's own `nodejs` package is too old):

   ```sh
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   node --version   # must be v22.18.0 or newer
   ```

2. Install the app and a dedicated service user:

   ```sh
   sudo git clone https://github.com/andyboulle/free-my-vizio.git /opt/free-my-vizio
   sudo useradd --system --home /var/lib/free-my-vizio --shell /usr/sbin/nologin fmv
   sudo install -d -o fmv -g fmv -m 700 /var/lib/free-my-vizio
   sudo cp /opt/free-my-vizio/deploy/systemd/free-my-vizio.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now free-my-vizio
   ```

   The unit runs `/usr/bin/node`; if `which node` prints another path, edit `ExecStart` in
   `/etc/systemd/system/free-my-vizio.service`.

3. Continue with [First-time setup](#first-time-setup-all-options), using:

   ```sh
   cd /opt/free-my-vizio
   FMV="sudo -u fmv env FMV_DATA_DIR=/var/lib/free-my-vizio node src/cli.ts"
   RESTART="sudo systemctl restart free-my-vizio"
   ```

Logs: `journalctl -u free-my-vizio -f`

---

## Option C — macOS (Node.js + launchd)

Good for trying it out. The Mac must stay awake and on your home network (System Settings → Battery/Energy →
prevent automatic sleeping when the display is off, and keep it plugged in).

1. Install Node.js 22.18+ (e.g. `brew install node@22` or from [nodejs.org](https://nodejs.org)) and clone the repo:

   ```sh
   git clone https://github.com/andyboulle/free-my-vizio.git ~/free-my-vizio
   cd ~/free-my-vizio
   ```

2. Try it in the foreground first: `npm start` (stop with Ctrl-C). Allow incoming connections for `node` if macOS asks.
3. Do the [First-time setup](#first-time-setup-all-options) in a second terminal with:

   ```sh
   FMV="node src/cli.ts"
   RESTART="echo 'Stop npm start with Ctrl-C and run it again'"
   ```

4. Run it in the background at login with launchd:

   ```sh
   mkdir -p ~/Library/Logs/free-my-vizio ~/Library/LaunchAgents
   sed -e "s#REPLACE_NODE#$(which node)#" -e "s#REPLACE_REPO#$PWD#g" -e "s#REPLACE_HOME#$HOME#g" \
     deploy/launchd/com.freemyvizio.server.plist > ~/Library/LaunchAgents/com.freemyvizio.server.plist
   launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.freemyvizio.server.plist
   ```

   Restart later with `launchctl kickstart -k "gui/$(id -u)/com.freemyvizio.server"`. Logs are in
   `~/Library/Logs/free-my-vizio/`.

---

## Option D — Docker Desktop on macOS/Windows

Docker Desktop cannot use host networking, so the container can't advertise your computer's real address. You must
tell it explicitly.

1. Find your computer's LAN IP (macOS: `ipconfig getifaddr en0`) and reserve it in your router.
2. Start with the bridge override:

   ```sh
   git clone https://github.com/andyboulle/free-my-vizio.git && cd free-my-vizio
   COMPOSE="docker compose -f deploy/docker/compose.yaml -f deploy/docker/compose.mac.yaml"
   $COMPOSE up -d --build
   ```

3. Set the public URL the TV should use (replace the IP):

   ```sh
   $COMPOSE exec free-my-vizio node -e '
     const f="/data/config.json", c=require(f);
     c.server.publicBaseUrl="http://192.168.1.50:8730";
     require("fs").writeFileSync(f, JSON.stringify(c, null, 2));'
   $COMPOSE restart
   ```

4. Continue with [First-time setup](#first-time-setup-all-options) using:

   ```sh
   FMV="$COMPOSE exec free-my-vizio node src/cli.ts"
   RESTART="$COMPOSE restart"
   ```

   `discover` can't scan your home network from inside Docker Desktop — get the TV's IP from your router or the TV's
   network settings instead.

---

## First-time setup (all options)

`$FMV` and `$RESTART` are the commands from your install option above.

1. **Find the TV's IP address**

   ```sh
   $FMV discover
   ```

   Prints e.g. `192.168.1.42 M65Q6-L4`. If nothing appears, use your router's device list or the TV's network
   information screen.

2. **Pair** (TV on; a 4-digit PIN appears on the TV):

   ```sh
   $FMV pair --host 192.168.1.42
   ```

3. **Restart the server** so it uses the new pairing: `$RESTART`

4. **Check compatibility:**

   ```sh
   $FMV doctor
   ```

   `"verified": true` means your exact model and firmware have been tested. `false` is fine — it just means untested;
   please [send a compatibility report](https://github.com/andyboulle/free-my-vizio/issues/new?template=compatibility-report.md).

5. **Open the admin app on your phone:**

   ```sh
   $FMV admin-url
   ```

   Open the printed link on your phone and bookmark it / "Add to Home Screen". **Anyone with this link can control your
   TV — don't share it.**

6. **Set the TV to start in SmartCast:** on the TV, **Menu → System → Power → Input at Power On → SmartCast**.
   (If it's set to "Last Used TV Input", the TV may start on HDMI and Free My Vizio will correctly stay out of the way.)

7. **Try it:** press **Home** on the TV remote. Free My Vizio should appear within ~2 seconds. You can also run
   `$FMV open`.

Next: [docs/USAGE.md](USAGE.md).

---

## Upgrading

```sh
cd free-my-vizio            # or /opt/free-my-vizio
git pull
# Docker:
docker compose -f deploy/docker/compose.yaml up -d --build
# systemd:
sudo systemctl restart free-my-vizio
```

Configuration is migrated automatically on start. Back up first (below) if you've customised a lot.

## Backup & moving to a new server

Everything (pairing, layout, admin link) lives in the **data directory**:

| Install | Data directory |
|---|---|
| Docker | volume `free-my-vizio-data` (mounted at `/data`) |
| systemd | `/var/lib/free-my-vizio` |
| macOS / manual | `~/.free-my-vizio` (or `$FMV_DATA_DIR`) — `node src/cli.ts config-path` prints it |

Back up a Docker volume (while stopped):

```sh
docker compose -f deploy/docker/compose.yaml down
docker run --rm -v free-my-vizio-data:/data -v "$PWD:/backup" alpine tar czf /backup/fmv-data.tgz -C /data .
docker compose -f deploy/docker/compose.yaml up -d
```

To move to a new server, copy the whole data directory (it contains secrets — keep permissions private, `chmod 700`)
and start the new server. If the TV rejects the old pairing, just run `pair` again. If the server's IP address changed
and you set `publicBaseUrl`, update it.

## Uninstalling

Free My Vizio installs nothing on the TV and changes no TV settings, so removing it is just:

```sh
# Docker
docker compose -f deploy/docker/compose.yaml down -v      # -v also deletes the data volume
# systemd
sudo systemctl disable --now free-my-vizio && sudo rm /etc/systemd/system/free-my-vizio.service
sudo rm -rf /opt/free-my-vizio /var/lib/free-my-vizio && sudo userdel fmv
# macOS
launchctl bootout "gui/$(id -u)/com.freemyvizio.server"; rm ~/Library/LaunchAgents/com.freemyvizio.server.plist
rm -rf ~/.free-my-vizio
```

The TV keeps working normally. (The TV may still list the old pairing internally; it's harmless.)

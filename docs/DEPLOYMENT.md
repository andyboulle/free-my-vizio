# Deployment

Free My Vizio is intended for a trusted home LAN. It has no cloud control plane and
must never be port-forwarded to the internet. Reserve the TV's DHCP lease (or use a
stable DHCP reservation) so pairing and rediscovery remain predictable. Allow TCP
8730 from the LAN to the host and TCP 7345 from the host to the TV; deny both from
guest/WAN interfaces.

## Linux (Pi OS / Ubuntu, systemd)

Create a dedicated unprivileged account and data directory, then install the
repository at `/opt/free-my-vizio`:

```sh
sudo useradd --system --home /var/lib/free-my-vizio --shell /usr/sbin/nologin fmv
sudo install -d -o fmv -g fmv -m 700 /var/lib/free-my-vizio
sudo cp deploy/systemd/free-my-vizio.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now free-my-vizio
sudo journalctl -u free-my-vizio -f
```

Install Node.js 22.18+ at `/usr/bin/node` (or update `ExecStart` to its absolute
path). `ProtectSystem=strict`, `ProtectHome`, `NoNewPrivileges`, and the single
`ReadWritePaths` keep the service's filesystem access narrow. Pair with
`npm run cli -- pair --host TV_IP` before enabling takeover if the data directory
is empty.

## macOS (launchd)

Install Node.js 22.18+ and adjust the absolute paths in
`deploy/launchd/com.freemyvizio.server.plist`. Create the log directory before
loading:

```sh
mkdir -p "$HOME/Library/Logs/free-my-vizio"
cp deploy/launchd/com.freemyvizio.server.plist "$HOME/Library/LaunchAgents/"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.freemyvizio.server.plist"
launchctl kickstart -k "gui/$(id -u)/com.freemyvizio.server"
```

`RunAtLoad` starts after login and `KeepAlive` restarts an exited process. The
plist's `StandardOutPath` and `StandardErrorPath` are persistent; configure
`newsyslog` for these paths (for example, rotate at 10 MB, keep 5 compressed
files) on hosts where launchd logs are not otherwise capped.

## Docker (optional)

The supplied image has no runtime npm dependencies and runs as the non-root
`node` user. The image initializes the persistent data directory with matching
ownership before dropping privileges. Host networking is required so the TV can reach port 8730 and the
container can reach the TV's port 7345:

```sh
docker compose -f deploy/docker/compose.yaml up -d --build
docker compose -f deploy/docker/compose.yaml logs -f
```

On Docker Desktop for macOS, use the bridge override instead of host networking.
Set `server.publicBaseUrl` in the persistent config to the Mac's stable LAN URL
so the TV can load the UI:

```sh
docker compose -f deploy/docker/compose.yaml -f deploy/docker/compose.mac.yaml up -d --build
```

Reserve both the Mac's DHCP address and the TV's DHCP lease. The TV reservation
is especially important on Docker Desktop: rediscovery scans the `/24` containing
the configured or last known TV address, rather than the container's Docker
bridge network. Keep `server.publicBaseUrl` synchronized if the host address
changes.

The named volume contains pairing and configuration data. Back it up while stopped:

```sh
docker compose -f deploy/docker/compose.yaml down
docker run --rm -v free-my-vizio-data:/data -v "$PWD:/backup" alpine \
  tar czf /backup/free-my-vizio-data.tgz -C /data .
```

## Upgrades and migration

Back up the complete data directory (`/var/lib/free-my-vizio`, the macOS
`FMV_DATA_DIR` directory, or the Docker volume), stop the service, replace the
application files, and start it again. Pairing migrates with the data directory:
copy `config.json`, `secrets.json`, and `cache/` with permissions preserved; never
copy tokens into source control or logs. If a TV receives a new DHCP address,
the supervisor scans the local `/24` after ten minutes of unreachability and
updates the saved host when the configured device ID matches.

Do not claim a soak or deployment pass from this document. Reboot validation and
the 48-hour resilience check are manual M7 work.

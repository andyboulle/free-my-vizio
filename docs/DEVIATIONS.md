# Deviations

## 2026-10-27 — M7 Docker Desktop networking

- **Decision:** Docker deployment uses host networking so the TV can reach port 8730 and the container can reach the TV API.
- **Problem:** On Docker Desktop for macOS, host networking runs in the Linux VM. The service selected `192.168.65.3` as its public URL, while the TV is on the Mac's LAN. The container could reach the TV API, but the advertised UI address is not the Mac LAN address.
- **Evidence:** Docker Desktop reports `darwin/arm64`; container startup logged `tvUiUrl` using `192.168.65.3`; host access to the stopped host service was separate from the container.
- **Proposed change:** Use Docker bridge networking with port `8730` published to the Mac and set `server.publicBaseUrl` to the Mac's LAN URL for Docker Desktop. Retain host networking for Linux deployments.
- **Impact:** Docker Compose would have platform-specific networking behavior and requires a stable LAN address or DHCP reservation for the host. This must be approved before changing the binding compose configuration.

# Free My Vizio

A privacy-conscious, customizable home screen for Vizio SmartCast TVs — no firmware modification.
Initial target: **Vizio M65Q6-L4**, firmware 86.910.19.2-1.

**Status:** M7 deployment files are included; complete the manual host installation
and resilience checklist before treating a deployment as validated.

How it works: a small Node.js server on your home network serves a custom home screen that the TV opens in its
built-in web runtime, launches your apps and inputs through the TV's local API, and brings the custom home back
whenever the stock SmartCast home appears.

## Documents

| Document | Purpose |
|---|---|
| [docs/RESEARCH_SUMMARY.md](docs/RESEARCH_SUMMARY.md) | Executive summary |
| [docs/TECHNICAL_FEASIBILITY.md](docs/TECHNICAL_FEASIBILITY.md) | Evidence, capability matrix, PoC results |
| [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) | Requirements and acceptance criteria |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Binding architecture decisions |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Milestones M0–M9 |
| [docs/IMPLEMENTATION_AGENT_PROMPT.md](docs/IMPLEMENTATION_AGENT_PROMPT.md) | Prompt for the implementation agent |
| [docs/evidence/](docs/evidence/README.md) | Sanitized captures from the target TV |
| [poc/](poc/README.md) | Disposable proof-of-concept tool used in research |

## Development

Requires Node.js 22.18 or newer. Node versions below 22.18 do not provide the
unflagged TypeScript type stripping used by this project.

```sh
npm install
npm run verify
```

### Running as a service

Deployment templates for systemd, launchd, and optional Docker are in
[`deploy/`](deploy/). Follow [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for
installation, firewall, backup, upgrade, and pairing migration steps. The server
stores configuration and pairing in `FMV_DATA_DIR` (or
`~/.free-my-vizio`); keep that directory private. It listens on port 8730 by
default and should only be reachable from the trusted LAN.

M7 manual checklist:

- [ ] Install on an always-on host, pair the TV, and enable the appropriate service.
- [ ] Reboot the host and confirm the service starts and takeover works.
- [ ] Observe the documented 48-hour soak, memory, and log limits; record results
  in `docs/MANUAL_TESTS.md` (never infer this from mocks).

The project has no runtime npm dependencies. Development dependencies are used
only for TypeScript type checking. The test-only TLS certificate generated for
the mock TV in a later milestone is not a secret.

## Safety

Never expose the server or the TV API to the internet. Pairing tokens live outside the repository.
This is an unofficial project, not affiliated with Vizio.

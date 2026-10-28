# Contributing

Thanks for helping! Bug reports, compatibility reports for other Vizio models, and pull requests are all welcome.

## Compatibility reports (no coding needed)

If you run Free My Vizio on a TV other than the M65Q6-L4, please
[open a compatibility report](https://github.com/andyboulle/free-my-vizio/issues/new?template=compatibility-report.md)
with the output of `fmv doctor` (it contains no secrets) and what worked.

## Development setup

Requires **Node.js 22.18+** (TypeScript runs directly via Node's type stripping — there is no build step).

```sh
git clone https://github.com/andyboulle/free-my-vizio.git
cd free-my-vizio
npm install          # dev dependencies only (typescript, @types/node)
npm run verify       # type-check + web syntax check + size budget + all tests
npm start            # run the server locally (data in ~/.free-my-vizio)
```

You don't need a TV to work on most of the code: the test suite includes a mock SmartCast TV
(`test/mock-tv/`) that serves real (sanitised) responses captured from an M65Q6-L4 (`docs/evidence/`).

For live-reload of web files with Docker: `docker compose -f deploy/docker/compose.yaml -f deploy/docker/compose.dev.yaml up -d`.

## Project layout

```
src/            Node server (TypeScript, erasable syntax only)
  tv/           SmartCast API client, model profiles, discovery
  supervisor/   "Takeover" state machine
  server/       HTTP server, TV and admin APIs, static files
  catalog/      Vizio app catalog + icons
  config/       config/secrets storage and validation
web/tv/         TV home screen (vanilla HTML/CSS/ES modules, runs in the TV's Chrome 128 runtime)
web/admin/      Admin app (phone-first)
web/shared/     Design tokens, icons, brand colours
deploy/         Docker, systemd and launchd templates
test/           node:test unit + integration tests, mock TV
docs/           User guides; docs/engineering/ = research, architecture, design history
poc/            Original research proof-of-concept (not used by the app)
```

## Ground rules

- **No runtime dependencies**, no bundlers or frameworks. Keep TypeScript to erasable syntax (no `enum`, `namespace`,
  parameter properties); relative imports end in `.ts`.
- **TV performance matters**: the TV's browser is slow. In `web/tv`, animate only `transform`/`opacity`, avoid large
  shadows, blurs and full-screen gradients that change at runtime. See
  [docs/engineering/DESIGN_SPEC.md §14](docs/engineering/DESIGN_SPEC.md).
- **Never** add code that changes TV settings, resets the TV, touches firmware/updates, or probes undocumented endpoints.
- **Never** log or commit tokens, PINs, serial numbers, device IDs, IP addresses of real devices, or `secrets.json`.
  New captures in `docs/evidence/` must be redacted.
- Tests that need the real TV are manual; record them in
  [docs/engineering/MANUAL_TESTS.md](docs/engineering/MANUAL_TESTS.md). Mocks don't prove hardware compatibility.
- Architecture decisions are in [docs/engineering/ARCHITECTURE.md](docs/engineering/ARCHITECTURE.md); propose changes in
  an issue first.

## Pull requests

1. Keep PRs focused; include tests for behaviour changes.
2. `npm run verify` must pass.
3. Update user docs (`README.md`, `docs/*.md`) when you change commands, settings or behaviour.
4. By contributing you agree your contribution is licensed under the MIT License.

# Free My Vizio

A privacy-conscious, customizable home screen for Vizio SmartCast TVs — no firmware modification.
Initial target: **Vizio M65Q6-L4**, firmware 86.910.19.2-1.

**Status:** implementation scaffold complete; M1 TV client is next.

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

The project has no runtime npm dependencies. Development dependencies are used
only for TypeScript type checking. The test-only TLS certificate generated for
the mock TV in a later milestone is not a secret.

## Safety

Never expose the server or the TV API to the internet. Pairing tokens live outside the repository.
This is an unofficial project, not affiliated with Vizio.

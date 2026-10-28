# Security

## Model

Free My Vizio is designed for a **trusted home network** only.

- The server listens on TCP 8730 on your LAN. **Never** port-forward it or expose it to the internet.
- The admin API requires a secret admin token (delivered once via `fmv admin-url`); the TV screen uses a separate
  secret token passed in the URL fragment. Requests with unexpected `Host` headers are rejected (DNS-rebinding defence).
- The TV pairing token and other secrets live only in `secrets.json` in the data directory (mode 0600). They are
  redacted from logs and never returned by the APIs.
- The TV page loads only first-party assets under a strict Content-Security-Policy, because pages running in the TV's
  web runtime can access privileged TV functions.
- The server never changes TV settings, never triggers reset/update/firmware operations, and only uses documented,
  reversible SmartCast API calls.

If you think your admin link leaked: run `fmv rotate-tokens`, restart the server, and run `fmv open`.

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's
[private vulnerability reporting](https://github.com/andyboulle/free-my-vizio/security/advisories/new) for this
repository. Include steps to reproduce and the affected version/commit. Never include real tokens or your admin link.

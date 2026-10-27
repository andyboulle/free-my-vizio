# Evidence captured from the target TV

Captured 2026-10-26 from the target television over its local API (read-only GETs).
Identifiers (serial number, ESN, device UUID, advertising ID, Sentry DSN, ULI IDs, DNS/IP data,
Wi-Fi scan results) were **redacted** before committing.

| File | Source | Use |
|---|---|---|
| `m65q6-l4_86.910.19.2-1_deviceinfo.json` | `GET https://<TV_IP>:7345/state/device/deviceinfo` (no auth required) | Model/firmware/capability ground truth; mock-TV fixture |
| `m65q6-l4_86.910.19.2-1_settings_tree.json` | Recursive `GET /menu_native/dynamic/tv_settings/...` (paired) — map of URI → raw response | Settings paths, types, HASHVAL shapes; mock-TV fixture |
| `catalog/vizio_apps_prod.sample.json` | Trimmed copy (16 apps) of public `https://scfs.vizio.com/appservice/vizio_apps_prod.json` | Catalog parser fixture |
| `catalog/app_availability_prod.sample.json` | Matching trimmed copy of public `.../app_availability_prod.json` (incl. null-id records, MT5586/MT5586L entries) | Payload selection fixture |

Target: Vizio **M65Q6-L4**, firmware **86.910.19.2-1**, ViziOS `mtk5586-1.8.1657.1`,
SCPL/API `3.7.2-2621.0005`, Conjure `128.1.8`, Cast `1.68 (cast_20250829)`.

Test code may load these files as fixtures. Never add unredacted captures to the repository.

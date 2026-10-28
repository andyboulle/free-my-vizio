# Free My Vizio — UI/UX Design Specification

Version 1.0 · 2026-10-27 · Status: **Approved for implementation**

Direction chosen by the owner: **cinematic** (Apple TV / Google TV feel), **fully local animated ambient gradient**
backdrop tinted by the focused app, **large clock + date**, **fireplace screensaver**, and a **full redesign of the
admin page**. Product name stays **Free My Vizio**.

This document is binding for the UI work in the same way `ARCHITECTURE.md` is for the backend. Read
`docs/engineering/IMPLEMENTATION_AGENT_PROMPT.md` first (safety, deviations, stop conditions still apply), then this file, then do
milestones **UI0 → UI7** in §12.

---

## 1. Design principles

1. **10-foot first.** Everything is read from ~3 m away on a 65" panel and driven by a 5-way D-pad. No hover, no pointer,
   no text entry on the TV.
2. **Calm, not empty.** One clear focal point at a time: the clock when idle, the focused card when navigating.
   No ads, no recommendations, no remote content — ever.
3. **Instant feedback.** Every key press produces visible motion within one frame; every action shows progress or a result.
4. **The TV is a weak computer.** MediaTek MT5586-class SoC. Animate only `transform` and `opacity`, budget effects, and
   verify frame rate on the real TV (§10). Pretty but janky = fail.
5. **Never strand the user.** "SmartCast Home" is always reachable; errors explain what to do; Back never exits.
6. **Same language everywhere.** TV and admin share tokens (colors, type, motion), iconography, and copy tone.

## 2. Platform constraints (verified unless marked)

| Constraint | Value | Design impact |
|---|---|---|
| Viewport | **1280 × 720 CSS px**, `devicePixelRatio 1.5` (1920×1080 physical) | Design at 1280×720; assets at ≥1.5× |
| Engine | Chrome 128 (Conjure) | Modern CSS ok: grid, `:focus-visible`, `color-mix()`, `@property`, container queries, `inset`, `aspect-ratio` |
| CSP | `default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'` | **No CDNs, no Google Fonts, no inline `<style>`/`style=""`** → self-host fonts/assets; set dynamic values with `element.style.setProperty()` from JS (allowed: CSSOM is not blocked by `style-src`) |
| Input | ArrowUp/Down/Left/Right, Enter, Backspace (Back). Play/Pause/Info **not** delivered (tested) | Design for 6 keys only. Home/app buttons are handled by the TV |
| Overscan | Modern panel, but some users enable zoom | Title-safe area: 64 px left/right, 40 px top/bottom |
| GPU | Unknown budget | `backdrop-filter` and large blurs are **suspected expensive** → limited use + fallback (§10) |
| Panel | QLED (VA LCD), not OLED | Static UI burn-in is not a concern; screensaver is for ambience, not protection |
| Audio autoplay | **Unverified** in Conjure | Fireplace sound is optional, default off, and gated behind a TV test |

## 3. Design tokens (`web/shared/tokens.css`, imported by TV and admin)

All values are CSS custom properties on `:root`. Never hard-code a colour, size, or duration outside this file.

### 3.1 Colour

```css
--bg-0: #07080b;            /* page base */
--bg-1: #0d0f14;            /* raised surfaces (admin cards) */
--glass: rgb(18 20 26 / .56);
--glass-strong: rgb(18 20 26 / .78);
--stroke: rgb(255 255 255 / .08);
--stroke-strong: rgb(255 255 255 / .16);
--text-1: rgb(255 255 255 / .96);  /* primary */
--text-2: rgb(255 255 255 / .66);  /* secondary */
--text-3: rgb(255 255 255 / .42);  /* tertiary / hints */
--accent: #f0f2f1;          /* user configurable (config.home.accent) */
--focus-ring: rgb(255 255 255 / .92);
--ok: #3ddc97; --warn: #ffb547; --err: #ff5d5d;
--brand: #f0f2f1;           /* set at runtime to the focused shortcut's brand colour */
```

Contrast: `--text-1/--text-2` on `--bg-0` ≥ 7:1 / ≥ 4.5:1. On the ambient backdrop, text sits over the legibility
scrim (§5.2), so the same ratios hold.

### 3.2 Typography

- Font: **Inter** variable (SIL OFL 1.1), self-hosted at `web/shared/fonts/InterVariable.woff2` with
  `web/shared/fonts/LICENSE.txt` (OFL text). Source: the official release at https://github.com/rsms/inter/releases
  (`InterVariable.woff2`). `font-display: block` on TV (avoid font swap flash), `swap` on admin.
- `font-feature-settings: "tnum" 1, "cv11" 1` on the clock (tabular digits, single-storey a).

| Token | TV size / weight / line-height | Use |
|---|---|---|
| `--t-display` | 132 / 200 / 1.0, letter-spacing −0.02em | Hero clock |
| `--t-title` | 34 / 600 / 1.15 | Focused item name in hero |
| `--t-subtitle` | 22 / 450 / 1.3 | Date, focused item subtitle |
| `--t-label` | 20 / 600 / 1.2 | Card label (focused), button text |
| `--t-overline` | 16 / 650 / 1.2, uppercase, letter-spacing 0.14em | Row titles |
| `--t-caption` | 18 / 450 / 1.3 | Hints, toasts (minimum TV text size) |

Admin uses the same family with a standard scale: 32/24/18/16/14 px.

### 3.3 Space, radius, elevation

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 40, 48, 64.
- Radius: `--r-card: 18px`, `--r-wide: 16px`, `--r-pill: 999px`, `--r-panel: 24px`.
- Shadows (focused card only): `0 18px 40px rgb(0 0 0 / .55), 0 0 0 3px var(--focus-ring), 0 0 48px color-mix(in srgb, var(--brand) 55%, transparent)`.

### 3.4 Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | Focus, entrances |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | Row scroll, crossfades |
| `--d-fast` | 120 ms | Press |
| `--d-focus` | 180 ms | Focus scale/glow |
| `--d-scroll` | 280 ms | Row / rail translation |
| `--d-backdrop` | 700 ms | Backdrop colour crossfade |
| `--d-saver-in` / `--d-saver-out` | 1200 ms / 350 ms | Screensaver |

Reduced motion (`config.home.appearance.reduceMotion` or `prefers-reduced-motion`): durations → 0–80 ms, no ambient drift,
no parallax, fireplace still runs (it is content, not decoration) but at 20 fps.

## 4. Screens & information architecture (TV)

```
Home ──(idle N min / "Fireplace" tile)──► Fireplace screensaver ──(any key)──► Home (same focus)
 │
 ├─ App card ──OK──► native app launches (TV leaves our UI)
 ├─ Input card ──OK──► TV switches input
 └─ System pill ──OK──► SmartCast Home (suppresses takeover) | Fireplace | Turn off TV (confirm dialog)
Overlays: Toast · Confirm dialog · Offline banner · Setup screen (no token)
```

## 5. Home screen

### 5.1 Layout (1280×720 CSS px, all coordinates are design targets ±4 px)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐ y=0
│ (ambient backdrop — full bleed)                                                          │
│  64 ──────────────────────────────────────────────────────────────────────────── 1216    │
│  y=40  Living Room ·  ● status chip (only when degraded)                   ⌂ Free My Vizio│ header 40–80
│                                                                                          │
│  y=120  10:42                       (display 132px, weight 200)                          │ hero 112–360
│  y=262  Tuesday, October 27                                                              │
│  y=310  ─ Netflix                    (title 34/600, crossfades with focus)               │
│  y=346  App · Press OK to open       (subtitle, --text-2)                                │
│                                                                                          │
│  y=392  APPS                                                                             │ rail area 392–680
│  y=420  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌──      ← square cards 148×148  │
│         │ N  │ │ ▶  │ │ pv │ │ D+ │ │ hu │ │ ...│ │    │          gap 24, row h 148       │
│         └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                                 │
│  y=600  INPUTS                                                                           │
│  y=628  ┌──────────┐ ┌──────────┐ ┌──────────┐   ← wide cards 220×112 (peek of next row) │
│                                                                                     y=680│
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Header** (y 40–80): left — room title (`config.home.title`, `--t-subtitle`, `--text-2`) and, only when something is
  wrong, a status chip (§5.7). Right — small wordmark "Free My Vizio" at `--text-3` (18 px, 600). No clock here.
- **Hero** (y 112–360): big clock + date (§5.4). Under it, the **focus caption**: focused shortcut name (`--t-title`) and
  subtitle (`--t-subtitle`, `--text-2`): apps → "App · Press OK to open"; inputs → "<input name> · HDMI 1"; system →
  action description. Caption crossfades (opacity 0→1, translateY 6→0, `--d-focus`) on focus change.
- **Rails** (y 392–680): one row per visible section. Row title (`--t-overline`, `--text-3`) 28 px above the cards.
  Vertical rhythm: 40 px between the bottom of one row's cards and the next row title.
  - The **focused row is always placed at y=420** (cards' top edge). Rows above it slide up and fade to 0 opacity
    (they are out of the rail area); the next row peeks from below. Implementation: one container
    `#rails` translated with `translateY` (`--d-scroll`, `--ease-in-out`).
  - When the focused row is not the first row, the hero compresses: the clock scales to 0.55 and moves to top-right
    (x=1216 right-aligned, y=40) over `--d-scroll`, the caption stays at y=120–200, and the rails start at y=260.
    This gives more room for lower rows ("focus mode"). Returning to the first row restores the hero.
- **Horizontal scrolling within a row**: rows can exceed the screen. Keep the focused card at least one card-width
  from the right safe edge and at least 0 from the left safe edge ("edge scroll with lead"). Translate the row track
  with `transform` only. Show a 48 px right-edge fade mask (`mask-image: linear-gradient(...)`) when more cards exist.

### 5.2 Ambient backdrop

Layers, back to front (all `position: fixed; inset: 0; pointer-events: none`):

1. `--bg-0` fill.
2. **Two colour layers A and B** (for crossfading). Each layer = 3 large soft blobs built from
   `radial-gradient()` backgrounds (no `filter: blur()`):
   - Blob 1: `--brand` at 55% alpha, 900×900, centred (980, 140).
   - Blob 2: brand hue rotated +40° (computed in JS) at 35%, 800×800, centred (260, 620).
   - Blob 3: `--accent` at 18%, 700×700, centred (1180, 640).
   - Layers drift slowly: each blob layer animates `transform: translate3d()/scale()` over 40–60 s alternate infinite
     (`will-change: transform`). Drift amplitude ≤ 60 px, scale 1.0–1.08.
3. **Crossfade**: on focus change, set the inactive layer's colours, then swap opacity A↔B over `--d-backdrop`. Debounce
   colour changes by 120 ms so fast scrolling doesn't strobe.
4. **Legibility scrim**: `linear-gradient(180deg, rgb(7 8 11 / .25) 0%, rgb(7 8 11 / .10) 35%, rgb(7 8 11 / .72) 62%, rgb(7 8 11 / .92) 100%)`
   plus a radial vignette `radial-gradient(120% 90% at 50% 40%, transparent 55%, rgb(0 0 0 / .55) 100%)`.
5. **Film grain**: 2% opacity tiled 128×128 noise texture (`web/tv/img/grain.png`, generated once by a script in
   `scripts/make-grain.mjs` using seeded random — commit the PNG). Static; no animation.

Idle "breathing" when nothing is focused for 20 s: brand alpha oscillates ±8% over 8 s. Stop when any key is pressed.

### 5.3 Brand colours

Per-shortcut `brandColor` resolution order:
1. `shortcut.brandColor` from config (admin override).
2. Curated table `web/shared/brand-colors.js` (catalog id → hex):
   Netflix 34 `#E50914`, YouTube 44 `#FF0033`, YouTube TV 45 `#FF0033`, Prime Video 33 `#00A8E1`, Disney+ 76 `#113CCF`,
   Hulu 19 `#1CE783`, Max/HBO Max 128 `#002BE7`, Plex 40 `#E5A00D`, Peacock 88 `#F5C518`, Paramount+ 9 `#0064FF`,
   Tubi 90 `#FA382F`, Apple TV+ 91 `#A1A1A6`, Pluto TV 12 `#FFF200`, Sling 150 `#1E9BE9`, Spotify (if present) `#1DB954`.
3. **Derived from the icon** on the TV: draw the icon (same-origin, so canvas is not tainted) into a 24×24 canvas,
   take the average of non-white (luma < 0.92), non-black (luma > 0.08), opaque pixels; boost saturation to ≥ 0.45
   and clamp lightness to 0.40–0.60 in HSL. Cache in `localStorage` (`fmv.brand.<catalogId>`).
4. Fallback: inputs `#7C8CFF`, system `#9AA3B2`, unknown `--accent`.

### 5.4 Clock & date

- Format from `config.home.clock.format`: `auto` (from `Intl.DateTimeFormat().resolvedOptions().hourCycle`), `12h`, `24h`.
  12h shows "10:42" with a smaller "PM" (`--t-subtitle`, `--text-2`, baseline aligned).
- Date line (`config.home.clock.showDate`, default true): `Intl.DateTimeFormat(undefined, {weekday:'long', month:'long', day:'numeric'})`.
- Update aligned to the minute (`setTimeout` to the next minute boundary, then every 60 s). Digit changes crossfade 300 ms.
- Greeting (optional, `config.home.clock.greeting`, default false): "Good evening" above the clock in `--t-subtitle`.

### 5.5 Cards

**App card** — 148×148, `--r-card`. The catalog icon fills the card (`object-fit: cover`). If the icon has
transparency or fails to load, the card background is the brand colour with the app name centred (20/700, white).
Rest state: no label, 1 px inset border `--stroke`, brightness 0.92.

**Input card** — 220×112, `--r-wide`, glass background (`--glass`, see §10 fallback). Left: 40 px line icon
(`web/tv/img/input-hdmi.svg`, `input-tv.svg`, `input-av.svg`, `input-cast.svg`; 2 px stroke, `--text-1`).
Right: user label (e.g. "Apple TV") 20/600 and the port ("HDMI 1") 16/450 `--text-2`. Labels always visible.

**System pill** — height 64, padding 0 28 px, `--r-pill`, glass. 28 px icon + label 20/600. Items:
"SmartCast Home" (`icon-home.svg`), "Fireplace" (`icon-flame.svg`), "Turn off TV" (`icon-power.svg`).

| State | Visual (all transitions `--d-focus`, `--ease-out`, transform/opacity/box-shadow only) |
|---|---|
| Rest | scale 1.0, brightness .92 (via an overlay `::after` with opacity, not `filter`) |
| Focused | scale **1.12** (app), 1.08 (input/pill); focus shadow (§3.3); brightness 1.0; label appears 14 px below app cards (20/600, `--text-1`, fade+rise) |
| Pressed (Enter keydown→keyup) | scale −0.06 from focused over `--d-fast`, then back |
| Loading (activate pending) | 3 px circular progress arc around the card edge (SVG `stroke-dasharray` animation) in `--focus-ring`; card stays focused |
| Success | app/input: no extra UI (the TV switches). system: toast |
| Error | horizontal shake (−6, 6, −3, 0 px, 300 ms) + toast with reason |
| Unavailable (`available:false`) | 45% opacity, small "Unavailable" badge bottom-left; OK shows toast "Not available on this TV" |

Focus must never be lost: exactly one element has focus at all times on the TV.

### 5.6 Navigation model

- Left/Right: move within the row (stop at ends; **no wrap**). At an end, play a 120 ms "bump" (translateX ±8 px).
- Up/Down: move to the previous/next non-empty row; column = the card whose horizontal centre is closest to the current
  card's centre (works for mixed card widths). Remember the last focused index per row and restore it when returning
  to that row if it is within ±1 card of the geometric target.
- Enter: activate. Ignore key auto-repeat for Enter (`e.repeat`).
- Back: if a dialog is open → close it. Else if not on the first card of the first row → focus first card of the first
  row (animated). Else → bump. Never exit.
- Key repeat on arrows: allowed; throttle to one move per 90 ms to keep animations readable.
- The focus engine stays a pure module (`web/tv/js/focus.js`) operating on measured card rectangles
  (`{id,row,x,width}`) so it is unit-testable in Node.

### 5.7 Status & feedback

- **Status chip** (header, only when degraded): glass pill 32 px high with dot + text. States:
  `Reconnecting…` (warn, server unreachable), `TV not responding` (warn, from `/api/tv/status` when takeover is UNREACHABLE),
  `Takeover paused` (neutral, suppressed or loop-guarded) with remaining minutes.
- **Offline banner** replaces the old red bar: glass panel, top centre, 520 px wide: "Can't reach the Free My Vizio server.
  Retrying in 8 s…" with a live countdown; existing tiles stay visible but dimmed 50% and activation shows the same message.
- **Toast**: bottom-centre, glass, 18–20 px text, icon + message, auto-hide 3 s, slides up 12 px. **Hidden from the DOM
  when empty** (the current build shows an empty box — fix). Max one toast; new ones replace.
- **Confirm dialog** ("Turn off TV?"): centred glass panel 560×260, title 28/600, body 20/450, buttons [Cancel] [Turn off];
  default focus **Cancel**; Left/Right moves between buttons; Back = Cancel; focus is trapped in the dialog; the scene behind
  dims to 40% and scales to 0.98.

### 5.8 Empty, setup and first-run states

- **No token / opened incorrectly**: full-screen centred card: wordmark, "Open Free My Vizio from your phone or the server
  to finish setup", and the admin URL host (`location.host`) in 22 px. No secrets shown.
- **No visible shortcuts**: hero stays; rail area shows a glass panel: "Add apps from the Free My Vizio admin page on your
  phone" + the host.
- **Entrance animation** on load: backdrop fades in (600 ms), clock rises 12 px + fades (500 ms, delay 100), rows stagger in
  (each card 40 ms apart, max 400 ms total). Skip entirely with reduced motion.

## 6. Fireplace screensaver

### 6.1 Behaviour

- Starts after `config.screensaver.idleMinutes` (default **5**, options 1/2/5/10/15/30, or disabled) with no key press
  **while our UI is visible**, or immediately from the "Fireplace" system pill.
- Any key exits: fade out `--d-saver-out`, the key press is **consumed** (does not move focus), focus returns to the
  previously focused card.
- Stops rendering (cancel `requestAnimationFrame`) when `document.hidden` or when the page is about to be replaced.
- While active, the TV UI keeps its 30 s home refresh paused.
- **Interplay with TV power features is unverified** — the TV's "Auto Power Off: 10 minutes" setting and any native
  SmartCast screensaver may turn off the panel or overlay us. Test MT-UI5.3/5.4 decides; if the TV powers off during the
  fireplace, document it and recommend the user set Auto Power Off as desired (do not change TV settings from code).

### 6.2 Visual composition (1280×720)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  dark room: radial warm glow from bottom centre (#ff7a1a → transparent), breathing │
│                                                                                │
│                         embers rising (≤ 40 sprites)                           │
│                     ░▒▓ flames (canvas, procedural) ▓▒░                        │
│                 ▄▄▄▄▄▄▄▄▄ logs (SVG silhouette, glowing edges) ▄▄▄▄▄▄          │
│  10:42 (bottom-left, 40 px, --text-3, pixel-shifts ±6 px every 60 s)  [optional] │
└────────────────────────────────────────────────────────────────────────────────┘
```

1. **Room**: `#050302` fill + radial glow `radial-gradient(60% 55% at 50% 88%, rgb(255 122 26 / .38), transparent 70%)`
   whose opacity "breathes" (0.75–1.0, irregular: sum of two sines at 0.37 Hz and 0.11 Hz) — driven from the fire
   intensity each frame (CSS variable `--glow` set via `style.setProperty`).
2. **Flames** — `<canvas id="fire">` using the classic **"Doom fire" cellular automaton**:
   - Simulation grid **160×90** cells (cheap), rendered to a 160×90 `ImageData`, drawn to the canvas and **upscaled by CSS**
     to 960×540 positioned bottom-centre (`image-rendering: auto` → soft), plus `filter: blur(2px)` **on the canvas only**
     (one small element; verify perf).
   - Palette: 37 entries from transparent black → deep red `#1f0707` → `#9f2f07` → orange `#df5f07` → `#efa71f` →
     yellow `#dfcf6f` → near-white `#efefc7`. Alpha ramps from 0 at index 0 to 1 at index 6.
   - Propagation each step: for each cell, `src = cell below`; `decay = rand(0..2)`; `dst = cell - decay + windOffset`
     (wind offset −1..+1 slowly varying, so flames sway); `value = max(0, src - (decay & 1))`.
   - Source row: base intensity 36 with ±10% flicker per cell; the source is shaped to the log bed (intensity 0 outside
     x 30%–70% of width with soft falloff) so flames rise from the logs, not edge to edge.
   - **Intensity** (`config.screensaver.intensity`): low/medium/high → max flame height 45%/60%/75% of the canvas
     (implemented as an extra decay bias).
   - Run the simulation at **30 steps/s** (accumulate rAF time; skip frames when ahead). Use a `Uint8Array` and a
     precomputed `Uint32Array` palette for writes (no per-pixel object allocation).
3. **Logs**: `web/tv/img/logs.svg` — 3 stacked rounded logs, dark brown `#1a0d06`, with an inner orange edge glow
   (`#ff8a3d`, opacity animated from `--glow`). Sits in front of the flame base so flames emerge from behind/between logs.
4. **Embers**: up to 40 small (2–4 px) orange-yellow dots; each is a `<div>` animated with CSS keyframes
   (translateY −220…−420 px, translateX sway ±30 px, opacity 1→0, 2.5–5 s, randomized delays). Respawn by restarting
   the animation (`animationiteration`). No canvas work.
5. **Optional clock** (`config.screensaver.showClock`, default true): small, dim, pixel-shifts every minute.
6. **Hint**: "Press any button to return" (`--t-caption`, `--text-3`) fades out after 4 s.
7. **Sound** (`config.screensaver.sound`, default **false**; P2): procedural crackle via Web Audio (brown-noise bed at
   −30 dB + random short noise bursts with fast decay at 0.5–4 Hz). Only enable after MT-UI5.5 proves audio works in
   Conjure; volume follows the TV volume — keep levels low.

Module: `web/tv/js/fireplace.js` exporting `createFireplace(root, options) → { start(), stop(), setIntensity() }`; the
simulation step `stepFire(cells, width, height, rng, wind, bias)` is pure and unit-tested (determinism with a seeded RNG,
bounds, no negative values, source row shaping).

## 7. Admin app redesign (phone-first, responsive)

Goal: a polished control app you'd be happy to open on your phone every day. Same tokens, Inter, dark by default,
`prefers-color-scheme: light` supported with a light token set (`--bg-0:#f6f7f9`, text dark, same accent).

### 7.1 Shell & navigation

- **< 768 px (phone)**: top app bar (title of the current view + status dot) and a **bottom tab bar** with 5 tabs:
  **Home** (dashboard), **Layout**, **Remote**, **Appearance**, **Settings**. 56 px bar, icons + labels, safe-area insets
  (`env(safe-area-inset-bottom)`).
- **≥ 768 px**: left sidebar (240 px) with the same 5 items; content max-width 960 px.
- Hash routing: `#/home`, `#/layout`, `#/remote`, `#/appearance`, `#/settings`, `#/settings/diagnostics`,
  `#/settings/pairing`. Remove the admin token fragment on load (already done) and keep routing working.
- Global toast/snackbar bottom (above tab bar) with optional **Undo** action (6 s).
- Loading: skeleton placeholders, never raw "Loading…" text. Errors: inline banner with retry.

### 7.2 Views

**Home (dashboard)**
- Hero card: TV name, model + firmware (small), a large state line in plain English:
  "Showing Free My Vizio" / "Watching Netflix" (catalog name lookup) / "On HDMI 1" / "TV is off" / "Can't reach the TV".
  Coloured dot (ok/warn/err).
- Primary actions: **Open on TV**, **Pause takeover** (sheet: 15 min / 1 h / until TV off → maps to suppression; requires a
  small admin endpoint, §8), **Resume**.
- Quick launch: horizontal scroller of the user's visible app shortcuts (icons) → `POST /api/admin/activate` (§8) to launch
  on the TV from the phone.
- Health row: server uptime, last takeover launch ("2 min ago"), verification badge (Verified M65Q6-L4 · 86.910.19.2-1, or
  amber "Unverified model/firmware").

**Layout**
- **Live preview** at the top: a scaled (16:9) rendering of the TV home using the same `render.js` + CSS in an
  `<iframe src="/tv/preview.html">` (no TV token; the admin page posts the draft layout via `postMessage`). Shows backdrop,
  clock, and rails. Tap a card in the list below → highlight it in the preview.
- **Sections list**: each section is a collapsible card with title (inline rename), drag handle, and its shortcuts as rows:
  icon, label (inline rename), kind badge, **visibility toggle** (eye), drag handle, overflow menu (Rename, Change brand colour,
  Move to section…, Remove). Hidden items render at 50% with "Hidden on TV".
- **Reordering**: pointer-events drag & drop (long-press 250 ms on touch to start, autoscroll near edges, drop indicator line)
  **and** accessible Move up / Move down in the overflow menu.
- **Add** (floating action button "+" on phone, button on desktop) → bottom sheet with segmented control
  [Apps | Inputs | System]:
  - Apps: search field + grid of catalog apps (icon + name), already-added ones show a check; tap to add/remove.
  - Inputs: from `/api/admin/inputs`, with the TV's names; tap to add.
  - System: SmartCast Home (always present, cannot be removed/hidden — show a lock icon), Turn off TV.
- **Saving**: autosave 600 ms after the last change (`PUT /api/admin/config`), status text "Saving… / Saved" in the app bar,
  Undo snackbar for remove/hide/move. On validation error, show inline errors and keep the unsaved draft.

**Remote**
- Phone remote that drives the TV via `/api/admin/key`: large circular D-pad (OK centre), Back, Home, Vol −/+, Mute,
  Power off; haptic tap (`navigator.vibrate(10)` where supported). Buttons ≥ 64 px. Below: input switcher chips
  (activates input shortcuts). Long-press on Vol repeats every 200 ms.

**Appearance**
- Theme: Cinematic (dark ambient, default) · OLED (pure black, no backdrop blobs, static) · Light (soft daylight gradient,
  dark text). Live preview card.
- Accent: 8 swatches (`#f0f2f1 #7C8CFF #B07CFF #FF6FAE #FF7A59 #FFB547 #3DDC97 #2BD4C9`) + custom hex input.
- Backdrop: Ambient (animated) · Still (no drift) · Off.
- Clock: 12h / 24h / Auto, Show date, Greeting.
- Card labels: Focused only (default) · Always.
- Reduce motion toggle.
- Fireplace screensaver: removed by the owner-approved T5 performance decision in §14.8.

**Settings**
- Takeover: mode as three radio cards with plain-language descriptions:
  "Always — bring Free My Vizio back whenever SmartCast Home appears" · "At power-on only" · "Off".
  SmartCast Home pause length (minutes).
- TV: host/IP (read-only + "Find TV" which runs discovery if implemented), **Pairing wizard** (stepper: 1 Start → 2 Enter the
  PIN shown on your TV (4 large digit boxes, numeric keyboard) → 3 Done; cancel on leave).
- Diagnostics (sub-page): humanized event timeline (icon, time-ago, message), filters (All/Warnings/Errors), **Copy report**
  (redacted JSON already provided by the server), raw JSON behind a disclosure.
- About: version, links to docs, licences (Inter OFL, icon set).

### 7.3 Admin accessibility & quality bar
WCAG 2.2 AA contrast; all controls reachable by keyboard with visible `:focus-visible`; touch targets ≥ 44×44;
`aria-live="polite"` for save status/toasts; form labels on every input; works at 360 px width and at 200% zoom;
no layout shift on load (reserve skeleton space).

## 8. Data & API changes required by the design

### 8.1 Config → `schemaVersion: 2` (update `schema.ts`, `validateConfig`, `migrateConfig`)

```jsonc
"home": {
  "title": "Living Room", "theme": "cinematic" /* cinematic | oled | light */, "accent": "#f0f2f1",
  "clock": { "format": "auto" /* auto|12h|24h */, "showDate": true, "greeting": false },
  "appearance": { "backdrop": "ambient" /* ambient|still|off */, "labels": "focused" /* focused|always */, "reduceMotion": false },
  "sections": [ /* unchanged shape; Shortcut gains optional "brandColor": "#RRGGBB" */ ]
},
```
- Fireplace screensaver configuration and system action were removed after the owner-approved T5 performance decision
  recorded in §14.8.
- Migration v1→v2: `theme: dark→cinematic, oled→oled, light→light`; `showClock:false` → `clock` kept but the hero shows
  only the date and caption; add defaults for new blocks; write back on first load. Unit-test the migration.
- `validateConfig` covers every new field (enums, `idleMinutes ∈ {1,2,5,10,15,30}`, `brandColor` `/^#[0-9a-f]{6}$/i`).

### 8.2 API
- `GET /api/tv/home` adds: `clock`, `appearance`, `accent`, and per shortcut `subtitle` (input port
  "HDMI 1" for inputs; description for system), `brandColor` (config override only), `available` (false if the app has
  no payload for this TV), `icon` (only when cached).
- `POST /api/admin/activate {shortcutId}` — same as the TV route, for phone quick-launch.
- `POST /api/admin/takeover/pause {minutes | "untilStandby"}` and `POST /api/admin/takeover/resume` — wrap supervisor
  suppression (reuse `suppressGeneration` semantics).
- There is no fireplace preview endpoint or screensaver status payload.
- `GET /api/admin/apps-summary` (optional) — or reuse `/api/admin/catalog` with icons for the add sheet.
- **CSP for the preview**: `/tv/preview.html` must be served with `frame-ancestors 'self'` (all other TV/admin HTML keeps
  `frame-ancestors 'none'`). The preview page needs no token: it renders only the draft layout posted by the admin page via
  `postMessage` (verify `event.origin === location.origin`) and uses icon URLs, never calling `/api/tv/*`.

### 8.3 Icons
- Cached icons are **WebP** but saved/served as `.png` with `Content-Type: image/png` — wrong. Detect the format from the
  magic bytes on download (`RIFF....WEBP` → webp, `\x89PNG` → png, `\xFF\xD8` → jpeg), store as `<id>.<ext>`, serve with
  the correct type, and return the right URL in `/api/tv/home`. Update the `/icons/` route regex.

### 8.4 Carry-over from review
- **R4 is not actually fixed**: the live CSP still ends with `base-uri 'none' }` (Chrome logs two CSP errors). Fix in UI0.

## 9. Copy & tone

Short, friendly, specific. Sentence case. No jargon on the TV (never "takeover", "payload", "Conjure" on the TV).
Examples: "Opening Netflix…", "Couldn't switch to HDMI 1. Is the TV on?", "SmartCast Home — Free My Vizio will come back
in 10 min", "Turn off the TV?". Admin may use "Takeover" with a one-line explanation.

## 10. Performance & quality budgets (TV)

| Budget | Target | How to verify |
|---|---|---|
| First meaningful paint | ≤ 1.2 s after launch on the TV | `performance.now()` at first render, posted to the debug overlay |
| Focus move | ≤ 1 frame to start; animation ≥ 50 fps | Debug overlay FPS meter |
| Fireplace | ≥ 28 fps sustained 10 min; no growth in memory | Debug overlay (fps + `performance.memory` if available) |
| Payload | JS ≤ 60 KB, CSS ≤ 30 KB (unminified OK), font ≤ 360 KB | `scripts/size-report.mjs` in `npm run verify` (fails over budget) |
| Main-thread work per frame (idle home) | ~0 (only CSS transform animations) | DevTools on desktop Chrome with 4× CPU throttle |

- **Debug overlay**: `?debug=1` on the TV URL (append in `fmv open --debug`) shows FPS (rAF-based, 1 s window), last frame
  time, effect level, and first-render time in the top-right corner. Not shown otherwise.
- **Effect levels** (`fx-high` default / `fx-low` class on `<body>`): `fx-low` disables `backdrop-filter` (uses `--glass-strong`
  instead), disables blob drift, removes the canvas blur on the fire, and halves ember count. **Auto-downgrade**: if measured
  FPS on the home screen averages < 45 for 5 s after load, switch to `fx-low` and store `fmv.fx=low` in `localStorage`.
  `backdrop-filter` is used **only** on: status chip, toast, offline banner, dialog (never on cards or rails).
- No layout reads after writes in animation paths; measure card rects once per render and on resize.

## 11. File plan (TV and admin)

```
web/shared/tokens.css            # §3 tokens (+ light token set for admin)
web/shared/fonts/InterVariable.woff2, LICENSE.txt
web/shared/brand-colors.js       # §5.3 table + derive/caching helpers (pure parts testable)
web/shared/icons/*.svg           # line icons: home, flame, power, hdmi, tv, av, cast, eye, eye-off, grip, plus, search,
                                 # remote, settings, layout, palette, wifi-off, check, chevron (author or copy from Lucide, ISC; keep LICENSE)
web/tv/index.html, preview.html
web/tv/css/base.css (layout), cards.css, backdrop.css, overlays.css, fireplace.css, themes.css
web/tv/js/main.js (bootstrap), api.js, state.js (existing), focus.js (geometry-based), render.js, rails.js (scroll/translate),
          backdrop.js, clock.js, toast.js, dialog.js, idle.js (screensaver timer), fireplace.js, debug.js, fx.js
web/tv/img/logs.svg, grain.png
web/admin/index.html, admin.css, js/{app.js,router.js,api.js,views/{home,layout,remote,appearance,settings,diagnostics}.js,
          components/{toast,sheet,dnd,toggle,segmented,stepper}.js}
scripts/make-grain.mjs, scripts/size-report.mjs
test/unit/{focus-geometry,brand-color,fireplace-step,clock-format,config-v2,icon-format}.test.{js,ts}
```

Keep the zero-runtime-dependency rule: no frameworks, no bundlers, no CSS preprocessors.

## 12. Milestones

Each milestone: implement → `npm run verify` → screenshots at 1280×720 of the listed states (desktop Chrome is fine for
visual review; save to `docs/screenshots/<milestone>/`, gitignored if large) → manual TV checks → commit `feat(ui): UI<n> …`.

| # | Scope | Acceptance |
|---|---|---|
| **UI0** | Foundations: tokens.css, Inter self-hosted, icon set, CSP fix (R4), icon format fix (§8.3), config v2 + migration + validation, `/api/tv/home` additions, debug overlay, size-report | `verify` green incl. migration + icon-format tests; live CSP header exact (no console CSP errors); icons served as `image/webp`; size report within budget |
| **UI1** | Home layout & cards: header, hero clock/date/caption, rails with focused-row placement, app/input/pill cards with all states, entrance animation, toast fix, empty/setup states | Screenshots match §5 layout (±4 px); unit tests for geometry focus (mixed widths, row memory, no wrap), clock formatting; MT-UI1.1 every card reachable; MT-UI1.2 no visible jank on the TV with debug overlay ≥ 50 fps during focus moves |
| **UI2** | Ambient backdrop, brand colours (curated + derived), crossfade, scrim, grain, fx levels + auto-downgrade, reduced motion | brand-color unit tests (derive from synthetic ImageData); MT-UI2.1 backdrop colour follows focus without strobing during fast scrolling; MT-UI2.2 FPS ≥ 45 on home with `fx-high` or auto-switches to `fx-low` |
| **UI3** | Overlays: status chip, offline banner with countdown, confirm dialog (power off), system pills incl. Fireplace action | MT-UI3.1 stop server → banner + countdown, recover automatically; MT-UI3.2 Turn off TV → dialog default Cancel, Back cancels, confirm turns TV off |
| **UI4** | Hero "focus mode" compression for lower rows + horizontal edge-scroll with lead + right-edge fade | Screenshots for row 1 vs row 2 focus; MT-UI4.1 with ≥ 12 apps, scrolling right/left keeps focus visible and lead respected |
| **UI5** | Fireplace screensaver (idle timer, pill trigger, preview flag via status), logs/embers/glow, intensity, clock pixel-shift | `stepFire` unit tests; MT-UI5.1 starts after idle; any key returns to the same card; MT-UI5.2 ≥ 28 fps for 10 min (debug overlay) else `fx-low` path verified; **MT-UI5.3** leave fireplace running 15 min — record whether the TV's Auto Power Off or a native screensaver interrupts; **MT-UI5.4** same after the TV's Auto Power Off is set to Off by the user manually (do not automate); MT-UI5.5 (P2, optional) Web Audio plays in Conjure → only then enable the Sound option |
| **UI6** | Admin shell + Home dashboard + Remote + Settings (takeover cards, pairing wizard, diagnostics timeline) + new admin endpoints (§8.2) | Admin endpoint tests (auth, validation, pause/resume semantics, preview flag); manual: works on an iPhone-size viewport (360–430 px) and desktop; Lighthouse-style checks: no console errors, contrast AA |
| **UI7** | Admin Layout editor (live preview iframe, drag & drop + accessible move, add sheet with search, autosave + undo) and Appearance view | MT-UI7.1 reorder by drag on a phone → TV reflects within 35 s (or immediately on next visibility); MT-UI7.2 hide/unhide with Undo; MT-UI7.3 change accent/theme → preview updates instantly and TV after refresh |

Record all MT results in `docs/engineering/MANUAL_TESTS.md`. Stop-and-report conditions from the agent prompt still apply; in addition,
stop and report if the home screen cannot reach ≥ 45 fps even with `fx-low` (the design must then be simplified with the owner).

## 13. Out of scope (do not build)

Weather, multiple profiles, quick-settings row, content recommendations/metadata, any remote images or fonts, any change
to TV settings from the UI (screensaver tests ask the user to change Auto Power Off manually), video files for the
fireplace (procedural only), new runtime dependencies.

---

## 14. Performance revision — "Cinematic Lite" (2026-10-27) — **supersedes conflicting parts of §3.3, §5.2, §5.5, §6.2, §10, §12 (UI2/UI5)**

### 14.1 Decision

**SIMPLIFY** (not preserve, not redesign). Keep the product direction — dark cinematic look, big clock + date, focus
caption, square brand-art cards, brand-tinted background, fireplace — but render it as a **static, compositor-friendly
scene**. The ambient *motion* is dropped; the ambient *colour* is kept. A single rendering tier ("lite") is the default
and only required tier for the M65Q6-L4. The optional "enhanced" tier becomes an admin opt-in, not an automatic mode.

### 14.2 Rationale (from the observed 12–13 FPS during rapid Left/Right)

Code review of UI0–UI7 shows the drop is caused by **per-key-press repaint and forced layout**, not by an inherently slow
device:

| Cause in current build | Cost per key press / frame |
|---|---|
| `.tile` transitions `box-shadow` with a 40 px drop shadow **and** a 48 px `color-mix()` glow (`base.css .tile:focus`) | Two large blurred shadows re-rasterised every frame for 180 ms on two cards, at 1.5× DPR |
| Backdrop = two full-screen (+60 px) layers with three `radial-gradient(color-mix())` each, drifting, plus scrim and grain | Each brand change (`backdrop.js` sets `--brand`) re-rasterises a ~2000×1170 px gradient layer, then cross-fades two full-screen layers (≥ 5 full-screen blended layers of overdraw) |
| `.row[data-overflow] { mask-image }` on the **moving** track | The masked layer is re-rastered whenever the track translates |
| `updateRailFocus()` on every key: sets custom properties on `#rails` (invalidates style for the whole subtree), toggles a class on every `.rail`, calls `getBoundingClientRect()` on all rows after style writes | Forced synchronous style + layout on every press |
| `tile.focus()` without `preventScroll` | Browser scroll-into-view work on each move |
| No key throttle (spec §5.6 asked for 90 ms; `keys.js` has none) | Auto-repeat (~15–30/s) queues more work than a frame can absorb |
| Focus-mode animates `height` and `font-size` of the hero | Layout animation |
| Fireplace sets `--glow` on the full-screen root each frame and `filter: blur()` on an upscaled canvas | Full-screen repaint + filter every frame |
| Auto-downgrade samples average FPS over 5 s windows | Idle time masks interaction stalls → downgrade unreliable (matches the observed "stayed fx-high at 12 FPS") |

Every one of these can be removed without changing the look meaningfully, so a redesign is unjustified. Preserving the
current effects is not possible on this hardware.

### 14.3 Effect classification

| Effect | Status | Lite implementation |
|---|---|---|
| Visible focus (ring + scale) | **Mandatory** | `transform: scale(1.08)` + ring/glow on a `::before` pseudo-element whose **opacity** animates; shadows themselves never animate |
| Activation feedback (spinner/arc), toasts, offline banner, confirm dialog, status chip | **Mandatory** | Opaque `--glass-strong` surfaces, no blur |
| Brand-tinted background | **Mandatory (as colour)** | Two solid-colour layers cross-fading by opacity under one static shading layer (§14.4 item 2) |
| Big clock, date, focus caption | **Mandatory** | Text only; caption updated at most once per frame |
| Focus transitions | **Mandatory, simplified** | transform + opacity only, 140 ms |
| Row scrolling | **Mandatory, simplified** | `translate3d` on the track only; offsets from cached geometry |
| Right-edge fade | Optional | Static gradient overlay fixed at the rail edge (not a mask on the track) |
| Entrance animation | Optional | Single opacity fade of `#app` 300 ms; no per-card stagger |
| Focus-mode hero compression | Optional | Transform-only (`translateY`/`scale` on `#hero`), no height/font-size animation |
| Brand-colour derivation from icons | Optional | Only via `requestIdleCallback` after first render, cached; never on the key path |
| Ambient drift / breathing | **Expendable — removed** in lite | — |
| Radial-gradient blobs / `color-mix()` at runtime | **Expendable — removed** from all per-frame/per-focus paths | Colours precomputed in JS as plain `rgb()` strings |
| Film grain | **Expendable — removed** | — |
| `backdrop-filter` / blur anywhere on the TV | **Expendable — removed** | — |
| Large drop shadow (40 px) + 48 px glow | **Expendable — replaced** | Static ring 3 px + 16 px glow on the pseudo-element, rasterised once |

### 14.4 Prioritised implementation changes (do in this order; measure after each with §14.6 test T1)

1. **Input path** (`keys.js`, `main.js`):
   - Coalesce moves: keep only the latest pending direction and process **at most one move per animation frame**, and
     ignore repeats closer than **110 ms** (`e.repeat`). Enter ignores repeats.
   - `tile.focus({ preventScroll: true })`.
   - `focusAt()` does DOM **writes only**: update the two affected tiles (old/new), the caption (skip if unchanged), and
     the focused row's track transform. Never touch all `.rail`s; never set custom properties on `#rails`/`:root` per key.
2. **Focus styling** (`base.css`):
   - Remove `box-shadow` from `.tile` and `.tile:focus` and from the `transition` list.
   - Add `.tile::before { content:""; position:absolute; inset:-4px; border-radius:inherit; box-shadow: 0 0 0 3px var(--focus-ring), 0 0 16px var(--brand-glow); opacity:0; transition: opacity 140ms var(--ease-out); }`
     and `.tile:focus::before { opacity:1 }`. `--brand-glow` is a precomputed `rgb(r g b / .55)` string set **once per tile
     at render time** (no `color-mix()`).
   - `.tile { transition: transform 140ms var(--ease-out) }`, `.tile:focus { transform: scale(1.08) }` (apps too; 1.12 dropped).
   - `.tile` keeps `overflow:hidden` on an inner wrapper only (the `::before` ring must not be clipped).
3. **Backdrop** (`index.html`, `base.css`, `backdrop.js`) — replace the whole layer stack with exactly three elements:
   - `.bg-tint[data-layer=a|b]`: full-screen, **solid** `background-color` = brand mixed 22% into `--bg-0` (computed in JS
     with simple RGB lerp). Change colour only on the inactive layer, then swap **opacity** (400 ms). Debounce 250 ms after
     the last move so held keys never trigger it.
   - `.bg-shade`: one static full-screen element painted once: `radial-gradient(70% 80% at 80% 15%, transparent 0%, rgb(7 8 11 / .55) 55%, rgb(7 8 11 / .96) 100%)`
     followed by the existing bottom legibility gradient. Its colours never change, so it is rasterised once.
   - Delete drift keyframes, grain, the third accent blob, and all runtime `color-mix()`.
   - Result: the brand colour "glows" from the top right exactly as before, but changing it costs one solid fill + one
     compositor opacity fade.
4. **Rails** (`rails.js`, `base.css`):
   - Remove `mask-image` from `.row`. Add one static `.rail-fade` element (absolute, right 0, width 64 px, full rail-area
     height, gradient `transparent → rgb(7 8 11 / .9)`) shown only when the focused row overflows.
   - Cache each card's `offsetLeft`/`offsetWidth` and the track width after render (and on resize); `scrollTrackToFocus`
     uses the cache — **no `getBoundingClientRect()` on the key path**.
   - Vertical row change: `#rails` gets an inline `transform: translate3d(0, Ypx, 0)` (not a custom property).
   - `will-change: transform` on `#rails` and on each `.row` track only (not on every tile).
5. **Hero focus-mode**: animate only `transform` on `#hero` (e.g. `translateY(-92px)`) and on `.hero-clock`
   (`translate(...) scale(.55)` with `transform-origin: top right`); no `height`/`font-size` transitions. Final layout
   positions may differ ±16 px from §5.1; that is accepted.
6. **Overlays**: remove every `backdrop-filter` on the TV; use `--glass-strong`. Remove the `#app[aria-hidden]` scale-down
   (use a 40% black dim overlay fading by opacity instead).
7. **Entrance**: replace the per-card stagger with one 300 ms opacity fade of `#app`.
8. **Brand derivation**: run `deriveBrandColor` for uncached icons in `requestIdleCallback` (fallback `setTimeout(…, 2000)`)
   after first render, one icon per callback; apply to tiles not currently focused, else on next focus.
9. **Tiers** (`fx.js`): delete the automatic FPS downgrade and the `fmv.fx` key. Body class is `fx-lite` by default.
   New config field `home.appearance.effects: "lite" | "enhanced"` (default `"lite"`; schema v2 additive change with
   validation + migration default). `enhanced` re-enables only: 140 ms caption cross-fade, entrance stagger, slow drift of
   `.bg-shade` via transform (no gradient re-raster). Admin Appearance shows "Effects: Standard (recommended for this TV) /
   Enhanced (may stutter)".
10. **Fireplace** (`fireplace.js`, `fireplace.css`):
    - Keep it; it is a separate full-screen mode with its own target (§14.5).
    - Remove `filter: blur()` from the canvas. Simulate at **20 steps/s** on a 160×90 grid; render to the canvas and let CSS
      upscale with smoothing (bilinear) — the softness replaces the blur.
    - Glow: a separate static `.fire-glow` element (gradient painted once); animate its **opacity** from JS
      (`el.style.opacity = …` at 20 Hz) — never `setProperty('--glow')` on the root.
    - Embers: reduce to **12** CSS-animated elements (transform/opacity only).
    - Logs: unchanged (static SVG).
    - Draw/compute only when a simulation step is due; skip rAF callbacks otherwise.
11. **Debug overlay** (`debug.js`): text updates at most **2×/s** (the overlay itself must not repaint every frame). Show:
    current FPS (1 s), **min 1-s FPS since reset**, **p95 frame time** and **count of frames > 50 ms** over the last 10 s,
    tier, first-render ms. Reset stats on `?debug=1` load and whenever the screensaver starts/stops. Also `POST` a summary
    every 10 s to new `POST /api/tv/debug-metrics` (tvUiToken auth, accepted **only** when the TV UI was opened with debug;
    body ≤ 1 KB; server logs it as `tv_perf` at info level). This makes results readable from `docker logs` without
    eyeballing the TV.
12. **Baseline page**: `?debug=1&fx=none` renders the home with backdrop, ring and transitions disabled (flat colours) —
    used only to measure the device ceiling (T0).

### 14.5 Revised acceptance criteria (replace UI2 and UI5 performance criteria and §10 FPS rows)

All measurements on the real M65Q6-L4, TV UI opened with `fmv open --debug`, values read from the `tv_perf` log lines.

| ID | Scenario | Pass |
|---|---|---|
| **T0** Baseline | `?fx=none`, hold Right on a row of ≥ 10 cards for 5 s, then Left for 5 s | Records the ceiling `B` = median FPS. If `B < 50`, **stop and report** (the platform, not the design, is limiting; thresholds below become relative: replace 45 with `0.85·B`) |
| **T1** Rapid horizontal | Lite tier, ≥ 10 app cards, hold Right 5 s, hold Left 5 s, repeat 3× | Median FPS ≥ **50**; min 1-s FPS ≥ **40**; p95 frame ≤ **33 ms**; frames > 50 ms ≤ **3 per 10 s**; focus never lands on a stale card (visual check) |
| **T2** Vertical + focus mode | Press Down/Up between all rows 20× at ~3 presses/s | Same thresholds as T1 |
| **T3** Brand change | Move across 6 apps with different brand colours, pausing 1 s on each | No 10-s window with > 2 frames > 50 ms; background colour settles ≤ 700 ms after the pause |
| **T4** Idle home | No input for 60 s | Median FPS ≥ **55** (should be ~display rate; nothing animates) |
| **T5** Fireplace | Fireplace running 10 min | Median FPS ≥ **24**, min 1-s FPS ≥ **18**; simulation steps/s ≥ 19; no growth in `performance.memory.usedJSHeapSize` > 10 MB if available; exits within one frame of a key press |
| **T6** Enhanced tier (informational) | Set `effects: enhanced`, run T1 | Recorded only; if it fails T1 the admin label must read "may stutter" (already planned) |

Automated tests to add: key coalescing/throttle (fake clock), `focusAt` performs no `getBoundingClientRect` calls (spy),
RGB lerp tint function, debug stats (min/p95/long-frame counting from synthetic frame times), `effects` schema validation and
migration, `/api/tv/debug-metrics` auth + size limit + "debug only" gating.

### 14.6 Test procedure (owner at the TV, agent reading logs)

1. `docker compose … up -d --build`, then `docker exec docker-free-my-vizio-1 node src/cli.ts open --debug`.
2. Ensure ≥ 10 visible app shortcuts (add via admin if needed).
3. Run T0 (`open --debug` with the `fx=none` flag added by the CLI option `--baseline`), then T1–T4, then trigger the
   Fireplace pill and wait 10 min for T5.
4. Agent collects `docker logs docker-free-my-vizio-1 | grep tv_perf` and records the numbers per test in
   `docs/engineering/MANUAL_TESTS.md` (scenario, median, min 1-s, p95, long frames, pass/fail).
5. If T1 fails after all 12 changes: stop and report with the logs; do not add more effects or try new techniques without
   design review.

### 14.7 Governance

- This section is recorded as a formal deviation in `docs/engineering/DEVIATIONS.md` (2026-10-27, "UI performance: Cinematic Lite").
- It is a simplification within the approved direction and preserves all functional requirements (navigation, focus
  visibility, activation feedback, offline behaviour, SmartCast Home reachability, no TV setting changes, no new
  dependencies). **Owner approved 2026-10-27 — implementation may proceed immediately.**

### 14.8 Owner-approved fireplace removal

The T5 real-TV validation failed its sustained performance budget. **Owner approved removal of the fireplace
screensaver on 2026-10-27.** The Fireplace system shortcut, idle trigger, preview endpoint/status payload, canvas
simulation, embers, logs, fireplace styling, and optional sound setting are no longer part of the product. The normal
Home screen remains the only FMV idle surface; Cinematic Lite and UI0–UI7 functionality are preserved. T5 is tracked as
Removed (not Not run) in `docs/engineering/MANUAL_TESTS.md`, and the detailed deviation is recorded in `docs/engineering/DEVIATIONS.md`.

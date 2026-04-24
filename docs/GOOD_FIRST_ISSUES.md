# Good first issues

Ten hand-picked issues sized for a first contribution: each one fits in a
single PR, touches one or two files, has clear acceptance criteria, and
doesn't require deep familiarity with the engine. Maintainers can copy any
section verbatim into a fresh GitHub Issue and tag it `good first issue`.

> Friendly conventions: open a draft PR early, link the issue in the
> description, run `npm run check` before pushing, prefer one logical
> change per commit. See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the
> full guide.

---

## 1. Add a Spanish (`es`) translation

**Scope**: localisation · **Files**: `src/i18n.js`
**Why it's friendly**: the file is one flat object per locale; copy the `en`
block, rename to `es`, translate values, done. No build step.

**Acceptance**:

- A new `es:` block in `STRINGS` with every key translated.
- Settings → Language picker shows "es" as an option (it auto-discovers).
- `setLocale('es')` doesn't break any UI rendering.

---

## 2. Add a Japanese (`ja`) translation

Same scope as #1, with one extra check: confirm `<html lang>` becomes
`ja` after switching (already wired in `setLocale`).

---

## 3. Settings: remember last-played difficulty as default per-locale

**Scope**: storage · **Files**: `src/storage.js`, `src/main.js`
**Acceptance**:

- `save.settings.difficulty` persists exactly as today (no behaviour change
  for existing saves).
- A new `save.settings.lastDifficulty` is recorded on every `Game.start`.
- A README sentence calls this out.

---

## 4. Replace one synth SFX with a free CC0 wav

**Scope**: audio · **Files**: `src/audio.js`, optional new
`docs/audio-credits.md`
**Acceptance**:

- Pick **one** of `hit`, `levelUp`, `pickup`, `explosion`.
- Source from freesound.org under CC0 only (no CC-BY).
- File ≤ 50 KB, 22 kHz mono OK.
- Falls back to the synth path if `Audio` constructor isn't available.
- Credit line in `docs/audio-credits.md`.

---

## 5. Add a "Forest" colourway to the in-game theme

**Scope**: visual · **Files**: `styles.css`, `src/main.js` (background gradient)
**Acceptance**:

- New radio in Settings: "Theme" (Default / Forest / Dusk).
- `save.settings.theme` persists.
- Forest swaps the bluish gradients for greens; Dusk for warm purples.
- `prefers-contrast: more` and the existing colorblind toggle still
  produce legible HUD text under each theme.

---

## 6. Pause icon button visible in the top-right corner on touch devices

**Scope**: UX · **Files**: `index.html`, `styles.css`, `src/ui.js`
**Acceptance**:

- The on-canvas DOM overlay shows a `⏸` button only when
  `window.matchMedia('(pointer: coarse)').matches`.
- Tapping it triggers `Game.togglePause()` (re-use existing handler).
- Reachable via keyboard `Tab`, has visible `:focus-visible` ring.

---

## 7. Show the seed string on the Speedrun result screen

**Scope**: UI polish · **Files**: `src/ui.js`
**Acceptance**:

- After a Speedrun ends, the game-over card displays
  `Seed: 0x5357524e` (formatted from `CONFIG.SPEEDRUN_SEED`) so players
  know they competed on the deterministic timeline.

---

## 8. Pre-commit hook that runs `npm run check`

**Scope**: DX · **Files**: new `.husky/pre-commit` (or hand-rolled
`.githooks/pre-commit` plus `package.json` scripts).
**Acceptance**:

- Hook runs `npm run check` and aborts on failure.
- Documented in `CONTRIBUTING.md`.
- Optional: a one-line `npm run prepare` to wire it on `npm install`.
- No new runtime deps — Husky as a devDep is OK; a hand-rolled hook is
  preferred.

---

## 9. README: animated GIF of a 10-second run

**Scope**: docs · **Files**: `README.md`, `docs/screenshots/`
**Acceptance**:

- Capture using the recipe in `docs/gif-script.md` (`ffmpeg` or
  `MediaRecorder`).
- Output ≤ 2 MB, ≤ 10 seconds, 600 px wide.
- Linked from the Screenshots section, **above** the SVG mockups.

---

## 10. Add `data-build-id` to the body so DevTools can confirm the live version

**Scope**: ops · **Files**: `index.html`, `src/config.js`
**Acceptance**:

- `<body data-build-id="2.5.0">` is set from `CONFIG.VERSION` at boot.
- `console.log(document.body.dataset.buildId)` in DevTools prints the
  current version.
- Service-worker cache key is bumped from the same constant, so refreshes
  pick up new versions instead of serving stale.

---

## How to claim one

Comment on the issue with **"I'll take this"** or open a draft PR
referencing the issue number. Maintainers respond within 48 h on
weekdays. If you're unsure how to start, ask in the issue thread — no
question is too small. Welcome aboard.

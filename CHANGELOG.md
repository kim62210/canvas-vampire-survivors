# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Placeholder for upcoming changes. Contributors, add your entries here.

## [2.3.0] - 2026-04-25

Performance, accessibility, and testing pass. The frame-rate is now stable at
60 fps even at 500 on-screen enemies, the menu is fully keyboard navigable,
and the first unit-test suite lands (73 cases, `node --test`). No new
runtime dependencies.

### Added

- `src/spatial-hash.js` — dedicated broad-phase index, separated from
  `systems.js`. 64 px cells, `insert` / `insertAll` / `queryRect` /
  `findNearest`, all O(1) amortised. `systems.js` re-exports it for
  backwards compatibility with v2.x callers.
- `src/pool.js` — generic object pool with `acquire` / `release` / `clear`
  / `stats`, used for `FloatingText` and `Particle` to kill the per-frame
  allocation/GC churn during boss waves.
- `test/` directory with 73 `node:test` cases across 5 suites:
  `spatial-hash`, `pool`, `weapons`, `storage`, `achievements`. `npm test`
  runs them; CI runs them on every PR.
- `docs/ACCESSIBILITY.md` — honest list of shipped a11y features and
  known gaps.
- ARIA live region (`<p id="a11yLiveRegion" role="status" aria-live>`) that
  broadcasts boss incoming / boss defeated / level-up / achievement
  unlocked events to screen readers.
- Dialog semantics on every overlay (`role="dialog"` + `aria-modal` +
  `aria-labelledby`).
- Arrow-key navigation inside the level-up menu (`↑`/`↓`/`←`/`→`).
- `:focus-visible` focus ring on every interactive control, plus a
  `forced-colors: active` block mapping to Windows High Contrast tokens.
- `@media (prefers-contrast: more)` high-contrast palette.
- `viewport-fit=cover` + `svh`/`dvh` height units to fix the iOS Safari
  100vh overflow behind the dynamic address bar.
- `touch-action: none` + `overscroll-behavior: none` on the body to stop
  accidental pinch-zoom and pull-to-refresh.
- Offscreen sprite cache for non-boss enemies (one pre-rasterised bitmap
  per `id@size`, blit with `drawImage` instead of per-frame arc fills).
- `Performance` section in the README with before/after fps numbers.

### Changed

- `update()` in `src/main.js` split into ten focused private methods
  (difficulty calc, enemy step, projectile step, particle/text step, etc.)
  to keep each under a sensible size.
- `Game.shake()` respects `prefers-reduced-motion` even when the
  in-game Screen Shake toggle is on.
- Spatial-hash cell size bumped from 100 (= `GRID_SIZE * 2`) to 64 so
  typical enemy bounding boxes fit in one cell; added `SPATIAL_CELL_SIZE`
  and `DT_CLAMP` constants to `CONFIG`.
- `package.json` version bumped to 2.3.0; `npm run check` now also runs
  `npm test`; CI workflow replaced its "skip if no tests" block with a
  required `npm test` step.

### Fixed

- Tab-away + return no longer injects a ~second of simulation in a single
  step — `dt` is clamped to 50 ms and the game auto-pauses on
  `document.visibilitychange`.
- Storage module is now Node-friendly: the `localStorage` probe is lazy
  instead of running at import time, so tests can load `src/storage.js`
  without a DOM.

## [2.2.0] - 2026-04-25

Visual + distribution polish release. The game looks the same on the canvas
but is much more inviting from a cold link. No new runtime dependencies.

### Added

- README hero overhaul: SVG hero banner (`docs/hero.svg`), ASCII title,
  9 status/feature badges, "▶ Play in browser" call-to-action, 3-column
  feature grid, screenshot gallery, "Why another clone?" pitch, "Stack"
  table, "Inspiration & credits" section and a star-history chart footer.
- Open Graph + Twitter card metadata in `index.html`, plus a `<link rel="canonical">`
  for the GitHub Pages URL.
- `docs/og-card.svg` — 1200×630 social-share card referenced by OG tags.
- `manifest.json` — PWA manifest so mobile users can "Add to Home Screen".
- `service-worker.js` — tiny cache-first SW that lets the game launch offline
  after the first visit. Auto-registered on http(s) origins; no-op on `file://`.
- `docs/screenshots/README.md` — contributor guide for capturing canvas frames
  (with a one-shot bookmarklet) plus a `.gitkeep` so the folder commits empty.
- `docs/gif-script.md` — recipes for recording demo GIFs/WebMs (`ffmpeg`,
  `gifski`, in-browser `MediaRecorder`).
- Achievements gallery: a new "View Achievements" button on the start screen
  opens a 12-card grid showing locked/unlocked status, name and description.
- JSDoc-style module headers on every file under `src/` documenting purpose,
  dependencies and exports.

### Changed

- Orbit shard collision: query radius now adapts to the largest enemy size
  (was a hard-coded 40 px that occasionally missed the Void Lord).
- Level-up menu: maxed weapons/passives now render as a dimmed `MAXED` card
  instead of vanishing from the pool, so players can see their mastery.
- Boss banner re-translates immediately when the player switches language
  while the banner is still on screen.

### Fixed

- Settings panel: language change now triggers `UI.onLocaleChanged()` so any
  sticky DOM strings (boss banner) refresh without waiting for the next event.

## [2.0.0] - 2026-04-25

Major refactor release. The game is now modular, lint-clean, and ships with a
full open-source contribution workflow. No runtime dependencies were added.

### Added

- Modular `src/` layout: `main`, `config`, `data`, `entities`, `weapons`,
  `systems`, `audio`, `input`, `storage`, `ui`, `i18n`.
- i18n support with English and 简体中文 translations, selectable at runtime.
- Virtual touch joystick for mobile and tablet play.
- Gamepad input via the Gamepad API.
- Persistent save / settings via `localStorage`.
- In-game settings panel (volume, language, reduced motion).
- `prefers-reduced-motion` support for particle effects.
- Spatial hash for collision queries, improving late-game performance.
- Fixed-step physics loop decoupled from rendering — frame-rate independent.
- ESLint + Prettier configuration and `npm run lint` / `npm run format` scripts.
- `.editorconfig` for consistent whitespace across editors.
- GitHub issue templates (bug report, feature request) and PR template.
- Dependabot configuration for weekly dependency updates.
- CI workflow running lint and format checks on Node 20.
- GitHub Pages deployment workflow for an always-up-to-date online demo.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, this `CHANGELOG.md`.

### Changed

- Extracted monolithic `game.js` into small, single-purpose modules.
- Rewrote the game loop to use delta time; all gameplay code now scales
  correctly at 30, 60, 120, and 144 fps.
- HUD rendering moved out of the canvas and into DOM overlays for better
  accessibility and crisper text.
- README rewritten in English-first form with architecture diagram, roadmap,
  and online-demo link.

### Fixed

- Projectile pooling: projectiles no longer leak when the player dies mid-volley.
- Magnet pickup radius now correctly stacks with the passive.
- Experience bar visual desync after a fast double-level-up.
- Boss wave timing could skip a tier if the frame took longer than 100 ms.

### Performance

- Enemy update loop now uses a fixed-cell spatial hash instead of O(n^2) scans.
- Particle system capped and pooled; old particles are recycled.
- Canvas layers split so static background tiles no longer redraw each frame.

## [1.0.0] - 2024-02-14

### Added

- Initial public release.
- Core game loop, player movement, and auto-attacking weapons.
- 8 weapons, 9 passive items, 6 enemy types.
- Upgrade-on-level-up screen with 3 randomised choices.
- Particle effects and basic wave announcements.
- Single-file `game.js` implementation (~1400 lines).

[Unreleased]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/compare/v2.3.0...HEAD
[2.3.0]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/compare/v2.0.0...v2.2.0
[2.0.0]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/releases/tag/v1.0.0

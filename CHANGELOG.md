# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Camera follow + arena expansion** (iter-10 final-mile). The world is now a
  2400×1600 arena with a viewport-centred camera that clamps to arena edges.
  Player clamp moved from canvas bounds (`CONFIG.CANVAS_*`) to arena bounds
  (`CONFIG.ARENA_*`). The faint background grid finally tiles correctly with
  the camera (previously dead code with `player.x` only). See
  `Game._updateCamera()` and `_drawGrid()` in `src/main.js`.
- `window.__SURV_DEBUG__` — dev-only test hooks (`advance`, `grantLevel`,
  `killPlayer`, `spawnBoss`) gated to `localhost`, used by the Playwright
  smoke harness to capture deterministic boss / level-up / game-over
  screenshots without scripting a 5-minute play session.
- `scripts/runtime-smoke.js` now captures **5 real PNG scenes** (mainmenu,
  gameplay, boss-fight, levelup, gameover) and runs `@axe-core/playwright`
  against the main menu. Results land in `docs/RUNTIME_QA_REPORT.md`.
- `docs/CONTRIBUTING_QUICKSTART.md` — 5-minute clone-to-first-PR walkthrough.
- `docs/ISSUE_LABELS.md` — recommended issue/PR label set.
- `.github/CODEOWNERS` — auto-routes PR reviews to `@Ricardo-M-L`.

### Changed

- README screenshots are now all real PNGs (boss-fight, levelup, gameover
  replaced their SVG placeholders). SVG fallbacks remain archived under
  `docs/screenshots/svg/`.
- `--primary` darkened from `#3388ff` to `#1d6fe0` (~4.66:1 vs white) so
  primary buttons clear WCAG AA. `aria-label` on `#weaponIcons` and
  `#passiveIcons` is now valid (added `role="list"`). Mobile pinch-zoom
  re-enabled (removed `user-scalable=no`).
- HUD weapon-icons row gets `z-index: 5` + slight backdrop-blur so the
  player avatar can't tuck under the chips at arena edges.

### Fixed

- `_drawGrid()` no longer calls `player.x` from inside the world transform
  expecting screen-space coordinates; grid lines now align to arena coords.

## [2.5.0] - 2026-04-25

Reflection + polish release. No new content; instead, a sweep through every
"tiny TODO" left at the end of v2.4 so the main branch can be tagged and
shipped with a clear conscience. Still no runtime dependencies.

### Added

- `EffectLayer.schedule(seconds, fn)` (`src/effects.js`) — generic dt-based
  delay queue used by the gameplay loop. Replaces the wall-clock
  `setTimeout` used for the Glacial Cascade follow-up pulse, so the second
  ring now correctly pauses with the game / hidden tab.
- `Game._bindLeaderboardImport()` (`src/main.js`) — listens for the
  `vs-leaderboard-import` `CustomEvent` that the UI dispatches, dedupes
  incoming runs by `date+timeSurvived` (or `date+timeMs` for speedrun),
  merges them through the existing recordHighScore / recordSpeedrunScore
  helpers, persists, and refreshes the open dialog.
- `docs/generate-screenshots.js` — Node script that emits 6 SVG mockups
  under `docs/screenshots/` (`mainmenu`, `gameplay-early`, `boss-fight`,
  `levelup`, `gameover`, `achievements`). SVG was chosen over a real
  headless renderer to keep the toolchain dependency-free; real PNG
  captures still take precedence when contributors provide them.
- `docs/RELEASE_v2.5.md` — long-form release notes summarising every
  v1.0 → v2.5 change. Suitable for a GitHub release announcement / blog.
- `docs/REPO_SETTINGS.md` — checklist of GitHub UI settings (homepage URL,
  topics, About description, branch protections) the maintainer should
  apply by hand. We don't touch the live remote from CI.
- `docs/GOOD_FIRST_ISSUES.md` — 10 hand-picked "good first issue"
  candidates with scope, files-touched and acceptance criteria, ready to
  be filed verbatim into the GitHub Issues tab.

### Changed

- `Player.takeDamage` (`src/entities.js`) now sets `game.run.tookAnyDamage`,
  and `Game.gameOver` derives the high-score `noHit` flag from that boolean
  rather than the `unhitTimer >= gameTime - 0.5` proxy. The proxy could
  misfire on fractional-second deaths or i-frame races; the new flag is
  authoritative.
- `Game.gameOver` (`src/main.js`) caps `save.totals.seenBuilds` at
  `CONFIG.SEEN_BUILDS_CAP` (1000). Older keys roll out FIFO so the save
  payload stays small even on hyper-active accounts.
- `setLocale` (`src/i18n.js`) now mirrors the active language onto
  `document.documentElement.lang` (en → `en`, zh → `zh-Hans`). Helps
  screen readers, browser translation prompts and `:lang(...)` selectors.
- README "Performance" table is now explicitly tagged "(estimated)" and
  the methodology callout warns readers to reproduce locally before
  quoting the numbers anywhere.
- README "Screenshots" gallery now references the generated SVG mockups
  in `docs/screenshots/*.svg` instead of broken-image PNG placeholders.
- `package.json` version bumped to 2.5.0; `CONFIG.VERSION` matches.

## [2.4.0] - 2026-04-25

Content + launch prep release. The catalogue roughly doubles in depth
(3 new weapons, 2 new enemies, 2 new bosses, 6 new achievements), a
fully deterministic Speedrun mode lands, and the press-kit docs cover
HN / Reddit / Dev.to / Twitter launch surfaces. Still no runtime
dependencies.

### Added

- **Weapons** (`src/data.js` + `src/weapons.js`):
    - Frost Nova — radial burst that damages + slows foes, evolves to a
      double-pulse `Glacial Cascade`.
    - Soul Drain — short-range tether that lifesteals 25% of dealt damage,
      evolves to a two-target `Vampiric Chord`.
    - Boomerang — thrown forward, homes back to the hero, evolves to a
      twin-arc pattern.
- **Enemies**: Bomber (armed fuse, self-destructs for 40 AOE dmg),
  Illusionist (every ~5 s spawns 2 low-HP clones). Both are in the
  wave-director rotation from Splitters onwards.
- **Bosses**: Necromancer at 7:30, Chrono Lich at 12:00. Both reuse the
  existing ability dispatch (`summon` / `charge`).
- **Achievements**: `speed_demon`, `no_hit_boss`, `max_all`, `early_evolve`,
  `triple_build`, `zen_5min`. Three of them also wire new unlocks
  (Boomerang / Frost Nova / Soul Drain as starter-weapon options).
- **Speedrun mode** (`src/main.js#startSpeedrun`): deterministic LCG
  (`SeededRng` in `storage.js`), fixed `SPEEDRUN_SEED`, millisecond-
  precision timer, split-time timeline at `CONFIG.SPEEDRUN_SPLITS`
  (1/3/5/7.5/10/12 min), separate `speedrun_highscores` localStorage
  slot. Retry preserves Speedrun mode; Quit exits back to the normal
  menu.
- **Leaderboard screen** (`src/ui.js#showLeaderboard`): full-screen
  dialog accessible from the main menu, scrollable rows showing time /
  level / kills / weapon build / date / no-hit badge, plus Export /
  Import JSON text area for sharing runs.
- `docs/LAUNCH_POST.md` — 500-word launch blog draft tailored for HN /
  Reddit / Dev.to.
- `docs/PRESS_KIT.md` — 20-word positioning + 140-char tweet + 1-minute
  pitch + fact sheet.
- `docs/TWEET_DRAFTS.md` — 5 tweet angles (technical, nostalgia,
  challenge, tutorial, social-good).
- `docs/REDDIT_POST.md` — r/WebGames and r/roguelites post templates.
- `docs/FAQ.md` — 10 common-question answers for new users.
- Speedrun per-run splits appear on the Game Over screen.

### Changed

- `CONFIG` centralises previously-inline magic numbers:
  `SPEEDRUN_SEED`, `SPEEDRUN_SPLITS`, `SPEEDRUN_MAX_SLOTS`,
  `LEADERBOARD_PAGE_SIZE`, `EARLY_EVOLVE_THRESHOLD`,
  `NOVA_SLOW_DEFAULT`, `BOMBER_DEFAULT_RADIUS`. `VERSION` → 2.4.0.
- `package.json` keywords expanded: adds `html5-canvas-game`,
  `vampire-survivors-clone`, `browser-roguelite`, `speedrun`,
  `zero-dependencies`, `indie-game` for discoverability.
- `Game._applyUpgrade` now records: `maxedWeaponCount`, `passivesPicked`,
  `evolvedBefore.sevenMin`, so the new achievements can query a single
  source of truth.
- `Game.gameOver` persists the weapon composition and a no-hit flag
  with each high-score entry; lifetime `seenBuilds` drives the
  Triple-Threat achievement.
- `WAVES` pool broadened to include Bomber from 120 s and Illusionist
  from 240 s, so mid-game has more to chew on.

### Tests

- Test suite expanded from 73 to 95+ cases. New coverage: speedrun
  storage slot, seeded RNG determinism, all new weapon types, new enemy
  archetype bookkeeping, edge cases on pool recycling and spatial-hash
  queries.

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

[Unreleased]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/compare/v2.5.0...HEAD
[2.5.0]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/compare/v2.0.0...v2.2.0
[2.0.0]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/releases/tag/v1.0.0

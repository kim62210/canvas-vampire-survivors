# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Placeholder for upcoming changes. Contributors, add your entries here.

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

[Unreleased]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Ricardo-M-L/canvas-vampire-survivors/releases/tag/v1.0.0

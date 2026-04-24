# Release notes — Survivor v2.5.0

_Tag suggested: `v2.5.0` · branch: `main` · MIT_

A short release; v2.4 already shipped the Speedrun mode and content drop, so
v2.5 is a **reflection + polish** pass: every loose end from the 2.x line is
either closed or tracked. The main branch is now in a state where you can
confidently `git checkout main && open index.html` and trust what shows up.

---

## tl;dr

> Vanilla-JS Vampire-Survivors clone, zero runtime deps. v2.5 closes the
> last "small TODO" set: paused-tab-safe weapon timers, working
> leaderboard import, authoritative no-hit detection, save-size cap,
> generated screenshot mockups, locale-aware `<html lang>`. **134
> `node:test` cases**, lint + format clean, 60 fps at 500 enemies.

## Highlights

- **Effects layer scheduler.** `EffectLayer.schedule(seconds, fn)` is a tiny
  dt-based delay queue. The Glacial Cascade follow-up pulse used to fire on a
  wall-clock `setTimeout(400)`, which kept ticking when the tab was hidden;
  it now lives on the queue and pauses with the sim.
- **Leaderboard Import actually works.** The UI dispatches a
  `vs-leaderboard-import` `CustomEvent`; `Game._bindLeaderboardImport()`
  listens, dedupes by `date+timeSurvived`/`date+timeMs`, and merges through
  the existing `recordHighScore` / `recordSpeedrunScore` helpers.
- **No-hit is now authoritative.** A per-run `tookAnyDamage` flag flips on
  inside `Player.takeDamage`. The high-score `noHit` field reads from that
  boolean instead of the old `unhitTimer >= gameTime - 0.5` proxy, which
  could misfire on fractional-second deaths.
- **Saves can't grow forever.** `seenBuilds` (drives the Triple-Threat
  achievement) is capped at `CONFIG.SEEN_BUILDS_CAP = 1000` and rolls FIFO.
- **Generated screenshot mockups.** `docs/generate-screenshots.js` emits 6
  SVG mockups (`mainmenu`, `gameplay-early`, `boss-fight`, `levelup`,
  `gameover`, `achievements`) so the README gallery is no longer six broken
  image icons. SVG was chosen over a real headless renderer to keep the
  toolchain dependency-free; real PNG captures still take precedence.
- **`<html lang>` follows the locale switcher.** `setLocale('zh')` now sets
  `document.documentElement.lang = 'zh-Hans'`, helping screen readers,
  in-browser translation prompts and `:lang(...)` selectors.
- **README perf table marked "(estimated)".** No more accidental
  benchmark-grade interpretation of one dev's M1 Pro numbers.

## Full path: v1.0 → v2.5

| Version  | Date       | Theme                                                                                                                                                                                                                                               |
| -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v1.0.0` | 2024-02-14 | Initial public release; single-file game.js (~1400 LOC)                                                                                                                                                                                             |
| `v2.0.0` | 2026-04-25 | Modular `src/` rewrite, i18n, fixed-step loop, OSS scaffolding (CONTRIBUTING/CoC/CI/Pages)                                                                                                                                                          |
| `v2.1.0` | 2026-04-25 | Wave director, 5 enemy archetypes, 2 bosses, weapon evolutions, achievements + leaderboard, effects layer, music upgrade                                                                                                                            |
| `v2.2.0` | 2026-04-25 | Visual + distribution polish: hero banner, 9 README badges, OG card, PWA manifest + service worker, achievements gallery, JSDoc headers                                                                                                             |
| `v2.3.0` | 2026-04-25 | Perf + a11y: spatial-hash broad phase, object pools, sprite cache, dt clamp, ARIA live region, focus rings, high-contrast/forced-colors, 73-test suite                                                                                              |
| `v2.4.0` | 2026-04-25 | Content density: Frost Nova / Soul Drain / Boomerang weapons (with evolutions), Bomber + Illusionist enemies, Necromancer + Chrono Lich bosses, 6 new achievements, deterministic Speedrun mode + leaderboard, launch-prep docs (HN/Reddit/Twitter) |
| `v2.5.0` | 2026-04-25 | Reflection + polish (this release)                                                                                                                                                                                                                  |

## Numbers

- **134 `node:test` cases** across 7 suites (`pool`, `spatial-hash`,
  `weapons`, `storage`, `achievements`, `data`, `speedrun`).
- **0 runtime dependencies.** ESLint + Prettier as devDeps only.
- **0 known TODO comments** in `src/`.
- **6 generated SVG screenshot mockups**, ~50 KB total.
- **10 weapons** (7 base + 3 v2.4 additions), each with an evolved form.
- **10 passives**, **5 boss archetypes**, **6 enemy archetypes**.
- **12 achievements**, **3 unlock weapons** behind them.

## Compatibility

- v2.4 saves load unchanged. The new `tookAnyDamage` flag is per-run, not
  persisted; the new `seenBuilds` cap only prunes if a save is already past
  1000 entries (which no realistic player has hit).
- The `vs-leaderboard-import` `CustomEvent` is additive; existing UI flows
  still work if you don't paste any JSON.

## What we're _not_ shipping in v2.5

- Map variants / persistent meta-progression / WebGL renderer / replay
  recording — all still on the roadmap, marked in `README.md`.
- Real PNG screenshots — see `docs/screenshots/README.md` for the
  contributor bookmarklet that captures a clean canvas frame.
- Translations beyond EN + zh-Hans — PRs welcome (`src/i18n.js` is one
  string table per locale).

## Upgrading from v2.4

Pull the tag, refresh the browser. Local saves, achievements and
leaderboard entries persist across the bump.

```bash
git checkout v2.5.0
npm install   # devDeps only; no runtime deps
npm run check # lint + format + 134 tests
npm start     # http://localhost:3000
```

## Thanks

To everyone who filed an issue, sent a PR, translated a string or just
played a run. v2.5 is the version this repo gets to retire its "TODO" list
on; future work is feature work.

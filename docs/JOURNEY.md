# Journey

A backwards walk through the 16 iteration branches that took
`canvas-vampire-survivors` from a 1.4k-line single-file prototype to a
modular, accessible, internationalised, gamepad-aware roguelite with 241
unit tests, three stages, ten weapons, two playable bosses with
stage-aware overrides, a deterministic Speedrun mode, a Wordle-style
Daily Challenge, a 5-step interactive tutorial, replay recording, and a
live GitHub Pages deploy that the live-deploy smoke harness confirms
zero-error on every push to `main`.

This document is reconstructed from `git log --oneline` after the fact —
each row links to the dominant commit on that branch and summarises the
lasting artefacts. For per-feature semantics, follow the
[CHANGELOG](../CHANGELOG.md) link in the right-most column.

## Timeline

| Iter | Branch / commit | Theme                         | Lasting artefacts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Tests | Released as     |
| ---- | --------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------- |
| 1    | `d133f3c`       | Modular refactor              | Split 43k `game.js` monolith into `src/{main,entities,systems,weapons,audio,input,ui,i18n,storage,data,config}.js`; ESM bootstrap; `styles.css`; static `server.js`                                                                                                                                                                                                                                                                                                                                                       | —     | _seed for v2.0_ |
| 2    | `8d5da4e`       | OSS scaffolding               | `.github` issue forms + PR template + `ci.yml` + `deploy-pages.yml` + Dependabot + Funding; CoC, SECURITY, CHANGELOG; ESLint flat config; README rewrite with mermaid arch diagram                                                                                                                                                                                                                                                                                                                                        | —     | v2.0            |
| 3    | `dea4ee8`       | Gameplay depth                | 7 weapons w/ evolutions, 10 passives (Luck added), 9 enemy archetypes, 2 named bosses, wave director, 12 achievements, meta-unlocks, leaderboard, effects layer (`src/effects.js`), achievements tracker (`src/achievements.js`), BALANCE.md                                                                                                                                                                                                                                                                              | —     | v2.1            |
| 4    | `ab2b09e`       | Visual + distribution polish  | Hero SVG banner, 9 README badges, OG/Twitter cards, PWA manifest, cache-first service worker, achievements gallery screen, JSDoc module headers; Orbit-shard radius adapts; level-up MAXED card                                                                                                                                                                                                                                                                                                                           | —     | v2.2            |
| 5    | `805953f`       | Perf + a11y + tests           | `src/spatial-hash.js` (64 px broad phase), `src/pool.js` generic pool, ARIA live region, dialog roles, arrow-key level-up nav, prefers-contrast/forced-colors palettes, sprite cache; first `node:test` suite (73 cases); `dt` clamp + `visibilitychange` auto-pause                                                                                                                                                                                                                                                      | 73    | v2.3            |
| 6    | `d6502fa`       | Content density + launch prep | Frost Nova / Soul Drain / Boomerang; Bomber + Illusionist; Necromancer (7:30) + Chrono Lich (12:00); 6 new achievements; Speedrun mode (deterministic LCG, ms timer, splits); leaderboard dialog with JSON export/import; press kit + tweet drafts + Reddit + FAQ docs                                                                                                                                                                                                                                                    | 134   | v2.4            |
| 7    | `a86adb3`       | Reflection refactor           | `<html lang>` syncs with locale; Frost Nova 2nd pulse on dt scheduler; `noHit` flag from `tookAnyDamage`; FIFO-cap `seenBuilds`; Leaderboard Import listener; perf table tagged "(estimated)"                                                                                                                                                                                                                                                                                                                             | 139   | v2.5            |
| 8    | `dcd7f83`       | v2.5 docs polish              | Upgraded SVG screenshot mockups, `docs/v2.5.0-NOTES.md`, helper scripts (pre-release-check, record-gif, capture-screenshots)                                                                                                                                                                                                                                                                                                                                                                                              | 139   | v2.5            |
| 9    | `f5c4d46`       | Real-browser runtime QA       | `scripts/runtime-smoke.js` Playwright harness; arena-clamp regression fix in `Player.update`; real PNG screenshots replace SVG; `docs/RUNTIME_QA_REPORT.md`; `docs/MANUAL_QA.md`                                                                                                                                                                                                                                                                                                                                          | 144   | _polish_        |
| 10   | `7c26135`       | Camera + a11y zero-violations | Arena 2400×1600 + camera follow clamp; `_drawGrid` aligned to arena coords; primary colour darkened to 4.66:1 contrast; `role="list"` on icons; viewport zoom restored; CODEOWNERS; `docs/CONTRIBUTING_QUICKSTART.md`; axe-core 0 violations                                                                                                                                                                                                                                                                              | 144   | _polish_        |
| 11   | `62851e4`       | Org migration sweep           | Replaced `Ricardo-M-L` URLs with `ricardo-foundry` across badges, OG/canonical/Twitter, build meta, docs and CHANGELOG                                                                                                                                                                                                                                                                                                                                                                                                    | 144   | _chore_         |
| 12   | `bf3de26`       | Stages + Daily                | `src/stages.js` registry (Whisperwood + Sunken Crypt), per-stage waves/boss timing/palette, weighted spawns; `src/daily.js` (cyrb53 → SeededRng, 14-day rolling history, Wordle share text); per-stage leaderboards; `damageNumbers` toggle; `scripts/test-live-deploy.js`                                                                                                                                                                                                                                                | 157   | v2.6 (draft)    |
| 13   | `62d4500`       | Iter-13 finishing             | Stage chip on main menu; `View Streak` 14-day calendar; first-launch `How to Play` overlay; `H/?` help overlay; global `M` mute; multi-sample 3×3 pixel sanity in live-deploy QA; `mergeDeep` settings auto-upgrade                                                                                                                                                                                                                                                                                                       | 167   | v2.6            |
| 14   | `eca8a68`       | Iter-14 tundra + gamepad      | `STAGES.TUNDRA` (Frozen Tundra, -10% speed, +20% HP, periodic cold tick); IceQueen boss via `bossOverrides`; `getStageModifiers()` schema; full Web Gamepad polling (sticks + edge-triggered A/B/Start/LB/RB); mobile special-skill button + size knob + PWA install prompt; Evasion / Magnet+ / Bulwark passives; 4 evolution micro-tweaks; daily rotation across 3 stages; `docs/CONTROLS.md`                                                                                                                           | 195   | v2.7            |
| 15   | `1d34657`       | Iter-15 tutorial + replay     | `src/tutorial.js` 5-step state machine (move → autoAttack → pickupExp → levelUp → pause) with Esc-skip; `src/replay.js` recorder + RLE compression + `ReplayPlayer` 1×/2×/4× speed; first-launch tutorial offer; opt-in critical-hit screen flash; boss-spawn shake +50%; `docs/USER_GUIDE.md`                                                                                                                                                                                                                            | 215   | v2.8 (draft)    |
| 16   | `08cc430`       | Iter-16 deep bug-bash         | Mid-run locale flip retranslates every `[data-i18n]` element; Speedrun pause/visibility excludes paused windows; `localStorage` quota fallback demotes to in-memory once and warns once; weapon broad-phase queries via spatial hash (~70% drop in weapon-fire cost on 200-enemy waves); `SpatialHash.queryRect` returns Array (V8 inlines tighter); 26 edge-case tests; `scripts/extended-smoke.js` multi-mode harness (forest / crypt / tundra × daily × speedrun × replay × locale-flip × micro-perf, 0 console.error) | 241   | v2.8-rc         |

## Cumulative diff at a glance

- **Lines** went from one ~1400-line `game.js` to ~6.5k across 17 modules
  under `src/`, with 11 test files under `test/` and 4 Playwright /
  audit scripts under `scripts/`.
- **Tests** grew 0 → 73 → 134 → 139 → 144 → 157 → 167 → 195 → 215 →
  **241**, all run by `node --test test/*.test.js` with no runner
  framework, no transpiler, no mock library.
- **Stages** went 1 → 2 → 3 (Whisperwood → +Sunken Crypt → +Frozen
  Tundra), each defined declaratively in `src/stages.js` so the wave
  director / boss schedule / palette / spawn weights / gameplay
  modifiers are all per-stage data.
- **Bosses** went 2 → 4 → 5: Reaper + VoidLord (v2.1) → +Necromancer +
  Chrono Lich (v2.4) → +IceQueen as a `bossOverrides` swap on tundra
  (v2.7).
- **Languages** stayed at 2 (English + 简体中文) but locale switching is
  now (iter-16) a true full-page retranslation, not just the boss
  banner.

## Notable refactors

A few iterations were specifically about reducing surface area rather
than adding it:

- **Iter-7 (`a86adb3`)** — five "tiny TODO"s left from v2.4 each
  promoted to a real fix. The pattern that emerged (replace wall-clock
  timers with the dt-aware scheduler, replace heuristic flags with
  authoritative ones) carried forward into iter-15 / iter-16.
- **Iter-9 (`f5c4d46`)** — moved QA from "tests pass therefore the game
  works" to "headless Chromium boots the game and we collect real
  console output". Surfaced the arena-clamp bug that had been silently
  ruining runs since the camera refactor.
- **Iter-16 (`08cc430`)** — no new gameplay; weapon broad-phase queries
  ported to the spatial hash, locale flip made truly mid-run safe,
  `localStorage` failure demoted exactly once, Speedrun pause time
  reconciled. The kind of bug-bash that can only happen once you have
  enough tests to be confident the refactor isn't introducing new bugs.

## Where v2.8 currently stands

Iter-15 and iter-16 both ship under the **v2.8.0-rc** umbrella in
[`CHANGELOG.md`](../CHANGELOG.md) (the package.json version stays at
`2.7.0` per the round constraint). The branch is feature-complete; the
only blocker before tagging is **real-screenshot capture** for the
tutorial / replay / tundra screens — the existing PNGs predate iter-14.
Once those land, `npm run check` is green, `npm run smoke:live` reports
0 console.error, and the tag can ship.

For the verbatim list of what changed in each tagged release, see
[CHANGELOG.md](../CHANGELOG.md). For a player-facing tour of what all
this becomes once you hit "Start Run", see
[USER_GUIDE.md](./USER_GUIDE.md).

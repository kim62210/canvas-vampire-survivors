# Verification Report — iter-21 (Agent A Round 21)

> **Scope:** read-only verification of the iter-20 ship. No gameplay or
> module-logic changes. The only edits attached to this branch are the
> minimum-set fixes called out in §"Findings & fixes" below — each one
> is a documentation-level correction (CHANGELOG metadata + Prettier
> reformatting of four `.md` files), with zero `src/`, `test/`, or
> `scripts/` modifications.

Generated: 2026-04-25
Branch: `iter-21-verify`
Base: `iter-20-easter-and-polish` @ `package.json` v2.7.0

---

## 1. Verification matrix

| #   | Check                                                                             | Command                                                                                                                                | Result                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Lint                                                                              | `npm run lint`                                                                                                                         | **PASS** (eslint, 0 errors, 0 warnings)                                                                                                                                                                                                                   |
| 1   | Format-check (initial)                                                            | `npm run format:check`                                                                                                                 | **FAIL** — 4 files (`CHANGELOG.md`, `docs/CROSSPROMO.md`, `docs/LIVE_QA_REPORT.md`, `docs/RELEASE_CHECKLIST.md`) — see §3.1                                                                                                                               |
| 1   | Tests                                                                             | `npm test` (`node --test test/*.test.js`)                                                                                              | **PASS** (279/279)                                                                                                                                                                                                                                        |
| 1   | Aggregate `npm run check`                                                         | lint && format:check && test                                                                                                           | **FAIL** before fix → **PASS** after Prettier `--write` of the 4 files (no logic change)                                                                                                                                                                  |
| 2   | `npm run smoke` (local)                                                           | `node scripts/runtime-smoke.js`                                                                                                        | **FAIL** — Playwright cannot click `#btnStart`; the first-launch `#howToPlayScreen` overlay intercepts pointer events. See §3.2. **Pre-existing** (script does not seed `flags.howToSeen`). Not fixed in this branch (would require touching `scripts/`). |
| 3   | `npm run smoke:live` (live Pages)                                                 | `node scripts/test-live-deploy.js`                                                                                                     | **PASS** — 200 OK, 0 console.error, 0 pageerror, 0 finding(s). Service-worker 404 + `willReadFrequently` are pre-existing benign warnings.                                                                                                                |
| 4   | `npm run smoke:extended`                                                          | `node scripts/extended-smoke.js`                                                                                                       | **PASS** — all 8 modes (forest, crypt, tundra, daily, speedrun, replay, locale-flip, profile): 0 console.error, 0 pageerror, 0 warn, 0 netfail, 7 informational notes.                                                                                    |
| 5   | `node --check` on every `src/*.js`                                                | 22 files                                                                                                                               | **PASS** — all 22 syntactically valid.                                                                                                                                                                                                                    |
| 6   | README relative links                                                             | 24 paths (`./LICENSE`, `./CHANGELOG.md`, `./docs/...`, `./src/...`, `./manifest.json`, `./service-worker.js`, `./docs/hero.svg`, etc.) | **PASS** — every path exists on disk. CHANGELOG anchors `#260---2026-04-25` and `#270---2026-04-25` both resolve to real `## [2.6.0]` and `## [2.7.0]` headings.                                                                                          |
| 6   | README badge HEAD reachability                                                    | 18 external URLs (shields.io, GitHub, GitHub Pages, star-history, MDN, Poncle, sister repos, axe-core CI badge)                        | **PASS** — every URL returns HTTP 200 to `curl -ILs`.                                                                                                                                                                                                     |
| 7   | CHANGELOG compliance (Keep-a-Changelog `Added/Changed/Fixed/Removed` per version) | manual scan of all 9 release sections                                                                                                  | **DEGRADED** — see §3.3. Strict `Removed` sections are absent everywhere; `Fixed` is missing in 3 versions. Plus a real metadata bug: missing `[2.7.0]` compare-link footer entry.                                                                        |
| 8   | Test stability (no flake)                                                         | ran `npm test` 3× back-to-back                                                                                                         | **PASS** — 279/279 each run. Durations 129 ms / 138 ms / 150 ms.                                                                                                                                                                                          |

---

## 2. Source-file syntax sweep (item 5, raw)

`node --check` on each module under `src/`:

```
OK src/achievements.js     OK src/keymap.js
OK src/audio.js            OK src/konami.js
OK src/config.js           OK src/main.js
OK src/daily.js            OK src/pool.js
OK src/data.js             OK src/replay.js
OK src/effects.js          OK src/spatial-hash.js
OK src/entities.js         OK src/stages.js
OK src/haptics.js          OK src/storage.js
OK src/i18n.js             OK src/systems.js
OK src/input.js            OK src/tutorial.js
                           OK src/ui.js
                           OK src/weapons.js
```

22 / 22 files compile cleanly under the host Node 18+ engine declared
in `package.json#engines`.

---

## 3. Findings & fixes

### 3.1 Prettier reformat of 4 documentation files _(fixed)_

`prettier --check` flagged purely-cosmetic whitespace drift in four
markdown files:

| File                        | Drift                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `CHANGELOG.md`              | sub-bullet indentation under iter-19 keymap (4-space → list-aligned)                                                                 |
| `docs/CROSSPROMO.md`        | trailing-whitespace padding inside the project-comparison table                                                                      |
| `docs/LIVE_QA_REPORT.md`    | JSON code-block indentation + missing blank line before fence (smoke-script-generated; one-shot reformat to match Prettier defaults) |
| `docs/RELEASE_CHECKLIST.md` | indented continuation line under a numbered list item                                                                                |

**Fix applied:** `npx prettier --write` on those four files. Zero
content changes, zero `.js` files touched, zero gameplay impact.
After the fix, `npm run check` is fully green.

### 3.2 `npm run smoke` blocked by first-launch overlay _(documented, not fixed)_

`scripts/runtime-smoke.js` boots a fresh headless Chromium with an
empty profile, then immediately calls `await startBtn.click()` on
`#btnStart`. iter-13 introduced a one-time `#howToPlayScreen`
overlay (`src/main.js:232`) that auto-shows on cold-boot when
`save.flags.howToSeen` is unset, and it intercepts pointer events
until dismissed.

Result: every fresh run hits `TimeoutError: <div ... id="howToPlayScreen">
intercepts pointer events` after 30 s of click retries.

This is **pre-existing** — it predates iter-21 and is reproducible
on `iter-20-easter-and-polish` HEAD. Two reasonable fixes (any one
suffices), neither attempted here per the "no script logic change"
guardrail of this round:

1. In `scripts/runtime-smoke.js`, before clicking `#btnStart`,
   `page.evaluate(() => localStorage.setItem('vs_save_v1', JSON.stringify({flags:{howToSeen:true,tutorialDone:true,pwaPromptSeen:true}})))` then `page.reload()`.
2. Or, after `page.goto`, click `#howToPlayScreen .btn` ("Got it")
   and the subsequent `#tutorialOfferNo` button before targeting
   `#btnStart`.

`npm run smoke:live` and `npm run smoke:extended` both **pass**, and
the live Pages build is verified end-to-end, so this gap is local-
harness-only and does not block release.

### 3.3 CHANGELOG compliance _(partially fixed)_

#### 3.3.1 Missing `[2.7.0]` compare-link footer _(fixed)_

The bottom of `CHANGELOG.md` declares Keep-a-Changelog compare links
but skips `2.7.0`:

```
[Unreleased]: ...compare/v2.6.0...HEAD     ← wrong base, should be v2.7.0
[2.6.0]:      ...compare/v2.5.0...v2.6.0
[2.5.0]:      ...
                 ↑ no [2.7.0] entry between Unreleased and 2.6.0
```

Even though `## [2.7.0] - 2026-04-25` is the most recent **released**
version (matching `package.json`'s `2.7.0`). README's `What's new`
section links `./CHANGELOG.md#270---2026-04-25` so the anchor itself
resolves, but the bottom-of-file metadata is internally inconsistent.

**Fix applied:** insert `[2.7.0]: .../compare/v2.6.0...v2.7.0` line
and rebase `[Unreleased]` to `v2.7.0...HEAD`. Pure metadata; no
release-notes content was added or rewritten.

#### 3.3.2 Per-version `Added/Changed/Fixed/Removed` audit _(documented, not "fixed")_

Strict reading of task 7 ("every version has Added/Changed/Fixed/Removed
sections") is more demanding than Keep-a-Changelog actually requires
— the spec explicitly allows omitting empty sub-sections. We did
**not** fabricate empty `### Removed` blocks; doing so would be
content-noise and is outside the iter-21 minimum-fix scope.

For transparency, the per-version coverage matrix (✅ present, — absent):

| Version    | Added | Changed | Fixed | Removed | Other              |
| ---------- | :---: | :-----: | :---: | :-----: | ------------------ |
| Unreleased |  ✅   |   ✅    |  ✅   |    —    | Tests, Performance |
| 2.7.0      |  ✅   |   ✅    |   —   |    —    | Tests              |
| 2.6.0      |  ✅   |   ✅    |  ✅   |    —    | —                  |
| 2.5.0      |  ✅   |   ✅    |   —   |    —    | —                  |
| 2.4.0      |  ✅   |   ✅    |   —   |    —    | Tests              |
| 2.3.0      |  ✅   |   ✅    |  ✅   |    —    | —                  |
| 2.2.0      |  ✅   |   ✅    |  ✅   |    —    | —                  |
| 2.0.0      |  ✅   |   ✅    |  ✅   |    —    | Performance        |
| 1.0.0      |  ✅   |    —    |   —   |    —    | —                  |

No release has actually **removed** functionality, hence the empty
column. If a future iter wants strict-compliance gloss for tooling,
a one-line `### Removed\n\n_None._` per version would do it; this
round leaves the existing release notes intact.

---

## 4. Smoke-script-generated artefacts _(reverted)_

`npm run smoke:live` rewrote `docs/LIVE_QA_REPORT.md` and
`docs/screenshots/live-gameplay.png`; `npm run smoke:extended`
rewrote `docs/EXTENDED_SMOKE_REPORT.md`; the failed `npm run smoke`
clobbered `docs/screenshots/real-mainmenu.png`. All four files were
`git checkout`ed back to their iter-20 baseline so this branch's
diff stays minimal — the regenerated PNGs differ in encoder noise
only and the report files differ in timestamps only.

---

## 5. Files touched on `iter-21-verify`

```
docs/VERIFICATION_iter21.md     (this file, new)
CHANGELOG.md                    (Prettier reformat + missing 2.7.0 footer link)
docs/CROSSPROMO.md              (Prettier reformat)
docs/LIVE_QA_REPORT.md          (Prettier reformat)
docs/RELEASE_CHECKLIST.md       (Prettier reformat)
```

Zero changes under `src/`, `test/`, `scripts/`, `index.html`,
`server.js`, `styles.css`, `game.js`, `package.json`,
`package-lock.json`, `manifest.json`, or `service-worker.js`.

---

## 6. Sign-off

- `npm run check` — green ✅
- `npm run smoke:live` — green ✅
- `npm run smoke:extended` — green ✅
- `npm run smoke` — red ❌ (pre-existing harness gap, see §3.2; not introduced by this branch and not fixed by this branch)
- 279 unit tests, 0 flakes across 3 back-to-back runs ✅
- 22 `src/*.js` files syntactically valid ✅
- README — 24 relative links and 18 external badges all reachable ✅
- CHANGELOG — `[2.7.0]` compare-link footer corrected; per-version section completeness documented above ✅

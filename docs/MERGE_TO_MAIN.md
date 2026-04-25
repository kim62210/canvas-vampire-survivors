# Merge to `main` — Bundle Plan

> Prepared on `iter-23-merge-bundle`. This branch adds **only** this document on
> top of `iter-22-smoke-fix`. No code, asset, or other doc changes.

`main` currently sits at `d133f3c` (the original modular-refactor import). Every
iteration since has shipped on its own `iter-N-*` branch and been pushed to
`origin`, but **none of them has been merged back into `main`**. As of
2026-04-25 the gap is **22 commits / 21 iterations** of production work.

Use this document as the single source-of-truth when deciding _how_ to land
those commits on `main`.

---

## 1. What `main` is missing (iter-2 → iter-22)

Listed newest first. Each entry names the iter branch, the headline commit, and
the user-visible payload it added to the game.

| Iter | Branch | Key commit | Headline payload |
| --- | --- | --- | --- |
| 22 | `iter-22-smoke-fix` | `3068db5` | Smoke-test fix: first-run overlays no longer block `#btnStart` on clean profiles. |
| 21 | `iter-21-verify` | `ce36ec7` | Verification-only pass; minimum CHANGELOG / Prettier touch-ups. |
| 20 | `iter-20-easter-and-polish` | `e571ad3` | Easter-egg achievements, emoji-rain effect, polish pass. |
| 19 | `iter-19-haptic-and-remap` | `907f43b` | Mobile haptics + customisable keyboard remap. |
| 18 | `iter-18-launch-ready` | `b9a0502` | Launch-ready release materials (RELEASE_CHECKLIST, LAUNCH_POST, PRESS_KIT) + cross-promo. |
| 17 | `iter-17-final-consolidation` | `916c841` | Final consolidation — JOURNEY, badges, no logic changes. |
| 16 | `iter-16-bug-bash` | `08cc430` | Deep bug-bash: locale flip, pause-time, quota fallback, spatial perf. |
| 15 | `iter-15-tutorial-and-replay` | `1d34657` | Tutorial state machine + replay system (v2.8 draft). |
| 14 | `iter-14-stage-3-and-gamepad` | `eca8a68` | Tundra stage, gamepad support, mobile polish (v2.7.0). |
| 13 | `iter-13-finishing-touches` | `62d4500` | Finishing touches (v2.6.0). |
| —  | `iter-12-content-and-live-test` | `c1c05e0` | Hotfix: build daily-share grid via array, not `string.slice`. |
| 12 | `iter-12-content-and-live-test` | `bf3de26` | Stages, daily challenge, live deploy QA. |
| —  | `iter-11-url-foundry` | `62851e4` | URL rewrite: `Ricardo-M-L` → `ricardo-foundry` across docs and badges. |
| 10 | `iter-10-final-mile` | `7c26135` | Camera follow + multi-scene smoke + a11y zero-violation pass. |
| 9  | `iter-9-runtime-qa` | `f5c4d46` | Real-browser runtime QA + arena clamp fix. |
| —  | `iter-8-final-polish` | `dcd7f83` | v2.5 final polish — upgraded screenshots, release notes, scripts. |
| —  | `iter-7-reflection-and-polish` | `a86adb3` | v2.5 reflection pass — fix 5 weaknesses, release prep. |
| 6  | `iter-6-content-and-launch` | `d6502fa` | v2.4: content density + launch prep. |
| 5  | `iter-5-perf-and-a11y` | `805953f` | v2.3: perf + a11y + `node:test` suite. |
| 4  | `iter-4-visual-and-demo` | `ab2b09e` | v2.2: visual + distribution polish for first impression. |
| 3  | `iter-3-gameplay-depth` | `dea4ee8` | v2.1: gameplay depth — evolutions, waves, achievements, effects. |
| 2  | `iter-2-oss-and-readme` | `8d5da4e` | OSS scaffolding, CI, Pages deploy, README rewrite. |

Cumulatively this is the entire jump from a bare modular import (v2.0) to the
launch-ready v2.8.0 build that lives on `iter-22-smoke-fix`.

`package.json` `version` field on `iter-22-smoke-fix`: **`2.7.0`**
(v2.8 work is committed but not yet bumped — see §4).

---

## 2. Recommended path: `squash-merge` per iter

Squashing keeps `main` readable as **one commit per iteration** while still
preserving the long-form history on the `iter-*` branches (and on `origin`).

```bash
# Land all 21 iterations onto main in chronological order.
# Run from the repo root, on a clean working tree.

git checkout main
git pull --ff-only origin main

for branch in \
    iter-2-oss-and-readme \
    iter-3-gameplay-depth \
    iter-4-visual-and-demo \
    iter-5-perf-and-a11y \
    iter-6-content-and-launch \
    iter-7-reflection-and-polish \
    iter-8-final-polish \
    iter-9-runtime-qa \
    iter-10-final-mile \
    iter-11-url-foundry \
    iter-12-content-and-live-test \
    iter-13-finishing-touches \
    iter-14-stage-3-and-gamepad \
    iter-15-tutorial-and-replay \
    iter-16-bug-bash \
    iter-17-final-consolidation \
    iter-18-launch-ready \
    iter-19-haptic-and-remap \
    iter-20-easter-and-polish \
    iter-21-verify \
    iter-22-smoke-fix
do
  git merge --squash "$branch"
  git commit -m "$branch: squashed merge"
done

git push origin main
```

If you'd rather collapse the entire 22-commit history into a **single** merge
commit on `main`, do this instead:

```bash
git checkout main
git pull --ff-only origin main
git merge --squash iter-22-smoke-fix
git commit -m "release v2.8: iter-2 → iter-22 squashed onto main"
git push origin main
```

Trade-off: zero per-iteration granularity on `main`, but a clean one-commit
delta. The `iter-*` branches still keep the granular history for archaeology.

---

## 3. Alternative: fast-forward `main` to `iter-22-smoke-fix`

Because `iter-22-smoke-fix` is a **direct linear descendant** of `main`
(`d133f3c` is its first ancestor), a fast-forward is possible and preserves
every single commit on `main`.

```bash
git checkout main
git pull --ff-only origin main
git merge --ff-only iter-22-smoke-fix
git push origin main
```

Use this if you want `main` to mirror the iter timeline 1:1 — you'll see all
22 commits show up on `main` exactly as they exist on the iter branches.

`git log --oneline main` after the FF will start with `3068db5` and end at
`d133f3c`, identical to `git log --oneline iter-22-smoke-fix` today.

---

## 4. Side-effects to plan for

### 4.1 GitHub Pages will redeploy automatically

`.github/workflows/deploy-pages.yml` triggers on `push: branches: [main]`
without any path filter, so **every** push to `main` (squash or FF) kicks off a
fresh build of the static site. After the merge:

- Watch the **Deploy to GitHub Pages** action.
- The post-deploy URL serves the v2.8 build (camera follow, tundra stage,
  gamepad, replay system, easter eggs, daily challenge, etc.).
- The previous deploy (currently the v2.0 modular import) becomes
  unreachable the moment the new one finishes.

### 4.2 CI test count will jump

`main` today has the bare modular import; `iter-22-smoke-fix` has the
`node:test` suite plus the multi-scene smoke harness layered on top. Expect
the `ci.yml` job on the post-merge `main` to run **substantially more tests**
than its previous baseline. Don't be alarmed by the spike — the iter-21
verification pass already confirmed they're green.

### 4.3 `package.json` version is _not_ bumped yet

`iter-22-smoke-fix` ships `"version": "2.7.0"` even though feature work for
v2.8 has landed (tutorial, replay, stages, easter eggs). Decide before the
merge:

- **Option A — bump first**: do `2.7.0` → `2.8.0` on a small follow-up branch,
  push, _then_ merge. Keeps `main`'s version coherent with what the user sees.
- **Option B — bump after**: merge as-is, then push a `chore: bump to 2.8.0`
  commit on top. Simpler, but `main` will briefly advertise an out-of-date
  version. (This repo doesn't auto-publish on tag, so the impact is only
  cosmetic in the README badge / footer.)

### 4.4 Branch hygiene

The 21 `iter-*` branches will still exist locally and on `origin` after the
merge. They're not strictly needed once `main` catches up, but **don't delete
them yet** — they're the fallback if a regression appears post-merge. A safe
cleanup window is ~2 weeks of `main` running green.

### 4.5 Open PRs / forks

This repo doesn't currently advertise external forks, but if a contributor has
been tracking `main` they will need to rebase / reset their fork after the
merge — the FF path adds 22 new commits, the squash path rewrites very little
but adds 1–21 new commits depending on how many squash points you take.

---

## 5. Pre-merge checklist

- [ ] CI on `iter-22-smoke-fix` is green (last verified iter-21).
- [ ] `npm run lint` and `npm test` pass locally on `iter-22-smoke-fix`.
- [ ] Decide on §2 vs §3 path; document the choice in the merge commit message.
- [ ] Decide on §4.3 version-bump timing.
- [ ] Pages workflow has not been disabled in repo settings.
- [ ] Announce the cutover so anyone watching the live site knows v2.8 is going
      out.

Once those check out, the merge itself is a 30-second operation. The work
is in choosing the strategy, not in running it.

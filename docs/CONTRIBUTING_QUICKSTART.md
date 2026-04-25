# Contributing in 5 minutes

A short, opinionated path from "I just cloned the repo" to "my first PR is
open". For the full rules see [`CONTRIBUTING.md`](../CONTRIBUTING.md). This
file is intentionally tiny; if you're stuck, open a Discussion and a
maintainer will walk you through it.

## 0. What you'll need

- **Node.js ≥ 18** (we use `node:test` and the modern `--test` runner).
- **Git** + a GitHub account.
- A modern browser (Chrome / Firefox / Safari ≥ 16).

That's it. There is no bundler, no transpiler, no `npm install`-ing of
runtime libraries — just ESLint and Prettier as dev tools.

## 1. Clone, install, run (≈60 seconds)

```bash
git clone https://github.com/Ricardo-M-L/canvas-vampire-survivors.git
cd canvas-vampire-survivors
npm install          # ESLint + Prettier + Playwright (dev only)
npm start            # opens at http://localhost:3000
```

If `npm` is not your thing, you can also drag `index.html` straight into a
browser tab. The game ships as plain ES modules served from disk.

## 2. Find your first issue (≈1 minute)

We tag onboarding-friendly tickets with **`good-first-issue`** and slightly
chunkier ones with **`help-wanted`**. Filters:

- [Open `good-first-issue`](https://github.com/Ricardo-M-L/canvas-vampire-survivors/issues?q=is%3Aissue+is%3Aopen+label%3Agood-first-issue)
- [Open `help-wanted`](https://github.com/Ricardo-M-L/canvas-vampire-survivors/issues?q=is%3Aissue+is%3Aopen+label%3Ahelp-wanted)
- [Open `a11y`](https://github.com/Ricardo-M-L/canvas-vampire-survivors/issues?q=is%3Aissue+is%3Aopen+label%3Aa11y)

If the issue list is empty but you still want to help, check out
[`docs/GOOD_FIRST_ISSUES.md`](./GOOD_FIRST_ISSUES.md) for evergreen ideas
(translations, balance cards, screenshots, accessibility audits).

## 3. Branch, code, lint, test (≈3 minutes)

```bash
git checkout -b feat/short-and-descriptive-name

# … your changes …

npm run lint          # eslint, no errors
npm run format        # prettier, formats *.js *.css *.html *.md *.json
npm test              # node --test test/*.test.js (144 tests at the time of writing)
npm run smoke         # optional: real-browser playwright + axe smoke
```

Running `npm run check` does the lint + format check + test in one go.
That's the same script CI runs.

## 4. Commit + push + PR (≈1 minute)

We loosely follow Conventional Commits — prefix your commit with `feat:`,
`fix:`, `perf:`, `refactor:`, `docs:`, `chore:`, or `test:`.

```bash
git add -p
git commit -m "feat: add Frost Lance evolution variant"
git push -u origin feat/short-and-descriptive-name
```

Then open the PR on GitHub. The PR template will prompt you for:

- A short summary of the change.
- A **manual** test plan (e.g. "ran for 8 minutes, killed Necromancer at
  04:00, no console errors, no visual glitches").
- Screenshots / GIF if the change is visible.

A maintainer (currently `@Ricardo-M-L`, owner per
[`CODEOWNERS`](../.github/CODEOWNERS)) will review within a few days. Don't
worry about getting style nits perfect — Prettier formats everything for you
and reviewers will help with the rest.

## 5. After your PR is merged

- Your handle goes into the contributor list. Drop a star ⭐ on the repo if
  you haven't already!
- Pick a slightly bigger issue, or open a feature proposal in Discussions.
- Tell a friend who likes vanilla-JS games — the project grows because
  people share it.

## Common gotchas

- **`npm install` failing on Playwright browser download** — set
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` if you're not running the smoke
  harness. Lint/test/format work without browsers installed.
- **Tests fail on Windows path globs** — make sure your shell is bash or
  use Git Bash; the npm scripts assume POSIX glob expansion.
- **"My change works on desktop but breaks the joystick"** — re-test on a
  phone or use DevTools' touch emulation. Touch input goes through
  `src/input.js`'s virtual joystick path.
- **No screenshot showed up after `npm run smoke`** — the smoke harness
  writes to `docs/screenshots/real-*.png`. If you don't see them, the
  Playwright launch likely failed; check the stderr for `[server!]` lines.

Welcome aboard, and have fun.

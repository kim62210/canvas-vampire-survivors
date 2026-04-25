# GitHub repository settings checklist

A few settings live only in the GitHub UI (not in any file in this repo) and
need to be applied by the repository **owner**, not by CI. Run through this
list once after the v2.5 tag — most boxes ought to be ticked already, but
they're worth re-checking before a public launch.

> Repo: https://github.com/ricardo-foundry/canvas-vampire-survivors

## 1. About panel (right-hand sidebar on the repo home page)

Click the gear icon next to **About** and set:

- **Description**:
    > Zero-dependency HTML5 Canvas roguelite inspired by Vampire Survivors. Vanilla JS · MIT.
- **Website**:
    > https://ricardo-foundry.github.io/canvas-vampire-survivors/
- Tick:
    - [x] Use your GitHub Pages website
    - [x] Releases
    - [x] Packages — leave **off** (we don't publish to npm)
- **Topics** (comma-separated, lower-case, hyphenated):
    ```
    game, html5, html5-canvas-game, canvas, roguelite,
    vampire-survivors, vampire-survivors-clone, browser-roguelite,
    bullet-hell, browser-game, vanilla-js, zero-dependencies,
    indie-game, speedrun, open-source, pwa, accessibility, i18n
    ```

These are also mirrored in `package.json#keywords` so npm-style tooling
can find the project.

## 2. Pages

`Settings → Pages`:

- **Source**: GitHub Actions (the `.github/workflows/pages.yml` workflow
  already deploys on push-to-main).
- **Custom domain**: leave empty unless you own one.
- **Enforce HTTPS**: ✅

After the first successful workflow run the URL above will go live.

## 3. Branch protection (optional but recommended for a public repo)

`Settings → Branches → Add rule`:

- Pattern: `main`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
    - select the `lint` and `test` checks from `ci.yml`
- ✅ Require linear history
- Leave **Require signed commits** off (it deters first-time contributors).

## 4. Discussions / Issues

`Settings → General → Features`:

- ✅ Issues
- ✅ Discussions — switch on if you want a place for "Show your build" and
  speedrun threads. Templates already live in `.github/`.

## 5. Releases

When tagging `v2.5.0`:

1. `Releases → Draft a new release`
2. Tag: `v2.5.0` (target `main`)
3. Title: `v2.5.0 — Reflection & polish`
4. Body: paste from `docs/RELEASE_v2.5.md`
5. Attach (optional): a `vs-2.5.0-source.zip` — GitHub auto-attaches one.
6. ✅ Set as the latest release
7. ✅ Create a discussion for this release (if Discussions is on)

## 6. Social preview image

`Settings → General → Social preview → Edit`:

- Upload `docs/og-card.svg` (or a 1280×640 PNG export of it).
- The card is also already wired into `index.html` via OG tags for
  link-shares of the live demo.

## 7. Sponsors / FUNDING

If you decide to accept sponsorship, drop a `.github/FUNDING.yml` and
re-check this file — currently the repo is sponsorship-free by design
("zero deps, zero strings").

## 8. Things _not_ to touch

- Don't enable Wiki — `README.md`, `CONTRIBUTING.md`, `BALANCE.md` and
  `docs/` already cover the long-form prose.
- Don't enable Projects — the roadmap lives in `README.md`.
- Don't import the GitHub-recommended `.gitignore` template — the
  hand-rolled one in the repo is intentionally minimal.

## 9. Verify

After applying everything above:

```bash
gh repo view ricardo-foundry/canvas-vampire-survivors --json description,homepageUrl,topics
```

Expected output should match the strings above.

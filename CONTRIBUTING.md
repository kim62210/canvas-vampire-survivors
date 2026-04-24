# Contributing to Survivor

First off — thanks for considering a contribution! This project lives and dies by its
community. The goal is a polished, **zero-dependency** HTML5 Canvas roguelite that
anyone can clone and hack on in minutes.

## Quick start

```bash
git clone https://github.com/OWNER/vampire-survivors-clone.git
cd vampire-survivors-clone
npm install            # only installs ESLint + Prettier
npm run dev            # http://localhost:3000
```

The runtime game itself has **no runtime dependencies** — you could delete
`node_modules` and it would still work in the browser. The dev dependencies are
only for linting/formatting.

## Ground rules

1. **No runtime dependencies.** Keep the game vanilla JS + Canvas. If you think
   a library is worth the weight, open an issue to discuss first.
2. **Keep it playable on a fresh clone without a build step.** ES modules
   served from disk are fine; bundlers are not.
3. **Accessibility matters.** New UI must be keyboard-navigable, respect
   `prefers-reduced-motion`, and work with a touch joystick.
4. **Frame-rate independence.** All gameplay code must use delta time. Never
   write `this.x += someSpeed` without multiplying by `dt`.
5. **Write i18n-ready strings.** Add new UI text to `src/i18n.js` in at least
   English and 简体中文.

## Project layout

```
.
├── index.html          Entry HTML
├── styles.css          All game styling
├── server.js           Tiny dev server (no deps)
├── src/
│   ├── main.js         Orchestrator + game loop
│   ├── config.js       Static config, GameState enum
│   ├── data.js         Weapons, passives, enemies, bosses
│   ├── entities.js     Player, Enemy, Projectile, ExpOrb, Particle
│   ├── weapons.js      Weapon behaviour
│   ├── systems.js      Spatial hash, camera, FPS meter
│   ├── audio.js        Web Audio synthesis
│   ├── input.js        Keyboard + virtual joystick
│   ├── storage.js      localStorage save/load
│   ├── ui.js           DOM/HUD helpers
│   └── i18n.js         Translations
└── .github/            Issue/PR templates, CI
```

## Pull request checklist

Before opening a PR, please:

- [ ] Run `npm run lint` — no errors.
- [ ] Run `npm run format` and commit any formatting changes.
- [ ] Manually playtest your change: run at 30fps (DevTools throttle) and 144fps.
- [ ] Update `CHANGELOG.md` under the `[Unreleased]` section.
- [ ] If you added gameplay content (weapon/passive/enemy), balance-test to at
      least the 5-minute mark on Normal difficulty.
- [ ] Add or update translations in `src/i18n.js` for any new UI strings.

## Commit messages

We loosely follow Conventional Commits. Prefixes we use:

- `feat:` new gameplay/UI feature
- `fix:` bug fix
- `perf:` performance improvement
- `refactor:` internal code change, no behaviour change
- `docs:` README / wiki updates
- `chore:` tooling/deps
- `test:` test-only changes

## Balance & design changes

Gameplay balance changes (enemy HP, weapon damage, etc.) should include a short
rationale in the PR description — ideally with a before/after anecdote or clip.

## Reporting bugs

Please use the bug report template under `.github/ISSUE_TEMPLATE/bug_report.yml`.
Include your browser, OS, and whether it's reproducible from a fresh run.

## Security

If you find a security issue (XSS via savefile, etc.), please **do not** open a
public issue. See `SECURITY.md`.

## Licence

By contributing, you agree your work will be released under the project's MIT
licence.

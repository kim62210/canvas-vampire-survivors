# Cross-promotion — sister projects

Three small, independent, MIT-licensed open-source repos under the same
GitHub org (`ricardo-foundry`) share a workflow:

- iterate in public, with per-iteration notes in `docs/JOURNEY.md`
- zero (or near-zero) runtime dependencies
- runtime-verified shipping (live smoke harnesses, not just unit tests)

Cross-linking them is genuinely useful for visitors — if you liked one,
you'll likely like the other two — and it boosts each repo's discoverability
without resorting to keyword-stuffing or paid promotion.

## The three repos

| Repo                        | One-liner                                                                       | Stack                                       | Status               |
| --------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- | -------------------- |
| **canvas-vampire-survivors** | Vanilla-JS Vampire-Survivors clone, zero runtime deps, plays on GitHub Pages.   | HTML5 Canvas · ES modules · Web Audio · PWA | v2.7 (this repo)     |
| **openhand**                | LLM-agnostic, plugin-first agent framework, sandboxed tools by default.         | TypeScript strict · npm workspaces · Docker | v0.7                 |
| **terminal-quest-cli**      | Bilingual terminal RPG with 11 quests, 11 minigames, 5 locales.                 | Node ≥14 · zero deps · npm publishable      | v2.8                 |

Live entry points:

- **canvas-vampire-survivors** — <https://ricardo-foundry.github.io/canvas-vampire-survivors/>
- **openhand** — <https://github.com/ricardo-foundry/openhand>
- **terminal-quest-cli** — `npx terminal-quest-cli` (or
  <https://www.npmjs.com/package/terminal-quest-cli>)

## Drop-in README block

Paste the block below into each repo's README, just above the License
section. It's identical across the three repos so the cross-link graph
is symmetric.

```markdown
## 🌌 Sister projects

Three small, independent, MIT-licensed repos under the same org. If you
liked this one, the other two are built with the same iterate-in-public,
near-zero-dep philosophy:

- **[canvas-vampire-survivors](https://github.com/ricardo-foundry/canvas-vampire-survivors)**
  — Vanilla-JS Vampire-Survivors clone. Zero runtime deps,
  [playable on GitHub Pages](https://ricardo-foundry.github.io/canvas-vampire-survivors/).
- **[openhand](https://github.com/ricardo-foundry/openhand)** — LLM-agnostic,
  plugin-first agent framework. TypeScript strict, sandboxed tools, Docker-ready.
- **[terminal-quest-cli](https://github.com/ricardo-foundry/terminal-quest-cli)**
  — Bilingual terminal RPG with 11 quests and 11 minigames. `npx terminal-quest-cli`
  to play, zero runtime deps.

Each project keeps a `docs/JOURNEY.md` with per-iteration notes — the
"build log" of how it got to its current shape.
```

When pasting into the other two repos, change the leading bullet so the
**current** repo isn't repeated; for example, `openhand`'s README should
list `canvas-vampire-survivors` and `terminal-quest-cli` (not openhand).

## Where else to cross-promote

- **GitHub Releases.** Add a "Sister projects" footer line on each release
  body (one line, three links).
- **Show HN / Reddit posts.** Single line in the OP comment ("If you like
  this, the same author has X and Y"). Don't spam; one mention per launch.
- **`pinned` repos** on each owner / org profile so visitors see all three
  at once.
- **`docs/PRESS_KIT.md`** — list the trio together, share a single
  press-kit zip if a journalist asks.

## What NOT to do

- Don't bundle them into a monorepo. The whole pitch is "three small,
  independent things". A monorepo would dilute that.
- Don't trade Stars across them. Authentic stars only.
- Don't auto-cross-post to social — write each post for its audience.

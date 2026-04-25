# Issue & PR labels

A short, opinionated set of labels we apply to issues and PRs. The list is
deliberately small — too many labels turn into noise. Maintainers can create
the labels in **Settings → Labels** with the suggested colours below.

| Label              | Colour    | When to use                                                           |
| ------------------ | --------- | --------------------------------------------------------------------- |
| `good-first-issue` | `#7057ff` | Beginner-friendly tickets. One file, clear acceptance, ≤2 hours.      |
| `help-wanted`      | `#008672` | We'd love a contributor on this. Slightly bigger than first-issue.    |
| `bug`              | `#d73a4a` | Something broken in the shipped game.                                 |
| `feat`             | `#a2eeef` | New gameplay/UI feature. Should reference design discussion if large. |
| `a11y`             | `#fbca04` | Accessibility issues — keyboard nav, contrast, screen reader, motion. |
| `perf`             | `#e99695` | Performance regressions or wins. Include before/after numbers.        |
| `docs`             | `#0075ca` | README / Markdown / JSDoc / inline comment changes only.              |
| `i18n`             | `#cccccc` | Translation work. Pair with the locale (`i18n: ja`, `i18n: es`, ...). |
| `wontfix`          | `#ffffff` | Closed as out-of-scope. Always leave a kind explanation.              |
| `duplicate`        | `#cfd3d7` | Closed as a duplicate. Always link the original.                      |

Maintainer note: keep one label per dimension (severity is implicit in
`bug`'s description, not a separate label). If a category grows past ~10
issues, that's a signal to spawn a roadmap item, not a new label.

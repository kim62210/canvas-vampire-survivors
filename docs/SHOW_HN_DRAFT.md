# Show HN draft — Survivor (canvas-vampire-survivors)

Source of truth for the Hacker News submission. Once you submit, freeze the
text below — never edit retroactively, just append a dated "EDIT:" footer.

---

## Title (≤ 80 chars)

> **Show HN: Survivor – a vanilla-JS Vampire-Survivors clone, zero deps,
> playable on GitHub Pages**

Alternates if the first one feels off:

- Show HN: I built a 16 KB Vampire Survivors clone in vanilla JS, no bundler
- Show HN: Vampire Survivors clone in plain JS — clone, open index.html, play
- Show HN: A 16-iteration log of shipping a roguelite in vanilla JS

The first one is the recommended default — it leads with the genre, the
stack signal, and the zero-friction CTA.

## URL

`https://ricardo-foundry.github.io/canvas-vampire-survivors/`

(Submit the Pages URL, **not** the repo. The Pages page links back to the
repo in the corner. HN ranks live demos higher than READMEs.)

---

## Post body (first comment, posted by OP within 60 s)

> Hi HN — author here.
>
> This is **Survivor**, a small Vampire-Survivors-style roguelite I wrote
> over 16 iterations to see how far you can take a browser game with
> **zero runtime dependencies**: no React, no bundler, no transpiler, no
> minifier. The whole thing is `index.html` + a few ES modules under
> `src/`. `npm install` only pulls ESLint + Prettier as dev tools.
>
> What I think is interesting:
>
> - **Vanilla JS, end to end.** ES2022 modules, HTML5 Canvas, Web Audio
>   for the synth music, `localStorage` for saves. The biggest
>   single file is under 1k lines and every export is JSDoc'd.
> - **Open in a browser, period.** It works from `file://`, from
>   `python -m http.server`, from `npm start`, and as a PWA on mobile
>   ("Add to Home Screen" gives you an offline icon via a 60-line
>   service worker).
> - **Runtime-verified.** A Playwright smoke harness boots the live
>   GitHub Pages URL, fast-forwards game time using `window.__SURV_DEBUG__`
>   hooks, takes real PNG screenshots of the boss / level-up / death
>   scenes, and asserts `0 console.error`, `0 pageerror`,
>   `0 finding(s)`. The README screenshots are **all** captures from
>   that script.
> - **A 16-iteration story.** I kept a `docs/JOURNEY.md` of every
>   iteration: what broke, what I cut, what I didn't ship and why. It's
>   the file I'd want to read if I were the next person reaching for a
>   "build a small game in plain JS" template.
>
> The current build has 3 stages (Whisperwood, Sunken Crypt, Frozen
> Tundra), 10 weapons with evolutions, 10 passives, gamepad support,
> EN + 简体中文 i18n, daily challenge with a deterministic per-UTC
> seed and a Wordle-style share string, axe-core clean main menu, and
> a 241-test `node:test` suite that runs in under 4 s.
>
> Inspired by Vampire Survivors by Poncle — independent homage, not
> affiliated.
>
> **Repo:** https://github.com/ricardo-foundry/canvas-vampire-survivors
>
> Happy to answer anything about the architecture, the iterate-in-public
> workflow, or specifically the trade-offs of refusing to add a bundler.

---

## Pre-staged follow-ups (paste as separate comments, one per topic)

These exist so the conversation has somewhere to go in the first hour, when
HN's ranking algorithm is most sensitive to comment velocity.

**Why no bundler?** "Bundlers solve a problem I didn't have. The whole
runtime is ~16 KB minified-equivalent (gzipped Pages serves it ~6 KB),
loads in one round trip, and a `<script type='module'>` tag is enough to
boot. The day I add a 2 MB framework I lose the entire 'open
index.html' pitch."

**Why a Playwright smoke instead of unit tests for the renderer?** "The
renderer is the integration boundary. Unit tests caught logic regressions
just fine; what they missed were `getImageData` MIME issues, font
fallbacks on iOS Safari, and a service-worker 404 on cold Pages CDN.
Live smoke caught all three."

**The 16-iteration journey.** Link to `docs/JOURNEY.md` and the per-iter
notes; happy to dig into any single iteration if anyone wants the gory
details.

**Sister projects.** Two other zero-deps OSS repos in the same family:
`openhand` (TypeScript LLM agent framework) and `terminal-quest-cli`
(bilingual terminal RPG). Same iterate-in-public workflow.

---

## Submission etiquette

- Post Tuesday–Thursday, 13:00–15:00 UTC (US morning, EU afternoon).
- Do **not** ask people to upvote — automatic flag risk.
- Reply to every top-level comment within 30 minutes for the first 4 h;
  HN rewards author engagement.
- Never edit the title once submitted; HN locks it after a few minutes
  anyway.
- If it doesn't land, wait 30+ days before resubmitting and change the
  title materially (HN's dupe detector is title-fuzzy).

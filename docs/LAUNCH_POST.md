# I wrote a Vampire Survivors clone in 2,000 lines of vanilla JavaScript — no framework, no build step

## Why I built it

I wanted one weekend project I could hand to my cousin and say "open the HTML
file, it works." No `npm install`. No bundler. No webpack config that
half-breaks on Windows. Just a folder of `.js` files you can double-click.

Vampire Survivors is a perfect game to rebuild because the rules are so
small: you walk, weapons auto-fire, enemies chase, XP orbs level you up,
you die. Everything interesting is emergent. Under the surface there is a
fixed-step simulation loop, a spatial hash for broad-phase collision, a
generic object pool for GC-free particles, and a save layer that works
without a backend. Writing all of that in plain JS turned out to be the
most fun I had programming this year.

## What shipped

- **13 weapons** (whip, knife, magic wand, lightning, garlic, orbit
  shards, area mines, plus v2.4 Frost Nova / Soul Drain / Boomerang),
  each with a level-5 evolution.
- **10 enemy archetypes** — chasers, splitters, ranged cultists, shielded
  golems, dashing dire wolves, self-destructing bombers, cloning
  illusionists — plus 4 bosses (Reaper, Necromancer, Void Lord, Chrono
  Lich) on a fixed timeline.
- **Speedrun mode** with a deterministic seed, millisecond timer and
  split points at 1/3/5/7.5/10/12 minutes.
- **18 achievements**, a passive-free "Zen Walker" challenge, and an
  exportable JSON leaderboard so you can share runs.
- **A11y pass**: reduced-motion, screen-reader live region, forced-colors
  high-contrast palette, full keyboard + gamepad + touch-joystick input.
- **Offline-capable PWA**: install to home screen, plays with the Wi-Fi
  unplugged after the first visit.

## Stack

Vanilla ES modules, one `<canvas>`, one stylesheet, a ~100-line
`node server.js` to serve the static files during development. Tests use
`node:test` (stdlib — no Jest, no Vitest, no Mocha). CI runs lint +
prettier + the test suite on every PR. Total runtime dependency count:
**zero**.

## Try it + read the code

- **Play in browser:** https://ricardo-m-l.github.io/canvas-vampire-survivors/
- **Source:** https://github.com/Ricardo-M-L/canvas-vampire-survivors

If you've ever wanted a readable, hackable Canvas game to learn from,
start here. Fork, reskin, bolt on a story, turn it into a game-jam
submission. MIT-licensed. Pull requests welcome, especially weapon
designs — the data layer is deliberately one table you can append to.

Feedback and roasts gladly accepted in the comments. Tell me what you'd
add and I might build it next weekend.

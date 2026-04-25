# Survivor — Press Kit

## One-line positioning (20 words)

A zero-dependency Vampire Survivors clone you can play in any browser and
read in one sitting.

## Tweet version (140 chars)

A Vampire Survivors clone in 2k lines of vanilla JS. No build step.
No deps. Speedrun mode + 18 achievements + PWA. Play & fork it:
https://ricardo-foundry.github.io/canvas-vampire-survivors/

## One-minute elevator pitch

Survivor is an open-source roguelite built in plain JavaScript — no
framework, no bundler, no runtime dependencies. You drop the folder on
any static host and it runs; you can even play it offline after the
first visit. The game ships with thirteen weapons (each with a level-5
evolution), ten enemy archetypes, four bosses on a fixed timeline, and
a Speedrun mode with a deterministic seed so runs are comparable down
to the millisecond. There are eighteen achievements — some cheeky, like
"Zen Walker" for surviving five minutes without picking a single
passive. Tests live in `node:test` from the standard library; CI runs
lint + prettier + the test suite on every PR. The whole project is MIT
and the source is deliberately small enough that you can read it in a
weekend and fork it the next. Whether you're learning Canvas, writing a
blog post about game loops, or looking for a reskinnable base for a jam
entry — this is meant for you.

## Most-quotable line

> "I wanted one weekend project I could hand to my cousin and say 'open
> the HTML file, it works.'"

## Fact sheet

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Engine       | Vanilla JavaScript, HTML5 Canvas                               |
| Runtime deps | 0                                                              |
| Source lines | ~2,000                                                         |
| Platforms    | Any browser (desktop + mobile) + PWA                           |
| License      | MIT                                                            |
| Input        | Keyboard, mouse, gamepad, touch joystick                       |
| A11y         | Reduced motion, SR live region, forced-colors, keyboard nav    |
| Test suite   | `node:test`, 95+ cases                                         |
| Contact      | https://github.com/ricardo-foundry/canvas-vampire-survivors/issues |

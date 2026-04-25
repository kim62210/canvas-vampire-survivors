# Frequently asked questions

## 1. Do I need to install anything?

No. Open the
[GitHub Pages URL](https://ricardo-foundry.github.io/canvas-vampire-survivors/)
and the game runs. If you want to self-host, `git clone`, then
`node server.js` or open `index.html` directly.

## 2. Does it work offline?

Yes. After your first visit the service worker caches every file, so the
game launches fine when you're on a plane or inside the subway. You can
also "Add to Home Screen" on iOS / Android for an app-like icon.

## 3. Is there mobile support?

Yes. A virtual joystick appears on touch devices. Audio unlocks on the
first tap (browser policy). We added `touch-action: none` and
`overscroll-behavior: none` to stop pinch-zoom and pull-to-refresh from
interfering with gameplay.

## 4. How do I save my progress?

Automatically, to `localStorage`. Your achievements, settings, high
scores and Speedrun records persist between sessions. There's a "Reset
all saved data" button in Settings. No backend, no tracking, no
analytics.

## 5. Can I move my save between devices?

Open the Leaderboard screen, click **Export** — you get a JSON blob in
the textarea. Paste it into the Leaderboard on the other device and
click **Import**. (Full save import is on the roadmap; right now only
scores transfer.)

## 6. Is there a Speedrun leaderboard?

Yes, local-only for now. The main menu "Speedrun" button starts a run
with a fixed RNG seed and fixed boss timeline. Splits appear at 1, 3, 5,
7.5, 10 and 12 minutes of in-game time, with millisecond precision.
Community leaderboard via a hosted API is on the roadmap but we'd rather
not hard-couple the project to any one backend yet.

## 7. What browsers are supported?

Modern Chrome, Firefox, Safari (desktop + iOS) and Edge. The game uses
ES modules, `<canvas>` 2D, WebAudio and `localStorage` — all
widely-supported APIs. IE11 is not supported and never will be.

## 8. Can I use this code for my own game / game jam?

Yes, please. The project is MIT-licensed. Fork it, reskin it, gut the
Vampire Survivors-ness, build your own thing. A credit line in the
README is appreciated but not required. Contributing a new weapon or
enemy archetype back upstream is even better — the `src/data.js`
catalogue is deliberately pure data so you can just append an entry.

## 9. Why vanilla JavaScript in 2026?

Because the whole point of the web is that you can double-click an HTML
file and it works. Every framework adds a tax: build steps, CI
complexity, upgrade cycles, supply-chain risk. For a game this size,
writing the 1,500 lines of glue that a framework would otherwise hide
turned out to be _fun_, educational, and made the result dramatically
easier to hack on.

## 10. Something broke / I have feedback

Please open an issue on GitHub
([bug report template](https://github.com/ricardo-foundry/canvas-vampire-survivors/issues/new/choose))
and include: browser + version, whether you're on mobile, and the URL.
Console logs are gold. If it's a gameplay balance opinion, please open a
Discussion instead.

# Manual QA Checklist

Player-facing smoke pass for contributors before tagging or merging gameplay
changes. Pair this with `npm run check` (lint + format + tests) and
`node scripts/runtime-smoke.js` (headless Chromium boot + screenshots).

The full pass takes ~10 minutes. If you have less time, do at least sections
**Boot**, **Combat**, and **Pause + resume**.

## Setup

1. `npm start` (or `node server.js`) — note the port (default 3000).
2. Open `http://localhost:<port>/` in a fresh browser profile / incognito so
   localStorage is empty (or click Settings → "Reset Save").
3. Open DevTools → Console. **Any red error or yellow warning is a bug.**

## Boot

- [ ] Title `SURVIVOR` appears within ~1 s of the page loading.
- [ ] All five buttons (`Start Run`, `Speedrun`, `Leaderboard`, `Settings`,
      `View Achievements`) are visible and tab-focusable.
- [ ] No 404s in the Network tab (especially `manifest.json`,
      `service-worker.js`, `hero.svg`).
- [ ] On a real HTTP origin (i.e. not `file://`) the service worker registers
      without errors.

## Movement + camera

- [ ] WASD moves the hero. Arrow keys also move the hero.
- [ ] The hero stays inside the playable arena — walking into any of the four
      walls **clamps** them, never lets them slide off-screen
      (regression guard for the Round 9 runtime fix).
- [ ] On touch, the virtual joystick (bottom-left) drives the hero.

## Combat

- [ ] At ~00:08 enemies enter the whip's range and visibly take damage
      (orange floating numbers).
- [ ] Killing an enemy drops a green XP orb that magnetises into the hero
      once you walk near it.
- [ ] FPS counter (Settings → Show FPS) holds 55+ during the first minute.

## Level-up

- [ ] At level 2 the game freezes and the **Choose an upgrade** card appears.
- [ ] Clicking a card resumes the run; the chosen weapon/passive shows up in
      the bottom HUD.
- [ ] `1` / `2` / `3` keyboard shortcuts also pick a card.

## Pause + resume

- [ ] `Esc` opens the pause menu, `Esc` again resumes.
- [ ] `P` does the same.
- [ ] The HUD `⏸` button does the same.
- [ ] Pause from the in-game button does **not** dismiss when clicking the
      canvas behind the overlay.
- [ ] Switching tabs auto-pauses; switching back leaves the pause menu up
      (no auto-resume "ghost" damage from a giant `dt`).

## Boss

- [ ] At 03:55 a red boss-warning banner flashes; at 04:00 the boss spawns
      with a screen shake.
- [ ] Defeating the boss spawns a particle burst and unlocks any achievements
      whose conditions are met (toast in the top-right).

## Speedrun

- [ ] `Speedrun` button starts a deterministic run (same enemy spawns
      every time) and tracks real-time splits (1m / 3m / 5m / 7.5m / ...).
- [ ] On death, the splits show up under the stats panel and the run lands
      in the Speedrun leaderboard tab, not the normal one.

## Settings

- [ ] Master / SFX / music sliders take effect immediately.
- [ ] `High contrast` and `Reduced motion` apply without reloading the page.
- [ ] `Reset Save` clears highscores, achievements and lifetime totals.
- [ ] Locale switch (`en` / `zh`) flips menu copy live.

## Accessibility (a11y)

- [ ] Tab traverses every menu in a sensible order; the focused button has
      a visible outline.
- [ ] Screen reader (VoiceOver / NVDA) announces "Boss incoming" and
      "Achievement unlocked" via the off-screen live region.
- [ ] `prefers-reduced-motion: reduce` disables camera shake and floating
      damage text.

## Game-over flow

- [ ] Dying brings up the **YOU DIED** card with stats.
- [ ] `Retry` starts a fresh run with the same difficulty.
- [ ] `Main Menu` returns to the title without leaking the previous run's
      timers (gameTime resets to 00:00).

## When something goes wrong

1. Copy the full console error stack into a new GitHub issue.
2. If it's reproducible, capture `localStorage.getItem('vs_clone_save_v2')`
   to attach.
3. Re-run `node scripts/runtime-smoke.js` and attach
   `docs/RUNTIME_QA_REPORT.md`.

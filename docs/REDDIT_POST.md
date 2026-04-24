# Reddit post templates

## For r/WebGames

**Title**

    [Browser] Survivor — open-source Vampire Survivors clone in vanilla JavaScript (no install, play in browser)

**Body**

Hey r/WebGames!

I built a small roguelite in plain JavaScript — no framework, no build
step, no install — and I'd love your feedback.

**Play:** https://ricardo-m-l.github.io/canvas-vampire-survivors/

**Source:** https://github.com/Ricardo-M-L/canvas-vampire-survivors

**Controls**

- WASD / arrow keys to move (touch joystick on mobile, gamepad also works).
- Weapons auto-fire.
- Esc / P to pause.
- Survive as long as you can; pick one upgrade per level-up.

**What's in this build**

- 13 weapons, each with a level-5 evolution (Whip → Bloody Sweep, Lightning
  → Thunder Call, new this version: Frost Nova, Soul Drain, Boomerang).
- 10 enemy archetypes including self-destructing Bombers and Illusionists
  that clone themselves.
- 4 bosses on a fixed timeline (5:00, 7:30, 10:00, 12:00).
- Speedrun mode with deterministic seed + millisecond splits.
- 18 achievements, exportable JSON leaderboard.
- Plays offline (PWA). Install to home screen if you want.

Zero runtime dependencies. MIT-licensed. Read the source if you feel
like it — I tried to keep every module small enough to understand in a
sitting.

Happy to answer any questions about the design or the code.

---

## For r/roguelites

**Title**

    Survivor — a free, MIT-licensed Vampire Survivors clone in the browser. New version adds Speedrun mode, 3 new weapons + 2 bosses.

**Body**

Long-time lurker here. I've been writing a browser roguelite heavily
inspired by Vampire Survivors, and the new v2.4 build just dropped. Would
love some playtest feedback, especially on the pacing of the late game.

**Play:** https://ricardo-m-l.github.io/canvas-vampire-survivors/
**Source:** https://github.com/Ricardo-M-L/canvas-vampire-survivors

**New in this build**

- **Speedrun mode** (menu → Speedrun): fixed seed, fixed boss timeline,
  millisecond-precision timer, splits at 1 / 3 / 5 / 7.5 / 10 / 12 min,
  separate leaderboard (exportable to JSON).
- **2 new bosses:** Necromancer at 7:30 and Chrono Lich at 12:00.
- **3 new weapons:**
    - Frost Nova — expanding ring that slows foes in the blast.
    - Soul Drain — tethers the nearest enemy and lifesteals.
    - Boomerang — flung forward, returns to the hero.
- **6 new achievements** including "Speed Demon" (Void Lord in <5 min
  wall-clock time), "Flawless Duel" (any boss, no-hit), "Zen Walker"
  (5 minutes with zero passives).
- Overhauled leaderboard UX: full screen, scrollable, export/import JSON
  for easy sharing.

**Known rough edges**

- Balance of the new evolutions hasn't had hundreds of hours of play yet.
- No meta-progression layer (yet) — every run is from scratch, like vanilla
  VS at launch.

Any feedback welcome. I'll be in the comments all day.

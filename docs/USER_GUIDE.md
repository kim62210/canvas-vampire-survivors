# Survivor — User Guide

This guide is the single-source player handbook. It covers everything from
basic controls to high-difficulty strategy. If you only have one minute,
read **Controls** and **The Loop** below; everything else is reference.

For the per-platform key/button reference (touch, gamepad, keyboard
modifiers), see [`CONTROLS.md`](./CONTROLS.md).

---

## The Loop

You walk. Your weapons swing on their own. Enemies die, drop XP orbs,
you walk over the orbs to level up, you pick an upgrade, and the spawn
director ramps. A boss arrives every few minutes. Survive 12 minutes
on a stage and you've cleared a "long run".

There is no manual aim and no fire button. Positioning **is** the game.

---

## Controls

| Action           | Keyboard        | Touch                          | Gamepad    |
| ---------------- | --------------- | ------------------------------ | ---------- |
| Move             | WASD / arrows   | Drag the joystick (lower-left) | Left stick |
| Pause / resume   | P or Esc        | Double-tap a screen edge       | Start      |
| Confirm a menu   | Enter or Space  | Tap the button                 | A          |
| Cancel / close   | Esc             | Tap outside the card           | B          |
| Cycle menu items | Tab / Shift+Tab | —                              | LB / RB    |
| Mute audio       | M               | Settings → volume sliders      | —          |
| Help overlay     | H or ?          | "How to Play" button           | —          |
| Special skill    | —               | ✦ button (lower-right)         | —          |

The virtual joystick has a 15% inner deadzone and a soft outer curve so
small drags don't sprint you across the arena. The gamepad layer uses an
18% deadzone with live-band renormalisation. Both are tuned to feel
identical at full deflection.

---

## First-Launch Tutorial (iter-15)

A fresh save offers a 5-step interactive tutorial:

1. **Move** — walk in any direction for ~0.4 seconds.
2. **Auto-attack** — the starting Whip swings on its own; just observe.
3. **Pick up XP** — kill a bat, then walk over the green orb.
4. **Level up** — fill the XP bar and choose your first upgrade.
5. **Pause** — press P or Esc to confirm the pause overlay works.

Each step shows a banner across the top of the screen with a hint. Press
**Esc** at any point to skip — the tutorial flag flips either way, so we
won't nag you on the next launch. You can also start it manually from
the main menu's **Try Tutorial** button.

---

## Replays (iter-15)

Every run is recorded into a single localStorage slot
(`vs_replay_last_v1`). Only the **most recent** run is kept — newer
runs overwrite older ones — so the save never grows unbounded.

**Replay Last Run** on the main menu opens a small dialog with a run
summary and three speed options:

- **1×** — real-time playback.
- **2×** — double speed.
- **4×** — quad speed (ideal for skimming late-game decisions).

Player input is **disabled** during playback. To leave the replay,
press P/Esc to pause, then Quit to Menu.

Caveat: replays preserve the player input timeline exactly, but
non-deterministic systems (Math.random for crit rolls, particle jitter)
will diverge. For frame-perfect determinism, use Speedrun or Daily mode
— those run on a seeded RNG.

---

## Stages

| Stage         | Modifiers                                               | Final Boss |
| ------------- | ------------------------------------------------------- | ---------- |
| Whisperwood   | Baseline — no modifiers                                 | Void Lord  |
| Crypt         | Earlier Reaper, denser undead pools                     | Void Lord  |
| Frozen Tundra | -10% move speed, +20% enemy HP, cold tick (-1 HP / 10s) | Ice Queen  |

The cold tick on Tundra never kills (clamps at 1 HP) so death is always
attributable to a real enemy hit.

Switch stages from **Stage** on the main menu — your choice persists.

---

## Weapons & Evolutions

Every run starts with **Whip**. Each weapon caps at level 5; reaching
level 5 unlocks the evolution if its trigger condition is met.

| Base weapon | Evolved form    | Trigger                  |
| ----------- | --------------- | ------------------------ |
| Whip        | Vampire Lash    | Lvl 5 + LUCK passive ≥ 1 |
| Knife       | Blade Fan       | Lvl 5 + ARMOR ≥ 1        |
| Lightning   | Thunder Call    | Lvl 5 + WISDOM ≥ 1       |
| Orbiter     | Twin Halo       | Lvl 5 + MIGHT ≥ 1        |
| Boomerang   | Twin Arc        | Lvl 5 + GROWTH ≥ 1       |
| Nova        | Glacial Cascade | Lvl 5 + MAGNET ≥ 1       |

Evolved weapons get small built-in stat tweaks (extra crit chance on
Blade Fan / Thunder Call, +damage on Twin Halo, -cooldown on Twin Arc).
Aim for an evolution by 7:00 to trip the **Early Evolve** achievement.

---

## Passives

Six slots, max 5 stacks each. The new iter-14 passives —

- **Evasion** (`dodge`): +5% dodge chance per stack, capped at 60%.
- **Pickup Magnet+** (`magnet_plus`): +35% pickup range per stack
  (multiplies against the basic MAGNET passive).
- **Bulwark** (`damage_reduction`): -8% incoming damage per stack,
  capped at 60%, applied after armor.

mix nicely with the classic GROWTH / WISDOM / LUCK / ARMOR / MIGHT /
MAGNET stack. A `LUCK 5 + WISDOM 3` build is the most common path to
an early evolution.

---

## Achievements

Full list in `src/data.js#ACHIEVEMENTS`. The "early evolve" and
"no-hit boss" are the two most rewarding to chase — they unlock a
visible badge on every leaderboard row going forward.

---

## Difficulty Strategy

| Difficulty | HP × | DMG × | Spawn × | Suggested when                                  |
| ---------- | ---- | ----- | ------- | ----------------------------------------------- |
| Easy       | 0.75 | 0.75  | 0.8     | Learning a new stage / build                    |
| Normal     | 1.0  | 1.0   | 1.0     | Default; balanced for the achievement catalogue |
| Hard       | 1.3  | 1.25  | 1.25    | After your first 12-minute clear                |
| Nightmare  | 1.75 | 1.5   | 1.6     | "I want to die before the first boss"           |

Tips:

- **First three minutes** decide the run. Pick MIGHT or LUCK on level 1
  if you don't have a clear plan yet.
- **Don't max two weapons before 5:00** — early evolution beats raw
  damage by ~20%. Save your weapon slots.
- **Magnet first on Tundra** — the cold tick punishes orb-chasing more
  than on the other stages.
- **Pause to re-orient** — Esc/P pauses the simulation entirely. There
  is no time bonus for "real-time only" play outside Speedrun mode.

---

## Daily Challenges & Streaks

The Daily Challenge button starts a per-UTC-day deterministic run with a
fixed stage and boss schedule. Cleared days build your streak — see
**View Streak** for the 14-day calendar. Daily runs go to a separate
leaderboard slot and don't pollute your normal/speedrun lists.

---

## Settings worth toggling

- **Reduced motion** — disables screen shake + critical-hit flash + most
  particles. Use if you're motion-sensitive.
- **Critical-hit screen flash** (iter-15) — the brief red flash on a crit.
  Off by default if Reduced Motion is on; otherwise opt-out here.
- **Touch button size** — 0.8× / 1.0× / 1.2× for the joystick + special.
- **Damage numbers** — turn off for a cleaner late-game with hundreds
  of enemies on screen.

---

## Troubleshooting

- **Inputs frozen mid-run?** You're probably watching a replay. P/Esc
  → Quit to Menu.
- **Save corrupted?** Settings → "Reset all saved data" wipes the slot
  and reloads.
- **No replays appearing?** The slot is single-run; finishing any new
  run overwrites it. Speedrun and Daily runs both record fine.
- **Frame drops on mobile** — bump Touch button size to 1.2× and turn
  Damage numbers off. Reducing the spawn cap is not exposed yet.

---

## Where to learn more

- [`CONTROLS.md`](./CONTROLS.md) — exhaustive bindings reference.
- [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) — screen reader / colour
  vision support details.
- [`FAQ.md`](./FAQ.md) — short answers to common questions.
- [`../BALANCE.md`](../BALANCE.md) — the numbers behind the design.
- [`../CHANGELOG.md`](../CHANGELOG.md) — version history; iter-15 notes
  cover the tutorial + replay rollout in detail.

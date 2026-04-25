# Controls

Reference for every input scheme Survivor supports. Pulled from `src/input.js`
and the DOM bindings in `src/main.js`.

## Keyboard / mouse

| Action          | Keys                       |
| --------------- | -------------------------- |
| Move            | `W` `A` `S` `D` or arrows  |
| Pause / resume  | `Esc` or `P`               |
| Mute            | `M`                        |
| Confirm in menu | `Enter`                    |
| Cancel / back   | `Esc`                      |
| Settings panel  | `,` (comma) on title       |
| Restart run     | `R` on the game-over panel |

Weapons fire automatically — there is no manual fire button on keyboard.

## Touch (mobile, tablet)

| Action            | Gesture                                  |
| ----------------- | ---------------------------------------- |
| Move              | Drag the virtual joystick (bottom-left)  |
| Special skill     | Tap the ✦ button (bottom-right)          |
| Pause             | Double-tap the left or right screen edge |
| Menu interactions | Tap buttons; swipe on long lists         |

The joystick has a 15% inner deadzone with a squared response curve on the
outer band. The button sizes scale with the **Touch button size** setting in
the options panel (0.8× / 1.0× / 1.2×).

## Gamepad (iter-14)

Survivor reads the standard Web Gamepad mapping (Xbox One / Series, DS4, DS5,
8BitDo Pro 2 in X-input mode). Edges are sampled once per frame; the first
connected pad wins.

| Action               | Button / stick      |
| -------------------- | ------------------- |
| Move                 | Left analog stick   |
| Aim (manual weapons) | Right analog stick  |
| Confirm in menu      | `A`                 |
| Cancel / back        | `B`                 |
| Pause / resume       | `Start`             |
| Cycle menu option ▶  | `RB` (right bumper) |
| Cycle menu option ◀  | `LB` (left bumper)  |

Both analog sticks use an 18% deadzone and renormalise the live band so a
fully-pressed diagonal still maps to magnitude 1. Edge-triggered: each press
fires its callback exactly once per press; holding does not auto-repeat.

To verify a controller is connected, open the browser dev tools and run
`navigator.getGamepads()`; the first non-null entry is the active pad.

# Live Deploy QA Report (iter-13)

Generated: 2026-04-25T08:09:56.320Z
URL: <https://ricardo-foundry.github.io/canvas-vampire-survivors/>

## HTTP / load

- Status: **200**
- Title: `Survivor — Open Source Roguelite`
- main.js loaded: ✅
- Game booted: ✅
- Canvas distinct colours (gameplay, 9-point 3x3 sweep, 32×32 each): union=123, richest patch=120

## Live state after ~10s of play

```json
{
    "state": "playing",
    "gameTime": 10.837899999997031,
    "kills": 0,
    "playerHp": 100,
    "playerLevel": 1,
    "enemies": 9,
    "projectiles": 0,
    "stageId": null
}
```

## Console errors (0)

_None_ ✅

## Console warnings (3)

1. `[demoted-to-warn] A bad HTTP response code (404) was received when fetching the script.`
2. `[sw] registration failed TypeError: Failed to register a ServiceWorker for scope ('https://ricardo-foundry.github.io/canvas-vampire-survivors/') with script ('https://ricardo-foundry.github.io/canvas-vampire-survivors/service-worker.js'): A bad HTTP response code (404) was received when fetching the script.`
3. `Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently`

## Page errors (0)

_None_ ✅

## Failed requests / 4xx-5xx (0)

_None_ ✅

## Findings (0)

_No issues detected._ ✅

## Screenshots

- `docs/screenshots/live-mainmenu.png`
- `docs/screenshots/live-gameplay.png`

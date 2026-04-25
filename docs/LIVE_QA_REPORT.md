# Live Deploy QA Report (iter-12)

Generated: 2026-04-25T06:46:20.270Z
URL: <https://ricardo-foundry.github.io/canvas-vampire-survivors/>

## HTTP / load
- Status: **200**
- Title: `Survivor — Open Source Roguelite`
- main.js loaded: ✅
- Game booted: ✅
- Canvas distinct colours (gameplay 64×64 centre): 3

## Live state after ~10s of play
```json
{
  "state": "playing",
  "gameTime": 10.834200000001491,
  "kills": 0,
  "playerHp": 100,
  "playerLevel": 1,
  "enemies": 7,
  "projectiles": 0,
  "stageId": null
}
```

## Console errors (0)
_None_ ✅

## Console warnings (2)
1. `[demoted-to-warn] A bad HTTP response code (404) was received when fetching the script.`
2. `[sw] registration failed TypeError: Failed to register a ServiceWorker for scope ('https://ricardo-foundry.github.io/canvas-vampire-survivors/') with script ('https://ricardo-foundry.github.io/canvas-vampire-survivors/service-worker.js'): A bad HTTP response code (404) was received when fetching the script.`

## Page errors (0)
_None_ ✅

## Failed requests / 4xx-5xx (0)
_None_ ✅

## Findings (0)
_No issues detected._ ✅

## Screenshots
- `docs/screenshots/live-mainmenu.png`
- `docs/screenshots/live-gameplay.png`

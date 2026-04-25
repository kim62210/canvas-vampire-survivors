# Runtime QA Report (Round 10)

Generated: 2026-04-25T06:01:07.566Z
Page: http://localhost:51275/

## Live game state after ~10 s of play

```json
{
    "state": "playing",
    "gameTime": 10.034900000000768,
    "kills": 0,
    "playerHp": 100,
    "playerLevel": 1,
    "playerXY": {
        "x": 1800,
        "y": 1400
    },
    "cameraXY": {
        "worldX": 1200,
        "worldY": 800
    },
    "enemies": 7,
    "projectiles": 0,
    "particles": 0,
    "fps": 60.00600060006,
    "weaponLevels": ["whip@1"]
}
```

## Console errors (0)

_None_ ✅

## Console warnings (0)

_None_ ✅

## Page errors / uncaught exceptions (0)

_None_ ✅

## Failed requests / 4xx-5xx responses (0)

_None_ ✅

## Accessibility (axe-core, main menu) — 0 violations

_None_ ✅

## Screenshots

- `docs/screenshots/real-mainmenu.png`
- `docs/screenshots/real-gameplay.png`
- `docs/screenshots/real-boss-fight.png`
- `docs/screenshots/real-levelup.png`
- `docs/screenshots/real-gameover.png`

## iter-10 notes

- Camera follow active: player kept centred in viewport, clamped to 2400×1600 arena.
- Test-only `window.__SURV_DEBUG__` hooks (advance / grantLevel / killPlayer / spawnBoss) are gated to localhost.

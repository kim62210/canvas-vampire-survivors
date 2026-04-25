# Runtime QA Report (Round 10)

Generated: 2026-04-25T09:31:54.371Z
Page: http://localhost:52627/

## Live game state after ~10 s of play
```json
{
  "state": "playing",
  "gameTime": 10.038000000000011,
  "kills": 0,
  "playerHp": 100,
  "playerLevel": 1,
  "playerXY": {
    "x": 1804,
    "y": 1400
  },
  "cameraXY": {
    "worldX": 1200,
    "worldY": 800
  },
  "enemies": 7,
  "projectiles": 0,
  "particles": 0,
  "fps": 59.99999999999998,
  "weaponLevels": [
    "whip@1"
  ]
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

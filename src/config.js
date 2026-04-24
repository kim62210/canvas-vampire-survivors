// Game configuration and static data.
// All numbers here are intentionally exposed as plain constants so contributors
// can tweak balance without hunting through logic.

export const CONFIG = {
    CANVAS_WIDTH: 1200,
    CANVAS_HEIGHT: 800,
    PLAYER_SPEED: 240, // px / second (was 4 px/frame => 240 @ 60fps)
    PLAYER_SIZE: 20,
    MAX_ENEMIES: 300,
    SPAWN_RADIUS: 900,
    DESPAWN_RADIUS: 1200,
    EXP_ORB_LIFETIME: 30, // seconds
    INVINCIBILITY_TIME: 0.5, // seconds
    PICKUP_DISTANCE: 24,
    MAGNET_BASE: 120,
    MAX_WEAPONS: 6,
    MAX_PASSIVES: 6,
    WEAPON_MAX_LEVEL: 5,
    WEAPON_EVOLVE_LEVEL: 5,
    PASSIVE_MAX_STACK: 5,
    TARGET_FPS: 60,
    GRID_SIZE: 50, // spatial-hash cell size for collision
    WAVE_DURATION: 30, // seconds per wave announcement
    HIGHSCORE_SLOTS: 10,
    VERSION: '2.1.0'
};

export const GameState = Object.freeze({
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_UP: 'levelup',
    GAMEOVER: 'gameover',
    SETTINGS: 'settings'
});

export const Difficulty = Object.freeze({
    EASY: { id: 'easy', label: 'Easy', hpMult: 0.75, dmgMult: 0.75, spawnMult: 0.8 },
    NORMAL: { id: 'normal', label: 'Normal', hpMult: 1.0, dmgMult: 1.0, spawnMult: 1.0 },
    HARD: { id: 'hard', label: 'Hard', hpMult: 1.3, dmgMult: 1.25, spawnMult: 1.25 },
    NIGHTMARE: { id: 'nightmare', label: 'Nightmare', hpMult: 1.75, dmgMult: 1.5, spawnMult: 1.6 }
});

export const STORAGE_KEY = 'vs_clone_save_v2';

/**
 * @module storage
 * @description Persistent save layer backed by `localStorage` with an
 * in-memory fallback for sandboxed contexts (private browsing, embedded
 * iframes). Also owns the leaderboard helper and the cumulative `totals`
 * accumulator. Forwards-compatible: `mergeDeep` lets us add new save fields
 * without invalidating older slots.
 *
 * Dependencies: `./config.js` (CONFIG, STORAGE_KEY).
 *
 * Exports:
 *   - loadSave(), saveSave(), resetSave()
 *   - recordHighScore(save, entry) → rank
 *   - accumulateTotals(save, run)
 */

import { CONFIG, STORAGE_KEY } from './config.js';

const DEFAULT_SAVE = {
    // Legacy single-slot best-of. Kept for backwards compatibility with v2.0 saves.
    highScore: {
        kills: 0,
        timeSurvived: 0,
        level: 1
    },
    // v2.1: top-N leaderboard and cumulative stats.
    highScores: [], // { kills, timeSurvived, level, date (epoch ms) }
    totals: {
        kills: 0,
        timePlayed: 0,
        runs: 0,
        bossKills: 0
    },
    achievements: {},
    settings: {
        masterVolume: 0.6,
        sfxVolume: 0.8,
        musicVolume: 0.4,
        difficulty: 'normal',
        showFps: false,
        screenShake: true,
        reducedMotion: false,
        colorblind: false,
        musicEnabled: true,
        locale: 'en'
    },
    runs: 0
};

let memoryFallback = null;

function hasLocalStorage() {
    try {
        const probe = '__vs_probe__';
        window.localStorage.setItem(probe, probe);
        window.localStorage.removeItem(probe);
        return true;
    } catch {
        return false;
    }
}

const usable = hasLocalStorage();

export function loadSave() {
    try {
        const raw = usable ? window.localStorage.getItem(STORAGE_KEY) : memoryFallback;
        if (!raw) return structuredCloneCompat(DEFAULT_SAVE);
        const parsed = JSON.parse(raw);
        return mergeDeep(structuredCloneCompat(DEFAULT_SAVE), parsed);
    } catch (err) {
        console.warn('[storage] Failed to load save, resetting.', err);
        return structuredCloneCompat(DEFAULT_SAVE);
    }
}

export function saveSave(data) {
    try {
        const serialised = JSON.stringify(data);
        if (usable) {
            window.localStorage.setItem(STORAGE_KEY, serialised);
        } else {
            memoryFallback = serialised;
        }
    } catch (err) {
        console.warn('[storage] Failed to write save.', err);
    }
}

export function resetSave() {
    if (usable) {
        window.localStorage.removeItem(STORAGE_KEY);
    } else {
        memoryFallback = null;
    }
}

// ---------------------------------------------------------------------------
// Leaderboard helpers
// ---------------------------------------------------------------------------
/**
 * Insert a run result into the top-N leaderboard (sorted by timeSurvived
 * descending, then by kills). Returns the 1-based rank of the new entry, or 0
 * if it did not qualify.
 */
export function recordHighScore(save, entry) {
    const list = Array.isArray(save.highScores) ? save.highScores : [];
    const withNew = list.concat([entry]);
    withNew.sort((a, b) => {
        if (b.timeSurvived !== a.timeSurvived) return b.timeSurvived - a.timeSurvived;
        return (b.kills || 0) - (a.kills || 0);
    });
    const top = withNew.slice(0, CONFIG.HIGHSCORE_SLOTS);
    save.highScores = top;
    const rank = top.indexOf(entry) + 1;
    // Also update legacy best-of for backwards compat.
    if (entry.timeSurvived > (save.highScore?.timeSurvived || 0)) {
        save.highScore.timeSurvived = entry.timeSurvived;
    }
    if (entry.kills > (save.highScore?.kills || 0)) save.highScore.kills = entry.kills;
    if (entry.level > (save.highScore?.level || 0)) save.highScore.level = entry.level;
    return rank;
}

export function accumulateTotals(save, run) {
    save.totals ??= { kills: 0, timePlayed: 0, runs: 0, bossKills: 0 };
    save.totals.kills += run.kills || 0;
    save.totals.timePlayed += run.gameTime || 0;
    save.totals.runs += 1;
    save.totals.bossKills += run.bossKills || 0;
}

function structuredCloneCompat(obj) {
    if (typeof structuredClone === 'function') return structuredClone(obj);
    return JSON.parse(JSON.stringify(obj));
}

function mergeDeep(target, source) {
    for (const key of Object.keys(source)) {
        if (Array.isArray(source[key])) {
            target[key] = source[key];
        } else if (source[key] && typeof source[key] === 'object') {
            target[key] = mergeDeep(target[key] ?? {}, source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

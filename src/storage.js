// Persistent storage via localStorage. Safe to call on platforms where
// storage may be blocked (private browsing, sandboxed iframes): we degrade
// gracefully to an in-memory store.

import { STORAGE_KEY } from './config.js';

const DEFAULT_SAVE = {
    highScore: {
        kills: 0,
        timeSurvived: 0,
        level: 1
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

function structuredCloneCompat(obj) {
    if (typeof structuredClone === 'function') return structuredClone(obj);
    return JSON.parse(JSON.stringify(obj));
}

function mergeDeep(target, source) {
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            target[key] = mergeDeep(target[key] ?? {}, source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

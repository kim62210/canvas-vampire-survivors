/**
 * @module stages
 * @description Stage / map registry. A stage is a *modifier set* on top of the
 * base wave director: it overrides the enemy pools, the boss timing, the
 * background palette and the music style without changing the underlying
 * spawn engine. The default stage `forest` is a no-op that mirrors the
 * v2.5 balance; `crypt` is the second map introduced in iter-12 — darker,
 * ranged-heavy, and the Reaper shows up at 4:00 instead of 5:00.
 *
 * Dependencies: `./data.js` (WAVES, BOSSES) for the defaults the modifiers
 * sit on top of. We deliberately don't touch the originals — `getWavesFor`
 * returns a frozen copy. This makes stages cheap to swap mid-session and
 * keeps the catalogue diff-friendly.
 *
 * Exports:
 *   - {Record<string, StageDef>} STAGES
 *   - getStage(id)               → StageDef (defaults to forest if unknown)
 *   - getWavesFor(id)            → WaveDef[]   (cloned + remapped)
 *   - getBossesFor(id)           → BossDef[]   (cloned + spawnAt remapped)
 *   - getBackgroundFor(id)       → { fill, gridAlpha }
 *   - listStages()               → StageDef[]  (stable order)
 */

import { BOSSES, WAVES } from './data.js';

/**
 * @typedef {Object} StageDef
 * @property {string} id             unique key, used in storage / URL
 * @property {string} name           display name
 * @property {string} icon           emoji shown on the picker
 * @property {string} description    one-line tagline shown on the picker
 * @property {Object} background     palette overrides for the renderer
 * @property {string} background.fill        CSS hex for the canvas backdrop
 * @property {number} background.gridAlpha   0..1 opacity of the grid
 * @property {string} musicStyle     'menu' | 'combat' | 'crypt' | 'forest' — hint for AudioEngine
 * @property {Object} [poolOverrides] map of enemyId -> weight bias (0..2)
 *                                    Applied per-spawn to bias the random pick.
 *                                    Missing ids default to 1.
 * @property {string[]} [extraEnemies] enemy ids appended to every wave's pool
 * @property {Record<string, number>} [bossOffsets] bossId -> seconds to add
 *                                                  (negative = earlier)
 */

/** @type {Record<string, StageDef>} */
export const STAGES = Object.freeze({
    FOREST: Object.freeze({
        id: 'forest',
        name: 'Whisperwood',
        icon: '🌲',
        description: 'The default forest. Balanced enemy mix, bosses on schedule.',
        background: { fill: '#1a1a2e', gridAlpha: 0.04 },
        musicStyle: 'forest',
        poolOverrides: {},
        extraEnemies: [],
        bossOffsets: {}
    }),
    CRYPT: Object.freeze({
        id: 'crypt',
        name: 'Sunken Crypt',
        icon: '🪦',
        description: 'Darker. More ranged casters. The Reaper rushes you at 4:00.',
        background: { fill: '#0c0816', gridAlpha: 0.025 },
        musicStyle: 'crypt',
        // Bias spawns: more mages and illusionists, fewer melee chasers.
        poolOverrides: {
            mage: 1.8,
            illusionist: 1.6,
            ghost: 1.4,
            skeleton: 1.2,
            bat: 0.6,
            zombie: 0.5,
            wolf: 0.7
        },
        // Add mage to every wave so the ranged-heavy promise holds in the
        // first 90 seconds where vanilla pools have no caster.
        extraEnemies: ['mage'],
        bossOffsets: {
            // Reaper arrives 60s earlier (5:00 -> 4:00).
            reaper: -60,
            // Necromancer also pulled in slightly so the 4:00→7:30 gap is healthier.
            necromancer: -30
        }
    })
});

const DEFAULT_STAGE_ID = 'forest';

/** @returns {StageDef} */
export function getStage(id) {
    if (!id) return STAGES.FOREST;
    for (const s of Object.values(STAGES)) {
        if (s.id === id) return s;
    }
    return STAGES.FOREST;
}

/** Stable ordering for the stage picker UI. */
export function listStages() {
    return [STAGES.FOREST, STAGES.CRYPT];
}

/**
 * Return a copy of the WAVES array with the stage's `extraEnemies` appended
 * to each wave's pool. We keep the original `from`/`to`/`spawnMult`/`label`
 * intact — only the `pool` array is mutated, and only on the copy.
 * @returns {Array}
 */
export function getWavesFor(id) {
    const stage = getStage(id);
    const extra = stage.extraEnemies || [];
    return WAVES.map((w) => {
        const pool = extra.length ? Array.from(new Set(w.pool.concat(extra))) : w.pool.slice();
        return { ...w, pool };
    });
}

/**
 * Return a copy of BOSSES with `spawnAt` shifted by the stage's per-boss
 * offset. The offset is clamped to a minimum of 30s so a stage cannot try
 * to spawn the boss before the player has any weapons online.
 * @returns {Array<{id:string, spawnAt:number, def:object}>}
 */
export function getBossesFor(id) {
    const stage = getStage(id);
    const offsets = stage.bossOffsets || {};
    return Object.values(BOSSES).map((b) => {
        const off = offsets[b.id] || 0;
        const spawnAt = Math.max(30, b.spawnAt + off);
        return { ...b, spawnAt };
    });
}

/** Background palette helper; the renderer reads this once per frame. */
export function getBackgroundFor(id) {
    const s = getStage(id);
    return s.background;
}

/**
 * Bias a uniform random pick by the stage's `poolOverrides` weights. Missing
 * ids default to weight 1; weights of 0 effectively remove that enemy from
 * the spawn pool for this stage.
 * @param {string[]} pool
 * @param {string} stageId
 * @param {() => number} rnd  random source [0, 1)
 * @returns {string}
 */
export function pickWeighted(pool, stageId, rnd = Math.random) {
    if (!pool.length) return null;
    const stage = getStage(stageId);
    const weights = stage.poolOverrides || {};
    let total = 0;
    const cum = pool.map((id) => {
        const w = weights[id] ?? 1;
        total += Math.max(0, w);
        return total;
    });
    if (total <= 0) return pool[Math.floor(rnd() * pool.length)];
    const r = rnd() * total;
    for (let i = 0; i < pool.length; i++) {
        if (r < cum[i]) return pool[i];
    }
    return pool[pool.length - 1];
}

export { DEFAULT_STAGE_ID };

/**
 * @module achievements
 * @description Evaluates the achievement catalogue against per-run + lifetime
 * state, persists unlocks into the save object and queues toast notifications
 * for the UI. Cheap to call: most checks short-circuit on the persistent
 * "already unlocked" flag.
 *
 * Dependencies: `./data.js` (ACHIEVEMENTS, UNLOCKS).
 *
 * Exports:
 *   - class AchievementTracker
 */

import { ACHIEVEMENTS, UNLOCKS } from './data.js';

export class AchievementTracker {
    constructor(save) {
        this.save = save;
        this.run = {
            bossesDefeated: {},
            maxedWeapon: false,
            orbsCollected: 0,
            longestUnhit: 0,
            tookAnyDamage: false
        };
        this.queue = [];
    }

    resetRun() {
        this.run = {
            bossesDefeated: {},
            maxedWeapon: false,
            orbsCollected: 0,
            longestUnhit: 0,
            tookAnyDamage: false
        };
    }

    onBossDefeated(bossId) {
        this.run.bossesDefeated[bossId] = true;
    }

    onWeaponMaxed() {
        this.run.maxedWeapon = true;
    }

    check(game) {
        const ctx = { game, run: this.run };
        const newly = [];
        for (const ach of ACHIEVEMENTS) {
            if (this.save.achievements[ach.id]) continue;
            try {
                if (ach.check(ctx)) {
                    this.save.achievements[ach.id] = Date.now();
                    newly.push(ach);
                    this.queue.push(ach);
                }
            } catch (err) {
                console.warn('[achievements] check failed', ach.id, err);
            }
        }
        return newly;
    }

    takeToasts() {
        const q = this.queue;
        this.queue = [];
        return q;
    }

    /** List weapon ids unlocked by earned achievements. */
    unlockedStartingWeapons() {
        const out = new Set();
        for (const id of Object.keys(UNLOCKS)) {
            if (this.save.achievements[id] && UNLOCKS[id].weapon) {
                out.add(UNLOCKS[id].weapon);
            }
        }
        return out;
    }
}

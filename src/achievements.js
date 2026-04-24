// Achievement evaluation + HUD toast queue.
// - `AchievementTracker` holds per-run state (maxedWeapon, bossesDefeated...)
//   plus the persistent `save.achievements` record.
// - Call `tracker.check(game)` after important events. Newly unlocked IDs are
//   pushed onto a toast queue that the UI renders.

import { ACHIEVEMENTS, UNLOCKS } from './data.js';

export class AchievementTracker {
    constructor(save) {
        this.save = save;
        this.run = {
            bossesDefeated: {},
            maxedWeapon: false,
            orbsCollected: 0,
            longestUnhit: 0
        };
        this.queue = [];
    }

    resetRun() {
        this.run = {
            bossesDefeated: {},
            maxedWeapon: false,
            orbsCollected: 0,
            longestUnhit: 0
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

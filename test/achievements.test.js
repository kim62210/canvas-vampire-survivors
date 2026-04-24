// Unit tests for AchievementTracker + the ACHIEVEMENTS catalogue condition
// functions. We bypass the UI entirely and focus on whether checks trigger
// with the right state and how unlocks map to starting weapons.

import test from 'node:test';
import assert from 'node:assert/strict';
import { AchievementTracker } from '../src/achievements.js';
import { ACHIEVEMENTS, UNLOCKS } from '../src/data.js';

function makeSave() {
    return { achievements: {} };
}

function makeGame({ kills = 0, gameTime = 0, level = 1 } = {}) {
    return { kills, gameTime, player: { level } };
}

test('AchievementTracker: starts with an empty run block', () => {
    const t = new AchievementTracker(makeSave());
    assert.deepEqual(t.run.bossesDefeated, {});
    assert.equal(t.run.orbsCollected, 0);
    assert.equal(t.run.longestUnhit, 0);
    assert.equal(t.run.maxedWeapon, false);
});

test('AchievementTracker: resetRun clears per-run state', () => {
    const t = new AchievementTracker(makeSave());
    t.run.maxedWeapon = true;
    t.run.orbsCollected = 42;
    t.run.bossesDefeated.reaper = true;
    t.resetRun();
    assert.equal(t.run.maxedWeapon, false);
    assert.equal(t.run.orbsCollected, 0);
    assert.deepEqual(t.run.bossesDefeated, {});
});

test('AchievementTracker: onBossDefeated records bossId', () => {
    const t = new AchievementTracker(makeSave());
    t.onBossDefeated('reaper');
    assert.equal(t.run.bossesDefeated.reaper, true);
});

test('AchievementTracker: onWeaponMaxed flips the flag', () => {
    const t = new AchievementTracker(makeSave());
    assert.equal(t.run.maxedWeapon, false);
    t.onWeaponMaxed();
    assert.equal(t.run.maxedWeapon, true);
});

test('AchievementTracker: first_blood unlocks on first kill', () => {
    const save = makeSave();
    const t = new AchievementTracker(save);
    const game = makeGame({ kills: 1 });
    const out = t.check(game);
    assert.ok(out.find((a) => a.id === 'first_blood'));
    assert.ok(save.achievements.first_blood);
});

test('AchievementTracker: achievements are not re-unlocked', () => {
    const save = makeSave();
    const t = new AchievementTracker(save);
    t.check(makeGame({ kills: 1 }));
    const once = save.achievements.first_blood;
    const again = t.check(makeGame({ kills: 2 }));
    assert.equal(
        again.find((a) => a.id === 'first_blood'),
        undefined
    );
    assert.equal(save.achievements.first_blood, once);
});

test('AchievementTracker: toast queue drains via takeToasts', () => {
    const t = new AchievementTracker(makeSave());
    t.check(makeGame({ kills: 1 }));
    assert.equal(t.queue.length, 1);
    const drained = t.takeToasts();
    assert.equal(drained.length, 1);
    assert.equal(t.queue.length, 0);
});

test('AchievementTracker: boss_slayer requires the reaper flag', () => {
    const save = makeSave();
    const t = new AchievementTracker(save);
    t.check(makeGame({ kills: 1 }));
    assert.ok(!save.achievements.boss_slayer);
    t.onBossDefeated('reaper');
    t.check(makeGame({ kills: 1 }));
    assert.ok(save.achievements.boss_slayer);
});

test('AchievementTracker: survive_5min unlocks at 300s', () => {
    const save = makeSave();
    const t = new AchievementTracker(save);
    t.check(makeGame({ gameTime: 299 }));
    assert.ok(!save.achievements.survive_5min);
    t.check(makeGame({ gameTime: 300 }));
    assert.ok(save.achievements.survive_5min);
});

test('AchievementTracker: level_20 requires player level 20', () => {
    const save = makeSave();
    const t = new AchievementTracker(save);
    t.check(makeGame({ level: 19 }));
    assert.ok(!save.achievements.level_20);
    t.check(makeGame({ level: 20 }));
    assert.ok(save.achievements.level_20);
});

test('AchievementTracker: xp_hoarder + untouchable use run state', () => {
    const save = makeSave();
    const t = new AchievementTracker(save);
    t.run.orbsCollected = 99;
    t.check(makeGame());
    assert.ok(!save.achievements.xp_hoarder);
    t.run.orbsCollected = 100;
    t.check(makeGame());
    assert.ok(save.achievements.xp_hoarder);
    t.run.longestUnhit = 60;
    t.check(makeGame());
    assert.ok(save.achievements.untouchable);
});

test('AchievementTracker: throwing check functions do not break iteration', () => {
    const save = makeSave();
    const t = new AchievementTracker(save);
    const bad = {
        id: 'bad',
        check: () => {
            throw new Error('boom');
        }
    };
    // Temporarily splice into the catalogue. We mutate the array because
    // the module exports the live reference.
    ACHIEVEMENTS.push(bad);
    try {
        assert.doesNotThrow(() => t.check(makeGame({ kills: 1 })));
        assert.ok(save.achievements.first_blood);
    } finally {
        const idx = ACHIEVEMENTS.indexOf(bad);
        if (idx >= 0) ACHIEVEMENTS.splice(idx, 1);
    }
});

test('AchievementTracker: unlockedStartingWeapons reflects earned list', () => {
    const save = makeSave();
    const t = new AchievementTracker(save);
    assert.equal(t.unlockedStartingWeapons().size, 0);
    // Fake a completed achievement that has an unlock mapping.
    save.achievements.first_blood = Date.now();
    const unlocked = t.unlockedStartingWeapons();
    assert.ok(unlocked.has('magic_wand'));
});

test('AchievementTracker: every UNLOCKS key maps to a real achievement id', () => {
    // Regression: if we add a new unlock, make sure its achievement exists.
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const key of Object.keys(UNLOCKS)) {
        assert.ok(ids.has(key), `UNLOCKS.${key} has no matching achievement`);
    }
});

test('AchievementTracker: catalogue has 10+ entries and unique ids', () => {
    assert.ok(ACHIEVEMENTS.length >= 10);
    const ids = ACHIEVEMENTS.map((a) => a.id);
    const unique = new Set(ids);
    assert.equal(unique.size, ids.length);
});

// Unit tests for src/storage.js. Runs in Node without a DOM; the module
// falls back to an in-memory store when `window` is missing.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    loadSave,
    saveSave,
    resetSave,
    recordHighScore,
    accumulateTotals,
    mergeDeep,
    _resetStorageForTests
} from '../src/storage.js';
import { CONFIG } from '../src/config.js';

test.beforeEach(() => {
    _resetStorageForTests();
    resetSave();
});

test('loadSave: returns default shape when nothing persisted', () => {
    const s = loadSave();
    assert.equal(s.highScore.kills, 0);
    assert.ok(Array.isArray(s.highScores));
    assert.equal(s.highScores.length, 0);
    assert.equal(s.settings.locale, 'en');
    assert.ok(s.totals);
});

test('saveSave + loadSave: round-trips arbitrary state', () => {
    const before = loadSave();
    before.kills = 1234;
    before.settings.difficulty = 'nightmare';
    saveSave(before);
    const after = loadSave();
    assert.equal(after.kills, 1234);
    assert.equal(after.settings.difficulty, 'nightmare');
});

test('resetSave: wipes persisted data', () => {
    const s = loadSave();
    s.settings.difficulty = 'hard';
    saveSave(s);
    resetSave();
    const fresh = loadSave();
    assert.equal(fresh.settings.difficulty, 'normal');
});

test('mergeDeep: overrides scalars', () => {
    const a = { a: 1, b: 2 };
    const out = mergeDeep(a, { a: 9 });
    assert.equal(out.a, 9);
    assert.equal(out.b, 2);
});

test('mergeDeep: recurses into nested objects', () => {
    const a = { settings: { vol: 0.5, lang: 'en' } };
    const out = mergeDeep(a, { settings: { vol: 0.8 } });
    assert.equal(out.settings.vol, 0.8);
    assert.equal(out.settings.lang, 'en');
});

test('mergeDeep: replaces arrays wholesale', () => {
    const a = { highScores: [{ k: 1 }, { k: 2 }] };
    const out = mergeDeep(a, { highScores: [{ k: 9 }] });
    assert.equal(out.highScores.length, 1);
    assert.equal(out.highScores[0].k, 9);
});

test('mergeDeep: allows adding new keys (forwards-compatible)', () => {
    const a = { existing: 1 };
    const out = mergeDeep(a, { brandNew: 2 });
    assert.equal(out.existing, 1);
    assert.equal(out.brandNew, 2);
});

test('loadSave: deep-merges unknown keys from disk into defaults', () => {
    const draft = loadSave();
    draft.customKey = 'extra';
    draft.settings.customSetting = true;
    saveSave(draft);
    const reloaded = loadSave();
    assert.equal(reloaded.customKey, 'extra');
    assert.equal(reloaded.settings.customSetting, true);
    // And the defaults still show up for keys the file lacked:
    assert.equal(reloaded.settings.locale, 'en');
});

test('recordHighScore: sorts by timeSurvived desc, then kills', () => {
    const save = { highScores: [], highScore: { kills: 0, timeSurvived: 0, level: 0 } };
    recordHighScore(save, { kills: 100, timeSurvived: 60, level: 3, date: 1 });
    recordHighScore(save, { kills: 50, timeSurvived: 120, level: 4, date: 2 });
    recordHighScore(save, { kills: 200, timeSurvived: 120, level: 5, date: 3 });
    // Order: time 120+kills200, time 120+kills50, time 60.
    assert.equal(save.highScores[0].kills, 200);
    assert.equal(save.highScores[1].kills, 50);
    assert.equal(save.highScores[2].kills, 100);
});

test('recordHighScore: caps list at CONFIG.HIGHSCORE_SLOTS', () => {
    const save = { highScores: [], highScore: { kills: 0, timeSurvived: 0, level: 0 } };
    for (let i = 0; i < CONFIG.HIGHSCORE_SLOTS + 5; i++) {
        recordHighScore(save, { kills: i, timeSurvived: i * 10, level: 1, date: i });
    }
    assert.equal(save.highScores.length, CONFIG.HIGHSCORE_SLOTS);
    // The weakest entries fell off, so the worst remaining is slot-count away.
    const worst = save.highScores[save.highScores.length - 1];
    assert.ok(worst.timeSurvived >= 5 * 10);
});

test('recordHighScore: updates the legacy best-of fields', () => {
    const save = { highScores: [], highScore: { kills: 10, timeSurvived: 10, level: 1 } };
    recordHighScore(save, { kills: 999, timeSurvived: 999, level: 99, date: 1 });
    assert.equal(save.highScore.kills, 999);
    assert.equal(save.highScore.timeSurvived, 999);
    assert.equal(save.highScore.level, 99);
});

test('recordHighScore: does not regress the legacy best-of on a worse run', () => {
    const save = { highScores: [], highScore: { kills: 500, timeSurvived: 500, level: 50 } };
    recordHighScore(save, { kills: 10, timeSurvived: 10, level: 1, date: 1 });
    assert.equal(save.highScore.kills, 500);
    assert.equal(save.highScore.timeSurvived, 500);
    assert.equal(save.highScore.level, 50);
});

test('accumulateTotals: initializes totals block if missing', () => {
    const save = {};
    accumulateTotals(save, { kills: 10, gameTime: 5, bossKills: 1 });
    assert.equal(save.totals.kills, 10);
    assert.equal(save.totals.timePlayed, 5);
    assert.equal(save.totals.runs, 1);
    assert.equal(save.totals.bossKills, 1);
});

test('accumulateTotals: increments across runs', () => {
    const save = {};
    accumulateTotals(save, { kills: 5, gameTime: 30, bossKills: 0 });
    accumulateTotals(save, { kills: 7, gameTime: 50, bossKills: 1 });
    assert.equal(save.totals.kills, 12);
    assert.equal(save.totals.timePlayed, 80);
    assert.equal(save.totals.runs, 2);
    assert.equal(save.totals.bossKills, 1);
});

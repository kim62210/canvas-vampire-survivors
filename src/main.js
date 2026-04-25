/**
 * @module main
 * @description Top-level orchestrator. Owns the `Game` instance, the
 * fixed-step update loop, the spawn/wave director, the achievement check
 * heartbeat and the menu/state machine. This is the only module that
 * reaches into nearly every other one — keep new logic out of here when a
 * focused module fits.
 *
 * Dependencies: every other module under `src/`.
 *
 * Exports:
 *   - class Game
 *   - boot()              constructor + window-handle install
 *   - re-exports ACHIEVEMENTS, WAVES from data.js
 */

import { CONFIG, Difficulty, GameState } from './config.js';
import { ACHIEVEMENTS, BOSSES, ENEMIES, WAVES, WEAPONS } from './data.js';
import {
    Enemy,
    ExpOrb,
    FloatingText,
    Particle,
    Player,
    findEnemyDef,
    registerWeaponClass
} from './entities.js';
import { Weapon } from './weapons.js';
import { AudioEngine } from './audio.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';
import { FpsMeter, ShakeCamera } from './systems.js';
import { SpatialHash } from './spatial-hash.js';
import { Pool, resetFloatingText, resetParticle } from './pool.js';
import { EffectLayer } from './effects.js';
import { AchievementTracker } from './achievements.js';
import {
    SeededRng,
    accumulateTotals,
    loadSave,
    loadSpeedrunScores,
    recordHighScore,
    recordSpeedrunScore,
    resetSave,
    saveSave
} from './storage.js';
import { setLocale } from './i18n.js';
import {
    DEFAULT_STAGE_ID,
    getBackgroundFor,
    getBossesFor,
    getWavesFor,
    pickWeighted
} from './stages.js';
import { dailyChallenge, saveDailyResult } from './daily.js';

registerWeaponClass(Weapon);

// ---------------------------------------------------------------------------
// Offscreen sprite cache. Pre-rasterising the tiny enemy sprites once and
// blitting the bitmap each frame is measurably faster than redoing the
// gradient/fill path every draw call. Cache key = `${id}-${size}`.
// ---------------------------------------------------------------------------
const SPRITE_CACHE = new Map();

function spriteKey(id, size) {
    return `${id}@${size}`;
}

function getEnemySprite(def, size) {
    const key = spriteKey(def.id, size);
    const cached = SPRITE_CACHE.get(key);
    if (cached) return cached;
    if (typeof document === 'undefined') return null; // SSR / test guard
    const pad = 4;
    const d = size * 2 + pad * 2;
    const off = document.createElement('canvas');
    off.width = d;
    off.height = d;
    const ox = d / 2;
    const oy = d / 2;
    const c = off.getContext('2d');
    c.fillStyle = def.color || '#ff4444';
    c.beginPath();
    c.arc(ox, oy, size, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.beginPath();
    c.arc(ox, oy, size * 0.5, 0, Math.PI * 2);
    c.fill();
    SPRITE_CACHE.set(key, off);
    return off;
}

export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = GameState.MENU;
        this.lastTime = 0;
        this.gameTime = 0;
        this.kills = 0;
        this.raf = 0;

        // Collections
        this.enemies = [];
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.expOrbs = [];
        this.particles = [];
        this.floatingTexts = [];
        this.mines = [];

        this.player = null;

        // Systems
        this.spatial = new SpatialHash(CONFIG.SPATIAL_CELL_SIZE);
        this.camera = new ShakeCamera();
        this.fpsMeter = new FpsMeter();
        this.effects = new EffectLayer();

        // Object pools for the churny entities. `prealloc` avoids the
        // first-level burst triggering an allocation cascade.
        this.pools = {
            floatingText: new Pool(() => new FloatingText('', 0, 0, '#fff'), resetFloatingText, {
                maxSize: 256,
                prealloc: 32
            }),
            particle: new Pool(() => new Particle(0, 0, '#fff'), resetParticle, {
                maxSize: 512,
                prealloc: 64
            })
        };

        // Tab-visibility aware pause so resuming doesn't produce a huge dt.
        this._hiddenPaused = false;
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => this._onVisibilityChange());
        }

        // Save + settings
        this.save = loadSave();
        setLocale(this.save.settings.locale || 'en');
        if (this.save.settings.colorblind) document.body.classList.add('cb-mode');

        // Audio + input + UI
        this.audio = new AudioEngine(this.save.settings);
        this.input = new InputManager();
        this.ui = new UI(this);

        // Achievements tracker persists the lifetime record.
        this.achievements = new AchievementTracker(this.save);

        this._bossesSpawned = new Set();
        this._spawnAccumulator = 0;
        this._bossWarnedAt = new Set();
        this._lastAnnouncedWave = null;

        // Active stage descriptor + per-stage waves/bosses snapshot. Keyed off
        // the persisted setting so a returning player resumes on whatever map
        // they last picked. Re-derived in start() so a stage swap mid-session
        // takes effect on the next run.
        this.stageId = this.save?.settings?.stage || DEFAULT_STAGE_ID;
        this.stageWaves = getWavesFor(this.stageId);
        this.stageBosses = getBossesFor(this.stageId);
        this.currentWave = this.stageWaves[0] || WAVES[0];

        // Speedrun bookkeeping. When `speedrunMode` is truthy, spawn picks
        // are deterministic, real-time splits are tracked and the result
        // lands in the speedrun leaderboard instead of the normal one.
        this.speedrunMode = false;
        this.speedrunRng = null;
        this.speedrunStart = 0;
        this.speedrunSplits = [];
        this._nextSplitIdx = 0;

        // Daily-challenge bookkeeping. When `dailyMode` is true the seed +
        // stage + boss schedule are pinned by `daily.dailyChallenge(...)`.
        this.dailyMode = false;
        this.dailyChallenge = null;

        // Per-run bookkeeping used by achievements.
        this.run = this.achievements.run;

        this._bindInput();
        this._bindDomButtons();
        this._bindLeaderboardImport();

        window.addEventListener('resize', () => this._resize());
        this._resize();
    }

    /**
     * Listen for the `vs-leaderboard-import` CustomEvent that `UI.showLeaderboard`
     * dispatches when the user pastes JSON and clicks Import. We merge the
     * incoming runs into both the normal and speedrun stores, dedupe by
     * `date+timeSurvived` (or `date+timeMs` for speedrun), then re-rank and
     * persist. The UI is then refreshed if it's still on screen.
     */
    _bindLeaderboardImport() {
        if (typeof window === 'undefined') return;
        window.addEventListener('vs-leaderboard-import', (ev) => {
            const payload = ev.detail || {};
            try {
                if (Array.isArray(payload.normal)) {
                    const seen = new Set(
                        (this.save.highScores || []).map((r) => `${r.date}|${r.timeSurvived}`)
                    );
                    for (const r of payload.normal) {
                        const k = `${r.date}|${r.timeSurvived}`;
                        if (!seen.has(k)) {
                            recordHighScore(this.save, r);
                            seen.add(k);
                        }
                    }
                    saveSave(this.save);
                }
                if (Array.isArray(payload.speedrun)) {
                    const existing = loadSpeedrunScores();
                    const seen = new Set(existing.map((r) => `${r.date}|${r.timeMs}`));
                    for (const r of payload.speedrun) {
                        const k = `${r.date}|${r.timeMs}`;
                        if (!seen.has(k)) {
                            recordSpeedrunScore(r);
                            seen.add(k);
                        }
                    }
                }
                // Refresh the open leaderboard view if the dialog is still up.
                this.ui.showLeaderboard?.(
                    this.save.highScores || [],
                    loadSpeedrunScores(),
                    () => {}
                );
            } catch (err) {
                console.warn('[main] leaderboard import failed', err);
            }
        });
    }

    // --- Lifecycle --------------------------------------------------------
    _bindInput() {
        this.input.attach(window);
        this.input.onTogglePause = () => this.togglePause();
        // Virtual joystick
        const joy = document.getElementById('joystickBase');
        const knob = document.getElementById('joystickKnob');
        if (joy && knob) this.input.attachJoystick(joy, knob);
    }

    _bindDomButtons() {
        const q = (id) => document.getElementById(id);
        q('btnStart')?.addEventListener('click', () => {
            this.audio.unlock();
            this.speedrunMode = false;
            this.dailyMode = false;
            this.start();
        });
        q('btnSpeedrun')?.addEventListener('click', () => {
            this.audio.unlock();
            this.startSpeedrun();
        });
        q('btnStage')?.addEventListener('click', () => this.openStagePicker());
        q('btnDaily')?.addEventListener('click', () => {
            this.audio.unlock();
            this.startDaily();
        });
        q('btnLeaderboard')?.addEventListener('click', () => this.openLeaderboard());
        q('btnSettings')?.addEventListener('click', () => this.openSettings());
        q('btnAchievements')?.addEventListener('click', () => this.openAchievements());
        q('btnRetry')?.addEventListener('click', () => {
            this.ui.hideGameOver();
            if (this.dailyMode) this.startDaily();
            else if (this.speedrunMode) this.startSpeedrun();
            else this.start();
        });
        q('btnMenu')?.addEventListener('click', () => {
            this.ui.hideGameOver();
            this.ui.showStart();
            this.state = GameState.MENU;
            this.speedrunMode = false;
        });
        q('btnResume')?.addEventListener('click', () => this.togglePause());
        q('btnQuit')?.addEventListener('click', () => {
            this.state = GameState.MENU;
            this.ui.hidePause();
            this.ui.showStart();
            cancelAnimationFrame(this.raf);
            this.audio.stopMusic();
        });
    }

    _resize() {
        const container = document.getElementById('gameContainer');
        if (!container) return;
        const w = Math.min(window.innerWidth - 16, CONFIG.CANVAS_WIDTH);
        const h = Math.min(window.innerHeight - 16, CONFIG.CANVAS_HEIGHT);
        const scale = Math.min(w / CONFIG.CANVAS_WIDTH, h / CONFIG.CANVAS_HEIGHT);
        container.style.width = `${CONFIG.CANVAS_WIDTH * scale}px`;
        container.style.height = `${CONFIG.CANVAS_HEIGHT * scale}px`;
    }

    start() {
        this.state = GameState.PLAYING;
        this.gameTime = 0;
        this.kills = 0;
        this.enemies = [];
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.expOrbs = [];
        this.particles = [];
        this.floatingTexts = [];
        this.mines = [];
        this._bossesSpawned.clear();
        this._bossWarnedAt.clear();
        this._spawnAccumulator = 0;
        this._lastAnnouncedWave = null;
        this._nextSplitIdx = 0;

        // Re-derive the stage snapshot at run start. Daily mode pins the
        // stage from the challenge spec; otherwise we honour the saved
        // setting so a stage-picker change between runs takes effect here.
        const stageOverride =
            this.dailyMode && this.dailyChallenge ? this.dailyChallenge.stage : null;
        this.stageId = stageOverride || this.save?.settings?.stage || DEFAULT_STAGE_ID;
        this.stageWaves = getWavesFor(this.stageId);
        this.stageBosses = this._applyDailyBossOffset(getBossesFor(this.stageId));
        this.currentWave = this.stageWaves[0];

        // Reset per-run achievement state.
        this.achievements.resetRun();
        this.run = this.achievements.run;
        // Seed the fields the v2.4 achievements depend on. Kept here (rather
        // than in AchievementTracker) because these tie together weapons/ui.
        this.run.passivesPicked = 0;
        this.run.maxedWeaponCount = 0;
        this.run.evolvedBefore = {};
        this.run.realSecondsToVoidLord = Infinity;
        this.run.noHitBoss = false;
        this.run.tookAnyDamage = false; // flipped by Player.takeDamage; drives no-hit badge
        this.run.bossFightNoHit = new Set(); // ids of bosses whose fight we've tracked
        this._runStartWallClock = performance.now();
        this.speedrunSplits = [];

        this.player = new Player(
            (CONFIG.ARENA_WIDTH ?? CONFIG.CANVAS_WIDTH) / 2,
            (CONFIG.ARENA_HEIGHT ?? CONFIG.CANVAS_HEIGHT) / 2
        );
        this.player.weapons.push(new Weapon(WEAPONS.WHIP));
        // Snap camera to player at run start so the first frame doesn't show
        // a one-tick lerp from (0,0).
        this._updateCamera();

        this.ui.hideStart();
        this.ui.hideGameOver();
        this.ui.hideLevelUp();
        this.ui.hidePause();

        this.save.runs = (this.save.runs || 0) + 1;
        saveSave(this.save);

        this.audio.unlock();
        this.audio.startMusic();

        this.lastTime = performance.now();
        this._scheduleFrame();
    }

    /**
     * Speedrun mode: deterministic seed, fixed boss timeline (the `spawnAt`
     * fields in data.js are already fixed), real-time millisecond clock,
     * separate leaderboard. We toggle `speedrunMode` before delegating to
     * `start()` so the spawn path can branch on the seeded RNG.
     */
    startSpeedrun() {
        this.speedrunMode = true;
        this.dailyMode = false;
        this.speedrunRng = new SeededRng(CONFIG.SPEEDRUN_SEED);
        this.speedrunStart = performance.now();
        this.start();
        this._announce('Speedrun started — deterministic seed.');
    }

    /**
     * Daily challenge: deterministic seed pinned to the UTC date, stage is
     * also pinned (rotates daily), and boss timings are nudged by a per-day
     * offset. Final entry lands in `daily-{date}-{stage}` rather than the
     * regular leaderboard so the global ranks aren't polluted.
     */
    startDaily() {
        this.dailyMode = true;
        this.speedrunMode = false;
        this.dailyChallenge = dailyChallenge();
        // Re-use SeededRng for spawn determinism — same plumbing as speedrun.
        this.speedrunRng = new SeededRng(this.dailyChallenge.seed);
        this.speedrunStart = performance.now();
        this.start();
        this._announce(`Daily Challenge ${this.dailyChallenge.date} — ${this.stageId}.`);
    }

    /** Apply the daily challenge's bossOffset to a `getBossesFor` result. */
    _applyDailyBossOffset(bosses) {
        if (!this.dailyMode || !this.dailyChallenge?.bossOffset) return bosses;
        const off = this.dailyChallenge.bossOffset;
        return bosses.map((b) => ({ ...b, spawnAt: Math.max(30, b.spawnAt + off) }));
    }

    /** Show the stage picker overlay; persists the choice via `save.settings.stage`. */
    openStagePicker() {
        this.ui.showStagePicker(this.stageId, (newStageId) => {
            this.stageId = newStageId;
            this.save.settings.stage = newStageId;
            saveSave(this.save);
        });
    }

    togglePause() {
        if (this.state === GameState.PLAYING) {
            this.state = GameState.PAUSED;
            this.ui.showPause();
            this.audio.stopMusic();
        } else if (this.state === GameState.PAUSED) {
            this.state = GameState.PLAYING;
            this.ui.hidePause();
            this.audio.startMusic();
            this.lastTime = performance.now();
            this._scheduleFrame();
        }
    }

    gameOver() {
        this.state = GameState.GAMEOVER;
        cancelAnimationFrame(this.raf);
        this.audio.stopMusic();
        this.audio.death();

        // Update lifetime "unique builds" counter: a build = the sorted set
        // of weapon ids at death. If we haven't seen this combination before,
        // append it. Hard-cap the array at SEEN_BUILDS_CAP (1000) to keep the
        // save under a reasonable byte budget — older keys roll out FIFO.
        this.save.totals ??= { kills: 0, timePlayed: 0, runs: 0, bossKills: 0 };
        this.save.totals.seenBuilds ??= [];
        const buildKey = this.player.weapons
            .map((w) => w.id)
            .sort()
            .join('+');
        if (buildKey && !this.save.totals.seenBuilds.includes(buildKey)) {
            this.save.totals.seenBuilds.push(buildKey);
            const cap = CONFIG.SEEN_BUILDS_CAP || 1000;
            if (this.save.totals.seenBuilds.length > cap) {
                this.save.totals.seenBuilds.splice(0, this.save.totals.seenBuilds.length - cap);
            }
            this.save.totals.uniqueBuilds = this.save.totals.seenBuilds.length;
        }

        // Final achievement check.
        this.achievements.check(this);
        this._flushAchievementToasts();

        // Record run -------------------------------------------------------
        const weaponIds = this.player.weapons.map((w) => w.id);
        const entry = {
            kills: this.kills,
            timeSurvived: this.gameTime,
            level: this.player.level,
            date: Date.now(),
            weapons: weaponIds,
            // v2.6: stage tag so per-stage leaderboards split correctly.
            stage: this.stageId,
            // Authoritative: was the player hit even once across the whole
            // run? Falls back to the unhit-timer proxy for backwards compat
            // if a custom path bypassed Player.takeDamage.
            noHit: !this.run.tookAnyDamage
        };
        // Daily-mode runs go to the per-day slot rather than the global
        // leaderboard so they don't pollute the speedrun/normal pools.
        if (this.dailyMode && this.dailyChallenge) {
            saveDailyResult({
                ...entry,
                date: this.dailyChallenge.date,
                seed: this.dailyChallenge.seed,
                won: !!this.run.bossesDefeated?.void_lord
            });
        } else {
            recordHighScore(this.save, entry);
        }
        accumulateTotals(this.save, {
            kills: this.kills,
            gameTime: this.gameTime,
            bossKills: Object.keys(this.run.bossesDefeated).length
        });
        saveSave(this.save);

        // Speedrun: write to its own leaderboard, and store the split timeline
        // on the game so the UI can render it in the game-over screen.
        if (this.speedrunMode) {
            const sEntry = {
                timeMs: performance.now() - this.speedrunStart,
                splits: this.speedrunSplits,
                level: this.player.level,
                kills: this.kills,
                date: Date.now(),
                weapons: weaponIds,
                noHit: entry.noHit
            };
            const rank = recordSpeedrunScore(sEntry);
            this._speedrunRank = rank;
            this._speedrunEntry = sEntry;
        }

        this.ui.showGameOver(this);
    }

    openLeaderboard() {
        this.ui.showLeaderboard(this.save.highScores || [], loadSpeedrunScores(), () => {
            /* closed */
        });
    }

    // --- Frame loop -------------------------------------------------------
    _scheduleFrame() {
        this.raf = requestAnimationFrame((t) => this._frame(t));
    }

    _onVisibilityChange() {
        if (typeof document === 'undefined') return;
        if (document.hidden) {
            if (this.state === GameState.PLAYING) {
                this._hiddenPaused = true;
                this.state = GameState.PAUSED;
                this.ui.showPause();
                this.audio.stopMusic();
            }
        } else if (this._hiddenPaused && this.state === GameState.PAUSED) {
            // Don't auto-resume: leave the pause menu up so the player
            // explicitly opts back in. Just reset the clock to avoid a
            // massive dt when they do click Resume.
            this._hiddenPaused = false;
            this.lastTime = performance.now();
        }
    }

    _frame(now) {
        if (this.state !== GameState.PLAYING && this.state !== GameState.LEVEL_UP) return;
        // Clamp dt so that (a) a paused+resumed tab does not nuke the sim in
        // one step, and (b) frame-rate spikes don't create tunneling bugs.
        const dt = Math.min((now - this.lastTime) / 1000, CONFIG.DT_CLAMP);
        this.lastTime = now;
        if (this.state === GameState.PLAYING) {
            this.update(dt);
        }
        this.effects.update(dt);
        this.render(dt);
        this.fpsMeter.tick(dt);
        this.ui.setFps(this.fpsMeter.fps, this.save.settings.showFps);
        this._scheduleFrame();
    }

    update(dt) {
        this.gameTime += dt;

        const { hpMult, dmgMult, diff } = this._computeDifficultyMults();
        this.enemyDmgMult = dmgMult; // used by enemy projectile spawn

        this.currentWave = this._selectWave();

        this.player.update(dt, this);
        if (this.player.dead) {
            this.gameOver();
            return;
        }

        // Spatial hash rebuild BEFORE anyone queries it.
        this.spatial.insertAll(this.enemies);

        this._updateEnemies(dt, hpMult, dmgMult);
        this._updateProjectiles(dt);
        this._updateEnemyProjectiles(dt);
        this._updateMines(dt);
        this._updateExpOrbs(dt);
        this._maybeTriggerLevelUp();
        this._updateParticlesAndText(dt);

        this._spawnLogic(dt, hpMult, dmgMult, diff.spawnMult);

        // Speedrun splits: push once per threshold as gameTime crosses them.
        if (this.speedrunMode) {
            const thresholds = CONFIG.SPEEDRUN_SPLITS;
            while (
                this._nextSplitIdx < thresholds.length &&
                this.gameTime >= thresholds[this._nextSplitIdx]
            ) {
                const mark = thresholds[this._nextSplitIdx];
                this.speedrunSplits.push({
                    mark,
                    realMs: performance.now() - this.speedrunStart
                });
                this._nextSplitIdx++;
            }
        }

        // Achievement ticks (cheap: most checks short-circuit).
        this.achievements.check(this);
        this._flushAchievementToasts();

        // HUD
        this.ui.updateHud(this);

        // Camera
        this.camera.update(dt, this.save.settings.screenShake);
        this._updateCamera();
    }

    /**
     * Position the camera so the player sits in the centre of the viewport,
     * clamped so the camera never shows arena out-of-bounds. Called every
     * frame from `update()` and once from `start()` to avoid a first-frame
     * snap. Stored on `this.camera.worldX/worldY` (top-left of the viewport
     * in arena coords). Render translates by `-worldX + shake.x` etc.
     */
    _updateCamera() {
        if (!this.player) return;
        const vw = CONFIG.CANVAS_WIDTH;
        const vh = CONFIG.CANVAS_HEIGHT;
        const aw = CONFIG.ARENA_WIDTH ?? vw;
        const ah = CONFIG.ARENA_HEIGHT ?? vh;
        let wx = this.player.x - vw / 2;
        let wy = this.player.y - vh / 2;
        if (wx < 0) wx = 0;
        if (wy < 0) wy = 0;
        if (wx > aw - vw) wx = aw - vw;
        if (wy > ah - vh) wy = ah - vh;
        this.camera.worldX = wx;
        this.camera.worldY = wy;
    }

    // --- update() helpers (kept close to the orchestrator for locality) ---
    _computeDifficultyMults() {
        const diff =
            Difficulty[(this.save.settings.difficulty || 'normal').toUpperCase()] ||
            Difficulty.NORMAL;
        const timeDiff = 1 + Math.floor(this.gameTime / 60) * 0.3;
        return { diff, hpMult: diff.hpMult * timeDiff, dmgMult: diff.dmgMult * timeDiff };
    }

    _updateEnemies(dt, hpMult, dmgMult) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt, this);

            const dx = e.x - this.player.x;
            const dy = e.y - this.player.y;
            const d = Math.hypot(dx, dy);
            if (d < e.size + this.player.size && !this.player.invincible) {
                this.player.takeDamage(e.damage, this);
                this.createFloatingText(
                    Math.round(e.damage),
                    this.player.x,
                    this.player.y - 30,
                    '#ff3333'
                );
            }

            if (e.hp <= 0) {
                this._onEnemyKilled(e, hpMult, dmgMult);
                this.enemies.splice(i, 1);
                continue;
            }

            if (d > CONFIG.DESPAWN_RADIUS && !e.boss) {
                this.enemies.splice(i, 1);
            }
        }
    }

    _onEnemyKilled(e, hpMult, dmgMult) {
        this.kills++;
        this.createParticles(e.x, e.y, e.color, e.boss ? 40 : 8);
        this.effects.hit(e.x, e.y, this._rgbFromHex(e.color));
        this.dropExp(e.x, e.y, e.expValue);
        if (e.boss) {
            this.shake(0.5);
            this.audio.explosion();
            this.achievements.onBossDefeated(e.id);
            this._announce(`${e.id.replace('_', ' ')} defeated`);
            // Mark no-hit-boss if the player's unhit streak is longer than
            // the fight itself. We use the unhit timer (seconds without
            // damage) as a cheap proxy; any damage during the fight resets it.
            if (this.player.unhitTimer >= 8) this.run.noHitBoss = true;
            // Speedrun: record wall-clock seconds until each boss.
            if (e.id === 'void_lord') {
                this.run.realSecondsToVoidLord =
                    (performance.now() - this._runStartWallClock) / 1000;
            }
        }
        if (e.splitter && e.type.splitInto) {
            const childDef = findEnemyDef(e.type.splitInto);
            if (childDef) {
                const n = e.type.splitCount || 2;
                for (let k = 0; k < n; k++) {
                    const a = (k / n) * Math.PI * 2;
                    this.enemies.push(
                        new Enemy(
                            e.x + Math.cos(a) * 14,
                            e.y + Math.sin(a) * 14,
                            childDef,
                            hpMult,
                            dmgMult
                        )
                    );
                }
            }
        }
        this.audio.hit();
    }

    _updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt, this);
            if (p.shouldRemove) {
                this.projectiles.splice(i, 1);
                continue;
            }

            const range = p.size + 32;
            for (const enemy of this.spatial.queryRect(p.x, p.y, range)) {
                if (p.hitEnemies.has(enemy)) continue;
                const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                if (d < enemy.size + p.size) {
                    let dmg = p.damage;
                    const chance = this.player.getCritChance();
                    const crit = chance > 0 && Math.random() < chance;
                    if (crit) dmg *= 2;
                    enemy.takeDamage(dmg);
                    p.hitEnemies.add(enemy);
                    if (enemy.hp > 0) {
                        this.createFloatingText(
                            Math.round(dmg),
                            enemy.x,
                            enemy.y - 20,
                            crit ? '#ffee44' : '#fff',
                            { crit }
                        );
                    }
                    this.effects.hit(enemy.x, enemy.y);
                    if (!p.piercing) {
                        p._onEnd(this);
                        p.shouldRemove = true;
                        break;
                    }
                }
            }
        }
    }

    _updateEnemyProjectiles(dt) {
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const ep = this.enemyProjectiles[i];
            ep.update(dt, this);
            if (ep.shouldRemove) this.enemyProjectiles.splice(i, 1);
        }
    }

    _updateMines(dt) {
        for (let i = this.mines.length - 1; i >= 0; i--) {
            const m = this.mines[i];
            m.update(dt, this);
            if (m.shouldRemove) this.mines.splice(i, 1);
        }
    }

    _updateExpOrbs(dt) {
        for (let i = this.expOrbs.length - 1; i >= 0; i--) {
            const o = this.expOrbs[i];
            o.update(dt, this);
            if (o.shouldRemove) this.expOrbs.splice(i, 1);
        }
    }

    _maybeTriggerLevelUp() {
        if (this._pendingLevelUps > 0 && this.state === GameState.PLAYING) {
            this._pendingLevelUps--;
            this.state = GameState.LEVEL_UP;
            this.audio.levelUp();
            this.effects.levelUp(this.player.x, this.player.y);
            this._announce(`Level ${this.player.level}! Choose an upgrade.`);
            this.ui.showLevelUp(this.player, (choice) => this._applyUpgrade(choice));
        }
    }

    _updateParticlesAndText(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const part = this.particles[i];
            part.update(dt);
            if (part.life <= 0) {
                this.pools.particle.release(part);
                this.particles.splice(i, 1);
            }
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.update(dt);
            if (ft.life <= 0) {
                this.pools.floatingText.release(ft);
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    /** Broadcast a short message to screen readers via the a11y live region. */
    _announce(msg) {
        if (typeof document === 'undefined') return;
        const el = document.getElementById('a11yLiveRegion');
        if (!el) return;
        // Toggle textContent to force SR re-announce if the message repeats.
        el.textContent = '';
        // Microtask flush before writing so ATs pick up the change.
        Promise.resolve().then(() => {
            el.textContent = msg;
        });
    }

    _applyUpgrade(choice) {
        if (choice) {
            if (choice.type === 'weapon') {
                const existing = this.player.weapons.find((w) => w.id === choice.data.id);
                if (existing) {
                    const prevLvl = existing.level;
                    existing.levelUp();
                    if (existing.level >= CONFIG.WEAPON_MAX_LEVEL) {
                        this.achievements.onWeaponMaxed();
                        // Track how many distinct weapons have been maxed this run.
                        if (prevLvl < CONFIG.WEAPON_MAX_LEVEL) {
                            this.run.maxedWeaponCount = (this.run.maxedWeaponCount || 0) + 1;
                        }
                    }
                    // Early-Evolve achievement: fire when the weapon actually
                    // crosses into its evolution tier before 7:00.
                    if (
                        existing.def.evolveLevel &&
                        prevLvl < existing.def.evolveLevel &&
                        existing.level >= existing.def.evolveLevel &&
                        this.gameTime < CONFIG.EARLY_EVOLVE_THRESHOLD
                    ) {
                        this.run.evolvedBefore = this.run.evolvedBefore || {};
                        this.run.evolvedBefore.sevenMin = true;
                    }
                } else {
                    this.player.weapons.push(new Weapon(choice.data));
                }
            } else {
                this.player.passives[choice.data.id] ??= { def: choice.data, count: 0 };
                if (this.player.passives[choice.data.id].count < CONFIG.PASSIVE_MAX_STACK) {
                    this.player.passives[choice.data.id].count++;
                    this.player.recalculateStats();
                    this.run.passivesPicked = (this.run.passivesPicked || 0) + 1;
                }
            }
        }
        this.ui.hideLevelUp();
        this.state = GameState.PLAYING;
        this.lastTime = performance.now();
    }

    _selectWave() {
        const t = this.gameTime;
        const list = this.stageWaves && this.stageWaves.length ? this.stageWaves : WAVES;
        let match = list[list.length - 1];
        for (const w of list) {
            if (t >= w.from && t < w.to) {
                match = w;
                break;
            }
        }
        if (this._lastAnnouncedWave !== match.label) {
            this._lastAnnouncedWave = match.label;
        }
        return match;
    }

    _spawnLogic(dt, hpMult, dmgMult, diffSpawnMult) {
        const wave = this.currentWave;
        const waveMult = wave.spawnMult || 1;
        const maxEnemies = Math.min(CONFIG.MAX_ENEMIES, 20 + Math.floor(this.gameTime / 10));
        const interval = Math.max(0.2, 1.2 - this.gameTime / 200) / (diffSpawnMult * waveMult);
        this._spawnAccumulator += dt;

        while (this._spawnAccumulator >= interval && this.enemies.length < maxEnemies) {
            this._spawnAccumulator -= interval;
            this._spawnOne(wave.pool, hpMult, dmgMult);
        }

        // Boss triggers (warning 5s before). Use the per-stage boss list so
        // stage-specific timing overrides (e.g. crypt's earlier Reaper) fire.
        const bossList =
            this.stageBosses && this.stageBosses.length ? this.stageBosses : Object.values(BOSSES);
        for (const boss of bossList) {
            const warnAt = boss.spawnAt - 5;
            if (this.gameTime >= warnAt && !this._bossWarnedAt.has(boss.id)) {
                this._bossWarnedAt.add(boss.id);
                this.audio.bossWarn();
            }
            if (this.gameTime >= boss.spawnAt && !this._bossesSpawned.has(boss.id)) {
                this._bossesSpawned.add(boss.id);
                this._spawnBoss(boss, hpMult, dmgMult);
            }
        }
    }

    _spawnOne(pool, hpMult, dmgMult) {
        // Speedrun + Daily both want determinism; either uses speedrunRng.
        const rng =
            (this.speedrunMode || this.dailyMode) && this.speedrunRng ? this.speedrunRng : null;
        const frnd = rng ? () => rng.nextFloat() : Math.random;
        // pickWeighted honours the active stage's poolOverrides; with default
        // stage (forest) all weights are 1 so it degrades to a uniform pick.
        const pick =
            pickWeighted(pool, this.stageId, frnd) || pool[Math.floor(frnd() * pool.length)];
        const type = findEnemyDef(pick) || ENEMIES.BAT;
        const angle = frnd() * Math.PI * 2;
        const dist = CONFIG.SPAWN_RADIUS + frnd() * 120;
        const x = this.player.x + Math.cos(angle) * dist;
        const y = this.player.y + Math.sin(angle) * dist;
        this.enemies.push(new Enemy(x, y, type, hpMult, dmgMult));
    }

    _spawnBoss(bossDef, hpMult, dmgMult) {
        const angle = Math.random() * Math.PI * 2;
        const d = CONFIG.SPAWN_RADIUS * 0.8;
        const x = this.player.x + Math.cos(angle) * d;
        const y = this.player.y + Math.sin(angle) * d;
        this.enemies.push(new Enemy(x, y, bossDef, hpMult, dmgMult));
        this.ui.showBossBanner();
        this.audio.bossSpawn();
        this.effects.bossSpawn();
        this.shake(0.8);
        this._announce(`Boss incoming: ${bossDef.name || bossDef.id}`);
    }

    _flushAchievementToasts() {
        const toasts = this.achievements.takeToasts();
        for (const ach of toasts) {
            this.ui.showAchievementToast(ach);
            this.audio.achievement();
            this.effects.achievement();
            this._announce(`Achievement unlocked: ${ach.name}. ${ach.description}`);
        }
    }

    _rgbFromHex(hex) {
        // Accept '#rrggbb' and return 'r,g,b' for effects layer.
        if (!hex || hex[0] !== '#') return '255,255,255';
        const n = parseInt(hex.slice(1), 16);
        return `${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff}`;
    }

    // --- Helpers ----------------------------------------------------------
    dropExp(x, y, amount) {
        this.expOrbs.push(new ExpOrb(x, y, amount));
    }
    createParticles(x, y, color, n) {
        if (this.save.settings.reducedMotion) n = Math.min(n, 2);
        for (let i = 0; i < n; i++) {
            this.particles.push(this.pools.particle.acquire(x, y, color));
        }
    }
    createFloatingText(text, x, y, color, opts) {
        if (this.save.settings.reducedMotion) return;
        // damageNumbers toggle (default on). Backwards-compatible: an older
        // save without the field still gets numbers because we treat
        // `undefined` as on.
        if (this.save.settings.damageNumbers === false) return;
        this.floatingTexts.push(this.pools.floatingText.acquire(text, x, y, color, opts || {}));
    }
    shake(amount) {
        // Reduced-motion users get no camera shake even if the setting is on.
        const prm =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (this.save.settings.screenShake && !prm && !this.save.settings.reducedMotion) {
            this.camera.shake(amount);
        }
    }

    // called by Player via takeDamage
    onPlayerHurt(_amount) {
        this.audio.damage();
        this.shake(0.25);
    }

    onBossAbility(boss) {
        if (boss.ability === 'summon') {
            const childDef = findEnemyDef('skeleton');
            for (let i = 0; i < 3; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = 80;
                this.enemies.push(
                    new Enemy(boss.x + Math.cos(a) * r, boss.y + Math.sin(a) * r, childDef, 2, 1.5)
                );
            }
            this.createParticles(boss.x, boss.y, '#aa33ff', 20);
        } else if (boss.ability === 'charge') {
            const dx = this.player.x - boss.x;
            const dy = this.player.y - boss.y;
            const d = Math.hypot(dx, dy) || 1;
            boss.x += (dx / d) * 120;
            boss.y += (dy / d) * 120;
            this.createParticles(boss.x, boss.y, '#ff3366', 15);
        }
    }

    // --- Rendering --------------------------------------------------------
    render(_dt) {
        const ctx = this.ctx;
        // 1) Background fill in screen space (no transform). This guarantees
        //    the viewport is always cleared even when the camera sits flush
        //    against an arena edge and a sliver would otherwise be unfilled.
        const bg = getBackgroundFor(this.stageId);
        ctx.fillStyle = bg.fill;
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // 2) World-space pass: translate by -camera + shake so entity coords
        //    (which live in arena space) project into the viewport.
        ctx.save();
        ctx.translate(-this.camera.worldX + this.camera.x, -this.camera.worldY + this.camera.y);

        this._drawGrid();

        for (const o of this.expOrbs) o.render(ctx);
        for (const m of this.mines) m.render(ctx);
        this._renderEnemies(ctx);
        if (this.player) {
            this.player.render(ctx);
            // Orbit shards live on the weapon, so render per-weapon extras here.
            for (const w of this.player.weapons) w.renderExtras?.(ctx);
        }
        for (const p of this.projectiles) p.render(ctx);
        for (const ep of this.enemyProjectiles) ep.render(ctx);
        for (const p of this.particles) p.render(ctx);
        for (const t of this.floatingTexts) t.render(ctx);

        ctx.restore();

        // 3) Screen-space effects (flash, pulses, vignette) on top — these
        //    render relative to the viewport, not the world.
        this.effects.render(ctx, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    }

    /**
     * Draw enemies using the cached offscreen sprite when available. Bosses
     * and flashing enemies still go through the full per-frame path because
     * their visuals include HP bars and hit-flash highlights that the cached
     * bitmap cannot reproduce. This cuts per-enemy drawing calls from ~4
     * (gradient + two arcs + fill) to a single drawImage for the common case.
     */
    _renderEnemies(ctx) {
        for (const e of this.enemies) {
            if (e.boss || e.flashTimer > 0 || e.shielded) {
                e.render(ctx);
                continue;
            }
            const sprite = getEnemySprite(e.type, e.size);
            if (sprite) {
                ctx.drawImage(sprite, e.x - sprite.width / 2, e.y - sprite.height / 2);
                // Cheap HP bar (cached sprite can't reflect current HP).
                const pct = Math.max(0, e.hp / e.maxHp);
                if (pct < 1) {
                    const w = 30;
                    ctx.fillStyle = '#222';
                    ctx.fillRect(e.x - w / 2, e.y - e.size - 10, w, 3);
                    ctx.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa33' : '#ff4444';
                    ctx.fillRect(e.x - w / 2, e.y - e.size - 10, w * pct, 3);
                }
            } else {
                e.render(ctx);
            }
        }
    }

    /**
     * Draws a faint grid in arena/world space. Because we're inside the
     * world-space transform (-camera + shake) we can just iterate from
     * the first grid line >= camera.worldX to the last one <= worldX+vw,
     * which auto-clips to the visible region without any per-frame guess.
     */
    _drawGrid() {
        const ctx = this.ctx;
        const alpha = (getBackgroundFor(this.stageId).gridAlpha ?? 0.04).toFixed(3);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1;
        const size = CONFIG.GRID_SIZE;
        const cx = this.camera.worldX;
        const cy = this.camera.worldY;
        const vw = CONFIG.CANVAS_WIDTH;
        const vh = CONFIG.CANVAS_HEIGHT;
        const startX = Math.floor(cx / size) * size;
        const startY = Math.floor(cy / size) * size;
        for (let x = startX; x <= cx + vw; x += size) {
            ctx.beginPath();
            ctx.moveTo(x, cy);
            ctx.lineTo(x, cy + vh);
            ctx.stroke();
        }
        for (let y = startY; y <= cy + vh; y += size) {
            ctx.beginPath();
            ctx.moveTo(cx, y);
            ctx.lineTo(cx + vw, y);
            ctx.stroke();
        }
    }

    openAchievements() {
        this.ui.showAchievements(this.save.achievements || {}, () => {
            /* closed */
        });
    }

    // --- Settings ---------------------------------------------------------
    openSettings() {
        this.ui.showSettings(
            this.save.settings,
            (key, value) => {
                this.save.settings[key] = value;
                saveSave(this.save);
                if (key === 'masterVolume' || key === 'sfxVolume' || key === 'musicVolume')
                    this.audio.applyVolumes();
                if (key === 'musicEnabled') this.audio.toggleMusic(value);
            },
            () => {
                /* closed */
            },
            () => {
                resetSave();
                this.save = loadSave();
                this.achievements = new AchievementTracker(this.save);
                this.run = this.achievements.run;
                this.audio.applyVolumes();
                this.ui.hideSettings();
            }
        );
    }
}

// Level-up batching. Called from gainExp via Player; we patch Player here to notify.
const origGainExp = Player.prototype.gainExp;
Player.prototype.gainExp = function (amount) {
    const ups = origGainExp.call(this, amount);
    if (ups.length && window.__vsGame) {
        window.__vsGame._pendingLevelUps = (window.__vsGame._pendingLevelUps || 0) + ups.length;
    }
    return ups;
};

// Bootstrap
export function boot() {
    const g = new Game();
    window.__vsGame = g;
    // Dev-only debug hooks. Gated on hostname so they never fire on the
    // GitHub Pages build; the smoke harness loads from localhost so it
    // does. Used by scripts/runtime-smoke.js to fast-forward to bosses,
    // force a level-up, and trigger game-over without having to actually
    // play 5 minutes per scene.
    const isDev =
        typeof location !== 'undefined' &&
        (location.hostname === 'localhost' ||
            location.hostname === '127.0.0.1' ||
            location.hostname === '');
    if (isDev) {
        window.__SURV_DEBUG__ = {
            /** Fast-forward simulated game time. Triggers everything that's
             * gated on `gameTime`: wave director, boss spawns, difficulty
             * scaling. Spawn accumulator follows along so a chunk of enemies
             * appears proportionate to the elapsed window. */
            advance(seconds = 30) {
                if (!g.player || g.state !== 'playing') return false;
                g.gameTime += seconds;
                // Keep the spawn director from emptying its bag in one frame.
                g._spawnAccumulator = 0;
                return true;
            },
            /** Push enough XP that the next update() flushes one level-up. */
            grantLevel(n = 1) {
                if (!g.player) return false;
                for (let i = 0; i < n; i++) g.player.gainExp(g.player.expToNext + 1);
                return true;
            },
            /** Knock the player to 1 HP so the next enemy hit ends the run. */
            killPlayer() {
                if (!g.player) return false;
                g.player.hp = 0;
                g.player.dead = true;
                return true;
            },
            /** Spawn the named boss right now (skipping its scheduled time). */
            spawnBoss(id) {
                const def = Object.values(BOSSES).find((b) => b.id === id);
                if (!def) return false;
                g._spawnBoss(def, 1, 1);
                g._bossesSpawned.add(def.id);
                return true;
            }
        };
    }
    return g;
}

// Re-export for any external script that needs the catalogue.
export { ACHIEVEMENTS, WAVES };

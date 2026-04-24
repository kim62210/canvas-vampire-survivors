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
import { FpsMeter, ShakeCamera, SpatialHash } from './systems.js';
import { EffectLayer } from './effects.js';
import { AchievementTracker } from './achievements.js';
import { accumulateTotals, loadSave, recordHighScore, resetSave, saveSave } from './storage.js';
import { setLocale } from './i18n.js';

registerWeaponClass(Weapon);

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
        this.spatial = new SpatialHash(CONFIG.GRID_SIZE * 2);
        this.camera = new ShakeCamera();
        this.fpsMeter = new FpsMeter();
        this.effects = new EffectLayer();

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

        this.currentWave = WAVES[0];

        // Per-run bookkeeping used by achievements.
        this.run = this.achievements.run;

        this._bindInput();
        this._bindDomButtons();

        window.addEventListener('resize', () => this._resize());
        this._resize();
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
            this.start();
        });
        q('btnSettings')?.addEventListener('click', () => this.openSettings());
        q('btnAchievements')?.addEventListener('click', () => this.openAchievements());
        q('btnRetry')?.addEventListener('click', () => {
            this.ui.hideGameOver();
            this.start();
        });
        q('btnMenu')?.addEventListener('click', () => {
            this.ui.hideGameOver();
            this.ui.showStart();
            this.state = GameState.MENU;
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

        // Reset per-run achievement state.
        this.achievements.resetRun();
        this.run = this.achievements.run;

        this.player = new Player(CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2);
        this.player.weapons.push(new Weapon(WEAPONS.WHIP));

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

        // Final achievement check.
        this.achievements.check(this);
        this._flushAchievementToasts();

        // Record run -------------------------------------------------------
        const entry = {
            kills: this.kills,
            timeSurvived: this.gameTime,
            level: this.player.level,
            date: Date.now()
        };
        recordHighScore(this.save, entry);
        accumulateTotals(this.save, {
            kills: this.kills,
            gameTime: this.gameTime,
            bossKills: Object.keys(this.run.bossesDefeated).length
        });
        saveSave(this.save);

        this.ui.showGameOver(this);
    }

    // --- Frame loop -------------------------------------------------------
    _scheduleFrame() {
        this.raf = requestAnimationFrame((t) => this._frame(t));
    }

    _frame(now) {
        if (this.state !== GameState.PLAYING && this.state !== GameState.LEVEL_UP) return;
        const dt = Math.min((now - this.lastTime) / 1000, 0.066);
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

        const diff =
            Difficulty[(this.save.settings.difficulty || 'normal').toUpperCase()] ||
            Difficulty.NORMAL;
        const timeDiff = 1 + Math.floor(this.gameTime / 60) * 0.3;
        const hpMult = diff.hpMult * timeDiff;
        const dmgMult = diff.dmgMult * timeDiff;
        this.enemyDmgMult = dmgMult; // used by enemy projectile spawn

        this.currentWave = this._selectWave();

        this.player.update(dt, this);
        if (this.player.dead) {
            this.gameOver();
            return;
        }

        // Spatial hash rebuild BEFORE anyone queries it.
        this.spatial.insertEnemies(this.enemies);

        // Enemies
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
                this.kills++;
                this.createParticles(e.x, e.y, e.color, e.boss ? 40 : 8);
                this.effects.hit(e.x, e.y, this._rgbFromHex(e.color));
                this.dropExp(e.x, e.y, e.expValue);
                if (e.boss) {
                    this.shake(0.5);
                    this.audio.explosion();
                    this.achievements.onBossDefeated(e.id);
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
                this.enemies.splice(i, 1);
                this.audio.hit();
                continue;
            }

            if (d > CONFIG.DESPAWN_RADIUS && !e.boss) {
                this.enemies.splice(i, 1);
            }
        }

        // Projectiles (broad-phase via spatial hash)
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
                    // Simple crit roll on projectile contact.
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

        // Enemy projectiles
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const ep = this.enemyProjectiles[i];
            ep.update(dt, this);
            if (ep.shouldRemove) this.enemyProjectiles.splice(i, 1);
        }

        // Mines
        for (let i = this.mines.length - 1; i >= 0; i--) {
            const m = this.mines[i];
            m.update(dt, this);
            if (m.shouldRemove) this.mines.splice(i, 1);
        }

        // Exp orbs
        for (let i = this.expOrbs.length - 1; i >= 0; i--) {
            const o = this.expOrbs[i];
            o.update(dt, this);
            if (o.shouldRemove) this.expOrbs.splice(i, 1);
        }

        // Level-up gating
        if (this._pendingLevelUps > 0 && this.state === GameState.PLAYING) {
            this._pendingLevelUps--;
            this.state = GameState.LEVEL_UP;
            this.audio.levelUp();
            this.effects.levelUp(this.player.x, this.player.y);
            this.ui.showLevelUp(this.player, (choice) => this._applyUpgrade(choice));
        }

        // Particles + text
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const part = this.particles[i];
            part.update(dt);
            if (part.life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.update(dt);
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }

        // Spawn
        this._spawnLogic(dt, hpMult, dmgMult, diff.spawnMult);

        // Achievement ticks (cheap: most checks short-circuit).
        this.achievements.check(this);
        this._flushAchievementToasts();

        // HUD
        this.ui.updateHud(this);

        // Camera
        this.camera.update(dt, this.save.settings.screenShake);
    }

    _applyUpgrade(choice) {
        if (choice) {
            if (choice.type === 'weapon') {
                const existing = this.player.weapons.find((w) => w.id === choice.data.id);
                if (existing) {
                    existing.levelUp();
                    if (existing.level >= CONFIG.WEAPON_MAX_LEVEL) {
                        this.achievements.onWeaponMaxed();
                    }
                } else {
                    this.player.weapons.push(new Weapon(choice.data));
                }
            } else {
                this.player.passives[choice.data.id] ??= { def: choice.data, count: 0 };
                if (this.player.passives[choice.data.id].count < CONFIG.PASSIVE_MAX_STACK) {
                    this.player.passives[choice.data.id].count++;
                    this.player.recalculateStats();
                }
            }
        }
        this.ui.hideLevelUp();
        this.state = GameState.PLAYING;
        this.lastTime = performance.now();
    }

    _selectWave() {
        const t = this.gameTime;
        let match = WAVES[WAVES.length - 1];
        for (const w of WAVES) {
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

        // Boss triggers (warning 5s before).
        for (const boss of Object.values(BOSSES)) {
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
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const type = findEnemyDef(pick) || ENEMIES.BAT;
        const angle = Math.random() * Math.PI * 2;
        const dist = CONFIG.SPAWN_RADIUS + Math.random() * 120;
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
    }

    _flushAchievementToasts() {
        const toasts = this.achievements.takeToasts();
        for (const ach of toasts) {
            this.ui.showAchievementToast(ach);
            this.audio.achievement();
            this.effects.achievement();
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
        for (let i = 0; i < n; i++) this.particles.push(new Particle(x, y, color));
    }
    createFloatingText(text, x, y, color, opts) {
        if (this.save.settings.reducedMotion) return;
        this.floatingTexts.push(new FloatingText(text, x, y, color, opts));
    }
    shake(amount) {
        if (this.save.settings.screenShake) this.camera.shake(amount);
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
        ctx.save();
        ctx.translate(this.camera.x, this.camera.y);
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        this._drawGrid();

        for (const o of this.expOrbs) o.render(ctx);
        for (const m of this.mines) m.render(ctx);
        for (const e of this.enemies) e.render(ctx);
        if (this.player) {
            this.player.render(ctx);
            // Orbit shards live on the weapon, so render per-weapon extras here.
            for (const w of this.player.weapons) w.renderExtras?.(ctx);
        }
        for (const p of this.projectiles) p.render(ctx);
        for (const ep of this.enemyProjectiles) ep.render(ctx);
        for (const p of this.particles) p.render(ctx);
        for (const t of this.floatingTexts) t.render(ctx);

        // Screen-space effects (flash, pulses) on top.
        this.effects.render(ctx, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        ctx.restore();
    }

    _drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        const size = CONFIG.GRID_SIZE;
        if (!this.player) return;
        const ox = -this.player.x % size;
        const oy = -this.player.y % size;
        for (let x = ox; x < CONFIG.CANVAS_WIDTH; x += size) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CONFIG.CANVAS_HEIGHT);
            ctx.stroke();
        }
        for (let y = oy; y < CONFIG.CANVAS_HEIGHT; y += size) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(CONFIG.CANVAS_WIDTH, y);
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
    return g;
}

// Re-export for any external script that needs the catalogue.
export { ACHIEVEMENTS, WAVES };

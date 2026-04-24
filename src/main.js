// Main game orchestrator. Wires entities, systems, UI, audio, and storage together.

import { CONFIG, Difficulty, GameState } from './config.js';
import { BOSSES, ENEMIES, WEAPONS } from './data.js';
import { Enemy, ExpOrb, FloatingText, Particle, Player, registerWeaponClass } from './entities.js';
import { Weapon } from './weapons.js';
import { AudioEngine } from './audio.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';
import { FpsMeter, ShakeCamera, SpatialHash } from './systems.js';
import { loadSave, resetSave, saveSave } from './storage.js';
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
        this.expOrbs = [];
        this.particles = [];
        this.floatingTexts = [];

        this.player = null;

        // Systems
        this.spatial = new SpatialHash(CONFIG.GRID_SIZE * 2);
        this.camera = new ShakeCamera();
        this.fpsMeter = new FpsMeter();

        // Save + settings
        this.save = loadSave();
        setLocale(this.save.settings.locale || 'en');

        // Audio + input + UI
        this.audio = new AudioEngine(this.save.settings);
        this.input = new InputManager();
        this.ui = new UI(this);

        this._bossesSpawned = new Set();
        this._spawnAccumulator = 0;

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
        q('btnStart')?.addEventListener('click', () => { this.audio.unlock(); this.start(); });
        q('btnSettings')?.addEventListener('click', () => this.openSettings());
        q('btnRetry')?.addEventListener('click', () => { this.ui.hideGameOver(); this.start(); });
        q('btnMenu')?.addEventListener('click', () => { this.ui.hideGameOver(); this.ui.showStart(); this.state = GameState.MENU; });
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
        this.expOrbs = [];
        this.particles = [];
        this.floatingTexts = [];
        this._bossesSpawned.clear();
        this._spawnAccumulator = 0;

        this.player = new Player(CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2);
        // Weapon constructor was injected into Player via registerWeaponClass.
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

        // Update high score + save
        const hs = this.save.highScore;
        if (this.gameTime > hs.timeSurvived) hs.timeSurvived = this.gameTime;
        if (this.kills > hs.kills) hs.kills = this.kills;
        if (this.player.level > hs.level) hs.level = this.player.level;
        this._checkAchievements();
        saveSave(this.save);

        this.ui.showGameOver(this);
    }

    _checkAchievements() {
        const a = this.save.achievements;
        const grant = (id) => { if (!a[id]) a[id] = Date.now(); };
        if (this.kills >= 100)      grant('slayer_100');
        if (this.kills >= 1000)     grant('slayer_1000');
        if (this.gameTime >= 300)   grant('survive_5min');
        if (this.gameTime >= 600)   grant('survive_10min');
        if (this.player.level >= 20) grant('level_20');
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
        this.render(dt);
        this.fpsMeter.tick(dt);
        this.ui.setFps(this.fpsMeter.fps, this.save.settings.showFps);
        this._scheduleFrame();
    }

    update(dt) {
        this.gameTime += dt;

        const diff = Difficulty[(this.save.settings.difficulty || 'normal').toUpperCase()] || Difficulty.NORMAL;
        const timeDiff = 1 + Math.floor(this.gameTime / 60) * 0.3;
        const hpMult = diff.hpMult * timeDiff;
        const dmgMult = diff.dmgMult * timeDiff;

        this.player.update(dt, this);
        if (this.player.dead) { this.gameOver(); return; }

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
                this.createFloatingText(Math.round(e.damage), this.player.x, this.player.y - 30, '#ff3333');
            }

            if (e.hp <= 0) {
                this.kills++;
                this.createParticles(e.x, e.y, e.color, e.boss ? 40 : 8);
                this.dropExp(e.x, e.y, e.expValue);
                if (e.boss) {
                    this.shake(0.5);
                    this.audio.explosion();
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
            if (p.shouldRemove) { this.projectiles.splice(i, 1); continue; }

            const range = p.size + 32;
            for (const enemy of this.spatial.queryRect(p.x, p.y, range)) {
                if (p.hitEnemies.has(enemy)) continue;
                const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                if (d < enemy.size + p.size) {
                    enemy.takeDamage(p.damage);
                    p.hitEnemies.add(enemy);
                    if (enemy.hp > 0) this.createFloatingText(Math.round(p.damage), enemy.x, enemy.y - 20, '#fff');
                    if (!p.piercing) {
                        p._onEnd(this);
                        p.shouldRemove = true;
                        break;
                    }
                }
            }
        }

        // Exp orbs
        for (let i = this.expOrbs.length - 1; i >= 0; i--) {
            const o = this.expOrbs[i];
            o.update(dt, this);
            if (o.shouldRemove) this.expOrbs.splice(i, 1);
        }

        // Handle level-ups queued during exp pickup
        if (this.player.exp >= this.player.expToNext || this._pendingLevelUps > 0) {
            // Player already levelled inside gainExp; open menu if any level-ups are pending.
        }
        if (this._pendingLevelUps > 0 && this.state === GameState.PLAYING) {
            this._pendingLevelUps--;
            this.state = GameState.LEVEL_UP;
            this.audio.levelUp();
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

        // HUD
        this.ui.updateHud(this);

        // Camera
        this.camera.update(dt, this.save.settings.screenShake);
    }

    _applyUpgrade(choice) {
        if (choice) {
            if (choice.type === 'weapon') {
                const existing = this.player.weapons.find(w => w.id === choice.data.id);
                if (existing) existing.levelUp();
                else this.player.weapons.push(new Weapon(choice.data));
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

    _spawnLogic(dt, hpMult, dmgMult, spawnMult) {
        const maxEnemies = Math.min(CONFIG.MAX_ENEMIES, 20 + Math.floor(this.gameTime / 10));
        // spawn interval ramps from 1.2s down to 0.25s
        const interval = Math.max(0.25, 1.2 - this.gameTime / 180) / spawnMult;
        this._spawnAccumulator += dt;

        while (this._spawnAccumulator >= interval && this.enemies.length < maxEnemies) {
            this._spawnAccumulator -= interval;
            this._spawnOne(hpMult, dmgMult);
        }

        // Boss triggers
        for (const boss of Object.values(BOSSES)) {
            if (this.gameTime >= boss.spawnAt && !this._bossesSpawned.has(boss.id)) {
                this._bossesSpawned.add(boss.id);
                this._spawnBoss(boss, hpMult, dmgMult);
            }
        }
    }

    _spawnOne(hpMult, dmgMult) {
        const pool = this._enemyPool();
        const type = pool[Math.floor(Math.random() * pool.length)];
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
        this.shake(0.8);
    }

    _enemyPool() {
        const t = this.gameTime;
        if (t < 30)  return [ENEMIES.BAT, ENEMIES.ZOMBIE];
        if (t < 60)  return [ENEMIES.BAT, ENEMIES.ZOMBIE, ENEMIES.SKELETON];
        if (t < 120) return [ENEMIES.ZOMBIE, ENEMIES.SKELETON, ENEMIES.WOLF, ENEMIES.GHOST];
        if (t < 180) return [ENEMIES.SKELETON, ENEMIES.WOLF, ENEMIES.GHOST];
        if (t < 300) return [ENEMIES.WOLF, ENEMIES.GOLEM, ENEMIES.GHOST];
        return [ENEMIES.WOLF, ENEMIES.GOLEM, ENEMIES.GHOST, ENEMIES.SKELETON];
    }

    // --- Helpers ----------------------------------------------------------
    dropExp(x, y, amount) { this.expOrbs.push(new ExpOrb(x, y, amount)); }
    createParticles(x, y, color, n) {
        if (this.save.settings.reducedMotion) n = Math.min(n, 2);
        for (let i = 0; i < n; i++) this.particles.push(new Particle(x, y, color));
    }
    createFloatingText(text, x, y, color) {
        if (this.save.settings.reducedMotion) return;
        this.floatingTexts.push(new FloatingText(text, x, y, color));
    }
    shake(amount) { if (this.save.settings.screenShake) this.camera.shake(amount); }

    // called by Player via takeDamage
    onPlayerHurt(amount) {
        this.audio.damage();
        this.shake(0.25);
    }

    onBossAbility(boss) {
        if (boss.ability === 'summon') {
            for (let i = 0; i < 3; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = 80;
                this.enemies.push(new Enemy(
                    boss.x + Math.cos(a) * r,
                    boss.y + Math.sin(a) * r,
                    ENEMIES.SKELETON, 2, 1.5
                ));
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
        for (const e of this.enemies) e.render(ctx);
        if (this.player) this.player.render(ctx);
        for (const p of this.projectiles) p.render(ctx);
        for (const p of this.particles) p.render(ctx);
        for (const t of this.floatingTexts) t.render(ctx);

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
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CONFIG.CANVAS_HEIGHT); ctx.stroke();
        }
        for (let y = oy; y < CONFIG.CANVAS_HEIGHT; y += size) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CONFIG.CANVAS_WIDTH, y); ctx.stroke();
        }
    }

    // --- Settings ---------------------------------------------------------
    openSettings() {
        this.ui.showSettings(
            this.save.settings,
            (key, value) => {
                this.save.settings[key] = value;
                saveSave(this.save);
                if (key === 'masterVolume' || key === 'sfxVolume' || key === 'musicVolume') this.audio.applyVolumes();
            },
            () => { /* closed */ },
            () => {
                resetSave();
                this.save = loadSave();
                this.audio.applyVolumes();
                this.ui.hideSettings();
            }
        );
    }
}

// Level-up batching. Called from gainExp via Player; we patch Player here to notify.
// We do this by monkey-patching gainExp to bump a counter on the running game.
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

// Entity classes: Player, Enemy, Projectile, ExpOrb, Particle, FloatingText.
// All physics is frame-rate independent (delta-time in seconds).

import { CONFIG } from './config.js';
import { PASSIVES, WEAPONS } from './data.js';

export class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.size = CONFIG.PLAYER_SIZE;
        this.baseMaxHp = 100;
        this.maxHp = this.baseMaxHp;
        this.hp = this.baseMaxHp;
        this.level = 1;
        this.exp = 0;
        this.expToNext = 50;
        this.weapons = [];
        this.passives = Object.create(null);
        this.invincible = false;
        this.invincibleTimer = 0;
        this.dead = false;
    }

    update(dt, game) {
        // Movement ---------------------------------------------------------
        const v = game.input.getMoveVector();
        const speed = CONFIG.PLAYER_SPEED * this.getSpeedMult();
        this.x += v.x * speed * dt;
        this.y += v.y * speed * dt;

        // Weapons ----------------------------------------------------------
        for (const w of this.weapons) w.update(dt, this, game);

        // I-frames ---------------------------------------------------------
        if (this.invincible) {
            this.invincibleTimer -= dt;
            if (this.invincibleTimer <= 0) this.invincible = false;
        }

        // Regen ------------------------------------------------------------
        const regen = this._passiveSum('hpRegen');
        if (regen) this.heal(regen * dt);
    }

    addPassive(def) {
        this.passives[def.id] ??= { def, count: 0 };
        if (this.passives[def.id].count >= CONFIG.PASSIVE_MAX_STACK) return;
        this.passives[def.id].count++;
        this.recalculateStats();
    }

    _passiveSum(key) {
        let total = 0;
        for (const id in this.passives) {
            const p = this.passives[id];
            if (p.def.effect[key] !== undefined) total += p.def.effect[key] * p.count;
        }
        return total;
    }

    _passiveMult(key) {
        let mult = 1;
        for (const id in this.passives) {
            const p = this.passives[id];
            if (p.def.effect[key] !== undefined) mult *= Math.pow(1 + p.def.effect[key], p.count);
        }
        return mult;
    }

    recalculateStats() {
        const prevMaxHp = this.maxHp;
        this.maxHp = this.baseMaxHp * this._passiveMult('maxHpMult');
        this.hp += (this.maxHp - prevMaxHp);
        this.hp = Math.min(this.hp, this.maxHp);
    }

    getDamageMult()  { return this._passiveMult('damageMult'); }
    getAreaMult()    { return this._passiveMult('areaMult'); }
    getCooldownMult(){
        // cooldownMult.effect is negative (-0.08 => 8% faster). Multiply safely.
        let mult = 1;
        for (const id in this.passives) {
            const p = this.passives[id];
            const v = p.def.effect.cooldownMult;
            if (v !== undefined) mult *= Math.pow(1 + v, p.count);
        }
        return Math.max(0.2, mult);
    }
    getSpeedMult()   { return this._passiveMult('speedMult'); }
    getExpMult()     { return this._passiveMult('expMult'); }
    getMagnetRange() {
        let mult = 1;
        for (const id in this.passives) {
            const p = this.passives[id];
            const v = p.def.effect.magnetMult;
            if (v !== undefined) mult *= Math.pow(1 + v, p.count);
        }
        return CONFIG.MAGNET_BASE * mult;
    }
    getArmor() { return this._passiveSum('armor'); }

    gainExp(amount) {
        this.exp += amount * this.getExpMult();
        const levelUps = [];
        while (this.exp >= this.expToNext) {
            this.exp -= this.expToNext;
            this.level++;
            this.expToNext = Math.floor(this.expToNext * 1.2);
            this.hp = Math.min(this.hp + 20, this.maxHp);
            levelUps.push(this.level);
        }
        return levelUps;
    }

    takeDamage(damage, game) {
        if (this.invincible || this.dead) return;
        const taken = Math.max(1, damage - this.getArmor());
        this.hp -= taken;
        this.invincible = true;
        this.invincibleTimer = CONFIG.INVINCIBILITY_TIME;
        game?.onPlayerHurt?.(taken);
        if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    }

    heal(amount) { this.hp = Math.min(this.hp + amount, this.maxHp); }

    render(ctx) {
        // Don't make the player fully disappear during i-frames: strobe alpha.
        const strobe = this.invincible ? (Math.floor(performance.now() / 60) % 2 === 0 ? 0.4 : 1) : 1;
        ctx.save();
        ctx.globalAlpha = strobe;

        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2.2);
        grad.addColorStop(0, 'rgba(100,200,255,0.35)');
        grad.addColorStop(1, 'rgba(100,200,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 2.2, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#44aaff';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#cfeaff';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 0.55, 0, Math.PI * 2); ctx.fill();

        // Garlic aura ring
        const garlic = this.weapons.find(w => w.id === 'garlic');
        if (garlic) {
            const range = garlic.getRange(this);
            const t = performance.now() / 400;
            ctx.strokeStyle = `rgba(160,255,160,${0.25 + Math.sin(t) * 0.08})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x, this.y, range, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    }
}

// Kept for API compatibility (previously injected the Weapon class).
export function registerWeaponClass(_cls) { /* noop */ }

// ---------------------------------------------------------------------------
// Enemy
// ---------------------------------------------------------------------------
export class Enemy {
    constructor(x, y, type, hpMult, dmgMult) {
        this.x = x; this.y = y;
        this.type = type;
        this.size = type.size;
        this.maxHp = type.hp * hpMult;
        this.hp = this.maxHp;
        this.speed = type.speed;
        this.damage = type.damage * dmgMult;
        this.expValue = type.exp;
        this.color = type.color;
        this.id = type.id;
        this.boss = !!type.boss;
        this.flashTimer = 0;
        this.ability = type.ability;
        this.abilityTimer = 3;
    }

    update(dt, game) {
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01) {
            this.x += (dx / d) * this.speed * dt;
            this.y += (dy / d) * this.speed * dt;
        }
        if (this.flashTimer > 0) this.flashTimer -= dt;

        if (this.boss) {
            this.abilityTimer -= dt;
            if (this.abilityTimer <= 0) {
                this.abilityTimer = this.ability === 'summon' ? 6 : 4.5;
                game.onBossAbility?.(this);
            }
        }
    }

    takeDamage(damage) { this.hp -= damage; this.flashTimer = 0.08; }

    render(ctx) {
        ctx.save();
        if (this.flashTimer > 0) {
            ctx.fillStyle = '#ffffff';
        } else {
            ctx.fillStyle = this.color;
        }
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 0.5, 0, Math.PI * 2); ctx.fill();

        // HP bar
        const pct = Math.max(0, this.hp / this.maxHp);
        const w = this.boss ? 80 : 30;
        ctx.fillStyle = '#222';
        ctx.fillRect(this.x - w / 2, this.y - this.size - 10, w, 4);
        ctx.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa33' : '#ff4444';
        ctx.fillRect(this.x - w / 2, this.y - this.size - 10, w * pct, 4);

        if (this.boss) {
            ctx.strokeStyle = '#ff33aa';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Projectile
// ---------------------------------------------------------------------------
export class Projectile {
    constructor(x, y, angle, def, damage, level, player) {
        this.x = x; this.y = y;
        this.startX = x; this.startY = y;
        this.angle = angle;
        this.def = def;
        this.damage = damage;
        this.level = level;
        this.size = 8;
        this.speed = def.speed || 300;
        this.piercing = !!def.piercing;
        this.homing = !!def.homing;
        this.arc = !!def.arc;
        this.boomerang = !!def.boomerang;
        this.explode = !!def.explode;
        this.explodeRadius = def.explodeRadius || 60;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.life = 4; // seconds
        this.hitEnemies = new Set();
        this.shouldRemove = false;
        this.travelDist = 0;
        this.maxDist = (def.baseRange || 300) * (player ? player.getAreaMult() : 1);
        this.id = def.id;
    }

    update(dt, game) {
        if (this.homing && this.hitEnemies.size === 0) {
            const target = game.spatial.findNearestEnemy(this.x, this.y, 9999);
            if (target) {
                const ta = Math.atan2(target.y - this.y, target.x - this.x);
                let diff = ta - this.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.angle += diff * Math.min(1, 6 * dt);
                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;
            }
        }

        if (this.arc) {
            this.vy += 420 * dt; // gravity
        }

        if (this.boomerang) {
            const d = Math.hypot(this.x - this.startX, this.y - this.startY);
            if (d > this.maxDist * 0.5) {
                const ra = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                this.vx = Math.cos(ra) * this.speed;
                this.vy = Math.sin(ra) * this.speed;
            }
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.travelDist += Math.hypot(this.vx, this.vy) * dt;
        this.life -= dt;

        if (this.travelDist > this.maxDist || this.life <= 0) {
            this._onEnd(game);
            this.shouldRemove = true;
        }

        if (this.boomerang) {
            const dp = Math.hypot(this.x - game.player.x, this.y - game.player.y);
            if (dp < 24 && this.travelDist > 60) {
                this._onEnd(game);
                this.shouldRemove = true;
            }
        }
    }

    _onEnd(game) {
        if (this.explode) {
            game.audio.explosion();
            for (const enemy of game.enemies) {
                const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                if (d < this.explodeRadius) enemy.takeDamage(this.damage * 0.6);
            }
            game.createParticles(this.x, this.y, '#ff8800', 20);
            game.shake(0.15);
        }
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        switch (this.id) {
            case 'knife':
                ctx.fillStyle = '#e0e6ee';
                ctx.fillRect(-12, -2, 24, 4);
                break;
            case 'magic_wand':
                ctx.fillStyle = '#aa66ff';
                ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.beginPath(); ctx.arc(-2, -2, 2.2, 0, Math.PI * 2); ctx.fill();
                break;
            case 'axe':
                ctx.fillStyle = '#b0b5b8';
                ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
                break;
            case 'cross':
                ctx.fillStyle = '#fff3a0';
                ctx.fillRect(-10, -3, 20, 6);
                ctx.fillRect(-3, -10, 6, 20);
                break;
            case 'fire_wand':
                ctx.fillStyle = '#ff6600';
                ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ffcc00';
                ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
                break;
            default:
                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Exp Orb
// ---------------------------------------------------------------------------
export class ExpOrb {
    constructor(x, y, value) {
        this.x = x; this.y = y;
        this.value = value;
        this.size = 4 + Math.log(value + 1) * 1.5;
        this.shouldRemove = false;
        this.magnetSpeed = 0;
        this.life = CONFIG.EXP_ORB_LIFETIME;
    }

    update(dt, game) {
        this.life -= dt;
        if (this.life <= 0) { this.shouldRemove = true; return; }
        const p = game.player;
        const dx = p.x - this.x;
        const dy = p.y - this.y;
        const d = Math.hypot(dx, dy);
        const mag = p.getMagnetRange();

        if (d < CONFIG.PICKUP_DISTANCE) {
            p.gainExp(this.value);
            game.createFloatingText(`+${this.value}XP`, p.x, p.y - 40, '#66bbff');
            game.audio.pickup();
            this.shouldRemove = true;
            return;
        }
        if (d < mag) {
            this.magnetSpeed = Math.min(this.magnetSpeed + 600 * dt, 560);
            this.x += (dx / d) * this.magnetSpeed * dt;
            this.y += (dy / d) * this.magnetSpeed * dt;
        }
    }

    render(ctx) {
        const a = this.life < 2 ? Math.max(0, this.life / 2) : 1;
        ctx.save(); ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2.2);
        g.addColorStop(0, 'rgba(100,180,255,0.55)');
        g.addColorStop(1, 'rgba(100,180,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7ab8ff';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Particle / FloatingText
// ---------------------------------------------------------------------------
export class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.size = Math.random() * 4 + 2;
        this.life = 1;
        this.decay = Math.random() * 1.5 + 1;
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * 180 + 60;
        this.vx = Math.cos(a) * s;
        this.vy = Math.sin(a) * s;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= Math.pow(0.2, dt);
        this.vy *= Math.pow(0.2, dt);
        this.life -= this.decay * dt;
        this.size *= Math.pow(0.3, dt);
    }
    render(ctx) {
        if (this.life <= 0) return;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
}

export class FloatingText {
    constructor(text, x, y, color) {
        this.text = text; this.x = x; this.y = y; this.color = color;
        this.life = 1; this.vy = -60;
    }
    update(dt) { this.y += this.vy * dt; this.life -= 1.2 * dt; }
    render(ctx) {
        if (this.life <= 0) return;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}

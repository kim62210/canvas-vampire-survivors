// Weapon behaviour, decoupled from the weapon catalogue in data.js.
// Each weapon is a single class; specific behaviours live in `fire*()`.

import { Projectile } from './entities.js';

export class Weapon {
    constructor(def) {
        this.def = def;
        this.id = def.id;
        this.name = def.name;
        this.icon = def.icon;
        this.level = 1;
        this.cooldown = 0;
    }

    levelUp() {
        this.level++;
    }

    update(dt, player, game) {
        this.cooldown -= dt;
        if (this.cooldown <= 0) {
            this.fire(player, game);
            this.cooldown = this.getCooldown(player);
        }
    }

    getDamage(player) {
        return this.def.baseDamage * (1 + (this.level - 1) * 0.2) * player.getDamageMult();
    }

    getCooldown(player) {
        return this.def.baseCooldown * Math.pow(0.92, this.level - 1) * player.getCooldownMult();
    }

    getRange(player) {
        return this.def.baseRange * (1 + (this.level - 1) * 0.1) * player.getAreaMult();
    }

    fire(player, game) {
        switch (this.def.type) {
            case 'melee':
                return this._fireMelee(player, game);
            case 'projectile':
                return this._fireProjectile(player, game);
            case 'instant':
                return this._fireInstant(player, game);
            case 'aura':
                return this._fireAura(player, game);
        }
    }

    _fireMelee(player, game) {
        const range = this.getRange(player);
        const dmg = this.getDamage(player);
        const hit = new Set();
        for (const enemy of game.enemies) {
            const dx = enemy.x - player.x;
            if (Math.abs(dx) > range) continue;
            if (Math.abs(enemy.y - player.y) > 40) continue;
            if (hit.has(enemy)) continue;
            hit.add(enemy);
            enemy.takeDamage(dmg);
            game.createFloatingText(Math.round(dmg), enemy.x, enemy.y - 20, '#ffaa00');
        }
        game.createParticles(player.x - range / 2, player.y, '#ffaa00', 5);
        game.createParticles(player.x + range / 2, player.y, '#ffaa00', 5);
        game.audio.shoot();
    }

    _fireProjectile(player, game) {
        const count = this.def.projectileCount + Math.floor((this.level - 1) / 2);
        const spreadDeg = count > 1 ? 14 : 0;
        const target = game.spatial.findNearestEnemy(player.x, player.y, this.getRange(player));
        if (!target) return;
        const base = Math.atan2(target.y - player.y, target.x - player.x);
        for (let i = 0; i < count; i++) {
            const offset = ((i - (count - 1) / 2) * spreadDeg * Math.PI) / 180;
            game.projectiles.push(
                new Projectile(
                    player.x,
                    player.y,
                    base + offset,
                    this.def,
                    this.getDamage(player),
                    this.level,
                    player
                )
            );
        }
        game.audio.shoot();
    }

    _fireInstant(player, game) {
        const range = this.getRange(player);
        const dmg = this.getDamage(player);
        const targets = game.enemies.filter(
            (e) => Math.hypot(e.x - player.x, e.y - player.y) < range
        );
        if (!targets.length) return;
        const target = targets[Math.floor(Math.random() * targets.length)];
        target.takeDamage(dmg);
        game.createFloatingText(Math.round(dmg), target.x, target.y - 20, '#ffff66');
        game.createParticles(target.x, target.y, '#ffff66', 14);
        game.audio.shoot();

        if (this.def.chain && this.level >= 3) {
            let current = target;
            const chained = new Set([current]);
            for (let i = 0; i < this.def.chainCount; i++) {
                let nearest = null,
                    minD = Infinity;
                for (const e of game.enemies) {
                    if (chained.has(e)) continue;
                    const d = Math.hypot(e.x - current.x, e.y - current.y);
                    if (d < 180 && d < minD) {
                        minD = d;
                        nearest = e;
                    }
                }
                if (!nearest) break;
                nearest.takeDamage(dmg * 0.7);
                game.createParticles(nearest.x, nearest.y, '#ffff66', 8);
                chained.add(nearest);
                current = nearest;
            }
        }
    }

    _fireAura(player, game) {
        const range = this.getRange(player);
        // Aura fires every baseCooldown seconds; damage is burst (not per-frame).
        const dmg = this.getDamage(player);
        for (const enemy of game.enemies) {
            const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (d < range) enemy.takeDamage(dmg);
        }
        if (Math.random() < 0.4) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * range;
            game.createParticles(
                player.x + Math.cos(a) * r,
                player.y + Math.sin(a) * r,
                '#88ff88',
                1
            );
        }
    }
}

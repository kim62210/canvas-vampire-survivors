/**
 * @module skills
 * @description iter-27 active skills — single-slot abilities the player
 * fires manually with the special key / touch button. Each archetype gets
 * a thematic skill at run start; the fifth ('lifeline') is a universal
 * panic heal you can swap into via a level-up card later.
 *
 * Design notes:
 *   - All effects run on the host (the only authoritative simulator).
 *     Guests trigger by sending a `guest:event {type:'activeSkill'}` so
 *     the host applies the world change for them.
 *   - Cooldown is tracked on the player itself (`activeSkillCd` /
 *     `activeSkillReady` time) so it survives Pause and gets serialised
 *     into host:tick for HUD progress.
 *   - `fire(player, game)` returns true on success. Skills decide their
 *     own targeting (nearest enemy, self, etc).
 *
 * Exports:
 *   - ACTIVE_SKILLS: id → def
 *   - DEFAULT_SKILL_FOR_CLASS: classId → skillId
 */

import { CONFIG } from './config.js';

/**
 * Helper: pick a fan of enemies inside a radius (sorted by distance)
 * for AOE skills. We avoid spatial hash queries here so this works on
 * test fixtures that don't construct one.
 */
function enemiesInRadius(game, x, y, radius) {
    const out = [];
    for (const e of game.enemies || []) {
        const d = Math.hypot(e.x - x, e.y - y);
        if (d <= radius) out.push({ e, d });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
}

export const ACTIVE_SKILLS = {
    // 도적 — 빠른 대쉬: 0.4초 무적 + 진행 방향으로 텔레포트.
    dash: {
        id: 'dash',
        name: '그림자 도약',
        icon: '💨',
        description: '진행 방향으로 즉시 이동 + 짧은 무적',
        cooldown: 8,
        fire(player, game) {
            // Last move vector (or default forward) becomes the dash dir.
            let vx = player.vx;
            let vy = player.vy;
            if (Math.hypot(vx || 0, vy || 0) < 0.05) {
                const last = game._lastMoveVec || { x: 1, y: 0 };
                vx = last.x;
                vy = last.y;
            }
            const len = Math.hypot(vx, vy) || 1;
            const dist = 220;
            player.x += (vx / len) * dist;
            player.y += (vy / len) * dist;
            const W = CONFIG.ARENA_WIDTH ?? CONFIG.CANVAS_WIDTH;
            const H = CONFIG.ARENA_HEIGHT ?? CONFIG.CANVAS_HEIGHT;
            player.x = Math.max(player.size, Math.min(W - player.size, player.x));
            player.y = Math.max(player.size, Math.min(H - player.size, player.y));
            player.invincible = true;
            player.invincibleTimer = Math.max(player.invincibleTimer || 0, 0.5);
            game.createParticles?.(player.x, player.y, '#7ad7ff', 18);
            game.audio?.pickup?.();
            return true;
        }
    },
    // 워리어 — 충격파: 주변 모든 적에게 큰 피해 + 넉백.
    blast: {
        id: 'blast',
        name: '충격파',
        icon: '💥',
        description: '주변 적 광역 피해 + 밀어냄',
        cooldown: 14,
        fire(player, game) {
            const radius = 200;
            const damage = 45 * (player.getDamageMult ? player.getDamageMult() : 1);
            const hits = enemiesInRadius(game, player.x, player.y, radius);
            for (const { e } of hits) {
                e.takeDamage(damage);
                const ang = Math.atan2(e.y - player.y, e.x - player.x);
                e.x += Math.cos(ang) * 60;
                e.y += Math.sin(ang) * 60;
            }
            game.createParticles?.(player.x, player.y, '#ffd166', 32);
            game.shake?.(0.4);
            game.audio?.explosion?.();
            return hits.length > 0 || true;
        }
    },
    // 마법사 — 시간 정지: 5초간 모든 적 70% 느려짐.
    timeSlow: {
        id: 'timeSlow',
        name: '시간 정지',
        icon: '⌛',
        description: '5초간 적 이동 70% 감속',
        cooldown: 28,
        fire(player, game) {
            for (const e of game.enemies || []) {
                e.slowTimer = Math.max(e.slowTimer || 0, 5);
                e.slowPct = Math.max(e.slowPct || 0, 0.7);
            }
            game.effects?.flash?.('#88ddff', 0.5);
            game.audio?.levelUp?.();
            return true;
        }
    },
    // 사제 — 신성한 빛: 자신 + 가장 가까운 동료 50% HP 회복.
    holyLight: {
        id: 'holyLight',
        name: '신성한 빛',
        icon: '🌟',
        description: '본인 + 가장 가까운 동료 HP 50% 회복',
        cooldown: 22,
        fire(player, game) {
            const candidates = [];
            if (game.player && game.player !== player && !game.player.dead) {
                candidates.push(game.player);
            }
            if (game.remotePlayers) {
                for (const rp of game.remotePlayers.values()) {
                    if (rp !== player && !rp.dead) candidates.push(rp);
                }
            }
            candidates.sort(
                (a, b) =>
                    Math.hypot(a.x - player.x, a.y - player.y) -
                    Math.hypot(b.x - player.x, b.y - player.y)
            );
            const ally = candidates[0];
            const heal = (p) => {
                if (!p || p.dead) return;
                const amount = Math.floor(p.maxHp * 0.5);
                if (typeof p.heal === 'function') p.heal(amount);
                else p.hp = Math.min(p.maxHp, p.hp + amount);
                game.createFloatingText?.(`+${amount}❤`, p.x, p.y - 30, '#7af0c2');
            };
            heal(player);
            if (ally) heal(ally);
            game.createParticles?.(player.x, player.y, '#ffeebb', 20);
            game.audio?.pickup?.();
            return true;
        }
    },
    // 누구나 — 패닉 라이프라인: HP 즉시 30% 회복.
    lifeline: {
        id: 'lifeline',
        name: '구명 부적',
        icon: '🍀',
        description: 'HP 30% 즉시 회복 + 2초 무적',
        cooldown: 30,
        fire(player, game) {
            const amount = Math.floor(player.maxHp * 0.3);
            if (typeof player.heal === 'function') player.heal(amount);
            else player.hp = Math.min(player.maxHp, player.hp + amount);
            player.invincible = true;
            player.invincibleTimer = Math.max(player.invincibleTimer || 0, 2);
            game.createFloatingText?.(`+${amount}❤`, player.x, player.y - 30, '#88ffaa');
            game.createParticles?.(player.x, player.y, '#88ffaa', 16);
            return true;
        }
    }
};

export const DEFAULT_SKILL_FOR_CLASS = {
    warrior: 'blast',
    mage: 'timeSlow',
    rogue: 'dash',
    priest: 'holyLight'
};

export function getSkillById(id) {
    return ACTIVE_SKILLS[id] || null;
}

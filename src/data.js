/**
 * @module data
 * @description Pure-data catalogue: weapons, passives, enemies, bosses, wave
 * director timeline, achievement definitions and unlock map. Behaviour lives
 * elsewhere (`weapons.js`, `entities.js`, `achievements.js`); this module is
 * intentionally side-effect free so it can be diffed during balancing.
 *
 * Dependencies: none.
 *
 * Exports:
 *   - {Record<string, WeaponDef>} WEAPONS
 *   - {Record<string, PassiveDef>} PASSIVES
 *   - {Record<string, EnemyDef>} ENEMIES
 *   - {Record<string, BossDef>} BOSSES
 *   - {WaveDef[]} WAVES
 *   - {AchievementDef[]} ACHIEVEMENTS
 *   - {Record<string, UnlockDef>} UNLOCKS
 */

// ---------------------------------------------------------------------------
// Weapons
// Level scaling is uniform: damage +20% per level, cooldown ×0.92, range +10%.
// Level 5 triggers a weapon's "evolution" flag (see weapons.js).
// ---------------------------------------------------------------------------
export const WEAPONS = {
    WHIP: {
        id: 'whip',
        name: 'Whip',
        icon: '⚔️',
        description: 'Lashes to both sides of the hero. Evolves: full circle sweep.',
        baseDamage: 20,
        baseCooldown: 1.5,
        baseRange: 90,
        projectileCount: 1,
        piercing: false,
        type: 'melee',
        evolveLevel: 5,
        evolveName: 'Bloody Sweep'
    },
    MAGIC_WAND: {
        id: 'magic_wand',
        name: 'Magic Wand',
        icon: '🔮',
        description: 'Homing bolt that seeks the closest foe. Evolves: triple volley.',
        baseDamage: 15,
        baseCooldown: 1.2,
        baseRange: 320,
        projectileCount: 1,
        piercing: false,
        type: 'projectile',
        speed: 420,
        homing: true,
        evolveLevel: 5,
        evolveName: 'Seeker Storm'
    },
    KNIFE: {
        id: 'knife',
        name: 'Knife',
        icon: '🗡️',
        description: 'Piercing blade thrown forward. Evolves: wide 5-blade fan.',
        baseDamage: 12,
        baseCooldown: 0.4,
        baseRange: 420,
        projectileCount: 1,
        piercing: true,
        type: 'projectile',
        speed: 620,
        evolveLevel: 5,
        evolveName: 'Blade Fan'
    },
    ORBIT: {
        id: 'orbit',
        name: 'Orbiter',
        icon: '💫',
        description: 'Spinning shards circle the hero. Evolves: two rings spinning.',
        baseDamage: 16,
        baseCooldown: 0.4, // used as "tick" for damage re-hit window
        baseRange: 120, // orbit radius
        projectileCount: 2,
        piercing: true,
        type: 'orbit',
        evolveLevel: 5,
        evolveName: 'Twin Halo'
    },
    LIGHTNING: {
        id: 'lightning',
        name: 'Lightning',
        icon: '⚡',
        description: 'Smites a random foe. Lv3+ chains. Evolves: storm burst.',
        baseDamage: 35,
        baseCooldown: 3.0,
        baseRange: 420,
        piercing: true,
        type: 'instant',
        chain: true,
        chainCount: 3,
        evolveLevel: 5,
        evolveName: 'Thunder Call'
    },
    MINE: {
        id: 'mine',
        name: 'Area Mine',
        icon: '💣',
        description: 'Drops a mine that arms and detonates. Evolves: double-stack.',
        baseDamage: 45,
        baseCooldown: 2.2,
        baseRange: 100, // explosion radius
        projectileCount: 1,
        piercing: true,
        type: 'mine',
        fuse: 1.2,
        evolveLevel: 5,
        evolveName: 'Cluster Mine'
    },
    GARLIC: {
        id: 'garlic',
        name: 'Garlic',
        icon: '🧄',
        description: 'Damaging aura around the hero.',
        baseDamage: 5,
        baseCooldown: 0.2,
        baseRange: 110,
        piercing: true,
        type: 'aura',
        continuous: true
    }
};

// ---------------------------------------------------------------------------
// Passives (stackable up to CONFIG.PASSIVE_MAX_STACK)
// ---------------------------------------------------------------------------
export const PASSIVES = {
    MAX_HP: {
        id: 'max_hp',
        name: 'Vitality',
        icon: '❤️',
        description: 'Max HP +20%',
        effect: { maxHpMult: 0.2 }
    },
    RECOVERY: {
        id: 'recovery',
        name: 'Recovery',
        icon: '💚',
        description: 'Regen +0.5 HP/s',
        effect: { hpRegen: 0.5 }
    },
    ARMOR: {
        id: 'armor',
        name: 'Armor',
        icon: '🛡️',
        description: 'Damage taken -1',
        effect: { armor: 1 }
    },
    MOVESPEED: {
        id: 'movespeed',
        name: 'Swiftness',
        icon: '👟',
        description: 'Move speed +10%',
        effect: { speedMult: 0.1 }
    },
    MIGHT: {
        id: 'might',
        name: 'Might',
        icon: '💪',
        description: 'Damage +10%',
        effect: { damageMult: 0.1 }
    },
    AREA: {
        id: 'area',
        name: 'Area',
        icon: '📏',
        description: 'Weapon range +10%',
        effect: { areaMult: 0.1 }
    },
    COOLDOWN: {
        id: 'cooldown',
        name: 'Cooldown',
        icon: '⏱️',
        description: 'Attack speed +8%',
        effect: { cooldownMult: -0.08 }
    },
    MAGNET: {
        id: 'magnet',
        name: 'Magnet',
        icon: '🧲',
        description: 'Pickup range +25%',
        effect: { magnetMult: 0.25 }
    },
    GROWTH: {
        id: 'growth',
        name: 'Growth',
        icon: '📈',
        description: 'XP gain +10%',
        effect: { expMult: 0.1 }
    },
    LUCK: {
        id: 'luck',
        name: 'Luck',
        icon: '🍀',
        description: 'Crit chance +5%',
        effect: { critChance: 0.05 }
    }
};

// ---------------------------------------------------------------------------
// Enemies
// Five distinct archetypes + legacy types kept for backwards compat.
// New archetype flags (all optional):
//   ranged:     fires projectiles at the player
//   splitter:   on death, spawns splitChildren × ENEMIES.splitInto
//   dasher:     charges forward in short bursts
//   shielded:   takes reduced damage until shield breaks
// ---------------------------------------------------------------------------
export const ENEMIES = {
    BAT: {
        id: 'bat',
        name: 'Bat',
        archetype: 'chaser',
        hp: 15,
        speed: 110,
        damage: 10,
        exp: 10,
        color: '#8844ff',
        size: 12
    },
    ZOMBIE: {
        id: 'zombie',
        name: 'Zombie',
        archetype: 'chaser',
        hp: 30,
        speed: 70,
        damage: 15,
        exp: 15,
        color: '#44aa44',
        size: 18
    },
    SKELETON: {
        id: 'skeleton',
        name: 'Skeleton',
        archetype: 'chaser',
        hp: 25,
        speed: 95,
        damage: 12,
        exp: 12,
        color: '#dddddd',
        size: 14
    },
    WOLF: {
        id: 'wolf',
        name: 'Dire Wolf',
        archetype: 'dasher',
        dasher: true,
        dashSpeed: 320,
        dashInterval: 3.5,
        dashDuration: 0.6,
        hp: 40,
        speed: 150,
        damage: 20,
        exp: 20,
        color: '#aa6644',
        size: 16
    },
    GOLEM: {
        id: 'golem',
        name: 'Golem',
        archetype: 'shielded',
        shielded: true,
        shieldHp: 60,
        damageReduction: 0.5,
        hp: 120,
        speed: 45,
        damage: 30,
        exp: 50,
        color: '#888888',
        size: 28
    },
    GHOST: {
        id: 'ghost',
        name: 'Ghost',
        archetype: 'chaser',
        hp: 20,
        speed: 130,
        damage: 18,
        exp: 18,
        color: '#88ccff',
        size: 15,
        ghost: true
    },
    // --- New archetypes --------------------------------------------------
    MAGE: {
        id: 'mage',
        name: 'Cultist',
        archetype: 'ranged',
        ranged: true,
        firingRange: 360,
        keepDistance: 260,
        projectileSpeed: 220,
        projectileDamage: 14,
        fireCooldown: 2.4,
        hp: 28,
        speed: 70,
        damage: 8,
        exp: 22,
        color: '#cc44cc',
        size: 14
    },
    SLIME: {
        id: 'slime',
        name: 'Slime',
        archetype: 'splitter',
        splitter: true,
        splitCount: 2,
        hp: 55,
        speed: 65,
        damage: 14,
        exp: 24,
        color: '#33cc88',
        size: 20
    },
    SLIMELING: {
        id: 'slimeling',
        name: 'Slimeling',
        archetype: 'chaser',
        hp: 18,
        speed: 105,
        damage: 8,
        exp: 6,
        color: '#66ddaa',
        size: 10
    }
};

// Splitter produces this type (lookup by id to avoid circular assignment).
ENEMIES.SLIME.splitInto = 'slimeling';

// ---------------------------------------------------------------------------
// Bosses
// Mid-boss at 5:00, final boss at 10:00 (default). Each has a signature ability.
// ---------------------------------------------------------------------------
export const BOSSES = {
    REAPER: {
        id: 'reaper',
        name: 'The Reaper',
        hp: 2500,
        speed: 80,
        damage: 40,
        exp: 500,
        color: '#220033',
        size: 48,
        boss: true,
        ability: 'summon',
        spawnAt: 300 // 5 minutes
    },
    VOID_LORD: {
        id: 'void_lord',
        name: 'Void Lord',
        hp: 6000,
        speed: 60,
        damage: 60,
        exp: 1200,
        color: '#550077',
        size: 64,
        boss: true,
        ability: 'charge',
        spawnAt: 600 // 10 minutes
    }
};

// ---------------------------------------------------------------------------
// Wave director: each entry is a window [from, to) (seconds) listing the pool
// of enemies that may spawn, plus a spawn-rate multiplier. The director falls
// back to the final entry once gameTime exceeds the last window.
// ---------------------------------------------------------------------------
export const WAVES = [
    { from: 0, to: 30, pool: ['bat', 'zombie'], spawnMult: 1.0, label: 'Opening' },
    { from: 30, to: 60, pool: ['bat', 'zombie', 'skeleton'], spawnMult: 1.1, label: 'Wave 2' },
    {
        from: 60,
        to: 90,
        pool: ['zombie', 'skeleton', 'mage'],
        spawnMult: 1.15,
        label: 'Cultists'
    },
    {
        from: 90,
        to: 120,
        pool: ['skeleton', 'wolf', 'ghost', 'mage'],
        spawnMult: 1.2,
        label: 'Pack'
    },
    {
        from: 120,
        to: 180,
        pool: ['wolf', 'ghost', 'slime', 'mage'],
        spawnMult: 1.3,
        label: 'Splitters'
    },
    {
        from: 180,
        to: 240,
        pool: ['wolf', 'golem', 'ghost', 'slime'],
        spawnMult: 1.4,
        label: 'Vanguard'
    },
    {
        from: 240,
        to: 300,
        pool: ['golem', 'ghost', 'slime', 'mage'],
        spawnMult: 1.5,
        label: 'Pressure'
    },
    {
        from: 300,
        to: 420,
        pool: ['wolf', 'golem', 'ghost', 'slime', 'mage'],
        spawnMult: 1.6,
        label: 'Post-Reaper'
    },
    {
        from: 420,
        to: 600,
        pool: ['golem', 'slime', 'mage', 'ghost', 'wolf'],
        spawnMult: 1.75,
        label: 'Escalation'
    },
    {
        from: 600,
        to: Infinity,
        pool: ['golem', 'slime', 'mage', 'ghost', 'wolf', 'skeleton'],
        spawnMult: 2.0,
        label: 'Endgame'
    }
];

// ---------------------------------------------------------------------------
// Achievements: condition evaluated at end-of-run + continuously in-game.
// `check(ctx)` returns true when unlocked. `ctx` = { game, run }
// ---------------------------------------------------------------------------
export const ACHIEVEMENTS = [
    {
        id: 'first_blood',
        name: 'First Blood',
        icon: '🗡️',
        description: 'Defeat your first foe.',
        check: (c) => c.game.kills >= 1
    },
    {
        id: 'slayer_100',
        name: 'Centurion',
        icon: '🎯',
        description: 'Defeat 100 foes in a single run.',
        check: (c) => c.game.kills >= 100
    },
    {
        id: 'slayer_1000',
        name: 'Legion Breaker',
        icon: '🏆',
        description: 'Defeat 1000 foes in a single run.',
        check: (c) => c.game.kills >= 1000
    },
    {
        id: 'boss_slayer',
        name: 'Reaper Down',
        icon: '☠️',
        description: 'Defeat the Reaper mid-boss.',
        check: (c) => !!c.run.bossesDefeated?.reaper
    },
    {
        id: 'void_breaker',
        name: 'Void Breaker',
        icon: '🌌',
        description: 'Defeat the Void Lord.',
        check: (c) => !!c.run.bossesDefeated?.void_lord
    },
    {
        id: 'survive_5min',
        name: 'Five-Minute Flame',
        icon: '⏱️',
        description: 'Survive 5 minutes.',
        check: (c) => c.game.gameTime >= 300
    },
    {
        id: 'survive_10min',
        name: 'Ten-Minute Titan',
        icon: '🔥',
        description: 'Survive 10 minutes.',
        check: (c) => c.game.gameTime >= 600
    },
    {
        id: 'survive_15min',
        name: 'Quarter Hour',
        icon: '⌛',
        description: 'Survive 15 minutes.',
        check: (c) => c.game.gameTime >= 900
    },
    {
        id: 'weapon_max',
        name: 'Mastery',
        icon: '🌟',
        description: 'Reach max level on any weapon.',
        check: (c) => !!c.run.maxedWeapon
    },
    {
        id: 'untouchable',
        name: 'Untouchable',
        icon: '🛡️',
        description: 'Avoid damage for 60 straight seconds.',
        check: (c) => (c.run.longestUnhit || 0) >= 60
    },
    {
        id: 'xp_hoarder',
        name: 'XP Hoarder',
        icon: '💎',
        description: 'Collect 100 XP orbs in a run.',
        check: (c) => (c.run.orbsCollected || 0) >= 100
    },
    {
        id: 'level_20',
        name: 'High Roller',
        icon: '📈',
        description: 'Reach hero level 20.',
        check: (c) => c.game.player?.level >= 20
    }
];

// ---------------------------------------------------------------------------
// Unlocks: achievement id → weapon id granted as starter-weapon option.
// ---------------------------------------------------------------------------
export const UNLOCKS = {
    first_blood: { weapon: 'magic_wand' },
    slayer_100: { weapon: 'knife' },
    survive_5min: { weapon: 'orbit' },
    boss_slayer: { weapon: 'lightning' },
    survive_10min: { weapon: 'mine' }
};

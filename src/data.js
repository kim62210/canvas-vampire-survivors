/**
 * @module data
 * @description Pure-data catalogue: weapons, passives, enemies, bosses, wave
 * director timeline, achievement definitions and unlock map. Behaviour lives
 * elsewhere (`weapons.js`, `entities.js`, `achievements.js`); this module is
 * intentionally side-effect free so it can be diffed during balancing.
 *
 * iter-27: localised the player-facing `name`, `description`, `label` and
 * `evolveName` strings into Korean. Numeric and behavioural fields (id, hp,
 * damage, effect maps, check functions, …) are unchanged so balance stays
 * identical to the upstream English build.
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
        name: '채찍',
        icon: '⚔️',
        description: '영웅 양옆을 후려친다. 진화: 360도 휘두르기.',
        baseDamage: 20,
        baseCooldown: 1.5,
        baseRange: 90,
        projectileCount: 1,
        piercing: false,
        type: 'melee',
        evolveLevel: 5,
        evolveName: '혈류 휘두르기'
    },
    MAGIC_WAND: {
        id: 'magic_wand',
        name: '마법 지팡이',
        icon: '🔮',
        description: '가장 가까운 적을 추적하는 유도탄. 진화: 3연발.',
        baseDamage: 15,
        baseCooldown: 1.2,
        baseRange: 320,
        projectileCount: 1,
        piercing: false,
        type: 'projectile',
        speed: 420,
        homing: true,
        evolveLevel: 5,
        evolveName: '추적의 폭풍'
    },
    KNIFE: {
        id: 'knife',
        name: '단검',
        icon: '🗡️',
        description: '전방으로 던지는 관통 칼날. 진화: 5날 부채.',
        baseDamage: 12,
        baseCooldown: 0.4,
        baseRange: 420,
        projectileCount: 1,
        piercing: true,
        type: 'projectile',
        speed: 620,
        evolveLevel: 5,
        evolveName: '검 부채',
        // iter-14 evolution micro-tweak: the fan also gets a flat +10% crit
        // chance on top of the player's current critChance roll. Picked up
        // by Weapon._rollCrit when the weapon `isEvolved()`.
        evolveBonusCrit: 0.1
    },
    ORBIT: {
        id: 'orbit',
        name: '회전 파편',
        icon: '💫',
        description: '영웅 주위를 도는 파편. 진화: 두 개의 고리.',
        baseDamage: 16,
        baseCooldown: 0.4, // used as "tick" for damage re-hit window
        baseRange: 120, // orbit radius
        projectileCount: 2,
        piercing: true,
        type: 'orbit',
        evolveLevel: 5,
        evolveName: '쌍둥이 후광',
        // iter-14: evolved Twin Halo also boosts shard damage by +10%.
        evolveDamageMult: 1.1
    },
    LIGHTNING: {
        id: 'lightning',
        name: '번개',
        icon: '⚡',
        description: '무작위 적을 강타. 3레벨 이상에서 연쇄. 진화: 폭풍 강타.',
        baseDamage: 35,
        baseCooldown: 3.0,
        baseRange: 420,
        piercing: true,
        type: 'instant',
        chain: true,
        chainCount: 3,
        evolveLevel: 5,
        evolveName: '천둥 부름',
        // iter-14: evolved Thunder Call rolls a +15% crit on the strikes.
        evolveBonusCrit: 0.15
    },
    MINE: {
        id: 'mine',
        name: '광역 지뢰',
        icon: '💣',
        description: '지뢰를 놓고 폭발. 진화: 더블 스택.',
        baseDamage: 45,
        baseCooldown: 2.2,
        baseRange: 100, // explosion radius
        projectileCount: 1,
        piercing: true,
        type: 'mine',
        fuse: 1.2,
        evolveLevel: 5,
        evolveName: '산탄 지뢰'
    },
    GARLIC: {
        id: 'garlic',
        name: '마늘',
        icon: '🧄',
        description: '영웅 주변에 피해 오라.',
        baseDamage: 5,
        baseCooldown: 0.2,
        baseRange: 110,
        piercing: true,
        type: 'aura',
        continuous: true
    },
    // --- v2.4 additions ---------------------------------------------------
    FROST_NOVA: {
        id: 'frost_nova',
        name: '서리 노바',
        icon: '❄️',
        description: '얼음 고리가 퍼지며 닿은 적을 둔화. 진화: 쌍 고리.',
        baseDamage: 28,
        baseCooldown: 3.2,
        baseRange: 200, // blast radius
        projectileCount: 1,
        piercing: true,
        type: 'nova',
        slowPct: 0.5,
        slowDuration: 1.2,
        evolveLevel: 5,
        evolveName: '빙하 폭포'
    },
    SOUL_DRAIN: {
        id: 'soul_drain',
        name: '영혼 흡수',
        icon: '🩸',
        description: '가장 가까운 적과 연결되어 매 틱마다 회복. 진화: 두 줄기.',
        baseDamage: 8,
        baseCooldown: 0.25, // tick rate
        baseRange: 260,
        projectileCount: 1,
        piercing: true,
        type: 'drain',
        lifestealPct: 0.25,
        evolveLevel: 5,
        evolveName: '흡혈의 줄'
    },
    BOOMERANG: {
        id: 'boomerang',
        name: '부메랑',
        icon: '🪃',
        description: '전방으로 던져지고 영웅에게 돌아옴. 진화: 쌍둥이 호.',
        baseDamage: 18,
        baseCooldown: 1.1,
        baseRange: 340,
        projectileCount: 1,
        piercing: true,
        type: 'projectile',
        speed: 380,
        boomerang: true,
        evolveLevel: 5,
        evolveName: '쌍둥이 호',
        // iter-14: Twin Arc fires 5% faster than its base cooldown formula.
        evolveCooldownMult: 0.95
    },
    // --- iter-20: Konami Code unlock --------------------------------------
    // Hidden weapon awarded on the first time the player enters the Konami
    // Code on the main menu. Behaves like a fast piercing projectile (a nod
    // to retro shoot-'em-ups). Not part of the regular drop pool — only
    // available as a starter once UNLOCKS.konami_code is earned.
    RETRO_BLASTER: {
        id: 'retro_blaster',
        name: '레트로 블래스터',
        icon: '👾',
        description: '8비트 아케이드 빔. 좁은 발사로 전방을 관통. 진화: 3연 빔.',
        baseDamage: 14,
        baseCooldown: 0.5,
        baseRange: 480,
        projectileCount: 2,
        piercing: true,
        type: 'projectile',
        speed: 700,
        evolveLevel: 5,
        evolveName: '픽셀 폭풍'
    }
};

// ---------------------------------------------------------------------------
// Passives (stackable up to CONFIG.PASSIVE_MAX_STACK)
// ---------------------------------------------------------------------------
export const PASSIVES = {
    MAX_HP: {
        id: 'max_hp',
        name: '활력',
        icon: '❤️',
        description: '최대 체력 +20%',
        effect: { maxHpMult: 0.2 }
    },
    RECOVERY: {
        id: 'recovery',
        name: '회복',
        icon: '💚',
        description: '체력 재생 +0.5/초',
        effect: { hpRegen: 0.5 }
    },
    ARMOR: {
        id: 'armor',
        name: '갑옷',
        icon: '🛡️',
        description: '받는 피해 -1',
        effect: { armor: 1 }
    },
    MOVESPEED: {
        id: 'movespeed',
        name: '신속',
        icon: '👟',
        description: '이동 속도 +10%',
        effect: { speedMult: 0.1 }
    },
    MIGHT: {
        id: 'might',
        name: '위력',
        icon: '💪',
        description: '피해 +10%',
        effect: { damageMult: 0.1 }
    },
    AREA: {
        id: 'area',
        name: '범위',
        icon: '📏',
        description: '무기 사거리 +10%',
        effect: { areaMult: 0.1 }
    },
    COOLDOWN: {
        id: 'cooldown',
        name: '재사용',
        icon: '⏱️',
        description: '공격 속도 +8%',
        effect: { cooldownMult: -0.08 }
    },
    MAGNET: {
        id: 'magnet',
        name: '자석',
        icon: '🧲',
        description: '획득 거리 +25%',
        effect: { magnetMult: 0.25 }
    },
    GROWTH: {
        id: 'growth',
        name: '성장',
        icon: '📈',
        description: '경험치 획득 +10%',
        effect: { expMult: 0.1 }
    },
    LUCK: {
        id: 'luck',
        name: '행운',
        icon: '🍀',
        description: '치명타 확률 +5%',
        effect: { critChance: 0.05 }
    },
    // --- iter-14 passives -------------------------------------------------
    DODGE: {
        id: 'dodge',
        name: '회피',
        icon: '💨',
        description: '회피 확률 +5%',
        effect: { dodgeChance: 0.05 }
    },
    MAGNET_PLUS: {
        id: 'magnet_plus',
        name: '강화 자석',
        icon: '🧲',
        description: '획득 거리 +35%',
        effect: { magnetMult: 0.35 }
    },
    DAMAGE_REDUCTION: {
        id: 'damage_reduction',
        name: '보루',
        icon: '🛡️',
        description: '받는 피해 -8%',
        effect: { damageReduction: 0.08 }
    }
};

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------
export const ENEMIES = {
    BAT: {
        id: 'bat',
        name: '박쥐',
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
        name: '좀비',
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
        name: '해골',
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
        name: '흉포한 늑대',
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
        name: '골렘',
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
        name: '유령',
        archetype: 'chaser',
        hp: 20,
        speed: 130,
        damage: 18,
        exp: 18,
        color: '#88ccff',
        size: 15,
        ghost: true
    },
    MAGE: {
        id: 'mage',
        name: '광신도',
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
        name: '슬라임',
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
        name: '새끼 슬라임',
        archetype: 'chaser',
        hp: 18,
        speed: 105,
        damage: 8,
        exp: 6,
        color: '#66ddaa',
        size: 10
    },
    // --- v2.4 additions: bomber + illusionist ---
    BOMBER: {
        id: 'bomber',
        name: '폭탄병',
        archetype: 'bomber',
        bomber: true,
        fuseRange: 80, // begins countdown when within this distance
        fuseTime: 1.4, // seconds before detonation
        blastRadius: 120,
        blastDamage: 40,
        hp: 35,
        speed: 120,
        damage: 10,
        exp: 28,
        color: '#ff6644',
        size: 14
    },
    ILLUSIONIST: {
        id: 'illusionist',
        name: '환영술사',
        archetype: 'illusionist',
        illusionist: true,
        cloneCooldown: 5.5,
        cloneCount: 2,
        hp: 42,
        speed: 95,
        damage: 12,
        exp: 30,
        color: '#cc88ff',
        size: 15
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
        name: '수확자',
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
        name: '공허의 군주',
        hp: 6000,
        speed: 60,
        damage: 60,
        exp: 1200,
        color: '#550077',
        size: 64,
        boss: true,
        ability: 'charge',
        spawnAt: 600 // 10 minutes
    },
    NECROMANCER: {
        id: 'necromancer',
        name: '강령술사',
        hp: 4200,
        speed: 70,
        damage: 50,
        exp: 850,
        color: '#3a1a4a',
        size: 54,
        boss: true,
        ability: 'summon',
        spawnAt: 450 // 7:30
    },
    CHRONO_LICH: {
        id: 'chrono_lich',
        name: '시간의 리치',
        hp: 10000,
        speed: 55,
        damage: 75,
        exp: 2000,
        color: '#0b2a4a',
        size: 72,
        boss: true,
        ability: 'charge',
        spawnAt: 720 // 12:00
    },
    ICE_QUEEN: {
        id: 'ice_queen',
        name: '얼음 여왕',
        hp: 6200,
        speed: 55,
        damage: 60,
        exp: 1300,
        color: '#88ccff',
        size: 66,
        boss: true,
        ability: 'charge',
        spawnAt: 660,
        iceQueen: true // visual flag, read by entities renderer for frost halo
    }
};

// ---------------------------------------------------------------------------
// Wave director: each entry is a window [from, to) (seconds) listing the pool
// of enemies that may spawn, plus a spawn-rate multiplier.
// ---------------------------------------------------------------------------
export const WAVES = [
    { from: 0, to: 30, pool: ['bat', 'zombie'], spawnMult: 1.0, label: '도입' },
    { from: 30, to: 60, pool: ['bat', 'zombie', 'skeleton'], spawnMult: 1.1, label: '2 웨이브' },
    {
        from: 60,
        to: 90,
        pool: ['zombie', 'skeleton', 'mage'],
        spawnMult: 1.15,
        label: '광신도'
    },
    {
        from: 90,
        to: 120,
        pool: ['skeleton', 'wolf', 'ghost', 'mage'],
        spawnMult: 1.2,
        label: '무리'
    },
    {
        from: 120,
        to: 180,
        pool: ['wolf', 'ghost', 'slime', 'mage', 'bomber'],
        spawnMult: 1.3,
        label: '분열병'
    },
    {
        from: 180,
        to: 240,
        pool: ['wolf', 'golem', 'ghost', 'slime', 'bomber'],
        spawnMult: 1.4,
        label: '선봉'
    },
    {
        from: 240,
        to: 300,
        pool: ['golem', 'ghost', 'slime', 'mage', 'illusionist'],
        spawnMult: 1.5,
        label: '압박'
    },
    {
        from: 300,
        to: 420,
        pool: ['wolf', 'golem', 'ghost', 'slime', 'mage', 'bomber', 'illusionist'],
        spawnMult: 1.6,
        label: '수확자 이후'
    },
    {
        from: 420,
        to: 600,
        pool: ['golem', 'slime', 'mage', 'ghost', 'wolf', 'illusionist'],
        spawnMult: 1.75,
        label: '격화'
    },
    {
        from: 600,
        to: Infinity,
        pool: ['golem', 'slime', 'mage', 'ghost', 'wolf', 'skeleton', 'bomber', 'illusionist'],
        spawnMult: 2.0,
        label: '종반'
    }
];

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------
export const ACHIEVEMENTS = [
    {
        id: 'first_blood',
        name: '첫 처치',
        icon: '🗡️',
        description: '첫 적을 처치하세요.',
        check: (c) => c.game.kills >= 1
    },
    {
        id: 'slayer_100',
        name: '백인장',
        icon: '🎯',
        description: '한 판에서 100명 처치.',
        check: (c) => c.game.kills >= 100
    },
    {
        id: 'slayer_1000',
        name: '군단 격파',
        icon: '🏆',
        description: '한 판에서 1000명 처치.',
        check: (c) => c.game.kills >= 1000
    },
    {
        id: 'boss_slayer',
        name: '수확자 격파',
        icon: '☠️',
        description: '수확자 중간 보스를 처치.',
        check: (c) => !!c.run.bossesDefeated?.reaper
    },
    {
        id: 'void_breaker',
        name: '공허 파괴자',
        icon: '🌌',
        description: '공허의 군주를 처치.',
        check: (c) => !!c.run.bossesDefeated?.void_lord
    },
    {
        id: 'survive_5min',
        name: '5분 불꽃',
        icon: '⏱️',
        description: '5분 생존.',
        check: (c) => c.game.gameTime >= 300
    },
    {
        id: 'survive_10min',
        name: '10분 거인',
        icon: '🔥',
        description: '10분 생존.',
        check: (c) => c.game.gameTime >= 600
    },
    {
        id: 'survive_15min',
        name: '사반의 시간',
        icon: '⌛',
        description: '15분 생존.',
        check: (c) => c.game.gameTime >= 900
    },
    {
        id: 'weapon_max',
        name: '숙련',
        icon: '🌟',
        description: '어떤 무기든 최대 레벨 도달.',
        check: (c) => !!c.run.maxedWeapon
    },
    {
        id: 'untouchable',
        name: '불가침',
        icon: '🛡️',
        description: '60초 연속 무피격.',
        check: (c) => (c.run.longestUnhit || 0) >= 60
    },
    {
        id: 'xp_hoarder',
        name: '경험치 수집가',
        icon: '💎',
        description: '한 판에서 100개 경험치 구슬 수집.',
        check: (c) => (c.run.orbsCollected || 0) >= 100
    },
    {
        id: 'level_20',
        name: '고렙 도전자',
        icon: '📈',
        description: '영웅 레벨 20 달성.',
        check: (c) => c.game.player?.level >= 20
    },
    // --- v2.4 additions ---------------------------------------------------
    {
        id: 'speed_demon',
        name: '속도의 악마',
        icon: '💨',
        description: '실시간 5분 이내에 공허의 군주 처치.',
        check: (c) =>
            !!c.run.bossesDefeated?.void_lord && (c.run.realSecondsToVoidLord || Infinity) < 300
    },
    {
        id: 'no_hit_boss',
        name: '완벽한 결투',
        icon: '🕊️',
        description: '보스전 중 무피격으로 보스 처치.',
        check: (c) => !!c.run.noHitBoss
    },
    {
        id: 'max_all',
        name: '모두 최대',
        icon: '👑',
        description: '한 판에서 모든 무기 슬롯 최대 레벨.',
        check: (c) => (c.run.maxedWeaponCount || 0) >= 6
    },
    {
        id: 'early_evolve',
        name: '조기 진화',
        icon: '🔮',
        description: '7분 전에 무기 진화.',
        check: (c) => !!c.run.evolvedBefore?.sevenMin
    },
    {
        id: 'triple_build',
        name: '3연 위협',
        icon: '🎲',
        description: '누적 3개의 서로 다른 빌드 완주.',
        check: (c) => (c.game.save?.totals?.uniqueBuilds || 0) >= 3
    },
    {
        id: 'zen_5min',
        name: '무위의 행자',
        icon: '🧘',
        description: '패시브 없이 5분 생존.',
        check: (c) => c.game.gameTime >= 300 && (c.run.passivesPicked || 0) === 0
    },
    // --- iter-20: hidden / easter-egg achievements ------------------------
    {
        id: 'konami_code',
        name: '코나미 코드',
        icon: '🎮',
        description: '전설의 치트 코드 발견. 레트로 블래스터를 해금합니다.',
        hidden: true,
        check: (c) => !!c.run.konamiCode
    },
    {
        id: 'speedrun_plus',
        name: '스피드런 플러스',
        icon: '⚡',
        description: '실시간 5분 이내에 주요 보스 처치. 스프라이트 잔상을 해금합니다.',
        hidden: true,
        check: (c) => !!c.run.fastBossClear
    },
    {
        id: 'pacifist_provoked',
        name: '평화주의자의 분노',
        icon: '🕊️',
        description: '60초 동안 0킬로 생존 — 세상이 알아서 일하게. 특별 보스 칭호를 해금합니다.',
        hidden: true,
        check: (c) => (c.run.pacifistTimer || 0) >= 60 && c.game.kills === 0
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
    survive_10min: { weapon: 'mine' },
    // v2.4 unlocks
    survive_15min: { weapon: 'boomerang' },
    void_breaker: { weapon: 'frost_nova' },
    speed_demon: { weapon: 'soul_drain' },
    // iter-20: easter-egg unlocks.
    konami_code: { weapon: 'retro_blaster' },
    speedrun_plus: { cosmetic: 'sprite_trail' },
    pacifist_provoked: { cosmetic: 'boss_title_pacifist' }
};

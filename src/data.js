// Static game data: weapons, passives, enemies, bosses.
// Keep this data-only; behaviour lives in systems/*.

export const WEAPONS = {
    WHIP: {
        id: 'whip', name: 'Whip', icon: '⚔️',
        description: 'Lashes to both sides of the hero',
        baseDamage: 20, baseCooldown: 1.5, baseRange: 90,
        projectileCount: 1, piercing: false, type: 'melee'
    },
    MAGIC_WAND: {
        id: 'magic_wand', name: 'Magic Wand', icon: '🔮',
        description: 'Homing bolt that seeks the closest foe',
        baseDamage: 15, baseCooldown: 1.2, baseRange: 320,
        projectileCount: 1, piercing: false, type: 'projectile',
        speed: 420, homing: true
    },
    KNIFE: {
        id: 'knife', name: 'Knife', icon: '🗡️',
        description: 'Piercing blade thrown forward',
        baseDamage: 12, baseCooldown: 0.4, baseRange: 420,
        projectileCount: 1, piercing: true, type: 'projectile',
        speed: 620
    },
    AXE: {
        id: 'axe', name: 'Axe', icon: '🪓',
        description: 'High-arc power attack',
        baseDamage: 40, baseCooldown: 2.0, baseRange: 260,
        projectileCount: 1, piercing: false, type: 'projectile',
        speed: 360, arc: true
    },
    CROSS: {
        id: 'cross', name: 'Cross', icon: '✝️',
        description: 'Boomerang holy strike',
        baseDamage: 25, baseCooldown: 1.8, baseRange: 260,
        projectileCount: 1, piercing: true, type: 'projectile',
        speed: 320, boomerang: true
    },
    FIRE_WAND: {
        id: 'fire_wand', name: 'Fire Wand', icon: '🔥',
        description: 'Explodes on impact, splash damage',
        baseDamage: 30, baseCooldown: 2.5, baseRange: 240,
        projectileCount: 1, piercing: false, type: 'projectile',
        speed: 300, explode: true, explodeRadius: 90
    },
    LIGHTNING: {
        id: 'lightning', name: 'Lightning', icon: '⚡',
        description: 'Smites a random foe, chains at lv3+',
        baseDamage: 35, baseCooldown: 3.0, baseRange: 420,
        piercing: true, type: 'instant', chain: true, chainCount: 3
    },
    GARLIC: {
        id: 'garlic', name: 'Garlic', icon: '🧄',
        description: 'Damaging aura around the hero',
        baseDamage: 5, baseCooldown: 0.2, baseRange: 110,
        piercing: true, type: 'aura', continuous: true
    }
};

export const PASSIVES = {
    MAX_HP:    { id: 'max_hp',    name: 'Vitality',   icon: '❤️', description: 'Max HP +20%',           effect: { maxHpMult: 0.2 } },
    RECOVERY:  { id: 'recovery',  name: 'Recovery',   icon: '💚', description: 'Regen +0.5 HP/s',       effect: { hpRegen: 0.5 } },
    ARMOR:     { id: 'armor',     name: 'Armor',      icon: '🛡️', description: 'Damage taken -1', effect: { armor: 1 } },
    MOVESPEED: { id: 'movespeed', name: 'Swiftness',  icon: '👟', description: 'Move speed +10%',       effect: { speedMult: 0.1 } },
    MIGHT:     { id: 'might',     name: 'Might',      icon: '💪', description: 'Damage +10%',           effect: { damageMult: 0.1 } },
    AREA:      { id: 'area',      name: 'Area',       icon: '📏', description: 'Weapon range +10%',     effect: { areaMult: 0.1 } },
    COOLDOWN:  { id: 'cooldown',  name: 'Cooldown',   icon: '⏱️', description: 'Attack speed +8%',      effect: { cooldownMult: -0.08 } },
    MAGNET:    { id: 'magnet',    name: 'Magnet',     icon: '🧲', description: 'Pickup range +25%',     effect: { magnetMult: 0.25 } },
    GROWTH:    { id: 'growth',    name: 'Growth',     icon: '📈', description: 'XP gain +10%',          effect: { expMult: 0.1 } }
};

export const ENEMIES = {
    BAT:      { id: 'bat',      name: 'Bat',      hp: 15,  speed: 110, damage: 10, exp: 10, color: '#8844ff', size: 12 },
    ZOMBIE:   { id: 'zombie',   name: 'Zombie',   hp: 30,  speed: 70,  damage: 15, exp: 15, color: '#44aa44', size: 18 },
    SKELETON: { id: 'skeleton', name: 'Skeleton', hp: 25,  speed: 95,  damage: 12, exp: 12, color: '#dddddd', size: 14 },
    WOLF:     { id: 'wolf',     name: 'Wolf',     hp: 40,  speed: 150, damage: 20, exp: 20, color: '#aa6644', size: 16 },
    GOLEM:    { id: 'golem',    name: 'Golem',    hp: 120, speed: 45,  damage: 30, exp: 50, color: '#888888', size: 28 },
    GHOST:    { id: 'ghost',    name: 'Ghost',    hp: 20,  speed: 130, damage: 18, exp: 18, color: '#88ccff', size: 15, ghost: true }
};

// Bosses scale with difficulty and wave index.
export const BOSSES = {
    REAPER: {
        id: 'reaper', name: 'The Reaper',  hp: 2500, speed: 80,  damage: 40, exp: 500,
        color: '#220033', size: 48, boss: true, ability: 'summon',
        spawnAt: 180   // seconds
    },
    VOID_LORD: {
        id: 'void_lord', name: 'Void Lord', hp: 6000, speed: 60, damage: 60, exp: 1200,
        color: '#550077', size: 64, boss: true, ability: 'charge',
        spawnAt: 360
    }
};

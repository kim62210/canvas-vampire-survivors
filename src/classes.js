/**
 * @module classes
 * @description iter-27 multiplayer character classes. Each class is a tiny
 * preset that swaps the starting weapon, tweaks max HP, and pins a peer
 * tint. The host applies these to its own `Player` and to each
 * `RemotePlayer` when a coop run begins so all four players read at a
 * glance.
 *
 * Solo runs ignore this module entirely — `Game.start()` only consults
 * the class table when `mpMode` is true.
 *
 * Exports:
 *   - CLASSES: Record<id, ClassDef>
 *   - DEFAULT_CLASS_ID: id used when a player joins without picking
 *   - getClassById(id): falls back to the default if id is unknown
 */

import { PASSIVES, WEAPONS } from './data.js';

// iter-27: starter passive bundles per class. Applied once in `start()` via
// `player.addPassive(def)` so each archetype reads distinctly: a warrior
// hits harder and resists more, a mage casts faster and wider, a rogue
// flits around with extra movement speed, a priest regenerates while
// expanding their garlic aura. Unknown ids are skipped silently.
export const CLASSES = {
    warrior: {
        id: 'warrior',
        name: '워리어',
        emoji: '⚔️',
        description: '튼튼한 체력 + 갑옷. 채찍 근접.',
        starterWeapon: WEAPONS.WHIP,
        maxHpDelta: 30,
        color: '#ffd166',
        starterPassives: [PASSIVES.ARMOR, PASSIVES.MIGHT]
    },
    mage: {
        id: 'mage',
        name: '마법사',
        emoji: '🔮',
        description: '빠른 마법봉 연사 + 광역. 체력 약함.',
        starterWeapon: WEAPONS.MAGIC_WAND,
        maxHpDelta: -20,
        color: '#06d6a0',
        starterPassives: [PASSIVES.COOLDOWN, PASSIVES.AREA]
    },
    rogue: {
        id: 'rogue',
        name: '도적',
        emoji: '🗡️',
        description: '단검 + 빠른 발놀림. 약함 → 회피로.',
        starterWeapon: WEAPONS.KNIFE,
        maxHpDelta: -10,
        color: '#118ab2',
        starterPassives: [PASSIVES.MOVESPEED, PASSIVES.MIGHT]
    },
    priest: {
        id: 'priest',
        name: '사제',
        emoji: '🌿',
        description: '마늘 오라 + 자가 회복. 광역 정화.',
        starterWeapon: WEAPONS.GARLIC,
        maxHpDelta: 10,
        color: '#ef476f',
        starterPassives: [PASSIVES.RECOVERY, PASSIVES.AREA]
    }
};

export const CLASS_ORDER = ['warrior', 'mage', 'rogue', 'priest'];
export const DEFAULT_CLASS_ID = 'warrior';

export function getClassById(id) {
    return CLASSES[id] || CLASSES[DEFAULT_CLASS_ID];
}

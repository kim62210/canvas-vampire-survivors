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

import { WEAPONS } from './data.js';

export const CLASSES = {
    warrior: {
        id: 'warrior',
        name: '워리어',
        emoji: '⚔️',
        description: '튼튼한 체력. 채찍으로 근접 공격.',
        starterWeapon: WEAPONS.WHIP,
        maxHpDelta: 30,
        color: '#ffd166'
    },
    mage: {
        id: 'mage',
        name: '마법사',
        emoji: '🔮',
        description: '마법봉으로 원거리 공격. 체력은 약함.',
        starterWeapon: WEAPONS.MAGIC_WAND,
        maxHpDelta: -20,
        color: '#06d6a0'
    },
    rogue: {
        id: 'rogue',
        name: '도적',
        emoji: '🗡️',
        description: '단검을 흩뿌려 사방을 공격.',
        starterWeapon: WEAPONS.KNIFE,
        maxHpDelta: -10,
        color: '#118ab2'
    },
    priest: {
        id: 'priest',
        name: '사제',
        emoji: '🌿',
        description: '마늘 오라로 주변을 정화. 회복형.',
        starterWeapon: WEAPONS.GARLIC,
        maxHpDelta: 10,
        color: '#ef476f'
    }
};

export const CLASS_ORDER = ['warrior', 'mage', 'rogue', 'priest'];
export const DEFAULT_CLASS_ID = 'warrior';

export function getClassById(id) {
    return CLASSES[id] || CLASSES[DEFAULT_CLASS_ID];
}

/**
 * @module assets-config
 * @description Wires the Kenney "Tiny Dungeon" sprite pack (CC0) into the
 * registry exposed by `assets.js`. Each entity key here is matched in the
 * entity render hook — anything not registered falls back to the original
 * procedural shape, so missing keys never crash the game.
 *
 * Pack: https://kenney.nl/assets/tiny-dungeon (CC0, attribution optional)
 *
 * Sprite size convention: tiles are 16×16 pixel-art. The default game
 * geometry uses radii of ~12–28 px, so we register them with `size`
 * matching the entity's world radius and set `smoothing: false` to keep
 * the pixel art crisp.
 *
 * Dependencies: ./assets.js
 */

import { registerSprites } from './assets.js';

registerSprites({
    // --- Player ---------------------------------------------------------
    player: { src: 'assets/sprites/player.png', size: 18, smoothing: false },

    // --- Common enemies ------------------------------------------------
    'enemy:bat': { src: 'assets/sprites/bat.png', size: 14, smoothing: false },
    'enemy:zombie': { src: 'assets/sprites/zombie.png', size: 18, smoothing: false },
    'enemy:skeleton': { src: 'assets/sprites/skeleton.png', size: 16, smoothing: false },
    'enemy:wolf': { src: 'assets/sprites/wolf.png', size: 18, smoothing: false },
    'enemy:golem': { src: 'assets/sprites/boss_knight.png', size: 28, smoothing: false },
    'enemy:ghost': { src: 'assets/sprites/ghost.png', size: 16, smoothing: false },
    'enemy:mage': { src: 'assets/sprites/mage.png', size: 16, smoothing: false },
    'enemy:slime': { src: 'assets/sprites/slime.png', size: 20, smoothing: false },
    'enemy:slimeling': { src: 'assets/sprites/slime.png', size: 12, smoothing: false },
    'enemy:bomber': { src: 'assets/sprites/bomber.png', size: 16, smoothing: false },
    'enemy:illusionist': { src: 'assets/sprites/illusionist.png', size: 16, smoothing: false },

    // --- Bosses --------------------------------------------------------
    'enemy:reaper': { src: 'assets/sprites/boss_old.png', size: 48, smoothing: false },
    'enemy:void_lord': { src: 'assets/sprites/knight.png', size: 64, smoothing: false },
    'enemy:necromancer': { src: 'assets/sprites/mage.png', size: 54, smoothing: false },
    'enemy:chrono_lich': { src: 'assets/sprites/boss_old.png', size: 72, smoothing: false },
    'enemy:ice_queen': { src: 'assets/sprites/skeleton.png', size: 66, smoothing: false },

    // --- Player projectiles (rotate so they point at the target) -------
    'projectile:knife': {
        src: 'assets/sprites/knife.png',
        size: 12,
        rotate: true,
        smoothing: false
    },
    'projectile:axe': { src: 'assets/sprites/axe.png', size: 14, rotate: true, smoothing: false },
    'projectile:magic_wand': {
        src: 'assets/sprites/wand_purple.png',
        size: 10,
        rotate: true,
        smoothing: false
    },
    'projectile:fire_wand': {
        src: 'assets/sprites/wand_red.png',
        size: 10,
        rotate: true,
        smoothing: false
    },
    'projectile:boomerang': {
        src: 'assets/sprites/wand_green.png',
        size: 10,
        rotate: true,
        smoothing: false
    },

    // --- Pickups -------------------------------------------------------
    expOrb: { src: 'assets/sprites/exp_orb.png', size: 8, smoothing: false }
});

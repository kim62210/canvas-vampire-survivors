// Unit tests for the Player entity. The most critical invariant we test
// here is the arena clamp added in iter-9 (runtime QA): without it the
// player walks off the right/bottom edge of the canvas and the game becomes
// unplayable because the renderer is fixed to the canvas world (no scrolling
// camera).

import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/entities.js';
import { CONFIG } from '../src/config.js';

// Minimal game scaffold that satisfies what Player.update touches.
function makeGame(moveVec = { x: 0, y: 0 }) {
    return {
        input: {
            getMoveVector: () => moveVec
        },
        run: { longestUnhit: 0 }
    };
}

test('Player: starts at the position passed to constructor', () => {
    const p = new Player(100, 200);
    assert.equal(p.x, 100);
    assert.equal(p.y, 200);
    assert.equal(p.hp, 100);
    assert.equal(p.maxHp, 100);
});

test('Player: stays inside arena when walking right at full speed', () => {
    // Start near the right edge and push right for 10 simulated seconds.
    const p = new Player(CONFIG.CANVAS_WIDTH - 50, CONFIG.CANVAS_HEIGHT / 2);
    const game = makeGame({ x: 1, y: 0 });
    for (let i = 0; i < 600; i++) p.update(0.016, game); // ~10 s at 60 fps
    assert.ok(p.x <= CONFIG.CANVAS_WIDTH - p.size, `player walked past right edge: x=${p.x}`);
});

test('Player: stays inside arena when walking down at full speed', () => {
    const p = new Player(CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT - 50);
    const game = makeGame({ x: 0, y: 1 });
    for (let i = 0; i < 600; i++) p.update(0.016, game);
    assert.ok(p.y <= CONFIG.CANVAS_HEIGHT - p.size, `player walked past bottom edge: y=${p.y}`);
});

test('Player: stays inside arena when walking diagonally up-left', () => {
    const p = new Player(50, 50);
    const game = makeGame({ x: -1, y: -1 });
    for (let i = 0; i < 600; i++) p.update(0.016, game);
    assert.ok(p.x >= p.size, `player walked past left edge: x=${p.x}`);
    assert.ok(p.y >= p.size, `player walked past top edge: y=${p.y}`);
});

test('Player: clamp leaves position untouched when stationary inside arena', () => {
    const p = new Player(600, 400);
    const game = makeGame({ x: 0, y: 0 });
    p.update(0.016, game);
    assert.equal(p.x, 600);
    assert.equal(p.y, 400);
});

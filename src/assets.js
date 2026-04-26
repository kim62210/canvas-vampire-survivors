/**
 * @module assets
 * @description Sprite registry for replacing the default geometric rendering
 * with image assets (PNG / SVG / WEBP). Each entity render path tries
 * `drawSprite(ctx, key, …)` first; when no sprite is registered for a key the
 * call returns `false` and the original procedural shape is drawn instead.
 *
 * That keeps the project zero-asset by default — a fork ships exactly the
 * vanilla geometric look — while letting downstream consumers swap visuals
 * one PNG at a time without touching `entities.js`.
 *
 * Dependencies: none.
 *
 * Sprite key conventions (used by entities.js):
 *   - 'player'                  player avatar
 *   - 'enemy:<id>'              enemy by data.js id (e.g. 'enemy:bat')
 *   - 'projectile:<id>'         player weapon projectile (e.g. 'projectile:knife')
 *   - 'enemyProjectile'         enemy bullet
 *   - 'orbitShard'              orbiter shard
 *   - 'mine'                    mine
 *   - 'expOrb'                  experience orb
 *
 * Exports:
 *   - registerSprite(key, src, opts)
 *   - registerSprites(map)
 *   - hasSprite(key)
 *   - drawSprite(ctx, key, x, y, overrides) → boolean (true if drawn)
 *   - clearSprites()
 *   - listSprites()
 */

const REGISTRY = new Map();

function loadImage(src) {
    if (typeof Image === 'undefined') return null; // SSR / unit-test guard
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    return img;
}

/**
 * Register a sprite. Calling twice with the same key replaces the previous
 * entry, handy for hot-swapping while iterating on art.
 *
 * @param {string} key   conventional sprite key (see module header)
 * @param {string} src   image URL, relative to index.html or absolute
 * @param {object} [opts]
 * @param {number} [opts.size]    target half-size in world px (radius)
 * @param {boolean} [opts.rotate] honour the entity's `angle` (projectiles)
 * @param {number} [opts.scale]   uniform scale multiplier (default 1)
 * @param {[number, number]} [opts.offset]  pixel offset before drawing
 * @param {boolean} [opts.smoothing] image smoothing flag (default true)
 */
export function registerSprite(key, src, opts = {}) {
    if (!key || !src) return;
    const img = loadImage(src);
    const entry = { img, ready: false, opts };
    if (img) {
        if (img.complete && img.naturalWidth > 0) {
            entry.ready = true;
        } else {
            img.addEventListener('load', () => {
                entry.ready = true;
            });
            img.addEventListener('error', () => {
                console.warn(`[assets] failed to load sprite '${key}' from ${src}`);
            });
        }
    }
    REGISTRY.set(key, entry);
}

/**
 * Bulk register. Each value is `string | { src, ...opts }`.
 *   registerSprites({
 *     player: 'assets/player.png',
 *     'enemy:bat': { src: 'assets/bat.png', size: 24 }
 *   });
 */
export function registerSprites(map) {
    if (!map) return;
    for (const [key, val] of Object.entries(map)) {
        if (typeof val === 'string') {
            registerSprite(key, val);
        } else if (val && typeof val === 'object' && val.src) {
            const { src, ...opts } = val;
            registerSprite(key, src, opts);
        }
    }
}

export function hasSprite(key) {
    const e = REGISTRY.get(key);
    return !!(e && e.ready);
}

/**
 * Draw a registered sprite at (x, y). Returns `true` on success so callers
 * can short-circuit with `if (drawSprite(...)) return;` and let the
 * procedural shape underneath act as the fallback.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} key
 * @param {number} x  world x
 * @param {number} y  world y
 * @param {object} [overrides]
 * @param {number} [overrides.size]   overrides registration size
 * @param {number} [overrides.angle]  radians; only used when registered with `rotate: true`
 * @param {number} [overrides.alpha]  multiplied with the current globalAlpha
 * @param {string} [overrides.tint]   CSS colour applied as multiply blend
 * @returns {boolean} `true` when the sprite was drawn
 */
export function drawSprite(ctx, key, x, y, overrides = {}) {
    const entry = REGISTRY.get(key);
    if (!entry || !entry.ready) return false;
    const { img, opts } = entry;
    const size = overrides.size ?? opts.size ?? Math.max(img.width, img.height) / 2;
    const scale = opts.scale ?? 1;
    const offset = opts.offset ?? [0, 0];
    const aspect = img.naturalHeight ? img.naturalHeight / img.naturalWidth : 1;
    const drawW = size * 2 * scale;
    const drawH = drawW * aspect;
    ctx.save();
    if (overrides.alpha !== undefined) ctx.globalAlpha *= overrides.alpha;
    ctx.translate(x + offset[0], y + offset[1]);
    if (opts.rotate && typeof overrides.angle === 'number') {
        ctx.rotate(overrides.angle);
    }
    ctx.imageSmoothingEnabled = opts.smoothing !== false;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    if (overrides.tint) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = overrides.tint;
        ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
    }
    ctx.restore();
    return true;
}

/** Mostly used by tests to start clean. */
export function clearSprites() {
    REGISTRY.clear();
}

/** Read-only view into the registry, useful for debugging. */
export function listSprites() {
    return Array.from(REGISTRY.keys());
}

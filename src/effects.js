/**
 * @module effects
 * @description Lightweight pure-canvas visual effects layered on top of the
 * gameplay render — screen flash, ring pulse, hit bursts. Each effect caps
 * its own update cost and reuses arrays in place to keep GC pressure low.
 *
 * Dependencies: none (canvas 2D context only).
 *
 * Exports:
 *   - class ScreenFlash, RingPulse, HitBursts
 *   - class EffectLayer  facade aggregating all three
 */

export class ScreenFlash {
    constructor() {
        this.color = 'rgba(255,255,255,0)';
        this.alpha = 0;
        this.decay = 3;
    }
    flash(color = '255,255,255', intensity = 0.4, decay = 3) {
        this.color = color;
        this.alpha = Math.max(this.alpha, intensity);
        this.decay = decay;
    }
    update(dt) {
        if (this.alpha > 0) {
            this.alpha -= this.decay * dt;
            if (this.alpha < 0) this.alpha = 0;
        }
    }
    render(ctx, w, h) {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = `rgb(${this.color})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }
}

// Ring pulse (e.g. player level-up). Emits a single growing ring per call.
export class RingPulse {
    constructor() {
        this.pulses = [];
    }
    emit(x, y, color = '255,210,77') {
        this.pulses.push({ x, y, color, r: 10, life: 1 });
    }
    update(dt) {
        for (let i = this.pulses.length - 1; i >= 0; i--) {
            const p = this.pulses[i];
            p.r += 220 * dt;
            p.life -= 1.5 * dt;
            if (p.life <= 0) this.pulses.splice(i, 1);
        }
    }
    render(ctx) {
        for (const p of this.pulses) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.strokeStyle = `rgb(${p.color})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}

// Hit burst: tiny ring-of-dots used when a projectile connects. Capped count.
export class HitBursts {
    constructor() {
        this.bursts = [];
        this.max = 40;
    }
    emit(x, y, color = '255,255,255') {
        if (this.bursts.length >= this.max) this.bursts.shift();
        this.bursts.push({ x, y, color, r: 2, life: 0.25 });
    }
    update(dt) {
        for (let i = this.bursts.length - 1; i >= 0; i--) {
            const b = this.bursts[i];
            b.r += 160 * dt;
            b.life -= 5 * dt;
            if (b.life <= 0) this.bursts.splice(i, 1);
        }
    }
    render(ctx) {
        for (const b of this.bursts) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, b.life);
            ctx.strokeStyle = `rgb(${b.color})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}

// Aggregator: one object to thread through the game for all lightweight FX.
//
// Also owns a generic `delays` queue: callers can schedule a `fn` to run after
// `t` seconds of *simulation* time. Unlike `setTimeout`, this queue is paused
// when the game is paused or the tab is hidden, because `update(dt)` only
// gets called from the gameplay loop. This is what the Glacial Cascade
// follow-up pulse uses instead of a wall-clock setTimeout.
export class EffectLayer {
    constructor() {
        this.flash = new ScreenFlash();
        this.pulses = new RingPulse();
        this.hits = new HitBursts();
        this.delays = []; // Array<{ t, fn }>
    }
    levelUp(x, y) {
        this.pulses.emit(x, y, '255,220,80');
        this.flash.flash('255,230,140', 0.22, 2.5);
    }
    hit(x, y, color = '255,255,255') {
        this.hits.emit(x, y, color);
    }
    bossSpawn() {
        this.flash.flash('255,40,60', 0.55, 1.6);
    }
    achievement() {
        this.flash.flash('200,255,200', 0.18, 2);
    }
    /**
     * iter-15 polish: short red flash on a critical hit. Kept very brief
     * (high decay) so the player still sees the action under it. Drives
     * the optional `criticalFlash` setting in main.js.
     */
    criticalHit() {
        this.flash.flash('255,80,80', 0.18, 6);
    }
    /**
     * Schedule a callback to fire after `seconds` of simulation time. The queue
     * is drained inside `update(dt)`, so it implicitly pauses with the game.
     * Returns a token whose `.cancelled = true` stops the callback.
     */
    schedule(seconds, fn) {
        const entry = { t: seconds, fn, cancelled: false };
        this.delays.push(entry);
        return entry;
    }
    update(dt) {
        this.flash.update(dt);
        this.pulses.update(dt);
        this.hits.update(dt);
        if (this.delays.length) {
            for (let i = this.delays.length - 1; i >= 0; i--) {
                const d = this.delays[i];
                d.t -= dt;
                if (d.t <= 0) {
                    this.delays.splice(i, 1);
                    if (!d.cancelled) {
                        try {
                            d.fn();
                        } catch (err) {
                            console.warn('[effects] scheduled fn threw', err);
                        }
                    }
                }
            }
        }
    }
    render(ctx, w, h) {
        this.pulses.render(ctx);
        this.hits.render(ctx);
        this.flash.render(ctx, w, h);
    }
}

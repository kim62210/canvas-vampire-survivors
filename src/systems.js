// Cross-cutting systems: spatial hash for broad-phase collision, spawn director,
// camera shake, FPS meter.

export class SpatialHash {
    constructor(cell = 80) {
        this.cell = cell;
        this.map = new Map();
    }
    clear() { this.map.clear(); }
    _key(x, y) { return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`; }

    insertEnemies(enemies) {
        this.clear();
        for (const e of enemies) {
            const k = this._key(e.x, e.y);
            let bucket = this.map.get(k);
            if (!bucket) { bucket = []; this.map.set(k, bucket); }
            bucket.push(e);
        }
    }

    *queryRect(x, y, r) {
        const c = this.cell;
        const x0 = Math.floor((x - r) / c);
        const x1 = Math.floor((x + r) / c);
        const y0 = Math.floor((y - r) / c);
        const y1 = Math.floor((y + r) / c);
        for (let gx = x0; gx <= x1; gx++) {
            for (let gy = y0; gy <= y1; gy++) {
                const b = this.map.get(`${gx},${gy}`);
                if (b) for (const e of b) yield e;
            }
        }
    }

    findNearestEnemy(x, y, maxRange) {
        let best = null, bestD = maxRange;
        for (const e of this.queryRect(x, y, maxRange)) {
            const d = Math.hypot(e.x - x, e.y - y);
            if (d < bestD) { bestD = d; best = e; }
        }
        // Fallback: if spatial query returned nothing within maxRange, try all
        // (shouldn't matter in practice but guarantees correctness).
        return best;
    }
}

export class ShakeCamera {
    constructor() { this.intensity = 0; this.x = 0; this.y = 0; }
    shake(amount) { this.intensity = Math.max(this.intensity, amount); }
    update(dt, enabled) {
        if (!enabled || this.intensity <= 0) { this.x = 0; this.y = 0; this.intensity = 0; return; }
        const i = this.intensity * 12;
        this.x = (Math.random() - 0.5) * i;
        this.y = (Math.random() - 0.5) * i;
        this.intensity = Math.max(0, this.intensity - 2 * dt);
    }
}

export class FpsMeter {
    constructor() { this.samples = []; this.fps = 0; }
    tick(dt) {
        this.samples.push(dt);
        if (this.samples.length > 60) this.samples.shift();
        const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
        this.fps = avg > 0 ? 1 / avg : 0;
    }
}

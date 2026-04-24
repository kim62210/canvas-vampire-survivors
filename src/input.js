// Unified input: keyboard + pointer + virtual joystick for touch devices.
// Exposes a normalised move vector so gameplay code never cares about source.

export class InputManager {
    constructor() {
        this.keys = Object.create(null);
        this.moveVec = { x: 0, y: 0 };
        this.touchVec = { x: 0, y: 0 };
        this.paused = false;
        this.listeners = [];
        this.joystick = null;
        this.onTogglePause = () => {};
    }

    attach(target = window) {
        const kd = (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;
            if (key === 'escape' || key === 'p') {
                e.preventDefault();
                this.onTogglePause();
            }
        };
        const ku = (e) => {
            this.keys[e.key.toLowerCase()] = false;
        };
        const blur = () => {
            this.keys = Object.create(null);
        };

        target.addEventListener('keydown', kd);
        target.addEventListener('keyup', ku);
        target.addEventListener('blur', blur);
        this.listeners.push(['keydown', kd, target]);
        this.listeners.push(['keyup', ku, target]);
        this.listeners.push(['blur', blur, target]);
    }

    detach() {
        for (const [event, fn, tgt] of this.listeners) tgt.removeEventListener(event, fn);
        this.listeners.length = 0;
        if (this.joystick) this.joystick.destroy();
    }

    attachJoystick(joystickEl, knobEl) {
        this.joystick = new VirtualJoystick(joystickEl, knobEl, (vx, vy) => {
            this.touchVec.x = vx;
            this.touchVec.y = vy;
        });
    }

    getMoveVector() {
        let x = 0,
            y = 0;
        const k = this.keys;
        if (k['w'] || k['arrowup']) y -= 1;
        if (k['s'] || k['arrowdown']) y += 1;
        if (k['a'] || k['arrowleft']) x -= 1;
        if (k['d'] || k['arrowright']) x += 1;
        if (x === 0 && y === 0) {
            x = this.touchVec.x;
            y = this.touchVec.y;
        }
        const len = Math.hypot(x, y);
        if (len > 1) {
            x /= len;
            y /= len;
        }
        this.moveVec.x = x;
        this.moveVec.y = y;
        return this.moveVec;
    }
}

class VirtualJoystick {
    constructor(base, knob, cb) {
        this.base = base;
        this.knob = knob;
        this.cb = cb;
        this.active = false;
        this.cx = 0;
        this.cy = 0;
        this.maxR = 60;

        const start = (e) => {
            this.active = true;
            const t = e.touches ? e.touches[0] : e;
            const rect = base.getBoundingClientRect();
            this.cx = rect.left + rect.width / 2;
            this.cy = rect.top + rect.height / 2;
            this._update(t.clientX, t.clientY);
            e.preventDefault();
        };
        const move = (e) => {
            if (!this.active) return;
            const t = e.touches ? e.touches[0] : e;
            this._update(t.clientX, t.clientY);
            e.preventDefault();
        };
        const end = () => {
            this.active = false;
            knob.style.transform = 'translate(-50%, -50%)';
            cb(0, 0);
        };

        base.addEventListener('touchstart', start, { passive: false });
        window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('touchend', end);
        base.addEventListener('mousedown', start);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);
        this._cleanup = () => {
            base.removeEventListener('touchstart', start);
            window.removeEventListener('touchmove', move);
            window.removeEventListener('touchend', end);
            base.removeEventListener('mousedown', start);
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', end);
        };
    }

    _update(x, y) {
        const dx = x - this.cx;
        const dy = y - this.cy;
        const d = Math.hypot(dx, dy);
        const clamp = Math.min(d, this.maxR);
        const nx = d === 0 ? 0 : (dx / d) * clamp;
        const ny = d === 0 ? 0 : (dy / d) * clamp;
        this.knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
        this.cb(nx / this.maxR, ny / this.maxR);
    }

    destroy() {
        this._cleanup?.();
    }
}

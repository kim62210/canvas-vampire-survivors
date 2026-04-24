/**
 * @module input
 * @description Unified input layer — keyboard, mouse, gamepad, and a virtual
 * touch joystick — exposing a single normalised move vector to gameplay code.
 * Mobile polish: 15% inner deadzone, squared response curve on the outer
 * band, edge double-tap to toggle pause.
 *
 * Dependencies: DOM (window/document event APIs).
 *
 * Exports:
 *   - class InputManager
 */

const JOYSTICK_DEADZONE = 0.15;
const DOUBLE_TAP_WINDOW_MS = 260;

export class InputManager {
    constructor() {
        this.keys = Object.create(null);
        this.moveVec = { x: 0, y: 0 };
        this.touchVec = { x: 0, y: 0 };
        this.paused = false;
        this.listeners = [];
        this.joystick = null;
        this.onTogglePause = () => {};
        this._lastEdgeTapAt = 0;
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

        // Touch edge double-tap → pause. Registered on the document so the
        // gesture works anywhere outside the joystick pad.
        const onTouchStart = (e) => {
            if (!e.touches || e.touches.length === 0) return;
            const t = e.touches[0];
            const w = window.innerWidth;
            const edgeLeft = t.clientX < w * 0.12;
            const edgeRight = t.clientX > w * 0.88;
            if (!edgeLeft && !edgeRight) return;
            const now = Date.now();
            if (now - this._lastEdgeTapAt < DOUBLE_TAP_WINDOW_MS) {
                this._lastEdgeTapAt = 0;
                this.onTogglePause();
            } else {
                this._lastEdgeTapAt = now;
            }
        };
        document.addEventListener('touchstart', onTouchStart, { passive: true });
        this.listeners.push(['touchstart', onTouchStart, document]);
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
        // Normalise and apply a dead-zone + squared curve on the outer band.
        const mag = clamp / this.maxR; // 0..1
        if (mag < JOYSTICK_DEADZONE) {
            this.cb(0, 0);
            return;
        }
        const liveRange = 1 - JOYSTICK_DEADZONE;
        const scaled = Math.pow((mag - JOYSTICK_DEADZONE) / liveRange, 1.3);
        const dirx = d === 0 ? 0 : dx / d;
        const diry = d === 0 ? 0 : dy / d;
        this.cb(dirx * scaled, diry * scaled);
    }

    destroy() {
        this._cleanup?.();
    }
}

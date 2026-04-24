// Web Audio synthesised SFX + procedural music loop. Zero external assets.
// All sounds are generated at playback time from oscillators and noise buffers.

export class AudioEngine {
    constructor(settings) {
        this.settings = settings;
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.musicOsc = null;
        this.musicInterval = null;
        this.enabled = true;
        this.unlocked = false;
    }

    init() {
        if (this.ctx) return;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) {
                this.enabled = false;
                return;
            }
            this.ctx = new AC();
            this.masterGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();
            this.sfxGain.connect(this.masterGain);
            this.musicGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);
            this.applyVolumes();
        } catch (err) {
            console.warn('[audio] disabled', err);
            this.enabled = false;
        }
    }

    unlock() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => { /* ignore */ });
        }
        this.unlocked = true;
    }

    applyVolumes() {
        if (!this.ctx) return;
        const s = this.settings;
        this.masterGain.gain.value = s.masterVolume ?? 0.6;
        this.sfxGain.gain.value = s.sfxVolume ?? 0.8;
        this.musicGain.gain.value = s.musicVolume ?? 0.4;
    }

    // Generic tone helper --------------------------------------------------
    tone({ freq = 440, dur = 0.08, type = 'sine', volume = 0.2, attack = 0.005, release = 0.05, sweep = 0, noise = false }) {
        if (!this.enabled || !this.ctx || !this.unlocked) return;
        const now = this.ctx.currentTime;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur + release);
        gain.connect(this.sfxGain);

        let source;
        if (noise) {
            source = this.ctx.createBufferSource();
            source.buffer = this._noiseBuffer();
        } else {
            const osc = this.ctx.createOscillator();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);
            if (sweep) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), now + dur);
            }
            source = osc;
        }
        source.connect(gain);
        source.start(now);
        source.stop(now + dur + release + 0.01);
    }

    _noiseBuffer() {
        if (this._noise) return this._noise;
        const len = this.ctx.sampleRate * 0.4;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this._noise = buf;
        return buf;
    }

    // High-level SFX -------------------------------------------------------
    hit()       { this.tone({ freq: 320, dur: 0.05, type: 'square', volume: 0.12, sweep: -120 }); }
    shoot()     { this.tone({ freq: 780, dur: 0.04, type: 'triangle', volume: 0.08, sweep: -200 }); }
    explosion() { this.tone({ noise: true, dur: 0.25, volume: 0.22, release: 0.15 }); }
    pickup()    { this.tone({ freq: 1200, dur: 0.06, type: 'sine', volume: 0.12, sweep: 400 }); }
    levelUp()   {
        this.tone({ freq: 660, dur: 0.1, type: 'triangle', volume: 0.2 });
        setTimeout(() => this.tone({ freq: 990, dur: 0.12, type: 'triangle', volume: 0.22 }), 90);
        setTimeout(() => this.tone({ freq: 1320, dur: 0.18, type: 'triangle', volume: 0.24 }), 200);
    }
    damage()    { this.tone({ freq: 180, dur: 0.18, type: 'sawtooth', volume: 0.18, sweep: -80 }); }
    death()     {
        this.tone({ freq: 220, dur: 0.4, type: 'sawtooth', volume: 0.25, sweep: -180 });
        setTimeout(() => this.tone({ freq: 110, dur: 0.6, type: 'sawtooth', volume: 0.2, sweep: -80 }), 200);
    }
    bossSpawn() {
        this.tone({ noise: true, dur: 0.4, volume: 0.3, release: 0.25 });
        setTimeout(() => this.tone({ freq: 80, dur: 0.6, type: 'sawtooth', volume: 0.3 }), 100);
    }

    // Very simple procedural music: a repeating minor arpeggio.
    startMusic() {
        if (!this.enabled || !this.ctx || this.musicInterval) return;
        this.unlock();
        const notes = [196, 233.08, 293.66, 349.23, 293.66, 233.08]; // G3 Bb3 D4 F4 D4 Bb3
        let idx = 0;
        const step = () => {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = notes[idx % notes.length];
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
            osc.connect(gain).connect(this.musicGain);
            osc.start(now);
            osc.stop(now + 0.36);
            idx++;
        };
        this.musicInterval = setInterval(step, 380);
    }

    stopMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
    }
}

/**
 * @module main
 * @description Top-level orchestrator. Owns the `Game` instance, the
 * fixed-step update loop, the spawn/wave director, the achievement check
 * heartbeat and the menu/state machine. This is the only module that
 * reaches into nearly every other one — keep new logic out of here when a
 * focused module fits.
 *
 * Dependencies: every other module under `src/`.
 *
 * Exports:
 *   - class Game
 *   - boot()              constructor + window-handle install
 *   - re-exports ACHIEVEMENTS, WAVES from data.js
 */

import { CONFIG, Difficulty, GameState } from './config.js';
import { ACHIEVEMENTS, BOSSES, ENEMIES, WAVES, WEAPONS } from './data.js';
import {
    Enemy,
    ExpOrb,
    FloatingText,
    Particle,
    Player,
    RemotePlayer,
    findEnemyDef,
    registerWeaponClass
} from './entities.js';
import { CLASSES, CLASS_ORDER, DEFAULT_CLASS_ID, getClassById } from './classes.js';
import { Weapon } from './weapons.js';
import { AudioEngine } from './audio.js';
import { InputManager } from './input.js';
import { HapticEngine } from './haptics.js';
import { loadKeymap, saveKeymap } from './keymap.js';
import { UI } from './ui.js';
import { FpsMeter, ShakeCamera } from './systems.js';
import { SpatialHash } from './spatial-hash.js';
import { Pool, resetFloatingText, resetParticle } from './pool.js';
import { EffectLayer } from './effects.js';
import { AchievementTracker } from './achievements.js';
import {
    SeededRng,
    accumulateTotals,
    getTouchButtonScale,
    loadSave,
    loadSpeedrunScores,
    recordHighScore,
    recordSpeedrunScore,
    resetSave,
    saveSave
} from './storage.js';
import { setLocale, t as _t, detectLocale } from './i18n.js';
import { hasSprite, drawSprite } from './assets.js';
import { MultiplayerClient } from './multiplayer.js';
import {
    DEFAULT_STAGE_ID,
    getBackgroundFor,
    getBossesFor,
    getStageModifiers,
    getWavesFor,
    pickWeighted
} from './stages.js';
import { dailyChallenge, saveDailyResult } from './daily.js';
import { TutorialState } from './tutorial.js';
import { ReplayPlayer, ReplayRecorder, loadReplay, saveReplay } from './replay.js';
import { KonamiDetector } from './konami.js';

registerWeaponClass(Weapon);

// ---------------------------------------------------------------------------
// Offscreen sprite cache. Pre-rasterising the tiny enemy sprites once and
// blitting the bitmap each frame is measurably faster than redoing the
// gradient/fill path every draw call. Cache key = `${id}-${size}`.
// ---------------------------------------------------------------------------
const SPRITE_CACHE = new Map();

// iter-27: distinct outline tint per peer slot so each player avatar reads
// at a glance. Up to 4 since the room cap is 4.
const PEER_COLORS = ['#ffd166', '#06d6a0', '#118ab2', '#ef476f'];

function clampUnit(v) {
    if (typeof v !== 'number' || Number.isNaN(v)) return 0;
    if (v > 1) return 1;
    if (v < -1) return -1;
    return v;
}

function spriteKey(id, size) {
    return `${id}@${size}`;
}

function getEnemySprite(def, size) {
    const key = spriteKey(def.id, size);
    const cached = SPRITE_CACHE.get(key);
    if (cached) return cached;
    if (typeof document === 'undefined') return null; // SSR / test guard
    const pad = 4;
    const d = size * 2 + pad * 2;
    const off = document.createElement('canvas');
    off.width = d;
    off.height = d;
    const ox = d / 2;
    const oy = d / 2;
    const c = off.getContext('2d');
    c.fillStyle = def.color || '#ff4444';
    c.beginPath();
    c.arc(ox, oy, size, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.beginPath();
    c.arc(ox, oy, size * 0.5, 0, Math.PI * 2);
    c.fill();
    SPRITE_CACHE.set(key, off);
    return off;
}

export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = GameState.MENU;
        this.lastTime = 0;
        this.gameTime = 0;
        this.kills = 0;
        this.raf = 0;

        // Collections
        this.enemies = [];
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.expOrbs = [];
        this.particles = [];
        this.floatingTexts = [];
        this.mines = [];

        this.player = null;

        // Systems
        this.spatial = new SpatialHash(CONFIG.SPATIAL_CELL_SIZE);
        this.camera = new ShakeCamera();
        this.fpsMeter = new FpsMeter();
        this.effects = new EffectLayer();

        // Object pools for the churny entities. `prealloc` avoids the
        // first-level burst triggering an allocation cascade.
        this.pools = {
            floatingText: new Pool(() => new FloatingText('', 0, 0, '#fff'), resetFloatingText, {
                maxSize: 256,
                prealloc: 32
            }),
            particle: new Pool(() => new Particle(0, 0, '#fff'), resetParticle, {
                maxSize: 512,
                prealloc: 64
            })
        };

        // Tab-visibility aware pause so resuming doesn't produce a huge dt.
        this._hiddenPaused = false;
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => this._onVisibilityChange());
        }

        // Save + settings
        this.save = loadSave();
        setLocale(this.save.settings.locale || detectLocale());
        if (this.save.settings.colorblind) document.body.classList.add('cb-mode');

        // Audio + input + UI
        this.audio = new AudioEngine(this.save.settings);
        this.input = new InputManager();
        // iter-19: haptic feedback engine. Reads the live save.settings ref
        // so toggling the Settings checkbox takes effect on the next event.
        this.haptics = new HapticEngine(this.save.settings);
        // iter-19: load custom keymap (or fall back to default WASD + arrows
        // + Esc/P + H/? + M) and hand it to the input manager. Persisted
        // changes from previous sessions are picked up here.
        this.keymap = loadKeymap();
        this.input.setKeymap(this.keymap);
        this.ui = new UI(this);
        // iter-27: setLocale runs before the UI exists (line ~150), so the
        // static menu/HUD labels stay on whatever the markup shipped with
        // (English defaults). Trigger a one-shot translate now that the
        // walker exists so the boot screen lands in Korean.
        this.ui.onLocaleChanged();

        // Achievements tracker persists the lifetime record.
        this.achievements = new AchievementTracker(this.save);

        this._bossesSpawned = new Set();
        this._spawnAccumulator = 0;
        this._bossWarnedAt = new Set();
        this._lastAnnouncedWave = null;

        // Active stage descriptor + per-stage waves/bosses snapshot. Keyed off
        // the persisted setting so a returning player resumes on whatever map
        // they last picked. Re-derived in start() so a stage swap mid-session
        // takes effect on the next run.
        this.stageId = this.save?.settings?.stage || DEFAULT_STAGE_ID;
        this.stageWaves = getWavesFor(this.stageId);
        this.stageBosses = getBossesFor(this.stageId);
        this.currentWave = this.stageWaves[0] || WAVES[0];

        // Speedrun bookkeeping. When `speedrunMode` is truthy, spawn picks
        // are deterministic, real-time splits are tracked and the result
        // lands in the speedrun leaderboard instead of the normal one.
        this.speedrunMode = false;
        this.speedrunRng = null;
        this.speedrunStart = 0;
        this.speedrunSplits = [];
        this._nextSplitIdx = 0;

        // Daily-challenge bookkeeping. When `dailyMode` is true the seed +
        // stage + boss schedule are pinned by `daily.dailyChallenge(...)`.
        this.dailyMode = false;
        this.dailyChallenge = null;

        // Per-run bookkeeping used by achievements.
        this.run = this.achievements.run;

        this._bindInput();
        this._bindDomButtons();
        this._bindLeaderboardImport();
        this._bindGlobalHotkeys();
        // iter-20: Konami code detector. Active only on the main menu (state
        // === MENU); the listener is hot-installed but checks the state on
        // every push so it never interferes with gameplay input.
        this._bindKonamiCode();

        // iter-13: paint the Stage chip on the main menu so a returning
        // player sees which map their next Start Run would launch.
        this.ui.updateStageChip(this.stageId);

        // iter-15: tutorial state machine + replay bookkeeping. Both are
        // inert until explicitly engaged by the player (via Try Tutorial /
        // Replay Last Run). Recorder is created on every run start in
        // `start()` and only persisted when the run ends; replay player is
        // only created on demand.
        this.tutorial = new TutorialState();
        this.replayRecorder = null;
        this.replayPlayer = null;
        this.replayActive = false;
        // iter-27: multiplayer client (lazy-connected when the player opens
        // the multiplayer lobby). Owns the Socket.io room state; the host
        // mirrors its game state to /survivor and guests render whatever
        // arrives in `host:tick`.
        this.mp = new MultiplayerClient();
        this.mpMode = false; // toggled true when a multiplayer game is active
        this.mpRole = null; // 'host' | 'guest' once a coop run starts
        // Host-only: per-guest authoritative state. Map<sid, RemotePlayer>.
        // Guest-only: same shape, populated from each `host:tick.pl` so we
        // can render every other peer (including the host's avatar) using a
        // single render path.
        this.remotePlayers = new Map();
        // Host-only: latest input vector per guest sid, last applied during
        // the next `_updateRemotePlayers` tick. Cleared when a guest leaves.
        this.guestInputs = new Map();
        // Guest-only: latest snapshot from `host:tick`. Render() reads this
        // instead of the local sim because the local sim is paused on guests.
        this._mpState = null;
        // Throttle the host → guest broadcast at 30 Hz regardless of frame
        // rate to keep payload size bounded on slower devices.
        this._mpHostTickAccum = 0;
        this._mpHostTickInterval = 1 / 30;
        // Throttle guest → host input updates similarly. We only push when
        // the vector actually changes OR every ~33 ms as a heartbeat.
        this._mpGuestInputAccum = 0;
        this._mpLastSentInput = { vx: 0, vy: 0 };
        // Roster captured when the run starts so guest joins after that
        // moment do not affect our authoritative spawn list mid-run.
        this._mpRoster = [];
        // Phase C: per-sid class selection. Host accumulates these from
        // `guest:event {type:'class', id}` and includes them in the
        // gameStart broadcast so every peer applies the same starter
        // weapon, hp delta, and tint.
        this._mpClassChoices = new Map();
        // Local choice — what the player picked for themselves in the
        // waiting room. Guests send this upstream; host uses it for
        // their own `this.player` config.
        this._mpLocalClassId = DEFAULT_CLASS_ID;
        // Per-frame snapshot of move vector for the recorder (kept on the
        // game so other systems can also peek at the most recent input).
        this._lastMoveVec = { x: 0, y: 0 };
        // Cached tutorial banner element handle; assigned lazily on first
        // tutorial activation so we don't pay for it on returning players.
        this._tutorialBanner = null;

        // First-launch How-to-Play: show once, persist a flag so we don't
        // nag returning players. Wrapped in a microtask so DOM is settled.
        // iter-15: same one-time gate now also offers the 5-step tutorial.
        if (!this.save?.flags?.howToSeen) {
            Promise.resolve().then(() => {
                this.ui.showHowToPlay(() => {
                    this.save.flags = this.save.flags || {};
                    this.save.flags.howToSeen = true;
                    saveSave(this.save);
                    // After the how-to-play closes, offer the interactive
                    // tutorial if it hasn't already been completed.
                    if (!this.save.flags.tutorialDone) this._offerTutorial();
                });
            });
        } else if (!this.save?.flags?.tutorialDone) {
            // Returning player who saw HTP but never finished the tutorial:
            // nudge once on the next cold-boot, no other interruption.
            Promise.resolve().then(() => this._offerTutorial());
        }

        // Apply any persisted mute on boot so a refresh keeps the choice.
        if (this.save.settings.muted) this.audio.setMuted(true);

        // iter-14: apply touch-button scale to CSS custom properties.
        this._applyTouchScale();
        // iter-14: PWA install prompt (one-shot per save). Listens for the
        // browser's `beforeinstallprompt` once; if it fires before the user
        // has dismissed it ever, we surface our own little banner.
        this._wirePwaPrompt();

        window.addEventListener('resize', () => this._resize());
        this._resize();
    }

    /**
     * Bind global hotkeys that operate from the main menu *and* during
     * gameplay: M toggles mute, H (or ?) toggles the help overlay. Pause
     * already has its own binding via InputManager.onTogglePause.
     */
    _bindGlobalHotkeys() {
        // iter-19: M (mute) and H/? (help) are now dispatched by the input
        // layer through the customisable keymap. We keep the per-frame
        // suppression for INPUT/TEXTAREA targets as a capture-phase guard so
        // typing into the leaderboard import textarea doesn't pause/help.
        if (typeof window === 'undefined') return;
        window.addEventListener(
            'keydown',
            (e) => {
                const tag = (e.target && e.target.tagName) || '';
                if (tag === 'INPUT' || tag === 'TEXTAREA') {
                    // Stop the input-manager's default handler from firing
                    // for typed text. We do this rather than gating inside
                    // input.js so keymap remapping stays tiny.
                    e.stopPropagation();
                }
            },
            true
        );
    }

    /**
     * iter-20: install the Konami Code detector. Listens on the main menu
     * only — the gameplay input layer already owns arrows during a run, and
     * we don't want a stray cheat-code press during combat to flicker an
     * unlock toast. On a successful sequence we flip a per-run flag, run
     * the achievement check immediately, and surface a small announcement
     * via the existing live-region helper. The unlock weapon is wired
     * through UNLOCKS so the next Start Run gets it as a starter option.
     */
    _bindKonamiCode() {
        if (typeof window === 'undefined') return;
        this._konami = new KonamiDetector(() => this._onKonamiUnlocked());
        window.addEventListener('keydown', (e) => {
            if (this.state !== GameState.MENU) return;
            // Ignore when typing into the leaderboard import textarea etc.
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            this._konami.push(e.key);
        });
    }

    /** Konami sequence completed: flip the per-run flag and unlock the cheat. */
    _onKonamiUnlocked() {
        // `this.run` is aliased to `this.achievements.run` (see constructor +
        // start()), so setting the flag in one place is enough for the
        // achievement check to read it.
        if (this.run) this.run.konamiCode = true;
        try {
            this.achievements.check(this);
        } catch {
            /* swallow — boot-time miss is fine */
        }
        this._flushAchievementToasts?.();
        this._announce('치트 코드 해금! 레트로 블래스터를 사용할 수 있어요.');
    }

    /** Toggle a global mute and persist so a refresh keeps the choice. */
    toggleMute() {
        const next = !this.save.settings.muted;
        this.save.settings.muted = next;
        saveSave(this.save);
        this.audio.setMuted(next);
        this._announce(next ? '음소거됨' : '음소거 해제');
    }

    /** Open the help overlay; close it if it's already open. */
    toggleHelp() {
        const el = this.ui.els.helpScreen;
        if (el && el.style.display === 'flex') {
            this.ui.hideHelp();
        } else {
            this.ui.showHelp();
        }
    }

    /**
     * Listen for the `vs-leaderboard-import` CustomEvent that `UI.showLeaderboard`
     * dispatches when the user pastes JSON and clicks Import. We merge the
     * incoming runs into both the normal and speedrun stores, dedupe by
     * `date+timeSurvived` (or `date+timeMs` for speedrun), then re-rank and
     * persist. The UI is then refreshed if it's still on screen.
     */
    _bindLeaderboardImport() {
        if (typeof window === 'undefined') return;
        window.addEventListener('vs-leaderboard-import', (ev) => {
            const payload = ev.detail || {};
            try {
                if (Array.isArray(payload.normal)) {
                    const seen = new Set(
                        (this.save.highScores || []).map((r) => `${r.date}|${r.timeSurvived}`)
                    );
                    for (const r of payload.normal) {
                        const k = `${r.date}|${r.timeSurvived}`;
                        if (!seen.has(k)) {
                            recordHighScore(this.save, r);
                            seen.add(k);
                        }
                    }
                    saveSave(this.save);
                }
                if (Array.isArray(payload.speedrun)) {
                    const existing = loadSpeedrunScores();
                    const seen = new Set(existing.map((r) => `${r.date}|${r.timeMs}`));
                    for (const r of payload.speedrun) {
                        const k = `${r.date}|${r.timeMs}`;
                        if (!seen.has(k)) {
                            recordSpeedrunScore(r);
                            seen.add(k);
                        }
                    }
                }
                // Refresh the open leaderboard view if the dialog is still up.
                this.ui.showLeaderboard?.(
                    this.save.highScores || [],
                    loadSpeedrunScores(),
                    () => {}
                );
            } catch (err) {
                console.warn('[main] leaderboard import failed', err);
            }
        });
    }

    // --- Lifecycle --------------------------------------------------------
    _bindInput() {
        this.input.attach(window);
        this.input.onTogglePause = () => this.togglePause();
        // iter-19: help/mute actions are routed through the keymap rather
        // than the legacy global keydown listener. Both still default to
        // H/M but a remap takes effect immediately.
        this.input.onActionHelp = () => this.toggleHelp();
        this.input.onActionMute = () => this.toggleMute();
        // Virtual joystick
        const joy = document.getElementById('joystickBase');
        const knob = document.getElementById('joystickKnob');
        if (joy && knob) this.input.attachJoystick(joy, knob);
        // iter-14: mobile special-skill button. The button is a placeholder
        // for now — wires through to togglePause until per-build skills are
        // implemented, so the press at least gives the player a way out.
        const special = document.getElementById('specialSkillBtn');
        if (special) {
            this.input.attachSpecialButton(special);
            this.input.onTouchSpecial = () => this.togglePause();
        }
        // iter-14: gamepad confirm/cancel/menu wiring. We map A→togglePause
        // and B→togglePause as well for now (overlay UIs read DOM keystrokes
        // directly), but Start is the canonical pause toggle.
        this.input.onGamepadConfirm = () => {
            // Forward as a synthetic Enter keypress so existing menu close
            // handlers fire without each one having to know about gamepads.
            this._dispatchKey('Enter');
        };
        this.input.onGamepadCancel = () => {
            this._dispatchKey('Escape');
        };
        this.input.onGamepadCycleNext = () => this._dispatchKey('Tab');
        this.input.onGamepadCyclePrev = () => this._dispatchKey('Tab', { shiftKey: true });
    }

    /** Dispatch a synthetic keydown so DOM listeners react to gamepad nav. */
    _dispatchKey(key, opts = {}) {
        if (typeof window === 'undefined' || typeof KeyboardEvent === 'undefined') return;
        const ev = new KeyboardEvent('keydown', { key, bubbles: true, ...opts });
        (document.activeElement || document.body).dispatchEvent(ev);
    }

    /**
     * iter-14: write the touch-button scale to CSS custom properties on the
     * document root. Multiplies the base sizes (defined in styles.css under
     * `:root`) by the user's setting so the joystick + special button stay
     * proportional. No-op outside the browser (test env).
     */
    _applyTouchScale() {
        if (typeof document === 'undefined' || !document.documentElement) return;
        const scale = getTouchButtonScale(this.save);
        const base = 140;
        const knob = 58;
        const special = 96;
        const root = document.documentElement.style;
        root.setProperty('--touch-button-size', `${Math.round(base * scale)}px`);
        root.setProperty('--touch-knob-size', `${Math.round(knob * scale)}px`);
        root.setProperty('--touch-special-size', `${Math.round(special * scale)}px`);
    }

    /**
     * iter-14: install-prompt plumbing. Browsers fire `beforeinstallprompt`
     * once when the page meets the install criteria. We stash the deferred
     * event, surface a small in-page banner the first time, and remember the
     * user's choice (install / dismiss) so we never nag them again. We
     * intentionally avoid auto-prompting — Chrome ranks repeated prompts as
     * spam; the user has to click our button.
     */
    _wirePwaPrompt() {
        if (typeof window === 'undefined') return;
        if (this.save?.flags?.pwaPromptSeen) return;
        let deferred = null;
        const banner = document.getElementById('pwaInstallPrompt');
        const installBtn = document.getElementById('pwaInstallBtn');
        const dismissBtn = document.getElementById('pwaInstallDismiss');
        const closeBtn = document.getElementById('pwaInstallClose');
        if (!banner || !installBtn || !dismissBtn) return;
        const markSeen = () => {
            this.save.flags = this.save.flags || {};
            this.save.flags.pwaPromptSeen = true;
            saveSave(this.save);
            banner.style.display = 'none';
        };
        window.addEventListener(
            'beforeinstallprompt',
            (e) => {
                e.preventDefault?.();
                deferred = e;
                banner.style.display = 'flex';
            },
            { once: true }
        );
        installBtn.addEventListener('click', async () => {
            if (deferred) {
                deferred.prompt?.();
                try {
                    await deferred.userChoice;
                } catch {
                    /* ignore */
                }
            }
            markSeen();
        });
        dismissBtn.addEventListener('click', markSeen);
        // iter-27: explicit close (✕) for the mobile layout where the prompt
        // floats over the menu — same behaviour as "Not now" but discoverable.
        closeBtn?.addEventListener('click', markSeen);
    }

    _bindDomButtons() {
        const q = (id) => document.getElementById(id);
        q('btnStart')?.addEventListener('click', () => {
            this.audio.unlock();
            this.speedrunMode = false;
            this.dailyMode = false;
            this.start();
        });
        q('btnSpeedrun')?.addEventListener('click', () => {
            this.audio.unlock();
            this.startSpeedrun();
        });
        q('btnStage')?.addEventListener('click', () => this.openStagePicker());
        q('btnDaily')?.addEventListener('click', () => {
            this.audio.unlock();
            this.startDaily();
        });
        q('btnLeaderboard')?.addEventListener('click', () => this.openLeaderboard());
        q('btnSettings')?.addEventListener('click', () => this.openSettings());
        q('btnAchievements')?.addEventListener('click', () => this.openAchievements());
        q('btnViewStreak')?.addEventListener('click', () => this.openStreak());
        q('btnHowTo')?.addEventListener('click', () => this.openHowToPlay());
        // iter-15: replay-last-run + tutorial entry points on the start menu.
        q('btnReplay')?.addEventListener('click', () => this.openReplay());
        q('btnTutorial')?.addEventListener('click', () => this.startTutorialRun());
        q('btnRetry')?.addEventListener('click', () => {
            this.ui.hideGameOver();
            // Phase 1.5: in coop the host can re-issue gameStart so all
            // peers retry together; guests just wait. Solo retry stays the
            // single-player path.
            if (this.mpMode && this.mpRole === 'host') {
                this.mp.sendHostEvent({
                    type: 'gameStart',
                    roomId: this.mp.roomId,
                    members: this._mpRoster,
                    stageId: this.save?.settings?.stage || null
                });
                this.audio.unlock();
                this.start();
                return;
            }
            if (this.mpMode && this.mpRole === 'guest') return; // wait for host
            if (this.dailyMode) this.startDaily();
            else if (this.speedrunMode) this.startSpeedrun();
            else this.start();
        });
        q('btnMenu')?.addEventListener('click', () => {
            this.ui.hideGameOver();
            this.ui.showStart();
            this.state = GameState.MENU;
            this.speedrunMode = false;
            // Phase 1.5: leaving the run also leaves the multiplayer room
            // so the host doesn't dangle and other guests get a clean
            // room:closed broadcast.
            if (this.mpMode) {
                try {
                    this.mp.leaveRoom();
                    this.mp.disconnect();
                } catch (_e) {
                    /* noop */
                }
                this.mpMode = false;
                this.mpRole = null;
                this.remotePlayers.clear();
                this.guestInputs.clear();
                this._mpState = null;
            }
        });
        q('btnResume')?.addEventListener('click', () => this.togglePause());
        q('btnQuit')?.addEventListener('click', () => {
            this.state = GameState.MENU;
            this.ui.hidePause();
            this.ui.showStart();
            cancelAnimationFrame(this.raf);
            this.audio.stopMusic();
        });
        q('btnMultiplayer')?.addEventListener('click', () => this.openMultiplayerLobby());
    }

    /**
     * iter-27: open the multiplayer lobby (host / join). Lazy-connects the
     * Socket.io client on first open and wires the standard event flow:
     *   create/join → waiting room → host clicks Start → coop game
     * The host-authoritative game loop is wired up in Phase 1.4.
     */
    openMultiplayerLobby() {
        const defaultNickname =
            this.save?.profile?.nickname || `Player${Math.floor(Math.random() * 100)}`;

        const onCreate = async (nickname, setStatus) => {
            try {
                this.mp.connect();
                const resp = await this.mp.createRoom(nickname);
                this._enterMultiplayerWaitingRoom({
                    roomId: resp.roomId,
                    hostSid: resp.hostSid,
                    members: [{ sid: resp.sid, nickname, isHost: true }]
                });
            } catch (_e) {
                setStatus?.(_t('mpDisconnected'), true);
            }
        };
        const onJoin = async (roomId, nickname, setStatus) => {
            try {
                this.mp.connect();
                const resp = await this.mp.joinRoom(roomId, nickname);
                if (!resp?.ok) {
                    setStatus?.(
                        resp?.error === 'NOT_FOUND'
                            ? _t('mpRoomNotFound')
                            : resp?.error === 'FULL'
                              ? _t('mpRoomFull')
                              : _t('mpDisconnected'),
                        true
                    );
                    return;
                }
                this._enterMultiplayerWaitingRoom({
                    roomId,
                    hostSid: resp.hostSid,
                    members: [{ sid: resp.sid, nickname, isHost: false }]
                });
            } catch (_e) {
                setStatus?.(_t('mpDisconnected'), true);
            }
        };

        const lobbyHandle = this.ui.showMultiplayerLobby({
            defaultNickname,
            onCreate,
            onJoin,
            onClose: () => this.ui.hideMultiplayer()
        });
        this._mpLobbyHandle = lobbyHandle;

        // Wire socket-side listeners only once per Game lifetime.
        if (!this._mpListenersBound) {
            this._mpListenersBound = true;
            this.mp.onRoomState((snap) => {
                // Cache the latest roster so when the host fires gameStart
                // we know who to seed RemotePlayer entries for.
                this._mpRoster = Array.isArray(snap?.members) ? snap.members.slice() : [];
                this._enterMultiplayerWaitingRoom(snap);
            });
            this.mp.onRoomClosed(() => {
                this.mp.disconnect();
                this.ui.hideMultiplayer();
                this._announce(_t('mpRoomClosed'));
                // Reset coop sim flags so the player can immediately start a
                // single-player run after the host bailed.
                this.mpMode = false;
                this.mpRole = null;
                this.remotePlayers.clear();
                this.guestInputs.clear();
                this._mpState = null;
                this.ui.showStart();
            });
            this.mp.onHostEvent((evt) => {
                if (evt?.type === 'gameStart') {
                    // Phase 1.4: capture authoritative role + roster snapshot
                    // sent by the host so guests render every peer.
                    this.mpMode = true;
                    this.mpRole = this.mp.isHost ? 'host' : 'guest';
                    if (Array.isArray(evt.members)) {
                        this._mpRoster = evt.members.slice();
                    }
                    // Phase C: stash the host-authoritative class map so
                    // start() can apply each player's class config.
                    this._mpClassMap = evt.classes || {};
                    this.ui.hideMultiplayer();
                    this.audio.unlock();
                    this.start();
                } else if (evt?.type === 'classPick') {
                    // Host broadcasts class picks (its own + relayed guests')
                    // so every peer's waiting-room UI stays in sync.
                    if (evt.sid && evt.classId) {
                        this._mpClassChoices.set(evt.sid, evt.classId);
                        this._mpLobbyHandle?.refreshClassChoices?.(this._mpClassChoices);
                    }
                } else if (evt?.type === 'gameOver') {
                    // Phase 1.5: host says the run is over for everyone.
                    if (this.state === GameState.PLAYING && this.mpRole === 'guest') {
                        // Use host-reported stats so the screen is consistent
                        // across all peers (the guest's mirrored values may
                        // be one tick behind on the wire).
                        if (this.player && evt.stats) {
                            this.player.level = evt.stats.level || this.player.level;
                        }
                        if (typeof evt.stats?.kills === 'number') this.kills = evt.stats.kills;
                        if (typeof evt.stats?.time === 'number') this.gameTime = evt.stats.time;
                        this.gameOver();
                    }
                }
            });
            // Phase 1.4: guest-side state mirror. Each tick is the host's
            // authoritative view; we copy it into local fields so the HUD
            // and render path keep working unchanged.
            this.mp.onHostTick((state) => this._applyHostTick(state));
            // Phase 1.4: host-side input sink. Stores the latest move vector
            // per guest sid; applied during `_updateRemotePlayers`.
            this.mp.onGuestInput((input) => {
                if (!input || !input.sid) return;
                this.guestInputs.set(input.sid, {
                    vx: clampUnit(input.vx),
                    vy: clampUnit(input.vy)
                });
            });
            // Phase C: host re-broadcasts every guest:event {classPick} so
            // every other peer's waiting-room UI updates live.
            this.mp.onGuestEvent((evt) => {
                if (!evt || !evt.sid) return;
                if (evt.type === 'classPick' && evt.classId) {
                    this._mpClassChoices.set(evt.sid, evt.classId);
                    this._mpLobbyHandle?.refreshClassChoices?.(this._mpClassChoices);
                    if (this.mp.isHost) {
                        this.mp.sendHostEvent({
                            type: 'classPick',
                            sid: evt.sid,
                            classId: evt.classId
                        });
                    }
                }
            });
            // iter-27: live lobby list — render whenever the namespace
            // pushes an updated rooms snapshot.
            this.mp.onRoomsList((rooms) => {
                this._mpLobbyHandle?.renderRooms?.(rooms);
            });
        }

        // Lazy-connect + initial fetch so the list paints on first open.
        try {
            this.mp.connect();
            this.mp.listRooms().then((resp) => {
                if (resp?.ok) lobbyHandle?.renderRooms?.(resp.rooms || []);
            });
        } catch (_e) {
            /* connect errors surface via the disconnect listener */
        }
    }

    _enterMultiplayerWaitingRoom(snap) {
        if (!snap || !snap.roomId) return;
        // Re-emit our local class choice so the host always has the latest
        // picture (covers reconnect + waiting-room re-renders).
        this._broadcastClassChoice(this._mpLocalClassId);
        this._mpLobbyHandle = this.ui.showMultiplayerWaitingRoom(snap, {
            selfSid: this.mp.sid,
            classes: CLASS_ORDER.map((id) => CLASSES[id]),
            classChoices: this._mpClassChoices,
            selectedClassId: this._mpLocalClassId,
            onPickClass: (classId) => {
                this._mpLocalClassId = classId;
                this._mpClassChoices.set(this.mp.sid, classId);
                this._broadcastClassChoice(classId);
            },
            onStart: () => {
                if (!this.mp.isHost) return;
                // Phase 1.4: ship the roster + chosen stage with gameStart
                // so guests can pre-create RemotePlayer entries and we all
                // render the same backdrop. Stage is host-authoritative.
                const members = Array.isArray(snap.members) ? snap.members : this._mpRoster;
                // Phase C: include each member's chosen class so guests
                // apply identical configs in their `start()` flow.
                const classes = {};
                for (const m of members || []) {
                    classes[m.sid] = this._mpClassChoices.get(m.sid) || DEFAULT_CLASS_ID;
                }
                this.mp.sendHostEvent({
                    type: 'gameStart',
                    roomId: snap.roomId,
                    members,
                    stageId: this.save?.settings?.stage || null,
                    classes
                });
                this.mpMode = true;
                this.mpRole = 'host';
                this._mpRoster = Array.isArray(members) ? members.slice() : [];
                this._mpClassMap = classes;
                this.ui.hideMultiplayer();
                this.audio.unlock();
                this.start();
            },
            onLeave: () => {
                this.mp.leaveRoom();
                this.mp.disconnect();
                this.ui.hideMultiplayer();
                this.mpMode = false;
                this.mpRole = null;
                this.remotePlayers.clear();
                this.guestInputs.clear();
                this._mpState = null;
                this._mpClassChoices.clear();
                this.ui.showStart();
            }
        });
    }

    /** Emit the local class pick so other peers (and the host) can mirror it. */
    _broadcastClassChoice(classId) {
        if (!this.mp || !this.mp.connected) return;
        if (this.mp.isHost) {
            // Host sends a host:event so all guests see the host's pick too.
            this.mp.sendHostEvent({ type: 'classPick', sid: this.mp.sid, classId });
        } else {
            // Guests forward via guest:event; the host re-broadcasts to peers.
            this.mp.sendGuestEvent({ type: 'classPick', classId });
        }
    }

    _resize() {
        // iter-27: canvas adapts to the live viewport instead of pinning to
        // the legacy 1200×800 letterboxed frame, and renders at 2× the CSS
        // viewport so players see 2× more of the arena (the camera zooms
        // out without changing entity world sizes). CONFIG.CANVAS_WIDTH and
        // CANVAS_HEIGHT are the single source of truth for camera math,
        // grid drawing, background fill and screen-space effects, so
        // updating both here propagates everywhere automatically.
        const container = document.getElementById('gameContainer');
        if (!container || !this.canvas) return;
        const w = Math.max(320, window.innerWidth);
        const h = Math.max(480, window.innerHeight);
        const ZOOM = 2;
        CONFIG.CANVAS_WIDTH = w * ZOOM;
        CONFIG.CANVAS_HEIGHT = h * ZOOM;
        container.style.width = `${w}px`;
        container.style.height = `${h}px`;
        this.canvas.width = w * ZOOM;
        this.canvas.height = h * ZOOM;
    }

    start() {
        this.state = GameState.PLAYING;
        this.gameTime = 0;
        this.kills = 0;
        this.enemies = [];
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.expOrbs = [];
        this.particles = [];
        this.floatingTexts = [];
        this.mines = [];
        this._bossesSpawned.clear();
        this._bossWarnedAt.clear();
        this._spawnAccumulator = 0;
        this._lastAnnouncedWave = null;
        this._nextSplitIdx = 0;
        // iter-16 bug-bash: clear stale pause-anchor from any prior paused run.
        this._pauseStartedAt = 0;
        // Phase 1.4: reset coop-side bookkeeping so a fresh run starts clean
        // even if the previous coop session left stale entries.
        this.remotePlayers.clear();
        this.guestInputs.clear();
        this._mpHostTickAccum = 0;
        this._mpGuestInputAccum = 0;
        this._mpLastSentInput = { vx: 0, vy: 0 };
        this._mpState = null;

        // Re-derive the stage snapshot at run start. Daily mode pins the
        // stage from the challenge spec; otherwise we honour the saved
        // setting so a stage-picker change between runs takes effect here.
        const stageOverride =
            this.dailyMode && this.dailyChallenge ? this.dailyChallenge.stage : null;
        this.stageId = stageOverride || this.save?.settings?.stage || DEFAULT_STAGE_ID;
        this.stageWaves = getWavesFor(this.stageId);
        this.stageBosses = this._applyDailyBossOffset(getBossesFor(this.stageId));
        this.currentWave = this.stageWaves[0];
        // iter-14: cache the active stage's gameplay modifiers (player speed,
        // enemy HP, cold tick). Looked up here so the per-frame hot path
        // doesn't pay the indirection — `getStageModifiers` walks STAGES.
        this.stageMods = getStageModifiers(this.stageId);
        this._coldTickAccum = 0;

        // Reset per-run achievement state.
        this.achievements.resetRun();
        this.run = this.achievements.run;
        // Seed the fields the v2.4 achievements depend on. Kept here (rather
        // than in AchievementTracker) because these tie together weapons/ui.
        this.run.passivesPicked = 0;
        this.run.maxedWeaponCount = 0;
        this.run.evolvedBefore = {};
        this.run.realSecondsToVoidLord = Infinity;
        this.run.noHitBoss = false;
        this.run.tookAnyDamage = false; // flipped by Player.takeDamage; drives no-hit badge
        this.run.bossFightNoHit = new Set(); // ids of bosses whose fight we've tracked
        this._runStartWallClock = performance.now();
        this.speedrunSplits = [];

        this.player = new Player(
            (CONFIG.ARENA_WIDTH ?? CONFIG.CANVAS_WIDTH) / 2,
            (CONFIG.ARENA_HEIGHT ?? CONFIG.CANVAS_HEIGHT) / 2
        );

        // Phase C: in coop, the chosen class swaps the starter weapon and
        // applies the HP delta. Outside coop we stay on the legacy WHIP.
        let localClassDef = null;
        if (this.mpMode) {
            const selfSid = this.mp?.sid;
            const localClassId =
                this._mpClassMap?.[selfSid] || this._mpLocalClassId || DEFAULT_CLASS_ID;
            localClassDef = getClassById(localClassId);
            this.player.weapons.push(new Weapon(localClassDef.starterWeapon));
            const baseHp = this.player.maxHp;
            this.player.maxHp = Math.max(20, baseHp + (localClassDef.maxHpDelta || 0));
            this.player.hp = this.player.maxHp;
        } else {
            this.player.weapons.push(new Weapon(WEAPONS.WHIP));
        }

        // iter-27: in coop, decorate the local Player with the nickname so
        // it renders the same name label peers see for it. Solo runs leave
        // both fields undefined and the render path skips the overlay.
        if (this.mpMode) {
            const selfSid = this.mp?.sid;
            const meta = this._mpRoster?.find?.((m) => m?.sid === selfSid);
            this.player.nickname = meta?.nickname || this.mp?.nickname || 'Player';
            // Class colour wins over the slot palette so each archetype
            // is recognisable at a glance.
            this.player.nameColor = localClassDef?.color || PEER_COLORS[0];
        } else {
            this.player.nickname = null;
            this.player.nameColor = null;
        }

        // Phase 1.4: in coop mode, seed a RemotePlayer for every other
        // member of the room. The host runs their movement/HP from
        // received inputs; guests overwrite this map every host:tick so
        // the seed here is just a pre-render placeholder.
        if (this.mpMode && Array.isArray(this._mpRoster) && this._mpRoster.length) {
            const cx = (CONFIG.ARENA_WIDTH ?? CONFIG.CANVAS_WIDTH) / 2;
            const cy = (CONFIG.ARENA_HEIGHT ?? CONFIG.CANVAS_HEIGHT) / 2;
            const selfSid = this.mp?.sid;
            let slot = 0;
            for (const m of this._mpRoster) {
                if (!m?.sid || m.sid === selfSid) continue;
                const angle = (slot / Math.max(1, this._mpRoster.length - 1)) * Math.PI * 2;
                // Phase C: pull this peer's class colour + hp delta so the
                // initial render frame matches what the host will broadcast.
                const peerClassId = this._mpClassMap?.[m.sid] || DEFAULT_CLASS_ID;
                const peerClassDef = getClassById(peerClassId);
                const rp = new RemotePlayer({
                    sid: m.sid,
                    nickname: m.nickname || 'Player',
                    color: peerClassDef.color,
                    x: cx + Math.cos(angle) * 60,
                    y: cy + Math.sin(angle) * 60
                });
                rp.maxHp = Math.max(20, 100 + (peerClassDef.maxHpDelta || 0));
                rp.hp = rp.maxHp;
                rp.classId = peerClassId;
                this.remotePlayers.set(m.sid, rp);
                slot++;
            }
        }

        // Snap camera to player at run start so the first frame doesn't show
        // a one-tick lerp from (0,0).
        this._updateCamera();

        this.ui.hideStart();
        this.ui.hideGameOver();
        this.ui.hideLevelUp();
        this.ui.hidePause();

        this.save.runs = (this.save.runs || 0) + 1;
        saveSave(this.save);

        // iter-15: spin up a fresh replay recorder for the new run, unless
        // we're playing back an existing replay. We use a deterministic seed
        // when one is available (speedrun / daily) so playback can recreate
        // identical spawns. Outside those modes, the recorder records the
        // wall-clock seed so replay still mostly reproduces the run, but
        // RNG-driven systems (Math.random) will diverge — documented in
        // docs/USER_GUIDE.md and the CHANGELOG.
        if (!this.replayActive) {
            const seed = this.speedrunRng?.state || Date.now() & 0xffffffff || 1;
            this.replayRecorder = new ReplayRecorder({
                seed,
                stage: this.stageId,
                difficulty: this.save.settings.difficulty || 'normal',
                dt: 1 / 60
            });
        } else {
            this.replayRecorder = null;
        }

        this.audio.unlock();
        this.audio.startMusic();

        this.lastTime = performance.now();
        this._scheduleFrame();
    }

    /**
     * Speedrun mode: deterministic seed, fixed boss timeline (the `spawnAt`
     * fields in data.js are already fixed), real-time millisecond clock,
     * separate leaderboard. We toggle `speedrunMode` before delegating to
     * `start()` so the spawn path can branch on the seeded RNG.
     */
    startSpeedrun() {
        this.speedrunMode = true;
        this.dailyMode = false;
        this.speedrunRng = new SeededRng(CONFIG.SPEEDRUN_SEED);
        this.speedrunStart = performance.now();
        this.start();
        this._announce('스피드런 시작 — 고정 시드.');
    }

    /**
     * Daily challenge: deterministic seed pinned to the UTC date, stage is
     * also pinned (rotates daily), and boss timings are nudged by a per-day
     * offset. Final entry lands in `daily-{date}-{stage}` rather than the
     * regular leaderboard so the global ranks aren't polluted.
     */
    startDaily() {
        this.dailyMode = true;
        this.speedrunMode = false;
        this.dailyChallenge = dailyChallenge();
        // Re-use SeededRng for spawn determinism — same plumbing as speedrun.
        this.speedrunRng = new SeededRng(this.dailyChallenge.seed);
        this.speedrunStart = performance.now();
        this.start();
        this._announce(`일일 챌린지 ${this.dailyChallenge.date} — ${this.stageId}.`);
    }

    /** Apply the daily challenge's bossOffset to a `getBossesFor` result. */
    _applyDailyBossOffset(bosses) {
        if (!this.dailyMode || !this.dailyChallenge?.bossOffset) return bosses;
        const off = this.dailyChallenge.bossOffset;
        return bosses.map((b) => ({ ...b, spawnAt: Math.max(30, b.spawnAt + off) }));
    }

    /** Show the stage picker overlay; persists the choice via `save.settings.stage`. */
    openStagePicker() {
        this.ui.showStagePicker(this.stageId, (newStageId) => {
            this.stageId = newStageId;
            this.save.settings.stage = newStageId;
            saveSave(this.save);
            // Refresh the chip on the main menu Stage button.
            this.ui.updateStageChip(newStageId);
        });
    }

    openStreak() {
        this.ui.showStreak();
    }

    openHowToPlay() {
        this.ui.showHowToPlay(() => {
            this.save.flags = this.save.flags || {};
            this.save.flags.howToSeen = true;
            saveSave(this.save);
        });
    }

    /**
     * iter-15: surface a small "Try Tutorial" prompt above the start menu
     * on first launch. Yes/skip button writes `tutorialDone=true` either way
     * so the prompt never re-appears.
     */
    _offerTutorial() {
        if (typeof document === 'undefined') return;
        if (this.save?.flags?.tutorialDone) return;
        // Ensure the host overlay exists (created lazily so the DOM stays
        // unchanged for users who never trigger it).
        let overlay = document.getElementById('tutorialOffer');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'tutorialOffer';
            overlay.className = 'tutorial-offer';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-live', 'polite');
            overlay.style.display = 'none';
            const container = document.getElementById('gameContainer');
            container?.appendChild(overlay);
        }
        const dismiss = () => {
            overlay.style.display = 'none';
            this.save.flags = this.save.flags || {};
            this.save.flags.tutorialDone = true;
            saveSave(this.save);
        };
        const accept = () => {
            overlay.style.display = 'none';
            this.startTutorialRun();
        };
        // iter-27: outside-click + ✕ button so the offer never wedges on top
        // of the menu when the user wants to ignore it.
        overlay.innerHTML = `
            <div class="overlay-card tutorial-offer-card">
                <button id="tutorialOfferClose" class="overlay-close" aria-label="닫기" title="닫기">✕</button>
                <h2>${_t('tutorialOffer')}</h2>
                <div class="btn-row">
                    <button id="tutorialOfferYes" class="btn primary">${_t('tryTutorial')}</button>
                    <button id="tutorialOfferNo" class="btn ghost">${_t('skipTutorial')}</button>
                </div>
            </div>`;
        overlay.style.display = 'flex';
        overlay.querySelector('#tutorialOfferYes')?.addEventListener('click', accept);
        overlay.querySelector('#tutorialOfferNo')?.addEventListener('click', dismiss);
        overlay.querySelector('#tutorialOfferClose')?.addEventListener('click', dismiss);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) dismiss();
        });
    }

    /**
     * Begin the tutorial: hand the menu off to a normal `start()` then flip
     * the tutorial state on. Esc skips at any point. Once the last step is
     * acknowledged we persist `tutorialDone=true`.
     */
    startTutorialRun() {
        this.tutorial = new TutorialState();
        this.tutorial.start();
        this.audio.unlock();
        this.speedrunMode = false;
        this.dailyMode = false;
        this.start();
        this._renderTutorialBanner();
        // Esc handler that explicitly skips the tutorial. Only fires while
        // the tutorial is active and a step is on screen — once the run is
        // over (success or skip) we detach the listener.
        if (typeof window !== 'undefined') {
            const onKey = (e) => {
                if (!this.tutorial.active) return;
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.tutorial.skip();
                    this._renderTutorialBanner();
                    this.save.flags = this.save.flags || {};
                    this.save.flags.tutorialDone = true;
                    saveSave(this.save);
                    window.removeEventListener('keydown', onKey, true);
                }
            };
            window.addEventListener('keydown', onKey, true);
            this._tutorialKeyHandler = onKey;
        }
    }

    /** Lazily mount + repaint the tutorial banner overlay. */
    _renderTutorialBanner() {
        if (typeof document === 'undefined') return;
        let banner = this._tutorialBanner;
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'tutorialBanner';
            banner.className = 'tutorial-banner';
            banner.setAttribute('aria-live', 'polite');
            const container = document.getElementById('gameContainer');
            container?.appendChild(banner);
            this._tutorialBanner = banner;
        }
        const prompt = this.tutorial.currentPrompt();
        if (!prompt) {
            banner.style.display = 'none';
            // If the tutorial just completed cleanly, persist the flag.
            if (this.tutorial.completed) {
                this.save.flags = this.save.flags || {};
                this.save.flags.tutorialDone = true;
                saveSave(this.save);
                this._announce(_t('tutorialDone'));
            }
            return;
        }
        // iter-27: explicit ✕ button so the banner can be dismissed without
        // pressing Esc — discoverable on touch builds and matches the UX of
        // every other overlay on the page.
        banner.innerHTML = `
            <button class="tutorial-close" aria-label="닫기" title="닫기">✕</button>
            <strong>${prompt.title}</strong>
            <span class="tutorial-body">${prompt.body}</span>
            <span class="tutorial-skip-hint">${_t('tutorialSkipHint')}</span>`;
        banner.style.display = 'block';
        banner.querySelector('.tutorial-close')?.addEventListener('click', () => {
            this._dismissTutorial();
        });
    }

    /**
     * iter-27: cancel the active tutorial — used by the banner close button
     * and any nav-away path that should not leave the banner stuck on screen.
     * Idempotent: safe to call when no tutorial is running.
     */
    _dismissTutorial() {
        if (this.tutorial?.active) {
            this.tutorial.skip();
        }
        this.save.flags = this.save.flags || {};
        this.save.flags.tutorialDone = true;
        saveSave(this.save);
        if (this._tutorialBanner) this._tutorialBanner.style.display = 'none';
        if (typeof window !== 'undefined' && this._tutorialKeyHandler) {
            window.removeEventListener('keydown', this._tutorialKeyHandler, true);
            this._tutorialKeyHandler = null;
        }
    }

    /**
     * iter-27: keep the tutorial banner in sync with the current game state.
     * Called from the render loop — when the player goes to the menu / pause
     * screen / settings / etc., the banner hides automatically. Cheap (style
     * mutation only, no innerHTML).
     */
    _syncTutorialVisibility() {
        const banner = this._tutorialBanner;
        if (!banner) return;
        const promptVisible =
            this.tutorial?.active &&
            this.state === GameState.PLAYING &&
            !!this.tutorial.currentPrompt();
        banner.style.display = promptVisible ? 'block' : 'none';
    }

    /**
     * iter-15: open the replay menu. Loads the most recent saved replay
     * (single-slot) and lets the player pick a 1× / 2× / 4× playback speed.
     * If no replay is saved, surface a friendly note.
     */
    openReplay() {
        const blob = loadReplay();
        this.ui.showReplayMenu(blob, (speed) => {
            if (!blob) return;
            this._beginReplay(blob, speed);
        });
    }

    /**
     * Engage replay playback: build a ReplayPlayer, start the run with the
     * persisted seed/stage/difficulty, and route input through the player.
     */
    _beginReplay(blob, speed) {
        this.replayPlayer = new ReplayPlayer(blob, { speed });
        this.replayActive = true;
        // Pin the same stage + difficulty so spawn determinism holds.
        if (blob.stage) this.save.settings.stage = blob.stage;
        if (blob.difficulty) this.save.settings.difficulty = blob.difficulty;
        // Reuse the speedrun seeding plumbing for spawn determinism. We
        // explicitly toggle off speedrunMode (no leaderboard write) but keep
        // the seeded RNG branch alive by setting `_replaySeededRng`.
        this.speedrunMode = false;
        this.dailyMode = false;
        this.speedrunRng = new SeededRng(blob.seed);
        // Use start() to do the rest of the setup (player, weapons, UI).
        this.start();
        // After start() resets state, force-feed the replay seed back in
        // because start() does not touch speedrunRng outside its modes.
        this.speedrunRng = new SeededRng(blob.seed);
        // Banner the user so they know inputs are disabled.
        this._announce(_t('replayPlaying'));
    }

    /**
     * End an active replay session — called when the player runs out of
     * frames or hits Esc / Quit. Returns the engine to the menu cleanly.
     */
    _endReplay() {
        this.replayActive = false;
        this.replayPlayer = null;
        this.state = GameState.MENU;
        cancelAnimationFrame(this.raf);
        this.audio.stopMusic();
        this.ui.hideGameOver();
        this.ui.showStart();
    }

    togglePause() {
        if (this.state === GameState.PLAYING) {
            this.state = GameState.PAUSED;
            this.ui.showPause();
            this.audio.stopMusic();
            // iter-16 bug-bash: stamp the pause moment so we can subtract the
            // paused duration from the speedrun wall-clock when we resume.
            // Without this, leaderboard timeMs (and split realMs) silently
            // counted seconds spent in the pause menu — penalising players
            // who paused to read a level-up dialog or take a breath.
            this._pauseStartedAt = performance.now();
            // iter-15: tutorial step 5 waits for a pause toggle.
            if (this.tutorial?.active) {
                this.tutorial.notifyPause();
                this._renderTutorialBanner();
            }
        } else if (this.state === GameState.PAUSED) {
            this.state = GameState.PLAYING;
            this.ui.hidePause();
            this.audio.startMusic();
            this.lastTime = performance.now();
            // iter-16 bug-bash: shift the speedrun + run-start anchors forward
            // by however long we were paused so wall-clock readings exclude
            // pause time. Both anchors are floats, so a simple addition keeps
            // the existing `performance.now() - anchor` math correct.
            if (this._pauseStartedAt) {
                const paused = performance.now() - this._pauseStartedAt;
                if (paused > 0 && Number.isFinite(paused)) {
                    if (this.speedrunStart) this.speedrunStart += paused;
                    if (this._runStartWallClock) this._runStartWallClock += paused;
                }
                this._pauseStartedAt = 0;
            }
            this._scheduleFrame();
        }
    }

    gameOver() {
        this.state = GameState.GAMEOVER;
        cancelAnimationFrame(this.raf);
        this.audio.stopMusic();
        this.audio.death();
        // iter-19: long death-knell pattern. Fired once at the moment of
        // game over, before any leaderboard / replay finalisation work.
        this.haptics?.gameOver();

        // Phase 1.5: in coop mode the host broadcasts a single gameOver
        // event so all guests transition together. Guests skip the
        // leaderboard / replay finalisation entirely (this run wasn't
        // authoritative on their machine) and just surface the UI screen.
        if (this.mpMode && this.mpRole === 'host') {
            try {
                this.mp.sendHostEvent({
                    type: 'gameOver',
                    stats: {
                        kills: this.kills,
                        time: this.gameTime,
                        level: this.player?.level || 1
                    }
                });
            } catch (_e) {
                /* ignore — local game-over still proceeds */
            }
        }
        if (this.mpMode && this.mpRole === 'guest') {
            // Guest path: just show the final screen with the mirrored
            // host stats. Skip the heavy persistence work below.
            this.ui.showGameOver(this);
            return;
        }
        // iter-15: snapshot + persist the recorded replay (single slot).
        // We do this before any of the leaderboard / achievement logic so a
        // crash inside those paths never loses the replay. Skipped during
        // playback (no recorder).
        if (this.replayRecorder) {
            try {
                this.replayRecorder.finalize({
                    kills: this.kills,
                    time: this.gameTime,
                    level: this.player?.level || 1
                });
                saveReplay(this.replayRecorder.serialize());
            } catch (err) {
                console.warn('[main] failed to persist replay', err);
            }
            this.replayRecorder = null;
        }

        // Update lifetime "unique builds" counter: a build = the sorted set
        // of weapon ids at death. If we haven't seen this combination before,
        // append it. Hard-cap the array at SEEN_BUILDS_CAP (1000) to keep the
        // save under a reasonable byte budget — older keys roll out FIFO.
        this.save.totals ??= { kills: 0, timePlayed: 0, runs: 0, bossKills: 0 };
        this.save.totals.seenBuilds ??= [];
        const buildKey = this.player.weapons
            .map((w) => w.id)
            .sort()
            .join('+');
        if (buildKey && !this.save.totals.seenBuilds.includes(buildKey)) {
            this.save.totals.seenBuilds.push(buildKey);
            const cap = CONFIG.SEEN_BUILDS_CAP || 1000;
            if (this.save.totals.seenBuilds.length > cap) {
                this.save.totals.seenBuilds.splice(0, this.save.totals.seenBuilds.length - cap);
            }
            this.save.totals.uniqueBuilds = this.save.totals.seenBuilds.length;
        }

        // Final achievement check.
        this.achievements.check(this);
        this._flushAchievementToasts();

        // Record run -------------------------------------------------------
        const weaponIds = this.player.weapons.map((w) => w.id);
        const entry = {
            kills: this.kills,
            timeSurvived: this.gameTime,
            level: this.player.level,
            date: Date.now(),
            weapons: weaponIds,
            // v2.6: stage tag so per-stage leaderboards split correctly.
            stage: this.stageId,
            // Authoritative: was the player hit even once across the whole
            // run? Falls back to the unhit-timer proxy for backwards compat
            // if a custom path bypassed Player.takeDamage.
            noHit: !this.run.tookAnyDamage
        };
        // Daily-mode runs go to the per-day slot rather than the global
        // leaderboard so they don't pollute the speedrun/normal pools.
        if (this.dailyMode && this.dailyChallenge) {
            saveDailyResult({
                ...entry,
                date: this.dailyChallenge.date,
                seed: this.dailyChallenge.seed,
                won: !!this.run.bossesDefeated?.void_lord
            });
        } else {
            recordHighScore(this.save, entry);
        }
        accumulateTotals(this.save, {
            kills: this.kills,
            gameTime: this.gameTime,
            bossKills: Object.keys(this.run.bossesDefeated).length
        });
        saveSave(this.save);

        // Speedrun: write to its own leaderboard, and store the split timeline
        // on the game so the UI can render it in the game-over screen.
        if (this.speedrunMode) {
            const sEntry = {
                timeMs: performance.now() - this.speedrunStart,
                splits: this.speedrunSplits,
                level: this.player.level,
                kills: this.kills,
                date: Date.now(),
                weapons: weaponIds,
                noHit: entry.noHit
            };
            const rank = recordSpeedrunScore(sEntry);
            this._speedrunRank = rank;
            this._speedrunEntry = sEntry;
        }

        this.ui.showGameOver(this);
    }

    openLeaderboard() {
        this.ui.showLeaderboard(this.save.highScores || [], loadSpeedrunScores(), () => {
            /* closed */
        });
    }

    // --- Frame loop -------------------------------------------------------
    _scheduleFrame() {
        this.raf = requestAnimationFrame((t) => this._frame(t));
    }

    _onVisibilityChange() {
        if (typeof document === 'undefined') return;
        if (document.hidden) {
            if (this.state === GameState.PLAYING) {
                this._hiddenPaused = true;
                this.state = GameState.PAUSED;
                this.ui.showPause();
                this.audio.stopMusic();
                // iter-16 bug-bash: track tab-hidden start so when the player
                // hits Resume the speedrun anchor shifts past the hidden
                // window. Mirrors togglePause()'s logic.
                this._pauseStartedAt = performance.now();
            }
        } else if (this._hiddenPaused && this.state === GameState.PAUSED) {
            // Don't auto-resume: leave the pause menu up so the player
            // explicitly opts back in. Just reset the clock to avoid a
            // massive dt when they do click Resume.
            this._hiddenPaused = false;
            this.lastTime = performance.now();
        }
    }

    _frame(now) {
        if (this.state !== GameState.PLAYING && this.state !== GameState.LEVEL_UP) return;
        // Clamp dt so that (a) a paused+resumed tab does not nuke the sim in
        // one step, and (b) frame-rate spikes don't create tunneling bugs.
        const dt = Math.min((now - this.lastTime) / 1000, CONFIG.DT_CLAMP);
        this.lastTime = now;
        // iter-14: pull the gamepad once per frame so axes + button edges
        // are fresh by the time update() reads `getMoveVector`. Safe no-op
        // when no pad is attached.
        this.input.pollGamepad?.();
        if (this.state === GameState.PLAYING) {
            this.update(dt);
        }
        // iter-20: pass the canvas viewport so EffectLayer can recycle
        // off-screen emoji rain drops without reaching back into the DOM.
        this.effects.update(dt, {
            w: this.canvas?.width || CONFIG.CANVAS_WIDTH,
            h: this.canvas?.height || CONFIG.CANVAS_HEIGHT
        });
        this.render(dt);
        this.fpsMeter.tick(dt);
        this.ui.setFps(this.fpsMeter.fps, this.save.settings.showFps);
        this._scheduleFrame();
    }

    update(dt) {
        // Phase 1.4: guests run a thin update — capture local input, push it
        // to the host, and let `_applyHostTick` drive everything else.
        if (this.mpMode && this.mpRole === 'guest') {
            const v = this.input.getMoveVector();
            this._lastMoveVec = { x: v.x, y: v.y };
            this._maybeSendGuestInput(dt, v);
            // Refresh the camera off the puppet `this.player` (its position
            // gets copied from `host:tick` in `_applyHostTick`).
            this.camera.update(dt, this.save.settings.screenShake);
            this._updateCamera();
            // HUD still reflects the mirrored player fields for parity with
            // single-player.
            this.ui.updateHud(this);
            // Phase B: dying alone no longer ends the run — the host owns
            // the gameOver decision and broadcasts a `host:event` once
            // every coop player is down. Guests just stand by while
            // teammates attempt a revive.
            return;
        }

        this.gameTime += dt;

        const { hpMult, dmgMult, diff } = this._computeDifficultyMults();
        this.enemyDmgMult = dmgMult; // used by enemy projectile spawn

        this.currentWave = this._selectWave();

        // iter-15: replay playback drives input by replacing
        // `input.getMoveVector` with the recorded vector for the current
        // frame. We tick the player AFTER this swap; the swap is undone via
        // `input.getMoveVector = original` only when the replay finishes.
        if (this.replayActive && this.replayPlayer) {
            const v = this.replayPlayer.getMoveVector();
            this.input.getMoveVector = () => v;
            this.replayPlayer.tick();
            if (this.replayPlayer.done) {
                // Out of frames: end the replay before computing player update
                // so the run terminates cleanly on the next loop iteration.
                this._endReplay();
                return;
            }
        }

        // iter-15: snapshot the current input so the recorder + tutorial
        // both see the same vector this frame. Reading `getMoveVector`
        // twice would otherwise be cheap but inconsistent under replay.
        const moveSnapshot = this.input.getMoveVector();
        this._lastMoveVec = { x: moveSnapshot.x, y: moveSnapshot.y };
        if (this.replayRecorder && !this.replayActive) {
            this.replayRecorder.record(this._lastMoveVec);
        }
        // Tutorial state-machine tick. Cheap no-op unless active.
        if (this.tutorial?.active) {
            this.tutorial.tick(dt, this._lastMoveVec);
            this._renderTutorialBanner();
        }

        this.player.update(dt, this);
        // Solo path: dead → game over. Coop path: only end if every
        // participant is down (revives can pull the host back up).
        if (this._isCoopGameOver()) {
            this.gameOver();
            return;
        }
        // iter-14: stage modifiers — cold tick (no-op on forest/crypt).
        this._applyColdTick(dt);

        // iter-20: pacifist-provoked timer. Counts up while the player has
        // zero kills; a single kill breaks the streak and forfeits the
        // window for the rest of the run (we cap at 60 + 1 to avoid
        // unbounded float growth and to make the achievement check trivial).
        if (this.run) {
            if (this.kills === 0) {
                if ((this.run.pacifistTimer || 0) < 61) {
                    this.run.pacifistTimer = (this.run.pacifistTimer || 0) + dt;
                }
            }
        }

        // Spatial hash rebuild BEFORE anyone queries it.
        this.spatial.insertAll(this.enemies);

        // Phase 1.4: tick remote players from buffered guest inputs before
        // enemy collision so movement+collision stays in the same frame.
        if (this.mpMode && this.mpRole === 'host') {
            this._updateRemotePlayers(dt);
        }
        this._updateEnemies(dt, hpMult, dmgMult);
        this._updateProjectiles(dt);
        this._updateEnemyProjectiles(dt);
        this._updateMines(dt);
        this._updateExpOrbs(dt);
        this._maybeTriggerLevelUp();
        this._updateParticlesAndText(dt);

        this._spawnLogic(dt, hpMult, dmgMult, diff.spawnMult);

        // Phase 1.4: throttled state broadcast to all guests at ~30 Hz.
        if (this.mpMode && this.mpRole === 'host') {
            this._mpHostTickAccum += dt;
            if (this._mpHostTickAccum >= this._mpHostTickInterval) {
                this._mpHostTickAccum = 0;
                this._sendHostTick();
            }
        }

        // Speedrun splits: push once per threshold as gameTime crosses them.
        if (this.speedrunMode) {
            const thresholds = CONFIG.SPEEDRUN_SPLITS;
            while (
                this._nextSplitIdx < thresholds.length &&
                this.gameTime >= thresholds[this._nextSplitIdx]
            ) {
                const mark = thresholds[this._nextSplitIdx];
                this.speedrunSplits.push({
                    mark,
                    realMs: performance.now() - this.speedrunStart
                });
                this._nextSplitIdx++;
            }
        }

        // Achievement ticks (cheap: most checks short-circuit).
        this.achievements.check(this);
        this._flushAchievementToasts();

        // HUD
        this.ui.updateHud(this);

        // Camera
        this.camera.update(dt, this.save.settings.screenShake);
        this._updateCamera();
    }

    /**
     * Position the camera so the player sits in the centre of the viewport,
     * clamped so the camera never shows arena out-of-bounds. Called every
     * frame from `update()` and once from `start()` to avoid a first-frame
     * snap. Stored on `this.camera.worldX/worldY` (top-left of the viewport
     * in arena coords). Render translates by `-worldX + shake.x` etc.
     */
    _updateCamera() {
        if (!this.player) return;
        const vw = CONFIG.CANVAS_WIDTH;
        const vh = CONFIG.CANVAS_HEIGHT;
        const aw = CONFIG.ARENA_WIDTH ?? vw;
        const ah = CONFIG.ARENA_HEIGHT ?? vh;
        let wx = this.player.x - vw / 2;
        let wy = this.player.y - vh / 2;
        if (wx < 0) wx = 0;
        if (wy < 0) wy = 0;
        if (wx > aw - vw) wx = aw - vw;
        if (wy > ah - vh) wy = ah - vh;
        this.camera.worldX = wx;
        this.camera.worldY = wy;
    }

    // --- update() helpers (kept close to the orchestrator for locality) ---
    _computeDifficultyMults() {
        const diff =
            Difficulty[(this.save.settings.difficulty || 'normal').toUpperCase()] ||
            Difficulty.NORMAL;
        const timeDiff = 1 + Math.floor(this.gameTime / 60) * 0.3;
        // Stage modifier folds into hpMult at the source so every spawn path
        // (waves, splitter children, bosses) inherits the +20% on tundra
        // without each call site reaching back into stages.js.
        const stageHpMult = this.stageMods?.enemyHpMult ?? 1;
        return {
            diff,
            hpMult: diff.hpMult * timeDiff * stageHpMult,
            dmgMult: diff.dmgMult * timeDiff
        };
    }

    /**
     * iter-14: tundra cold tick. Drains 1 HP every `coldTickInterval` seconds
     * (default 10) on stages that opt in. Skipped on stages with
     * `coldTickInterval == 0` (forest, crypt). Bypasses i-frames and armor on
     * purpose — it's an attrition mechanic, not damage — and never kills the
     * player outright (clamps at 1 HP) so death is always attributable to a
     * real hit.
     */
    _applyColdTick(dt) {
        const mods = this.stageMods;
        if (!mods || !mods.coldTickInterval) return;
        if (!this.player || this.player.dead) return;
        this._coldTickAccum += dt;
        while (this._coldTickAccum >= mods.coldTickInterval) {
            this._coldTickAccum -= mods.coldTickInterval;
            const dmg = mods.coldTickDamage || 1;
            // Drain HP without going through takeDamage so we don't refresh
            // i-frames or trigger the no-hit invalidation (cold is ambient).
            const next = Math.max(1, this.player.hp - dmg);
            if (next < this.player.hp) {
                this.player.hp = next;
                this.createFloatingText(`-${dmg}❄`, this.player.x, this.player.y - 36, '#88ccff');
            }
        }
    }

    _updateEnemies(dt, hpMult, dmgMult) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt, this);

            const dx = e.x - this.player.x;
            const dy = e.y - this.player.y;
            const d = Math.hypot(dx, dy);
            if (d < e.size + this.player.size && !this.player.invincible) {
                this.player.takeDamage(e.damage, this);
                this.createFloatingText(
                    Math.round(e.damage),
                    this.player.x,
                    this.player.y - 30,
                    '#ff3333'
                );
            }

            // Phase 1.4: remote players take damage on contact too. We don't
            // route through Player.takeDamage (no shake/haptics for peers)
            // so the host UX isn't muddied by peer hits.
            if (this.mpMode && this.mpRole === 'host') {
                for (const rp of this.remotePlayers.values()) {
                    if (rp.dead) continue;
                    const rdx = e.x - rp.x;
                    const rdy = e.y - rp.y;
                    const rd = Math.hypot(rdx, rdy);
                    if (rd < e.size + rp.size && !rp.invincible) {
                        rp.takeDamage(e.damage);
                        this.createFloatingText(
                            Math.round(e.damage),
                            rp.x,
                            rp.y - 30,
                            '#ff8866'
                        );
                    }
                }
            }

            if (e.hp <= 0) {
                this._onEnemyKilled(e, hpMult, dmgMult);
                this.enemies.splice(i, 1);
                continue;
            }

            if (d > CONFIG.DESPAWN_RADIUS && !e.boss) {
                this.enemies.splice(i, 1);
            }
        }
    }

    _onEnemyKilled(e, hpMult, dmgMult) {
        this.kills++;
        this.createParticles(e.x, e.y, e.color, e.boss ? 40 : 8);
        this.effects.hit(e.x, e.y, this._rgbFromHex(e.color));
        this.dropExp(e.x, e.y, e.expValue);
        if (e.boss) {
            this.shake(0.5);
            this.audio.explosion();
            this.achievements.onBossDefeated(e.id);
            this._announce(`${e.name || e.id.replace('_', ' ')} 처치`);
            // Mark no-hit-boss if the player's unhit streak is longer than
            // the fight itself. We use the unhit timer (seconds without
            // damage) as a cheap proxy; any damage during the fight resets it.
            if (this.player.unhitTimer >= 8) this.run.noHitBoss = true;
            // Speedrun: record wall-clock seconds until each boss.
            if (e.id === 'void_lord') {
                this.run.realSecondsToVoidLord =
                    (performance.now() - this._runStartWallClock) / 1000;
            }
            // iter-20: hidden Speedrunner Plus achievement. Any boss kill in
            // under 5 minutes wall-clock counts. The pause anchor inside
            // `togglePause` keeps `_runStartWallClock` honest, so a player
            // can't pad the timer by sitting in the pause menu.
            if (this._runStartWallClock) {
                const realSec = (performance.now() - this._runStartWallClock) / 1000;
                if (realSec < 300) this.run.fastBossClear = true;
            }
        }
        if (e.splitter && e.type.splitInto) {
            const childDef = findEnemyDef(e.type.splitInto);
            if (childDef) {
                const n = e.type.splitCount || 2;
                for (let k = 0; k < n; k++) {
                    const a = (k / n) * Math.PI * 2;
                    this.enemies.push(
                        new Enemy(
                            e.x + Math.cos(a) * 14,
                            e.y + Math.sin(a) * 14,
                            childDef,
                            hpMult,
                            dmgMult
                        )
                    );
                }
            }
        }
        this.audio.hit();
    }

    _updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt, this);
            if (p.shouldRemove) {
                this.projectiles.splice(i, 1);
                continue;
            }

            const range = p.size + 32;
            for (const enemy of this.spatial.queryRect(p.x, p.y, range)) {
                if (p.hitEnemies.has(enemy)) continue;
                const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                if (d < enemy.size + p.size) {
                    let dmg = p.damage;
                    const chance = this.player.getCritChance();
                    const crit = chance > 0 && Math.random() < chance;
                    if (crit) dmg *= 2;
                    enemy.takeDamage(dmg);
                    p.hitEnemies.add(enemy);
                    if (enemy.hp > 0) {
                        this.createFloatingText(
                            Math.round(dmg),
                            enemy.x,
                            enemy.y - 20,
                            crit ? '#ffee44' : '#fff',
                            { crit }
                        );
                    }
                    // iter-15 polish: brief red flash on critical hits, opt-out
                    // via Settings → criticalFlash. Suppressed when reduced
                    // motion is on so it never overrides accessibility.
                    if (
                        crit &&
                        this.save.settings.criticalFlash !== false &&
                        !this.save.settings.reducedMotion
                    ) {
                        this.effects.criticalHit();
                    }
                    this.effects.hit(enemy.x, enemy.y);
                    if (!p.piercing) {
                        p._onEnd(this);
                        p.shouldRemove = true;
                        break;
                    }
                }
            }
        }
    }

    _updateEnemyProjectiles(dt) {
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const ep = this.enemyProjectiles[i];
            ep.update(dt, this);
            if (ep.shouldRemove) this.enemyProjectiles.splice(i, 1);
        }
    }

    _updateMines(dt) {
        for (let i = this.mines.length - 1; i >= 0; i--) {
            const m = this.mines[i];
            m.update(dt, this);
            if (m.shouldRemove) this.mines.splice(i, 1);
        }
    }

    _updateExpOrbs(dt) {
        // iter-15: snapshot the orb-collected counter before the per-frame
        // update so we can fire `tutorial.notifyOrbPickup()` on the rising
        // edge. ExpOrb.update bumps `game.run.orbsCollected`; comparing the
        // two values is cheaper than wrapping ExpOrb.
        const before = this.run?.orbsCollected || 0;
        for (let i = this.expOrbs.length - 1; i >= 0; i--) {
            const o = this.expOrbs[i];
            o.update(dt, this);
            if (o.shouldRemove) this.expOrbs.splice(i, 1);
        }
        if (this.tutorial?.active) {
            const after = this.run?.orbsCollected || 0;
            for (let k = 0; k < after - before; k++) {
                this.tutorial.notifyOrbPickup();
            }
            if (after !== before) this._renderTutorialBanner();
        }
    }

    _maybeTriggerLevelUp() {
        if (this._pendingLevelUps > 0 && this.state === GameState.PLAYING) {
            this._pendingLevelUps--;
            this.state = GameState.LEVEL_UP;
            this.audio.levelUp();
            this.effects.levelUp(this.player.x, this.player.y);
            // iter-19: ascending-ramp vibration. Distinct shape from the
            // hurt single-pulse and the boss triple so the player can
            // tell what just happened from the haptic alone.
            this.haptics?.levelUp();
            this._announce(`레벨 ${this.player.level}! 강화를 선택하세요.`);
            // iter-15: notify the tutorial state machine — its "level up"
            // step waits for exactly this event.
            if (this.tutorial?.active) {
                this.tutorial.notifyLevelUp();
                this._renderTutorialBanner();
            }
            this.ui.showLevelUp(this.player, (choice) => this._applyUpgrade(choice));
        }
    }

    _updateParticlesAndText(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const part = this.particles[i];
            part.update(dt);
            if (part.life <= 0) {
                this.pools.particle.release(part);
                this.particles.splice(i, 1);
            }
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.update(dt);
            if (ft.life <= 0) {
                this.pools.floatingText.release(ft);
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    /** Broadcast a short message to screen readers via the a11y live region. */
    _announce(msg) {
        if (typeof document === 'undefined') return;
        const el = document.getElementById('a11yLiveRegion');
        if (!el) return;
        // Toggle textContent to force SR re-announce if the message repeats.
        el.textContent = '';
        // Microtask flush before writing so ATs pick up the change.
        Promise.resolve().then(() => {
            el.textContent = msg;
        });
    }

    // ---------- Phase 1.4: host-authoritative coop sync ------------------
    /** Host: drive each RemotePlayer with its latest buffered guest input. */
    _updateRemotePlayers(dt) {
        for (const rp of this.remotePlayers.values()) {
            const inp = this.guestInputs.get(rp.sid);
            if (inp) {
                rp.vx = inp.vx;
                rp.vy = inp.vy;
            }
            rp.tick(dt, this);
        }
        this._processRevives(dt);
    }

    /** Build a flat list of every coop participant (host + remotes). */
    _allCoopPlayers() {
        const list = [];
        if (this.player) list.push(this.player);
        for (const rp of this.remotePlayers.values()) list.push(rp);
        return list;
    }

    /**
     * iter-27 / Phase B: drive the coop revive gauge. For each downed
     * player, accumulate `reviveTimer` while *any* live ally is within
     * REVIVE_DISTANCE; if no ally is close, decay it back so an
     * interrupted revive doesn't carry across kills. Crossing the
     * threshold restores the player at REVIVE_HP_PCT of max HP and
     * grants a brief I-frame window so they don't immediately re-die.
     */
    _processRevives(dt) {
        const all = this._allCoopPlayers();
        if (all.length < 2) return; // no peers => nobody can revive
        const reviveDist = CONFIG.REVIVE_DISTANCE;
        const reviveTime = CONFIG.REVIVE_TIME;
        for (const p of all) {
            if (!p.dead) continue;
            let helper = null;
            for (const q of all) {
                if (q === p || q.dead) continue;
                const dx = q.x - p.x;
                const dy = q.y - p.y;
                if (Math.hypot(dx, dy) <= reviveDist) {
                    helper = q;
                    break;
                }
            }
            if (helper) {
                p.reviveTimer = (p.reviveTimer || 0) + dt;
                if (p.reviveTimer >= reviveTime) {
                    p.dead = false;
                    p.reviveTimer = 0;
                    p.hp = Math.max(1, Math.floor(p.maxHp * CONFIG.REVIVE_HP_PCT));
                    p.invincible = true;
                    p.invincibleTimer = CONFIG.REVIVE_INVINCIBILITY;
                    // Tiny floating note so the helper sees the revive land.
                    this.createFloatingText(
                        '↑',
                        p.x,
                        p.y - 36,
                        '#7af0c2'
                    );
                }
            } else if (p.reviveTimer > 0) {
                // Decay slowly when nobody is helping so a long-distance
                // ally can still finish a near-complete revive.
                p.reviveTimer = Math.max(0, p.reviveTimer - dt * 0.5);
            }
        }
    }

    /**
     * Solo: gameOver as soon as the host player dies.
     * Coop: gameOver only when *every* participant is down.
     */
    _isCoopGameOver() {
        if (!this.mpMode) return !!this.player?.dead;
        const all = this._allCoopPlayers();
        if (all.length === 0) return false;
        return all.every((p) => p.dead);
    }

    /**
     * Host: build the canonical state snapshot and broadcast it. Payload is
     * intentionally compact (short keys, only the fields renderers need) so
     * the wire stays light at 30 Hz × 4 peers.
     */
    _sendHostTick() {
        if (!this.mp || !this.player) return;
        const players = [];
        // Host's own avatar (sid = host's socket id).
        players.push({
            sid: this.mp.sid,
            x: this.player.x,
            y: this.player.y,
            hp: this.player.hp,
            mhp: this.player.maxHp,
            lvl: this.player.level,
            inv: !!this.player.invincible,
            dead: !!this.player.dead,
            // Phase B: ship revive progress so guests render the ally gauge.
            rt: this.player.reviveTimer || 0
        });
        for (const rp of this.remotePlayers.values()) {
            players.push({
                sid: rp.sid,
                x: rp.x,
                y: rp.y,
                hp: rp.hp,
                mhp: rp.maxHp,
                lvl: rp.level,
                inv: !!rp.invincible,
                dead: !!rp.dead,
                rt: rp.reviveTimer || 0
            });
        }
        const enemies = new Array(this.enemies.length);
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            enemies[i] = {
                id: e.id,
                x: e.x,
                y: e.y,
                hp: e.hp,
                mhp: e.maxHp,
                sz: e.size,
                b: e.boss ? 1 : 0
            };
        }
        const orbs = new Array(this.expOrbs.length);
        for (let i = 0; i < this.expOrbs.length; i++) {
            const o = this.expOrbs[i];
            orbs[i] = { x: o.x, y: o.y, sz: o.size };
        }
        // Phase A: include the player projectiles + enemy projectiles so
        // guests see attacks landing. We send only the visible-render fields
        // (id for sprite key, x/y, size) — gameplay is host-authoritative
        // so the guest never simulates these.
        const projectiles = new Array(this.projectiles.length);
        for (let i = 0; i < this.projectiles.length; i++) {
            const p = this.projectiles[i];
            projectiles[i] = { id: p.id || p.def?.id, x: p.x, y: p.y, sz: p.size, a: p.angle };
        }
        const enemyProjectiles = new Array(this.enemyProjectiles.length);
        for (let i = 0; i < this.enemyProjectiles.length; i++) {
            const ep = this.enemyProjectiles[i];
            enemyProjectiles[i] = { x: ep.x, y: ep.y, sz: ep.size };
        }
        this.mp.sendHostTick({
            t: this.gameTime,
            k: this.kills,
            wave: this.currentWave?.label || '',
            players,
            enemies,
            orbs,
            proj: projectiles,
            ep: enemyProjectiles
        });
    }

    /**
     * Guest: take a host snapshot and shape it into renderable form. We
     * reuse `Enemy`/`ExpOrb` shapes loosely — the renderer just reads
     * `x/y/size` etc, so plain objects with the same fields work.
     */
    _applyHostTick(state) {
        if (!state) return;
        this._mpState = state;
        this.gameTime = state.t || 0;
        this.kills = state.k || 0;
        // UI reads .label, so wrap the host's flat label string accordingly.
        if (typeof state.wave === 'string') {
            this.currentWave = { label: state.wave };
        }
        // Mirror the local player off the host's authoritative state so HUD
        // (HP bar, level badge) reflects what the host sees.
        const selfSid = this.mp?.sid;
        const me = state.players?.find?.((p) => p.sid === selfSid);
        if (me && this.player) {
            this.player.x = me.x;
            this.player.y = me.y;
            this.player.hp = me.hp;
            this.player.maxHp = me.mhp;
            this.player.level = me.lvl || 1;
            this.player.invincible = !!me.inv;
            this.player.dead = !!me.dead;
            this.player.reviveTimer = me.rt || 0;
        }
        // Rebuild remotePlayers from the snapshot so newly joined peers
        // appear automatically and dropped peers disappear.
        const seen = new Set();
        let slot = 0;
        for (const p of state.players || []) {
            if (!p.sid || p.sid === selfSid) continue;
            seen.add(p.sid);
            let rp = this.remotePlayers.get(p.sid);
            // Phase 1.5: resolve nickname against the roster captured at
            // gameStart so peer labels show real names rather than sid hex.
            const meta = this._mpRoster?.find?.((m) => m?.sid === p.sid);
            const niceName = meta?.nickname || `Player`;
            // Phase C: prefer the class colour over the slot palette so a
            // glance at the avatar tells you who's playing what archetype.
            const classId = this._mpClassMap?.[p.sid];
            const classDef = classId ? getClassById(classId) : null;
            const peerColor = classDef?.color || PEER_COLORS[(slot + 1) % PEER_COLORS.length];
            if (!rp) {
                rp = new RemotePlayer({
                    sid: p.sid,
                    nickname: niceName,
                    color: peerColor,
                    x: p.x,
                    y: p.y
                });
                this.remotePlayers.set(p.sid, rp);
            } else {
                if (meta?.nickname && rp.nickname !== niceName) rp.nickname = niceName;
                if (rp.color !== peerColor) rp.color = peerColor;
            }
            rp.x = p.x;
            rp.y = p.y;
            rp.hp = p.hp;
            rp.maxHp = p.mhp;
            rp.level = p.lvl || 1;
            rp.invincible = !!p.inv;
            rp.dead = !!p.dead;
            rp.reviveTimer = p.rt || 0;
            slot++;
        }
        for (const sid of [...this.remotePlayers.keys()]) {
            if (!seen.has(sid)) this.remotePlayers.delete(sid);
        }
    }

    /**
     * Guest: push our latest move vector to the host. Only emit when it
     * changes meaningfully OR on a heartbeat (~30 Hz) so a held key still
     * survives a packet loss.
     */
    _maybeSendGuestInput(dt, v) {
        if (!this.mp || !this.mp.isGuest) return;
        this._mpGuestInputAccum += dt;
        const cx = clampUnit(v.x);
        const cy = clampUnit(v.y);
        const last = this._mpLastSentInput;
        const changed = Math.abs(cx - last.vx) > 0.05 || Math.abs(cy - last.vy) > 0.05;
        if (!changed && this._mpGuestInputAccum < this._mpHostTickInterval) return;
        this._mpGuestInputAccum = 0;
        this._mpLastSentInput = { vx: cx, vy: cy };
        this.mp.sendGuestInput({ vx: cx, vy: cy });
    }

    _applyUpgrade(choice) {
        if (choice) {
            if (choice.type === 'weapon') {
                const existing = this.player.weapons.find((w) => w.id === choice.data.id);
                if (existing) {
                    const prevLvl = existing.level;
                    existing.levelUp();
                    if (existing.level >= CONFIG.WEAPON_MAX_LEVEL) {
                        this.achievements.onWeaponMaxed();
                        // Track how many distinct weapons have been maxed this run.
                        if (prevLvl < CONFIG.WEAPON_MAX_LEVEL) {
                            this.run.maxedWeaponCount = (this.run.maxedWeaponCount || 0) + 1;
                        }
                    }
                    // Early-Evolve achievement: fire when the weapon actually
                    // crosses into its evolution tier before 7:00.
                    if (
                        existing.def.evolveLevel &&
                        prevLvl < existing.def.evolveLevel &&
                        existing.level >= existing.def.evolveLevel &&
                        this.gameTime < CONFIG.EARLY_EVOLVE_THRESHOLD
                    ) {
                        this.run.evolvedBefore = this.run.evolvedBefore || {};
                        this.run.evolvedBefore.sevenMin = true;
                    }
                } else {
                    this.player.weapons.push(new Weapon(choice.data));
                }
            } else {
                this.player.passives[choice.data.id] ??= { def: choice.data, count: 0 };
                if (this.player.passives[choice.data.id].count < CONFIG.PASSIVE_MAX_STACK) {
                    this.player.passives[choice.data.id].count++;
                    this.player.recalculateStats();
                    this.run.passivesPicked = (this.run.passivesPicked || 0) + 1;
                }
            }
        }
        this.ui.hideLevelUp();
        this.state = GameState.PLAYING;
        this.lastTime = performance.now();
    }

    _selectWave() {
        const t = this.gameTime;
        const list = this.stageWaves && this.stageWaves.length ? this.stageWaves : WAVES;
        let match = list[list.length - 1];
        for (const w of list) {
            if (t >= w.from && t < w.to) {
                match = w;
                break;
            }
        }
        if (this._lastAnnouncedWave !== match.label) {
            this._lastAnnouncedWave = match.label;
        }
        return match;
    }

    _spawnLogic(dt, hpMult, dmgMult, diffSpawnMult) {
        const wave = this.currentWave;
        const waveMult = wave.spawnMult || 1;
        const maxEnemies = Math.min(CONFIG.MAX_ENEMIES, 20 + Math.floor(this.gameTime / 10));
        const interval = Math.max(0.2, 1.2 - this.gameTime / 200) / (diffSpawnMult * waveMult);
        this._spawnAccumulator += dt;

        while (this._spawnAccumulator >= interval && this.enemies.length < maxEnemies) {
            this._spawnAccumulator -= interval;
            this._spawnOne(wave.pool, hpMult, dmgMult);
        }

        // Boss triggers (warning 5s before). Use the per-stage boss list so
        // stage-specific timing overrides (e.g. crypt's earlier Reaper) fire.
        const bossList =
            this.stageBosses && this.stageBosses.length ? this.stageBosses : Object.values(BOSSES);
        for (const boss of bossList) {
            const warnAt = boss.spawnAt - 5;
            if (this.gameTime >= warnAt && !this._bossWarnedAt.has(boss.id)) {
                this._bossWarnedAt.add(boss.id);
                this.audio.bossWarn();
            }
            if (this.gameTime >= boss.spawnAt && !this._bossesSpawned.has(boss.id)) {
                this._bossesSpawned.add(boss.id);
                this._spawnBoss(boss, hpMult, dmgMult);
            }
        }
    }

    _spawnOne(pool, hpMult, dmgMult) {
        // Speedrun + Daily both want determinism; either uses speedrunRng.
        const rng =
            (this.speedrunMode || this.dailyMode) && this.speedrunRng ? this.speedrunRng : null;
        const frnd = rng ? () => rng.nextFloat() : Math.random;
        // pickWeighted honours the active stage's poolOverrides; with default
        // stage (forest) all weights are 1 so it degrades to a uniform pick.
        const pick =
            pickWeighted(pool, this.stageId, frnd) || pool[Math.floor(frnd() * pool.length)];
        const type = findEnemyDef(pick) || ENEMIES.BAT;
        const angle = frnd() * Math.PI * 2;
        const dist = CONFIG.SPAWN_RADIUS + frnd() * 120;
        const x = this.player.x + Math.cos(angle) * dist;
        const y = this.player.y + Math.sin(angle) * dist;
        this.enemies.push(new Enemy(x, y, type, hpMult, dmgMult));
    }

    _spawnBoss(bossDef, hpMult, dmgMult) {
        const angle = Math.random() * Math.PI * 2;
        const d = CONFIG.SPAWN_RADIUS * 0.8;
        const x = this.player.x + Math.cos(angle) * d;
        const y = this.player.y + Math.sin(angle) * d;
        this.enemies.push(new Enemy(x, y, bossDef, hpMult, dmgMult));
        this.ui.showBossBanner();
        this.audio.bossSpawn();
        this.effects.bossSpawn();
        // iter-15 polish: bump boss-spawn camera shake by +50% (0.8 → 1.2).
        // The reduced-motion gate inside `shake()` still applies so
        // accessibility users are unaffected.
        this.shake(1.2);
        // iter-19: triple-pulse vibration so the player feels the warning
        // even with audio off / sleeve-pocket play.
        this.haptics?.bossSpawn();
        this._announce(`보스 등장: ${bossDef.name || bossDef.id}`);
    }

    _flushAchievementToasts() {
        const toasts = this.achievements.takeToasts();
        for (const ach of toasts) {
            this.ui.showAchievementToast(ach);
            this.audio.achievement();
            this.effects.achievement();
            this._announce(`업적 달성: ${ach.name}. ${ach.description}`);
            // iter-20: harmless emoji-rain celebration the first time the
            // player crosses the 15-minute Survivor threshold. We trigger
            // off the achievement-just-unlocked event rather than polling
            // the save flag so a returning player who already has the
            // achievement doesn't get rained on every run.
            if (ach.id === 'survive_15min') {
                const w = this.canvas?.width || CONFIG.CANVAS_WIDTH;
                const h = this.canvas?.height || CONFIG.CANVAS_HEIGHT;
                this.effects.celebrate(w, h);
            }
        }
    }

    _rgbFromHex(hex) {
        // Accept '#rrggbb' and return 'r,g,b' for effects layer.
        if (!hex || hex[0] !== '#') return '255,255,255';
        const n = parseInt(hex.slice(1), 16);
        return `${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff}`;
    }

    // --- Helpers ----------------------------------------------------------
    dropExp(x, y, amount) {
        this.expOrbs.push(new ExpOrb(x, y, amount));
    }
    createParticles(x, y, color, n) {
        if (this.save.settings.reducedMotion) n = Math.min(n, 2);
        for (let i = 0; i < n; i++) {
            this.particles.push(this.pools.particle.acquire(x, y, color));
        }
    }
    createFloatingText(text, x, y, color, opts) {
        if (this.save.settings.reducedMotion) return;
        // damageNumbers toggle (default on). Backwards-compatible: an older
        // save without the field still gets numbers because we treat
        // `undefined` as on.
        if (this.save.settings.damageNumbers === false) return;
        this.floatingTexts.push(this.pools.floatingText.acquire(text, x, y, color, opts || {}));
    }
    shake(amount) {
        // Reduced-motion users get no camera shake even if the setting is on.
        const prm =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (this.save.settings.screenShake && !prm && !this.save.settings.reducedMotion) {
            this.camera.shake(amount);
        }
    }

    // called by Player via takeDamage
    onPlayerHurt(_amount) {
        this.audio.damage();
        this.shake(0.25);
        // iter-19: short single-pulse vibration. No-ops on platforms without
        // navigator.vibrate or when the user has switched it off.
        this.haptics?.hurt();
    }

    onBossAbility(boss) {
        if (boss.ability === 'summon') {
            const childDef = findEnemyDef('skeleton');
            for (let i = 0; i < 3; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = 80;
                this.enemies.push(
                    new Enemy(boss.x + Math.cos(a) * r, boss.y + Math.sin(a) * r, childDef, 2, 1.5)
                );
            }
            this.createParticles(boss.x, boss.y, '#aa33ff', 20);
        } else if (boss.ability === 'charge') {
            const dx = this.player.x - boss.x;
            const dy = this.player.y - boss.y;
            const d = Math.hypot(dx, dy) || 1;
            boss.x += (dx / d) * 120;
            boss.y += (dy / d) * 120;
            this.createParticles(boss.x, boss.y, '#ff3366', 15);
        }
    }

    // --- Rendering --------------------------------------------------------
    render(_dt) {
        // iter-27: keep the tutorial banner in sync each frame so leaving
        // PLAYING (pause / settings / menu) hides it without per-route hooks.
        this._syncTutorialVisibility();
        const ctx = this.ctx;
        // 1) Background fill in screen space (no transform). This guarantees
        //    the viewport is always cleared even when the camera sits flush
        //    against an arena edge and a sliver would otherwise be unfilled.
        const bg = getBackgroundFor(this.stageId);
        ctx.fillStyle = bg.fill;
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // 2) World-space pass: translate by -camera + shake so entity coords
        //    (which live in arena space) project into the viewport.
        ctx.save();
        ctx.translate(-this.camera.worldX + this.camera.x, -this.camera.worldY + this.camera.y);

        this._drawGrid();

        if (this.mpMode && this.mpRole === 'guest') {
            // Phase 1.4: render whatever the host most recently sent. We
            // intentionally skip projectiles/particles/effects — those are
            // tightly coupled to host-side weapons and not part of the
            // 1.4 wire format. Phase 1.5 expands the snapshot.
            this._renderGuestState(ctx);
        } else {
            for (const o of this.expOrbs) o.render(ctx);
            for (const m of this.mines) m.render(ctx);
            this._renderEnemies(ctx);
            if (this.player) {
                this.player.render(ctx);
                // Orbit shards live on the weapon, so render per-weapon extras here.
                for (const w of this.player.weapons) w.renderExtras?.(ctx);
            }
            // Phase 1.4: peers come right after the local avatar so they
            // visually sit at the same depth.
            if (this.mpMode && this.mpRole === 'host') {
                for (const rp of this.remotePlayers.values()) rp.render(ctx);
            }
            for (const p of this.projectiles) p.render(ctx);
            for (const ep of this.enemyProjectiles) ep.render(ctx);
            for (const p of this.particles) p.render(ctx);
            for (const t of this.floatingTexts) t.render(ctx);
        }

        ctx.restore();

        // 3) Screen-space effects (flash, pulses, vignette) on top — these
        //    render relative to the viewport, not the world.
        this.effects.render(ctx, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    }

    /**
     * Phase 1.4: render the host's most recently received state for guests.
     * Plain orbs / coloured circles are used for entities that don't carry
     * their full sprite metadata over the wire — Phase 1.5 promotes the
     * snapshot to include enemy sprite keys so the visual matches the host.
     */
    _renderGuestState(ctx) {
        const state = this._mpState;
        if (!state) return;
        // Exp orbs first (visual depth: ground)
        for (const o of state.orbs || []) {
            if (drawSprite(ctx, 'expOrb', o.x, o.y, { size: o.sz })) continue;
            ctx.save();
            const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, (o.sz || 6) * 2.2);
            g.addColorStop(0, 'rgba(100,180,255,0.55)');
            g.addColorStop(1, 'rgba(100,180,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(o.x, o.y, (o.sz || 6) * 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#7ab8ff';
            ctx.beginPath();
            ctx.arc(o.x, o.y, o.sz || 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        // Enemies — try sprite by id, fall back to a coloured blob with HP.
        for (const e of state.enemies || []) {
            const drewSprite = drawSprite(ctx, `enemy:${e.id}`, e.x, e.y, { size: e.sz });
            if (!drewSprite) {
                ctx.save();
                ctx.fillStyle = e.b ? '#ff3333' : '#aa3344';
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.sz || 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            // Cheap HP bar (small enemies only when damaged).
            if (e.mhp && e.hp < e.mhp) {
                const pct = Math.max(0, e.hp / e.mhp);
                const w = 30;
                ctx.fillStyle = '#222';
                ctx.fillRect(e.x - w / 2, e.y - (e.sz || 12) - 10, w, 3);
                ctx.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa33' : '#ff4444';
                ctx.fillRect(e.x - w / 2, e.y - (e.sz || 12) - 10, w * pct, 3);
            }
        }
        // Local player (mirrored from host) + every peer in the snapshot.
        if (this.player) this.player.render(ctx);
        for (const rp of this.remotePlayers.values()) rp.render(ctx);
        // Phase A: player projectiles — sprite-by-id when available, otherwise
        // a coloured blob so the attack at least registers visually.
        for (const p of state.proj || []) {
            const drewSprite = p.id
                ? drawSprite(ctx, `projectile:${p.id}`, p.x, p.y, {
                      size: p.sz || 8,
                      rotate: typeof p.a === 'number' ? p.a : false
                  })
                : false;
            if (!drewSprite) {
                ctx.save();
                ctx.fillStyle = '#ffe082';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.sz || 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
        // Phase A: enemy projectiles — tinted pink dot like host renders.
        for (const ep of state.ep || []) {
            const drewSprite = drawSprite(ctx, 'enemyProjectile', ep.x, ep.y, {
                size: ep.sz || 6
            });
            if (!drewSprite) {
                ctx.save();
                ctx.fillStyle = '#ff44aa';
                ctx.beginPath();
                ctx.arc(ep.x, ep.y, ep.sz || 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.beginPath();
                ctx.arc(ep.x, ep.y, (ep.sz || 6) * 0.45, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }

    /**
     * Draw enemies using the cached offscreen sprite when available. Bosses
     * and flashing enemies still go through the full per-frame path because
     * their visuals include HP bars and hit-flash highlights that the cached
     * bitmap cannot reproduce. This cuts per-enemy drawing calls from ~4
     * (gradient + two arcs + fill) to a single drawImage for the common case.
     */
    _renderEnemies(ctx) {
        for (const e of this.enemies) {
            if (e.boss || e.flashTimer > 0 || e.shielded) {
                e.render(ctx);
                continue;
            }
            // iter-26: prefer registered image asset when available; falls
            // back to the offscreen bitmap cache, then to the full per-frame
            // path. The HP-bar overlay is shared so any visual stays consistent.
            const spriteKey = `enemy:${e.id}`;
            let drewBody = false;
            if (hasSprite(spriteKey)) {
                drewBody = drawSprite(ctx, spriteKey, e.x, e.y, { size: e.size });
            }
            if (!drewBody) {
                const sprite = getEnemySprite(e.type, e.size);
                if (sprite) {
                    ctx.drawImage(sprite, e.x - sprite.width / 2, e.y - sprite.height / 2);
                    drewBody = true;
                }
            }
            if (!drewBody) {
                e.render(ctx);
                continue;
            }
            // Cheap HP bar (sprites can't reflect current HP on their own).
            const pct = Math.max(0, e.hp / e.maxHp);
            if (pct < 1) {
                const w = 30;
                ctx.fillStyle = '#222';
                ctx.fillRect(e.x - w / 2, e.y - e.size - 10, w, 3);
                ctx.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa33' : '#ff4444';
                ctx.fillRect(e.x - w / 2, e.y - e.size - 10, w * pct, 3);
            }
        }
    }

    /**
     * Draws a faint grid in arena/world space. Because we're inside the
     * world-space transform (-camera + shake) we can just iterate from
     * the first grid line >= camera.worldX to the last one <= worldX+vw,
     * which auto-clips to the visible region without any per-frame guess.
     */
    _drawGrid() {
        const ctx = this.ctx;
        const alpha = (getBackgroundFor(this.stageId).gridAlpha ?? 0.04).toFixed(3);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1;
        const size = CONFIG.GRID_SIZE;
        const cx = this.camera.worldX;
        const cy = this.camera.worldY;
        const vw = CONFIG.CANVAS_WIDTH;
        const vh = CONFIG.CANVAS_HEIGHT;
        const startX = Math.floor(cx / size) * size;
        const startY = Math.floor(cy / size) * size;
        for (let x = startX; x <= cx + vw; x += size) {
            ctx.beginPath();
            ctx.moveTo(x, cy);
            ctx.lineTo(x, cy + vh);
            ctx.stroke();
        }
        for (let y = startY; y <= cy + vh; y += size) {
            ctx.beginPath();
            ctx.moveTo(cx, y);
            ctx.lineTo(cx + vw, y);
            ctx.stroke();
        }
    }

    openAchievements() {
        this.ui.showAchievements(this.save.achievements || {}, () => {
            /* closed */
        });
    }

    // --- Settings ---------------------------------------------------------
    openSettings() {
        this.ui.showSettings(
            this.save.settings,
            (key, value) => {
                this.save.settings[key] = value;
                saveSave(this.save);
                if (key === 'masterVolume' || key === 'sfxVolume' || key === 'musicVolume')
                    this.audio.applyVolumes();
                if (key === 'musicEnabled') this.audio.toggleMusic(value);
                // iter-14: re-apply CSS custom properties when the touch
                // button scale changes so the player sees the buttons
                // resize live without reloading the page.
                if (key === 'touchButtonScale') this._applyTouchScale();
            },
            () => {
                /* closed */
            },
            () => {
                resetSave();
                this.save = loadSave();
                this.achievements = new AchievementTracker(this.save);
                this.run = this.achievements.run;
                this.audio.applyVolumes();
                this.ui.hideSettings();
            },
            {
                // iter-19: only render the vibration row when the host
                // actually has the API; the UI hides it otherwise so it
                // isn't a dead control.
                vibrationSupported: this.haptics?.isSupported() ?? false,
                onRemap: () => this.openRemap()
            }
        );
    }

    // --- Keymap remap -----------------------------------------------------
    /**
     * iter-19: open the Customize Controls dialog. Saves the new keymap to
     * localStorage and re-arms the input manager so the rebind takes effect
     * on the next keystroke.
     */
    openRemap() {
        this.ui.showRemap(
            this.keymap,
            (next) => {
                this.keymap = next;
                this.input.setKeymap(next);
                saveKeymap(next);
            },
            () => {
                /* closed; settings panel stays open behind */
            }
        );
    }
}

// Level-up batching. Called from gainExp via Player; we patch Player here to notify.
const origGainExp = Player.prototype.gainExp;
Player.prototype.gainExp = function (amount) {
    const ups = origGainExp.call(this, amount);
    if (ups.length && window.__vsGame) {
        window.__vsGame._pendingLevelUps = (window.__vsGame._pendingLevelUps || 0) + ups.length;
    }
    return ups;
};

// Bootstrap
export function boot() {
    const g = new Game();
    window.__vsGame = g;
    // Dev-only debug hooks. Gated on hostname so they never fire on the
    // GitHub Pages build; the smoke harness loads from localhost so it
    // does. Used by scripts/runtime-smoke.js to fast-forward to bosses,
    // force a level-up, and trigger game-over without having to actually
    // play 5 minutes per scene.
    const isDev =
        typeof location !== 'undefined' &&
        (location.hostname === 'localhost' ||
            location.hostname === '127.0.0.1' ||
            location.hostname === '');
    if (isDev) {
        window.__SURV_DEBUG__ = {
            /** Fast-forward simulated game time. Triggers everything that's
             * gated on `gameTime`: wave director, boss spawns, difficulty
             * scaling. Spawn accumulator follows along so a chunk of enemies
             * appears proportionate to the elapsed window. */
            advance(seconds = 30) {
                if (!g.player || g.state !== 'playing') return false;
                g.gameTime += seconds;
                // Keep the spawn director from emptying its bag in one frame.
                g._spawnAccumulator = 0;
                return true;
            },
            /** Push enough XP that the next update() flushes one level-up. */
            grantLevel(n = 1) {
                if (!g.player) return false;
                for (let i = 0; i < n; i++) g.player.gainExp(g.player.expToNext + 1);
                return true;
            },
            /** Knock the player to 1 HP so the next enemy hit ends the run. */
            killPlayer() {
                if (!g.player) return false;
                g.player.hp = 0;
                g.player.dead = true;
                return true;
            },
            /** Spawn the named boss right now (skipping its scheduled time). */
            spawnBoss(id) {
                const def = Object.values(BOSSES).find((b) => b.id === id);
                if (!def) return false;
                g._spawnBoss(def, 1, 1);
                g._bossesSpawned.add(def.id);
                return true;
            }
        };
    }
    return g;
}

// Re-export for any external script that needs the catalogue.
export { ACHIEVEMENTS, WAVES };

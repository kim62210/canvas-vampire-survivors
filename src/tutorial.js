/**
 * @module tutorial
 * @description Iter-15 first-launch tutorial. A 5-step state machine that
 * walks new players through the core verbs:
 *   1. move          — register WASD / arrow / joystick input
 *   2. autoAttack    — observe a weapon swing once
 *   3. pickupExp     — collect at least one XP orb
 *   4. levelUp       — pick an upgrade on the level-up screen
 *   5. pause         — open the pause menu
 *
 * The state machine is intentionally pure: it owns no DOM. The host UI
 * renders the prompt via `currentPrompt()` and forwards observed events to
 * `notify(eventName)` / `notifyMove(vec)` / `notifyOrbPickup()` etc. The
 * sequence advances when the per-step `done()` predicate returns true.
 *
 * Persistence: the host saves `save.flags.tutorialDone = true` once the last
 * step is acknowledged, so returning players never see the offer again.
 *
 * Dependencies: none (pure logic; testable in Node).
 *
 * Exports:
 *   - TUTORIAL_STEPS   ordered step list (id, prompt, doneOn)
 *   - TutorialState    class
 */

export const TUTORIAL_STEPS = [
    {
        id: 'move',
        title: '1 / 5 단계 — 이동',
        body: '왼쪽 아래 조이스틱을 드래그하거나 WASD/방향키로 영웅을 움직이세요.',
        // Counted as done once the player has held a non-zero move vector for
        // ~0.4 s of game time. Prevents a stuck-key from advancing instantly.
        thresholdSeconds: 0.4
    },
    {
        id: 'autoAttack',
        title: '2 / 5 단계 — 자동 공격',
        body: '직접 공격하지 않아도 됩니다. 적 가까이로 이동하면 무기가 알아서 발사돼요.',
        thresholdSeconds: 1.5
    },
    {
        id: 'pickupExp',
        title: '3 / 5 단계 — 경험치 획득',
        body: '적을 처치하면 초록색 경험치 구슬이 떨어져요. 그 위로 이동해 경험치를 얻으세요.',
        thresholdOrbs: 1
    },
    {
        id: 'levelUp',
        title: '4 / 5 단계 — 레벨업',
        body: '경험치 바를 채우면 강화 메뉴가 열려요. 하나를 고르면 한 판 내내 유지됩니다.',
        thresholdLevelUps: 1
    },
    {
        id: 'pause',
        title: '5 / 5 단계 — 일시정지',
        body: '우상단 ⏸ 버튼 또는 P/Esc 키로 일시정지할 수 있어요. 한 번 눌러 튜토리얼을 마칩니다.',
        thresholdPauses: 1
    }
];

export class TutorialState {
    /**
     * @param {object} [opts]
     * @param {boolean} [opts.active=false]   start disabled until host opts in
     */
    constructor(opts = {}) {
        this.active = !!opts.active;
        this.stepIndex = 0;
        // Per-step counters, reset each transition.
        this._moveSeconds = 0;
        this._autoAttackSeconds = 0;
        this._orbsPicked = 0;
        this._levelUps = 0;
        this._pauses = 0;
        this.completed = false;
        this.skipped = false;
    }

    /** Activate the state machine — call once when the player accepts. */
    start() {
        this.active = true;
        this.stepIndex = 0;
        this.completed = false;
        this.skipped = false;
        this._resetCounters();
    }

    /** Permanently end the tutorial without finishing every step. */
    skip() {
        if (!this.active) return;
        this.active = false;
        this.skipped = true;
    }

    /** Cleanly finish the tutorial — host should persist `tutorialDone=true`. */
    finish() {
        if (!this.active) return;
        this.active = false;
        this.completed = true;
    }

    _resetCounters() {
        this._moveSeconds = 0;
        this._autoAttackSeconds = 0;
        this._orbsPicked = 0;
        this._levelUps = 0;
        this._pauses = 0;
    }

    get currentStep() {
        if (!this.active) return null;
        return TUTORIAL_STEPS[this.stepIndex] || null;
    }

    /** Convenience for the renderer — `{ title, body }` or `null`. */
    currentPrompt() {
        const step = this.currentStep;
        if (!step) return null;
        return { id: step.id, title: step.title, body: step.body };
    }

    /**
     * Advance to the next step, calling `finish()` after the last. Returns
     * the new step id (or null when finished). Exposed so a host can force
     * progression in tests / when an external event already proves the
     * objective is complete.
     */
    advance() {
        if (!this.active) return null;
        this.stepIndex++;
        this._resetCounters();
        if (this.stepIndex >= TUTORIAL_STEPS.length) {
            this.finish();
            return null;
        }
        return TUTORIAL_STEPS[this.stepIndex].id;
    }

    /** Per-frame tick. `dt` in seconds; `moveVec` is the player's input. */
    tick(dt, moveVec) {
        if (!this.active) return;
        const step = this.currentStep;
        if (!step) return;
        switch (step.id) {
            case 'move': {
                if (moveVec && (Math.abs(moveVec.x) > 0.05 || Math.abs(moveVec.y) > 0.05)) {
                    this._moveSeconds += dt;
                    if (this._moveSeconds >= step.thresholdSeconds) this.advance();
                }
                break;
            }
            case 'autoAttack': {
                // The host calls this every frame the player has at least one
                // weapon firing. We just accumulate gameplay time so a player
                // not yet near an enemy doesn't get rushed past the prompt.
                this._autoAttackSeconds += dt;
                if (this._autoAttackSeconds >= step.thresholdSeconds) this.advance();
                break;
            }
            // The remaining steps wait for explicit notifications (orb,
            // level-up, pause). Tick is a no-op for them.
            default:
                break;
        }
    }

    /** Notify the state machine that the player picked up an XP orb. */
    notifyOrbPickup() {
        if (!this.active) return;
        const step = this.currentStep;
        if (!step) return;
        if (step.id !== 'pickupExp') return;
        this._orbsPicked++;
        if (this._orbsPicked >= step.thresholdOrbs) this.advance();
    }

    /** Notify the machine of a level-up event. */
    notifyLevelUp() {
        if (!this.active) return;
        const step = this.currentStep;
        if (!step) return;
        if (step.id !== 'levelUp') return;
        this._levelUps++;
        if (this._levelUps >= step.thresholdLevelUps) this.advance();
    }

    /** Notify the machine that the player toggled pause. */
    notifyPause() {
        if (!this.active) return;
        const step = this.currentStep;
        if (!step) return;
        if (step.id !== 'pause') return;
        this._pauses++;
        if (this._pauses >= step.thresholdPauses) this.advance();
    }

    /** Total number of steps (handy for "x / N" labels in the UI). */
    static get TOTAL_STEPS() {
        return TUTORIAL_STEPS.length;
    }
}
